// server/utils/dbErrorHttp.js
//
// Shared failure semantics for MongoDB connectivity blips.
//
// The /api connectDB gate in server.js has always answered a failed DIAL with
// 503 + `Retry-After: 5` + "Database temporarily unavailable. Please retry."
// But a container whose connection was healthy at the gate and whose socket
// still died mid-request surfaces a BARE driver error at the global handler,
// which defaulted it to an opaque 500 — the shape of the 2026-11-10 brand-slug
// 500s (`MongoNetworkError: tlsv1 alert internal error`, Atlas refusing the
// TLS handshake at its connection ceiling). Same cause, two answers.
//
// This module is the one source of truth for the 503 response shape, so both
// paths keep answering identically if one of them changes.

const { isTransientConnectionError } = require('./db-retry');

const DB_UNAVAILABLE_STATUS = 503;
// Retry-After must be a number or date string per RFC 7231; the gate has
// always sent seconds as a string, so that wire shape is preserved.
const DB_UNAVAILABLE_RETRY_AFTER = '5';
const DB_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable. Please retry.';

/**
 * Return the 503 response fields for a transient connectivity error, or null
 * when the error must keep its own status (dup key, validation, 4xx, …).
 *
 * @param {unknown} err        The caught driver/service error.
 * @param {number}  statusCode The status the handler would otherwise send.
 * @returns {{ status: number, retryAfter: string, message: string } | null}
 */
function transientDbFailure(err, statusCode) {
  if (!isTransientConnectionError(err)) return null;
  // A transient name alone is not enough — never rewrite a sub-5xx status
  // that a handler or AppError already chose deliberately.
  if (Number.isFinite(statusCode) && statusCode < 500) return null;
  return {
    status: DB_UNAVAILABLE_STATUS,
    retryAfter: DB_UNAVAILABLE_RETRY_AFTER,
    message: DB_UNAVAILABLE_MESSAGE,
  };
}

module.exports = {
  DB_UNAVAILABLE_STATUS,
  DB_UNAVAILABLE_RETRY_AFTER,
  DB_UNAVAILABLE_MESSAGE,
  transientDbFailure,
};
