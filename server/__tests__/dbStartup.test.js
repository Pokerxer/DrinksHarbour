const test = require('node:test');
const assert = require('node:assert/strict');
const { withDbStartupRetry: startup } = require('../utils/db-startup');

function selectionError() {
  return Object.assign(new Error('Server selection timed out'), { name: 'MongooseServerSelectionError' });
}

test('startup survives transient discovery failures and returns the recovered connection', async () => {
  let calls = 0;
  const connection = { connected: true };
  const warnings = [];
  const result = await startup(async () => {
    if (++calls < 3) throw selectionError();
    return connection;
  }, { delayMs: 0, onRetry: (attempt) => warnings.push(attempt) });
  assert.equal(result, connection);
  assert.equal(calls, 3);
  assert.deepEqual(warnings, [1, 2]);
});

test('startup stops after three failed connection attempts', async () => {
  let calls = 0;
  const failure = selectionError();
  await assert.rejects(startup(async () => { calls++; throw failure; }, { delayMs: 0 }), (err) => err === failure);
  assert.equal(calls, 3);
});

test('startup does not retry invalid configuration or rejected credentials', async () => {
  for (const failure of [new Error('MONGODB_URI is not defined'), Object.assign(new Error('Authentication failed'), { name: 'MongoServerError', code: 18 })]) {
    let calls = 0;
    await assert.rejects(startup(async () => { calls++; throw failure; }, { delayMs: 0 }), (err) => err === failure);
    assert.equal(calls, 1);
  }
});

test('a healthy startup connects once without a recovery warning', async () => {
  let calls = 0;
  const result = await startup(async () => { calls++; return 'connected'; }, { onRetry: () => assert.fail('unexpected retry') });
  assert.equal(result, 'connected');
  assert.equal(calls, 1);
});
