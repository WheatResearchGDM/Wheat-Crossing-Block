const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require(join(process.env.BC_TEST_BUILD, 'store.js'));
const { validateDrafts, toCsv, validDate, today, exportFilename } = require(join(process.env.BC_TEST_BUILD, 'model.js'));

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
  assert.ok(csv.startsWith('\ufeffNome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Data de criação;Device ID'));
  assert.ok(csv.includes('"Observação; ""revisar""\namanhã"')); assert.ok(csv.includes('"24/10/2026";"Emasculação";"12"'));
  assert.equal(exportFilename(profile), 'REGISTRO_BC_COLETOR DE TESTE.csv');
  assert.equal(exportFilename({ ...profile, userName: 'João / Sul' }), 'REGISTRO_BC_JOÃO _ SUL.csv'); db.raw.close();
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
    sheet[0].date = '2026-10-24'; sheet[3].date = '2026-10-24'; sheet[0].quantity = '17';
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

test('seis linhas, datas sugeridas e zero somente nos baldes visitados', async () => {
  const { db, store } = await make();
  const sheet = await store.loadSheet(profile, '1'); assert.equal(sheet.length, 6);
  assert.ok(sheet.every(r => r.quantity === '0'));
  assert.equal((await store.all()).length, 0);
  sheet[0].date = '2026-10-26'; sheet[1].date = '2026-10-27'; sheet[3].date = '2026-10-28';
  await store.saveSheet(profile, '1', sheet, ['1', '2']);
  const next = await store.loadSheet(profile, '2');
  assert.deepEqual(next.map(r => r.date), sheet.map(r => r.date));
  assert.ok(next.every(r => r.quantity === '0')); assert.equal((await store.all()).length, 3);
  assert.ok((await store.all()).every(r => r.bucket === '1')); db.raw.close();
});

test('troca de usuário mantém identidades, rascunhos e destinos separados', async () => {
  const { db, store } = await make(); await store.setProfile(profile);
  const sheet = await store.loadSheet(profile, '1'); sheet[0].quantity = '19';
  await store.saveSheet(profile, '1', sheet, ['1']);
  const other = await store.selectUser('Outro coletor');
  assert.notEqual(other.userId, profile.userId); assert.equal(other.deviceId, profile.deviceId);
  const fresh = await store.loadSheet(other, '1'); assert.equal(fresh[0].quantity, '0');
  await store.saveSheet(other, '1', fresh, ['1']);
  const restored = await store.selectUser('coletor de teste'); assert.equal(restored.userId, profile.userId);
  assert.equal((await store.loadSheet(restored, '1'))[0].quantity, '19');
  assert.equal((await store.users()).length, 2);
  await store.setSetting('output:' + other.userId, { kind: 'file', uri: 'content://test/outro' });
  assert.equal(await store.setting('output:' + restored.userId, null), null); db.raw.close();
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
