const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { SaveQueue } = require(join(process.env.BC_TEST_BUILD, 'collection.js'));

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
