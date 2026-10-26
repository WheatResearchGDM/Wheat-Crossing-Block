const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { changeSheetDate, SaveQueue } = require(join(process.env.BC_TEST_BUILD, 'collection.js'));

test('salvamento serializado mantém ordem de digitação e troca de contexto', async () => {
  const events = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  const queue = new SaveQueue();
  queue.enqueue(async () => { events.push('início A'); await gate; events.push('fim A'); }, 'A');
  queue.enqueue(async () => { events.push('B'); }, 'B');
  await Promise.resolve(); assert.deepEqual(events, ['início A']);
  release(); await queue.flush(); assert.deepEqual(events, ['início A', 'fim A', 'B']);
});
test('falha de um balde não é ocultada pelo sucesso de outro; nova tentativa recupera', async () => {
  const queue = new SaveQueue();
  queue.enqueue(async () => { throw new Error('disco cheio'); }, 'A');
  queue.enqueue(async () => {}, 'B');
  await assert.rejects(queue.flush(), /disco cheio/);
  queue.enqueue(async () => {}, 'A'); await queue.flush();
});
test('escolher data após digitar preserva o rascunho; outra data abre sua própria avaliação', () => {
  const profile = { userId: 'a', cycle: '', block: 'BC' };
  const sheet = [{ rowId: 'linha', date: '', quantity: '17', observation: 'PASSADA', purpose: 'EMASC' }];
  const first = changeSheetDate(sheet, 'linha', '2026-10-24', [], profile, '1');
  assert.equal(first[0].quantity, '17'); assert.equal(first[0].observation, 'PASSADA');
  const fresh = changeSheetDate(first, 'linha', '2026-10-25', [], profile, '1');
  assert.equal(fresh[0].quantity, '17'); assert.equal(fresh[0].observation, 'PASSADA');
  const records = [{ user_id: 'a', cycle: '', block: 'BC', bucket: '1', purpose: 'EMASC', date: '2026-10-26', quantity: 21, observation: 'Revisado' }];
  const reopened = changeSheetDate(first, 'linha', '2026-10-26', records, profile, '1');
  assert.equal(reopened[0].quantity, '21'); assert.equal(reopened[0].observation, 'Revisado');
  assert.throws(() => changeSheetDate([...first, { ...first[0], rowId: 'outra', date: '2026-10-25' }], 'linha', '2026-10-25', [], profile, '1'), /outra linha/);
});
