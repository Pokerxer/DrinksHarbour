// __tests__/db-retry.test.js
//
// The rule this file exists to protect: retry only errors that mean the server
// never saw the operation. Widen the net and a double-posted sales order follows.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isTransientConnectionError,
  withDbRetry,
} = require('../utils/db-retry');

const selErr = () => {
  const e = new Error('connection <monitor> to 65.62.42.210:27017 closed');
  e.name = 'MongoServerSelectionError';
  return e;
};

test('classifies the error from the reported outage as retryable', () => {
  assert.equal(isTransientConnectionError(selErr()), true);
});

test('classifies network failures as retryable', () => {
  for (const name of ['MongoNetworkError', 'MongoNetworkTimeoutError']) {
    const e = new Error('x');
    e.name = name;
    assert.equal(isTransientConnectionError(e), true, name);
  }
});

test('classifies transient server codes as retryable', () => {
  for (const code of [6, 7, 89, 9001, 10107, 11600]) {
    const e = new Error('x');
    e.name = 'MongoError';
    e.code = code;
    assert.equal(isTransientConnectionError(e), true, `code ${code}`);
  }
});

test('refuses to retry an error that might mean the write landed', () => {
  // Duplicate key is the dangerous one: the write WAS applied, so a replay
  // either double-applies or masks a real conflict.
  const dup = new Error('E11000 duplicate key error');
  dup.name = 'MongoServerError';
  dup.code = 11000;
  assert.equal(isTransientConnectionError(dup), false);

  const validation = new Error('Validation failed: sellingPrice is required');
  validation.name = 'ValidationError';
  validation.code = 121;
  assert.equal(isTransientConnectionError(validation), false);

  const unauthorized = new Error('not authenticated');
  unauthorized.name = 'MongoServerError';
  unauthorized.code = 13;
  assert.equal(isTransientConnectionError(unauthorized), false);
});

test('refuses non-errors and bare objects', () => {
  assert.equal(isTransientConnectionError(null), false);
  assert.equal(isTransientConnectionError(undefined), false);
  assert.equal(isTransientConnectionError('closed'), false);
  assert.equal(isTransientConnectionError({}), false);
});

test('returns the result untouched on the happy path', async () => {
  const result = await withDbRetry(() => Promise.resolve({ ok: true }));
  assert.deepEqual(result, { ok: true });
});

test('retries once and succeeds after a lost connection', async () => {
  let calls = 0;
  const result = await withDbRetry(
    () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(selErr())
        : Promise.resolve('recovered');
    },
    { delayMs: 0 }
  );
  assert.equal(result, 'recovered');
  assert.equal(calls, 2);
});

test('gives up after exactly one retry and surfaces the real error', async () => {
  let calls = 0;
  await assert.rejects(
    withDbRetry(
      () => {
        calls += 1;
        return Promise.reject(selErr());
      },
      { delayMs: 0 }
    ),
    /connection <monitor>/
  );
  // One original attempt plus one retry. A retry loop here would hammer a
  // cluster that is already struggling.
  assert.equal(calls, 2);
});

test('does not retry a non-retryable failure', async () => {
  let calls = 0;
  const dup = new Error('E11000 duplicate key error');
  dup.name = 'MongoServerError';
  dup.code = 11000;
  await assert.rejects(
    withDbRetry(
      () => {
        calls += 1;
        return Promise.reject(dup);
      },
      { delayMs: 0 }
    ),
    /duplicate key/
  );
  assert.equal(calls, 1);
});

test('waits before retrying so the dead topology can be replaced', async () => {
  let calls = 0;
  const started = Date.now();
  await withDbRetry(
    () => {
      calls += 1;
      return calls === 1 ? Promise.reject(selErr()) : Promise.resolve(1);
    },
    { delayMs: 60 }
  );
  assert.ok(
    Date.now() - started >= 55,
    'retry should not be immediate'
  );
});
