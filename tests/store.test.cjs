const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require(join(process.env.BC_TEST_BUILD, 'store.js'));
const { validateDrafts, toCsv, validDate, today, exportFilename, snapshotForDevice } = require(join(process.env.BC_TEST_BUILD, 'model.js'));

class Adapter {
  constructor(filename = ':memory:') { this.raw = new DatabaseSync(filename); }
  async execAsync(sql) { this.raw.exec(sql); }
  async runAsync(sql, ...params) { return this.raw.prepare(sql).run(...params); }
  async getFirstAsync(sql, ...params) { return this.raw.prepare(sql).get(...params) ?? null; }
  async getAllAsync(sql, ...params) { return this.raw.prepare(sql).all(...params); }
  async withExclusiveTransactionAsync(fn) {
    this.raw.exec('BEGIN IMMEDIATE');
    try { await fn(this); this.raw.exec('COMMIT'); } catch (e) { this.raw.exec('ROLLBACK'); throw e; }
  }
}
const profile = { userId: 'usuario-1', userName: 'Coletor de teste', deviceId: 'aparelho-1', cycle: '2026', block: 'Teste' };
const draft = (changes = {}) => ({ rowId: randomUUID(), date: '2026-10-24', quantity: '12', purpose: 'EMASC', observation: '', ...changes });
async function make(db = new Adapter(), uuid = randomUUID) { const store = new Store(db, uuid); await store.initialize(); return { db, store }; }

test('zero é válido; vazio não vira contagem; datas impossíveis e duplicadas são recusadas', () => {
  assert.equal(validateDrafts(profile, '1', [draft({ quantity: '0' }), draft({ quantity: '', purpose: 'POLI' })], ['1']).length, 1);
  assert.throws(() => validateDrafts(profile, '1', [draft({ quantity: '' })], ['1']));
  for (const quantity of ['-1', '1.5', '1e2', 'abc', '100001']) assert.throws(() => validateDrafts(profile, '1', [draft({ quantity })], ['1']));
  assert.throws(() => validateDrafts(profile, '1', [draft(), draft()], ['1']));
  assert.throws(() => validateDrafts(profile, '999', [draft()], ['1']));
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2028-02-29'), true);
  assert.equal(today(new Date(2026, 9, 24, 23, 59)), '2026-10-24');
});
test('salvar novamente não duplica; correção mantém ID e cria uma revisão', async () => {
  const { db, store } = await make();
  assert.equal(await store.save(profile, '1', [draft()], ['1']), 1);
  const first = (await store.all())[0];
  assert.equal(await store.save(profile, '1', [draft()], ['1']), 0);
  await store.save(profile, '1', [draft({ quantity: '0', observation: 'Revisado' })], ['1']);
  const rows = await store.all();
  assert.equal(rows.length, 1); assert.equal(rows[0].record_id, first.record_id);
  assert.equal(rows[0].version, 2); assert.equal(rows[0].quantity, 0); assert.equal(rows[0].created_at, first.created_at);
  assert.equal((await db.getAllAsync('SELECT * FROM revisions')).length, 2); db.raw.close();
});
test('datas, baldes, finalidades e safras independentes não se sobrescrevem', async () => {
  const { db, store } = await make();
  await store.save(profile, '1', [draft(), draft({ purpose: 'POLI' }), draft({ date: '2026-10-25' })], ['1', '2']);
  await store.save(profile, '2', [draft()], ['1', '2']);
  await store.save({ ...profile, cycle: '2027' }, '1', [draft()], ['1']);
  assert.equal((await store.all()).length, 5); db.raw.close();
});
test('falha na segunda avaliação reverte o lote inteiro', async () => {
  const { db, store } = await make(new Adapter(), () => 'id-repetido');
  await assert.rejects(store.save(profile, '1', [draft(), draft({ purpose: 'POLI' })], ['1']));
  assert.equal((await store.all()).length, 0); assert.equal((await db.getAllAsync('SELECT * FROM revisions')).length, 0); db.raw.close();
});
test('dados e identidade persistem após fechar e reabrir SQLite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-sqlite-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename));
    await first.store.setProfile(profile); await first.store.save(profile, '1', [draft()], ['1']); first.db.raw.close();
    const second = await make(new Adapter(filename));
    assert.deepEqual(await second.store.getProfile(), profile); assert.equal((await second.store.all()).length, 1); second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('exportação acumulada preserva unicode, delimitadores, aspas e novas linhas', async () => {
  const { db, store } = await make();
  await store.save(profile, '1', [draft({ observation: 'Observação; "revisar"\namanhã' })], ['1']);
  const csv = toCsv(await store.all());
  assert.ok(csv.startsWith('\ufeffNome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Prioridade;Nome do usuário;Data de criação;Device ID'));
  assert.ok(csv.includes('"Observação; ""revisar""\namanhã"')); assert.ok(csv.includes('"24/10/2026";"Emasculação";"12"'));
  assert.ok(csv.includes('Prioridade;Nome do usuário;Data de criação;Device ID'));
  assert.equal(exportFilename(profile), 'REGISTRO_BC_aparelho-1.csv');
  assert.equal(exportFilename({ ...profile, userName: 'Outro usuário' }), exportFilename(profile));
  assert.notEqual(exportFilename({ ...profile, deviceId: 'aparelho-2' }), exportFilename(profile)); db.raw.close();
});

test('último catálogo substitui navegação sem apagar coletas e preserva vínculo legado', async () => {
  const { db, store } = await make();
  await store.setProfile(profile);
  await store.mergeCatalog([{ cycle: '2026', block: 'Teste', bucket: '1' }]);
  await store.save(profile, '1', [draft()], ['1']);
  const next = await store.replaceCatalog([{ cycle: '', block: 'Teste', bucket: '2' }, { cycle: '', block: 'Novo', bucket: '3' }], 'ultimo.xlsx');
  assert.equal(next.find(e => e.block === 'Teste').cycle, '2026');
  assert.ok(!next.some(e => e.bucket === '1')); assert.equal((await store.all()).length, 1);
  assert.equal(await store.setting('catalogSource', ''), 'ultimo.xlsx'); db.raw.close();
});

test('rascunho incompleto sobrevive ao reinício e não substitui uma avaliação válida por vazio', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-autosave-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename));
    await first.store.setProfile(profile);
    const sheet = await first.store.loadSheet(profile, '1');
    sheet[0].date = '2026-10-24'; sheet[4].date = '2026-10-24'; sheet[0].quantity = '17';
    assert.equal(await first.store.saveSheet(profile, '1', sheet, ['1']), null);
    sheet[0].quantity = '';
    assert.match(await first.store.saveSheet(profile, '1', sheet, ['1']), /quantidade/);
    first.db.raw.close();
    const second = await make(new Adapter(filename));
    const recovered = await second.store.loadSheet(profile, '1');
    assert.equal(recovered[0].quantity, '');
    assert.equal((await second.store.all()).find(r => r.purpose === 'EMASC').quantity, 17);
    recovered[0].quantity = '0'; await second.store.saveSheet(profile, '1', recovered, ['1']);
    assert.equal((await second.store.all()).length, 2);
    assert.equal((await second.store.all()).find(r => r.purpose === 'EMASC').quantity, 0);
    second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('oito posições preservadas, duas linhas visíveis por padrão e datas sugeridas', async () => {
  const { db, store } = await make();
  const sheet = await store.loadSheet(profile, '1'); assert.equal(sheet.length, 8); assert.deepEqual(await store.getRowCounts(profile), { EMASC: 2, POLI: 2 });
  assert.ok(sheet.every(r => r.quantity === '0'));
  assert.equal((await store.all()).length, 0);
  sheet[0].date = '2026-10-26'; sheet[1].date = '2026-10-27'; sheet[4].date = '2026-10-28';
  await store.saveSheet(profile, '1', sheet, ['1', '2']);
  const next = await store.loadSheet(profile, '2');
  assert.deepEqual(next.filter(r => r.date).map(r => r.date), sheet.filter(r => r.date).map(r => r.date));
  assert.ok(next.every(r => r.quantity === '0')); assert.equal((await store.all()).length, 3);
  assert.ok((await store.all()).every(r => r.bucket === '1')); db.raw.close();
});

test('troca de usuário mantém a coleta em andamento e reutiliza o destino do aparelho', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  const sheet = await store.loadSheet(profile, '1'); sheet[0].date = '2026-10-24'; sheet[0].quantity = '19';
  await store.saveSheet(profile, '1', sheet, ['1']);
  const other = await store.selectUser('Outro coletor');
  assert.notEqual(other.userId, profile.userId); assert.equal(other.deviceId, profile.deviceId);
  const fresh = await store.loadSheet(other, '1'); assert.equal(fresh[0].quantity, '0');
  await store.saveSheet(other, '1', fresh, ['1']);
  const restored = await store.selectUser('coletor de teste'); assert.equal(restored.userId, profile.userId);
  const resumed = await store.loadSheet(restored, '1');
  assert.equal(resumed[0].date, '2026-10-24'); assert.equal(resumed[0].quantity, '19');
  assert.equal((await store.all()).find(r => r.user_id === profile.userId).quantity, 19);
  assert.equal((await store.users()).length, 2);
  await store.setSetting('outputDevice', { kind: 'folder', uri: 'content://test/pasta' });
  await store.selectUser(other.userName);
  assert.equal((await store.setting('outputDevice', null)).uri, 'content://test/pasta'); db.raw.close();
});

test('CSV do aparelho inclui todos os usuários e exclui outro aparelho', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  await store.save(profile, '1', [draft()], ['1']);
  const other = await store.selectUser('Maria');
  const sheet = await store.loadSheet(other, '1'); sheet[0].date = '2026-10-24'; sheet[0].quantity = '6';
  await store.saveSheet(other, '1', sheet, ['1']);
  const rows = await store.all();
  const snapshot = snapshotForDevice(profile, [...rows, { ...rows[0], device_id: 'aparelho-2', user_name: 'Outro aparelho' }]);
  assert.equal(snapshot.records.length, 2); assert.ok(snapshot.csv.includes('"Maria"')); assert.ok(snapshot.csv.includes('"Coletor de teste"'));
  assert.ok(!snapshot.csv.includes('Outro aparelho')); assert.equal(snapshot.filename, exportFilename(other)); db.raw.close();
});

test('exportação concluída limpa datas e campos de todos os baldes sem modificar o histórico', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  const sheet = await store.loadSheet(profile, '1'); sheet[0].date = '2026-10-24'; sheet[0].quantity = '18'; sheet[0].observation = 'PASSADA';
  await store.saveSheet(profile, '1', sheet, ['1', '2']);
  const second = await store.loadSheet(profile, '2'); second[0].quantity = '3'; await store.saveSheet(profile, '2', second, ['1', '2']);
  const exported = await store.all(); await store.completeExport(exported);
  for (const bucket of ['1', '2']) {
    const fresh = await store.loadSheet(profile, bucket);
    assert.ok(fresh.every(r => r.date === '' && r.quantity === '0' && r.observation === ''));
    await store.saveSheet(profile, bucket, fresh, ['1', '2']);
  }
  assert.deepEqual(await store.all(), exported);
  await assert.rejects(store.saveSheet(profile, '1', sheet, ['1', '2']), /rodada/); db.raw.close();
});

test('nova rodada na mesma data guarda nova avaliação sem substituir a anterior; reexportar não duplica', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  const first = await store.loadSheet(profile, '1'); first[0].date = '2026-10-24'; first[0].quantity = '14';
  await store.saveSheet(profile, '1', first, ['1']); await store.completeExport(await store.all());
  const second = await store.loadSheet(profile, '1');
  const { changeSheetDate } = require(join(process.env.BC_TEST_BUILD, 'collection.js'));
  const dated = changeSheetDate(second, second[0].rowId, '2026-10-24', await store.all(), profile, '1');
  assert.equal(dated[0].quantity, '0'); dated[0].quantity = '2';
  await store.saveSheet(profile, '1', dated, ['1']);
  assert.deepEqual((await store.all()).map(r => r.quantity).sort((a,b) => a-b), [2,14]);
  const snapshot = await store.all(); await store.completeExport(snapshot); await store.completeExport(snapshot);
  assert.deepEqual(await store.all(), snapshot); db.raw.close();
});

test('rodada limpa persiste após reabrir o banco e exportação antiga não apaga mudanças novas', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-reset-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename)); await first.store.setProfile(profile);
    const sheet = await first.store.loadSheet(profile, '1'); sheet[0].date = '2026-10-24'; sheet[0].quantity = '11';
    await first.store.saveSheet(profile, '1', sheet, ['1']); const old = await first.store.all();
    sheet[0].quantity = '12'; await first.store.saveSheet(profile, '1', sheet, ['1']);
    await assert.rejects(first.store.completeExport(old), /alterações posteriores/);
    assert.equal((await first.store.loadSheet(profile, '1'))[0].quantity, '12');
    await first.store.completeExport(await first.store.all()); first.db.raw.close();
    const second = await make(new Adapter(filename));
    assert.ok((await second.store.loadSheet(profile, '1')).every(r => r.date === '' && r.quantity === '0' && r.observation === ''));
    assert.equal((await second.store.all())[0].quantity, 12); second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('excluir usuário ativo remove identificação e lista, preserva dispositivo e coletas no CSV', async () => {
  const { db, store } = await make(); await store.setProfile(profile); await store.save(profile, '1', [draft()], ['1']);
  const next = await store.deleteUser(profile.userId);
  assert.equal(next.userName, ''); assert.notEqual(next.userId, profile.userId); assert.equal(next.deviceId, profile.deviceId);
  assert.equal((await store.users()).length, 0); assert.equal((await store.all()).length, 1);
  assert.ok(snapshotForDevice(next, await store.all()).csv.includes('Coletor de teste'));
  const recreated = await store.selectUser(profile.userName);
  assert.notEqual(recreated.userId, profile.userId); assert.ok((await store.loadSheet(recreated, '1')).every(r => r.date === ''));
  db.raw.close();
});

test('excluir outro usuário não troca usuário ativo nem apaga suas avaliações', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  const other = await store.selectUser('Maria'); await store.save(other, '1', [draft()], ['1']);
  await store.selectUser(profile.userName);
  const next = await store.deleteUser(other.userId);
  assert.equal(next.userId, profile.userId); assert.deepEqual((await store.users()).map(u => u.userId), [profile.userId]);
  assert.equal((await store.all())[0].user_name, 'Maria'); db.raw.close();
});

test('falha de gravação externa preserva formulário, histórico e estado de exportação', async () => {
  const { exportDevice } = require(join(process.env.BC_TEST_BUILD, 'export-flow.js'));
  const { db, store } = await make(); await store.setProfile(profile);
  const sheet = await store.loadSheet(profile, '1'); sheet[0].date = '2026-10-24'; sheet[0].quantity = '16'; sheet[0].observation = 'VEGETATIVO';
  await store.saveSheet(profile, '1', sheet, ['1']); const before = await store.all();
  await assert.rejects(exportDevice(store, profile, async () => { throw new Error('Destino sem acesso'); }), /Destino sem acesso/);
  assert.deepEqual(await store.loadSheet(profile, '1'), sheet); assert.deepEqual(await store.all(), before);
  assert.equal((await store.exportState(before)).pending, 1);
  const written = []; await exportDevice(store, profile, async rows => { written.push(...rows); });
  assert.deepEqual(written, before); assert.equal((await store.exportState(before)).pending, 0);
  assert.ok((await store.loadSheet(profile, '1')).every(r => r.date === '' && r.quantity === '0' && r.observation === ''));
  db.raw.close();
});

test('CSV mantém histórico de datas e protege textos interpretáveis como fórmulas', async () => {
  const { db, store } = await make();
  const sheet = await store.loadSheet(profile, '1'); sheet[0].date = '2026-10-24'; sheet[0].observation = '=1+1';
  await store.saveSheet(profile, '1', sheet, ['1']);
  sheet[0].date = '2026-10-25'; sheet[0].quantity = '9';
  await store.saveSheet(profile, '1', sheet, ['1']);
  const rows = await store.all();
  assert.equal(rows.filter(r => r.purpose === 'EMASC').length, 2);
  assert.ok(toCsv(rows).includes('"\'=1+1"')); db.raw.close();
});
test('uma correção posterior à geração do CSV continua pendente', async () => {
  const { db, store } = await make(); await store.save(profile, '1', [draft()], ['1']);
  const snapshot = await store.all(); await store.save(profile, '1', [draft({ quantity: '3' })], ['1']);
  await store.markExport(snapshot); assert.equal((await store.exportState(await store.all())).pending, 1);
  await store.markExport(await store.all()); assert.equal((await store.exportState(await store.all())).pending, 0); db.raw.close();
});

test('prioridade mantém a última escolha por bloco e balde após nova coleta e reinício', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-priority-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename));
    await first.store.setProfile(profile);
    assert.equal(await first.store.getPriority(profile, '1'), false);
    await first.store.setPriority(profile, '1', true);
    await first.store.setPriority(profile, '2', true);
    await first.store.setPriority(profile, '2', false);
    assert.equal(await first.store.getPriority({ ...profile, block: 'Outro' }, '1'), false);
    assert.equal(await first.store.getPriority({ ...profile, cycle: '2027' }, '1'), false);
    const sheet = await first.store.loadSheet(profile, '2'); sheet[0].date = '2026-10-26'; sheet[0].quantity = '8';
    await first.store.saveSheet(profile, '2', sheet, ['1', '2']);
    assert.equal(await first.store.setting('activeBucket', ''), '2');
    await first.store.completeExport(await first.store.all());
    assert.equal(await first.store.setting('activeBucket', ''), '');
    assert.ok((await first.store.loadSheet(profile, '1')).every(r => r.date === '' && r.quantity === '0' && r.observation === ''));
    first.db.raw.close();
    const second = await make(new Adapter(filename));
    assert.equal(await second.store.getPriority(profile, '1'), true);
    assert.equal(await second.store.getPriority(profile, '2'), false);
    assert.equal(await second.store.setting('activeBucket', ''), '');
    const other = await second.store.selectUser('Maria');
    assert.equal(await second.store.getPriority(other, '1'), true);
    assert.equal(await second.store.getPriority(other, '2'), false);
    const next = await second.store.loadSheet(other, '1'); next[0].date = '2026-10-26';
    await second.store.saveSheet(other, '1', next, ['1', '2']);
    assert.equal((await second.store.all()).find(r => r.user_id === other.userId).priority, true);
    second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('CSV acrescenta somente Prioridade e usa a última escolha para todas as linhas do balde', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  await store.save(profile, '1', [draft(), draft({ purpose: 'POLI' })], ['1']);
  const legacy = (await store.all())[0]; delete legacy.priority;
  assert.equal(toCsv([legacy]).split('\r\n')[1].split(';')[6], '"NÃO"');
  const before = await store.all();
  await store.setPriority(profile, '1', true);
  const prioritized = await store.all();
  assert.ok(prioritized.every(r => r.priority === true && r.version === 2));
  assert.deepEqual(prioritized.map(r => r.record_id), before.map(r => r.record_id));
  assert.deepEqual(prioritized.map(r => r.created_at), before.map(r => r.created_at));
  const csv = toCsv(prioritized).split('\r\n');
  assert.equal(csv[0], '\ufeffNome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Prioridade;Nome do usuário;Data de criação;Device ID');
  assert.ok(csv.slice(1, -1).every(row => row.split(';')[6] === '"SIM"' && row.split(';').length === 10));
  assert.equal(csv[1].split(';')[7], '"Coletor de teste"');
  assert.equal(csv[1].split(';')[8], `"${prioritized[0].created_at}"`);
  assert.equal(csv[1].split(';')[9], '"aparelho-1"');
  await assert.rejects(store.completeExport(before), /alterações posteriores/);
  await store.setPriority(profile, '1', true);
  assert.ok((await store.all()).every(r => r.version === 2));
  await store.completeExport(await store.all());
  await store.setPriority(profile, '1', false);
  assert.ok((await store.all()).every(r => r.priority === false && r.version === 3));
  assert.ok(toCsv(await store.all()).split('\r\n').slice(1,-1).every(row => row.split(';')[6] === '"NÃO"'));
  assert.equal((await db.getAllAsync('SELECT * FROM revisions')).length, 6);
  db.raw.close();
});

test('falha ao revisar prioridade reverte tanto o botão quanto as avaliações', async () => {
  const { db, store } = await make();
  await store.save(profile, '1', [draft(), draft({ purpose: 'POLI' })], ['1']);
  const before = await store.all();
  await db.execAsync("CREATE TRIGGER fail_priority BEFORE INSERT ON revisions WHEN NEW.version = 2 BEGIN SELECT RAISE(ABORT, 'falha de escrita'); END;");
  await assert.rejects(store.setPriority(profile, '1', true), /falha de escrita/);
  assert.equal(await store.getPriority(profile, '1'), false);
  assert.deepEqual(await store.all(), before);
  db.raw.close();
});

test('balde visitado em branco recebe últimas datas sem apagar avaliações existentes ou substituir a sugestão', async () => {
  const { db, store } = await make();
  const empty = await store.loadSheet(profile, '2');
  await store.saveSheet(profile, '2', empty, ['1', '2', '3']);
  const first = await store.loadSheet(profile, '1'); first[0].date = '2026-10-26'; first[0].quantity = '12';
  const { sheetDates } = require(join(process.env.BC_TEST_BUILD, 'collection.js'));
  await store.saveSheet(profile, '1', first, ['1', '2', '3'], sheetDates(first));
  const second = await store.loadSheet(profile, '2');
  assert.equal(second[0].date, '2026-10-26'); assert.equal(second[0].quantity, '0');
  second[0].date = '2026-10-27'; second[0].quantity = '8';
  await store.saveSheet(profile, '2', second, ['1', '2', '3'], sheetDates(second));
  const old = await store.loadSheet(profile, '1');
  assert.equal(old[0].date, '2026-10-26'); assert.equal(old[0].quantity, '12');
  await store.saveSheet(profile, '1', old, ['1', '2', '3']);
  const next = await store.loadSheet(profile, '3');
  assert.equal(next[0].date, '2026-10-27');
  assert.ok(next.every(r => r.quantity === '0'));
  db.raw.close();
});

test('datas da última seleção e contagens sobrevivem ao reinício e só limpam após exportar', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-dates-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename));
    await first.store.setProfile(profile);
    const sheet = await first.store.loadSheet(profile, '1'); sheet[0].date = '2026-10-26'; sheet[0].quantity = '23';
    const { sheetDates } = require(join(process.env.BC_TEST_BUILD, 'collection.js'));
    await first.store.saveSheet(profile, '1', sheet, ['1', '2'], sheetDates(sheet));
    first.db.raw.close();
    const second = await make(new Adapter(filename));
    assert.equal((await second.store.loadSheet(profile, '1'))[0].quantity, '23');
    assert.equal((await second.store.loadSheet(profile, '2'))[0].date, '2026-10-26');
    await second.store.selectUser('Maria'); await second.store.selectUser(profile.userName);
    assert.equal((await second.store.loadSheet(profile, '1'))[0].quantity, '23');
    const { exportDevice } = require(join(process.env.BC_TEST_BUILD, 'export-flow.js'));
    await assert.rejects(exportDevice(second.store, profile, async () => { throw new Error('Falhou'); }));
    assert.equal((await second.store.loadSheet(profile, '1'))[0].quantity, '23');
    await exportDevice(second.store, profile, async () => {});
    for (const bucket of ['1', '2']) assert.ok((await second.store.loadSheet(profile, bucket)).every(r => r.date === '' && r.quantity === '0'));
    assert.equal((await second.store.all())[0].quantity, 23);
    second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('cadastro é atualizado manualmente sem apagar dados ou exigir seleção após exportar', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  await store.replaceCatalog([{ cycle: '2026', block: 'Teste', bucket: '1' }], 'primeiro.xlsx');
  assert.ok(await store.setting('catalogImportedAt', ''));
  await store.setPriority(profile, '1', true);
  await store.save(profile, '1', [draft()], ['1']);
  const records = await store.all();
  await assert.rejects(store.replaceCatalog([], 'vazio.xlsx'));
  assert.equal(await store.setting('catalogSource', ''), 'primeiro.xlsx');
  await store.completeExport(records); assert.equal(await store.setting('catalogReviewPending', null), null);
  await store.completeExport(records); assert.equal(await store.setting('catalogReviewPending', null), null);
  await store.replaceCatalog([{ cycle: '2026', block: 'Teste', bucket: '2' }], 'atualizado.xlsx');
  assert.deepEqual((await store.getCatalog()).map(e => e.bucket), ['2']);
  assert.deepEqual(await store.all(), records);
  assert.equal(await store.getPriority(profile, '1'), true);
  assert.equal(await store.setting('catalogSource', ''), 'atualizado.xlsx');
  assert.equal(await store.setting('activeBucket', ''), '');
  db.raw.close();
});


test('resumo conta novos IDs desde a última exportação confirmada, sem contar correções ou reenvios', async () => {
  const { exportDevice } = require(join(process.env.BC_TEST_BUILD, 'export-flow.js'));
  const { db, store } = await make(); await store.setProfile(profile);
  await store.save(profile, '1', [draft(), draft({ purpose: 'POLI' })], ['1', '2']);
  assert.deepEqual(await exportDevice(store, profile, async () => {}), { total: 2, newRecords: 2 });
  assert.deepEqual(await exportDevice(store, profile, async () => {}), { total: 2, newRecords: 0 });
  await store.save(profile, '1', [draft({ quantity: '27' })], ['1', '2']);
  assert.equal((await store.exportState(await store.all())).pending, 1);
  assert.deepEqual(await exportDevice(store, profile, async () => {}), { total: 2, newRecords: 0 });
  const other = await store.selectUser('Maria');
  await store.save(other, '2', [draft({ quantity: '4' })], ['1', '2']);
  await assert.rejects(exportDevice(store, other, async () => { throw new Error('Falha de escrita'); }), /Falha de escrita/);
  assert.equal((await store.exportState(await store.all())).newRecords, 1);
  assert.deepEqual(await exportDevice(store, other, async () => {}), { total: 3, newRecords: 1 });
  assert.equal((await store.exportState(await store.all())).newRecords, 0);
  db.raw.close();
});

test('novo bloco limpa dados de todos os usuários, prioridades e destinos e persiste após reabrir', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-new-block-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename));
    await first.store.setProfile(profile);
    await first.store.replaceCatalog([{ cycle: '2026', block: 'Teste', bucket: '1' }], 'cadastro-antigo.xlsx');
    await first.store.setPriority(profile, '1', true);
    const sheet = await first.store.loadSheet(profile, '1'); sheet[0].date = '2026-10-24'; sheet[0].quantity = '17';
    await first.store.saveSheet(profile, '1', sheet, ['1']);
    const other = await first.store.selectUser('Maria');
    await first.store.save(other, '1', [draft({ observation: 'Dado do bloco anterior' })], ['1']);
    await first.store.setSetting('outputDevice', { kind: 'file', uri: 'content://provedor/antigo.csv' });
    await first.store.setSetting('outputFolder', { kind: 'folder', uri: 'content://provedor/pasta' });
    await first.store.markExport(await first.store.all());
    const users = await first.store.users();
    const clean = await first.store.resetBlock();
    assert.equal(clean.deviceId, profile.deviceId); assert.equal(clean.userId, other.userId); assert.equal(clean.userName, 'Maria');
    assert.equal(clean.block, ''); assert.equal(clean.cycle, '');
    assert.deepEqual(await first.store.all(), []);
    assert.deepEqual(await first.db.getAllAsync('SELECT * FROM revisions'), []);
    assert.deepEqual(await first.store.getCatalog(), []);
    assert.deepEqual(await first.store.users(), users);
    for (const key of ['outputDevice', 'outputFolder', 'catalogSource', 'catalogImportedAt', 'export', 'activeBucket'])
      assert.equal(await first.store.setting(key, null), null);
    assert.equal(await first.store.getPriority(profile, '1'), false);
    await assert.rejects(first.store.saveSheet(profile, '1', sheet, ['1']), /rodada/);
    first.db.raw.close();
    const second = await make(new Adapter(filename));
    assert.deepEqual(await second.store.getProfile(), clean);
    assert.deepEqual(await second.store.all(), []);
    for (const user of users) assert.ok((await second.store.loadSheet({ ...profile, ...user }, '1')).every(row => row.date === '' && row.quantity === '0' && row.observation === ''));
    const catalog = await second.store.replaceCatalog([{ cycle: '', block: 'Novo BC', bucket: '101' }], 'novo.xlsx');
    const nextProfile = { ...clean, block: catalog[0].block };
    await second.store.setProfile(nextProfile);
    const next = await second.store.loadSheet(nextProfile, '101'); next[0].date = '2026-10-27'; next[0].quantity = '3';
    await second.store.saveSheet(nextProfile, '101', next, ['101']);
    const { exportDevice } = require(join(process.env.BC_TEST_BUILD, 'export-flow.js'));
    assert.deepEqual(await exportDevice(second.store, nextProfile, async () => {}), { total: 1, newRecords: 1 });
    assert.ok(!toCsv(await second.store.all()).includes('Dado do bloco anterior'));
    second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('falha na limpeza do banco reverte a exclusão de histórico, coletas e destinos', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  await store.save(profile, '1', [draft()], ['1']);
  await store.setSetting('outputDevice', { uri: 'content://original.csv' });
  const before = await store.all();
  await db.execAsync("CREATE TRIGGER fail_clear BEFORE DELETE ON evaluations BEGIN SELECT RAISE(ABORT, 'falha ao limpar'); END;");
  await assert.rejects(store.resetBlock(), /falha ao limpar/);
  assert.deepEqual(await store.all(), before);
  assert.equal((await db.getAllAsync('SELECT * FROM revisions')).length, 1);
  assert.deepEqual(await store.getProfile(), profile);
  assert.equal((await store.setting('outputDevice', null)).uri, 'content://original.csv');
  db.raw.close();
});

test('falha ao limpar arquivos internos não apaga o banco; sucesso permite iniciar outro bloco', async () => {
  const { startNewBlock } = require(join(process.env.BC_TEST_BUILD, 'block-reset.js'));
  const { db, store } = await make(); await store.setProfile(profile);
  await store.save(profile, '1', [draft()], ['1']);
  const before = await store.all();
  await assert.rejects(startNewBlock(store, async () => { throw new Error('Arquivo em uso'); }), /Arquivo em uso/);
  assert.deepEqual(await store.all(), before);
  let cleaned = false;
  await startNewBlock(store, async () => { cleaned = true; });
  assert.equal(cleaned, true); assert.deepEqual(await store.all(), []);
  db.raw.close();
});


test('ocultar linhas mantém rascunhos, avaliações, revisões e CSV após reiniciar', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bc-hidden-'));
  try {
    const filename = join(directory, 'bc.db'); const first = await make(new Adapter(filename));
    await first.store.setProfile(profile);
    await first.store.setRowCounts(profile, { EMASC: 4, POLI: 3 });
    const sheet = await first.store.loadSheet(profile, '1');
    sheet[3].date = '2026-10-28'; sheet[3].quantity = '29'; sheet[3].observation = 'Última linha';
    sheet[6].date = '2026-10-28'; sheet[6].quantity = '12';
    await first.store.saveSheet(profile, '1', sheet, ['1', '2']);
    const before = await first.store.all(); const history = await first.db.getAllAsync('SELECT * FROM revisions');
    await first.store.setRowCounts(profile, { EMASC: 1, POLI: 1 });
    assert.deepEqual(await first.store.all(), before);
    assert.deepEqual(await first.db.getAllAsync('SELECT * FROM revisions'), history);
    assert.ok(toCsv(await first.store.all()).includes('Última linha'));
    first.db.raw.close();
    const second = await make(new Adapter(filename));
    assert.deepEqual(await second.store.getRowCounts(profile), { EMASC: 1, POLI: 1 });
    const restored = await second.store.loadSheet(profile, '1');
    assert.equal(restored[3].quantity, '29'); assert.equal(restored[3].observation, 'Última linha');
    await second.store.setRowCounts(profile, { EMASC: 4, POLI: 3 });
    assert.equal((await second.store.loadSheet(profile, '1'))[3].date, '2026-10-28');
    assert.deepEqual(await second.store.all(), before); second.db.raw.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('quantidade de linhas é comum aos baldes, independente por finalidade e limitada a 1–4', async () => {
  const { db, store } = await make();
  assert.deepEqual(await store.getRowCounts(profile), { EMASC: 2, POLI: 2 });
  await store.setRowCounts(profile, { EMASC: 3, POLI: 1 });
  await store.loadSheet(profile, '1'); await store.loadSheet(profile, '2');
  assert.deepEqual(await store.getRowCounts(profile), { EMASC: 3, POLI: 1 });
  assert.deepEqual(await store.getRowCounts({ ...profile, userId: 'outra' }), { EMASC: 2, POLI: 2 });
  await store.setRowCounts(profile, { EMASC: 0, POLI: 99 });
  assert.deepEqual(await store.getRowCounts(profile), { EMASC: 1, POLI: 4 });
  await store.setProfile(profile); await store.completeExport(await store.all());
  assert.deepEqual(await store.getRowCounts(profile), { EMASC: 1, POLI: 4 }); db.raw.close();
});

test('migração preserva as seis linhas antigas e mostra a terceira preenchida uma única vez', async () => {
  const { db, store } = await make();
  const legacy = ['EMASC', 'POLI'].flatMap(purpose => Array.from({ length: 3 }, (_, i) => draft({ purpose, date: i === 2 ? '2026-10-28' : '', quantity: i === 2 ? '9' : '0' })));
  const key = 'sheet:' + JSON.stringify([profile.userId, profile.cycle, profile.block, '1']);
  await store.setSetting(key, legacy);
  const migrated = await store.loadSheet(profile, '1');
  assert.equal(migrated.length, 8); assert.equal(migrated[2].rowId, legacy[2].rowId);
  assert.equal(migrated[6].rowId, legacy[5].rowId);
  assert.deepEqual(await store.getRowCounts(profile), { EMASC: 3, POLI: 3 });
  await store.setRowCounts(profile, { EMASC: 1, POLI: 1 });
  assert.equal((await store.loadSheet(profile, '1'))[2].quantity, '9');
  assert.deepEqual(await store.getRowCounts(profile), { EMASC: 1, POLI: 1 }); db.raw.close();
});

test('datas ocultas não criam avaliações nos novos baldes de duas linhas fixas', async () => {
  const { db, store } = await make();
  await store.setRowCounts(profile, { EMASC: 4, POLI: 2 });
  const sheet = await store.loadSheet(profile, '1'); sheet[3].date = '2026-10-28'; sheet[3].quantity = '7';
  const { sheetDates } = require(join(process.env.BC_TEST_BUILD, 'collection.js'));
  await store.saveSheet(profile, '1', sheet, ['1','2'], sheetDates(sheet));
  await store.setRowCounts(profile, { EMASC: 2, POLI: 2 });
  const next = await store.loadSheet(profile, '2'); assert.equal(next[3].date, '');
  await store.saveSheet(profile, '2', next, ['1','2']);
  assert.ok((await store.all()).every(r => r.bucket === '1'));
  await store.setRowCounts(profile, { EMASC: 4, POLI: 2 });
  assert.equal((await store.loadSheet(profile, '2'))[3].date, ''); // fixed two-row UI never suggests a hidden new evaluation
  assert.equal((await store.loadSheet(profile, '1'))[3].quantity, '7'); db.raw.close();
});


test('duas linhas editáveis preservam avaliações e rascunhos antigos da terceira e quarta linhas', async () => {
  const { db,store } = await make(); await store.setProfile(profile);
  const old=await store.loadSheet(profile,'1');
  old[2].date='2026-10-26';old[2].quantity='13';old[2].observation='Terceira antiga';
  old[3].date='2026-10-27';old[3].quantity='24';old[3].observation='Quarta antiga';
  await store.saveSheet(profile,'1',old,['1']);
  const previous=await store.all();
  old[0].date='2026-10-28';old[0].quantity='9';
  old[3].quantity=''; // a partial legacy draft must not block the two current editable rows
  assert.equal(await store.saveSheet(profile,'1',old,['1'],undefined,true),null);
  const restored=await store.loadSheet(profile,'1');
  assert.equal(restored.length,8);assert.equal(restored[2].observation,'Terceira antiga');assert.equal(restored[3].quantity,'');
  const all=await store.all();
  assert.equal(all.length,3);assert.deepEqual(all.filter(r=>previous.some(old=>old.record_id===r.record_id)),previous);
  assert.ok(toCsv(all).includes('Terceira antiga'));assert.ok(toCsv(all).includes('Quarta antiga'));
  db.raw.close();
});

test('cadastro e vínculo ao arquivo original são substituídos na mesma transação', async () => {
  const { db,store }=await make();
  const original={uri:'content://provider/document/arquivo-1',name:'baldes.xlsx'};
  await store.replaceCatalog([{cycle:'',block:'BC',bucket:'1'}],original.name,original);
  await store.save({...profile,cycle:'',block:'BC'},'1',[draft()],['1']);
  const records=await store.all();const importedAt=await store.setting('catalogImportedAt','');
  const next={uri:'content://provider/document/arquivo-2',name:'outro.xlsx'};
  await db.execAsync("CREATE TRIGGER fail_source BEFORE INSERT ON settings WHEN NEW.key='catalogInput' BEGIN SELECT RAISE(ABORT,'source failed'); END;");
  await assert.rejects(store.replaceCatalog([{cycle:'',block:'BC',bucket:'2'}],next.name,next),/source failed/);
  assert.equal((await store.getCatalog())[0].bucket,'1');
  assert.deepEqual(await store.setting('catalogInput',null),original);
  assert.equal(await store.setting('catalogSource',''),original.name);
  assert.equal(await store.setting('catalogImportedAt',''),importedAt);
  assert.deepEqual(await store.all(),records);
  await db.execAsync('DROP TRIGGER fail_source');
  await store.replaceCatalog([{cycle:'',block:'BC',bucket:'2'}],next.name,next);
  assert.equal((await store.getCatalog())[0].bucket,'2');assert.deepEqual(await store.setting('catalogInput',null),next);
  assert.deepEqual(await store.all(),records);
  await store.resetBlock();assert.equal(await store.setting('catalogInput',null),null);db.raw.close();
});
