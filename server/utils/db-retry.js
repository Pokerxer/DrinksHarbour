// server/utils/db-retry.js
//
// One retry for operations that lost their connection on the way to MongoDB.
//
// Why this exists: a `MongoServerSelectionError` whose message says
// `connection <monitor> to <ip>:27017 closed` does NOT mean the query failed.
// It means the driver could not find a server to send it to within
// `serverSelectionTimeoutMS`, because a monitoring connection died — which is
// what Atlas does to idle connections, and what an M0 cluster does wholesale when
// it resumes from its 30-minute auto-pause. The cluster is usually healthy again
// within a second or two.
//
// `config/db.js` already handles the *connection* side of this (it clears the
// cached promise so one blip is not paid for by every later request on the same
// warm container). What it cannot do is rescue the request that was already in
// flight when the monitor closed — that one still surfaces as a 500, which is
// what made a transient Atlas event look like a broken endpoint.
//
// Retrying is safe for exactly these errors and no others: a selection or network
// error means the driver never obtained a server, so the operation was never
// applied. Retrying a duplicate-key error, a validation error, or any error from
// a write that *was* acknowledged would risk double-applying it, so those are
// deliberately rethrown untouched.

/** Error labels the driver marks as safe to retry at the application level. */
const RETRYABLE_LABELS = new Set([
  'RetryableWriteError',
  'TransientTransactionError',
]);

/**
 * True when `err` is a connectivity failure the server never saw.
 *
 * Deliberately narrow. Anything that could mean "the write landed" — including a
 * bare `MongoServerError` — is not retryable here.
 */
function isTransientConnectionError(err) {
  if (!err || typeof err !== 'object') return false;

  const name = err.name || '';
  const codeName = err.codeName || '';

  // Selection and network errors are pre-execution: nothing was sent.
  if (
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError'
  ) {
    return true;
  }

  // Code 6 = HostUnreachable, 7 = HostNotFound, 89 = NetworkTimeout,
  // 9001 = SocketException, 10107 = NotWritablePrimary, 11600 = InterruptedAtShutdown.
  const TRANSIENT_CODES = new Set([6, 7, 89, 9001, 10107, 11600]);
  if (typeof err.code === 'number' && TRANSIENT_CODES.has(err.code)) return true;

  if (codeName === 'HostUnreachable' || codeName === 'NetworkTimeout') return true;

  // The driver labels its own transient failures.
  if (Array.isArray(err.errorLabels)) {
    for (const label of err.errorLabels) {
      if (RETRYABLE_LABELS.has(label)) return true;
    }
  }

  return false;
}

/**
 * Run `operation`, retrying it once if it fails on a lost connection.
 *
 * @param {Function} operation  Thunk returning a promise (or value) for the query.
 * @param {object}   [options]
 * @param {number}   [options.delayMs=250] Pause before the single retry.
 * @returns {Promise<*>} The operation's result, or its original error.
 */
async function withDbRetry(operation, options = {}) {
  const { delayMs = 250 } = options;

  try {
    return await operation();
  } catch (err) {
    if (!isTransientConnectionError(err)) throw err;

    // A closed monitor takes a moment to be replaced, and reconnecting immediately
    // usually just hits the same dead topology. One short pause is the difference
    // between a 500 and a served request.
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Second and final attempt: whatever this throws is what the caller sees.
    return operation();
  }
}

module.exports = { isTransientConnectionError, withDbRetry };