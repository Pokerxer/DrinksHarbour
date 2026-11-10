// __tests__/dbErrorHttp.test.js
//
// The rule this file exists to protect: a MID-REQUEST MongoDB connectivity
// blip gets the same failure semantics as a failed connect — 503, Retry-After,
// and the caller-facing "Database temporarily unavailable. Please retry."
// message — instead of the opaque 500 the global handler defaulted to.
//
// Background: the /api connectDB gate has always answered a failed DIAL with
// 503 + Retry-After. But a container whose connection was healthy at the gate
// and lost a handshake mid-request ("MongoNetworkError: tlsv1 alert internal
// error", Atlas refusing new TLS at its connection ceiling — 2026-11-10
// brand-slug 500s) surfaced a bare driver error that fell through as a 500.
// Both failure modes come from the same transient cause and must answer the
// same way.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DB_UNAVAILABLE_STATUS,
  DB_UNAVAILABLE_RETRY_AFTER,
  DB_UNAVAILABLE_MESSAGE,
  transientDbFailure,
} = require('../utils/dbErrorHttp');

const transientError = (name) => {
  const e = new Error('tlsv1 alert internal error');
  e.name = name;
  return e;
};

test('maps a mid-request MongoNetworkError to the 503 Retry-After shape', () => {
  const mapped = transientDbFailure(transientError('MongoNetworkError'), 500);
  assert.deepEqual(mapped, {
    status: DB_UNAVAILABLE_STATUS,
    retryAfter: DB_UNAVAILABLE_RETRY_AFTER,
    message: DB_UNAVAILABLE_MESSAGE,
  });
  assert.equal(DB_UNAVAILABLE_STATUS, 503);
  assert.equal(DB_UNAVAILABLE_RETRY_AFTER, '5');
  assert.equal(DB_UNAVAILABLE_MESSAGE, 'Database temporarily unavailable. Please retry.');
});

test('maps server selection and network timeout errors too', () => {
  for (const name of ['MongoServerSelectionError', 'MongoNetworkTimeoutError']) {
    assert.equal(
      transientDbFailure(transientError(name), 500) !== null,
      true,
      `${name} must map to 503`
    );
  }
});

test('refuses to remap an error that might mean a write landed', () => {
  const dup = new Error('E11000 duplicate key error');
  dup.name = 'MongoServerError';
  dup.code = 11000;
  assert.equal(transientDbFailure(dup, 500), null);
});

test('refuses non-errors', () => {
  assert.equal(transientDbFailure(null, 500), null);
  assert.equal(transientDbFailure('closed', 500), null);
  assert.equal(transientDbFailure({}, 500), null);
});

test('leaves sub-5xx statuses alone', () => {
  // An AppError with its own statusCode never carries a Mongo transient name,
  // but the guard must not rewrite any 4xx that somehow matches either.
  assert.equal(
    transientDbFailure(transientError('MongoNetworkError'), 400),
    null
  );
});
