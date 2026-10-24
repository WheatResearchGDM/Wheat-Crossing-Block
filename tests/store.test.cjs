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
  assert.ok(csv.startsWith('\ufeffschema_version;')); assert.ok(csv.includes('"Observação; ""revisar""\namanhã"'));
  assert.equal(exportFilename(profile), exportFilename({ ...profile, userName: 'Nome corrigido' }));
  assert.notEqual(exportFilename(profile), exportFilename({ ...profile, deviceId: 'outro' })); db.raw.close();
});
test('uma correção posterior à geração do CSV continua pendente', async () => {
  const { db, store } = await make(); await store.save(profile, '1', [draft()], ['1']);
  const snapshot = await store.all(); await store.save(profile, '1', [draft({ quantity: '3' })], ['1']);
  await store.markExport(snapshot); assert.equal((await store.exportState(await store.all())).pending, 1);
  await store.markExport(await store.all()); assert.equal((await store.exportState(await store.all())).pending, 0); db.raw.close();
});
