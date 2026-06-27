// server/services/scanPairing.service.js
//
// Short-lived in-memory session store that links a desktop Scan & Match drawer
// to a phone that scanned its QR code. Each session carries a single-use
// pairing code (the phone's only credential), a status lifecycle, and the AI
// match result streamed back to the desktop via Socket.io.
//
// Lifecycle: pending → uploaded → processing → complete | error
//
// In-memory (no Redis in this stack); a server restart drops active sessions.
// A 60s sweep expires sessions older than TTL_MS. v1-acceptable; Redis is the
// production upgrade path (mirrors the embeddings cache pattern).

const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const SWEEP_MS = 60 * 1000;

/** @type {Map<string, {tenantId:string, createdAt:number, expiresAt:number, status:string, result:any, used:boolean}>} */
const sessions = new Map();

/** Generate a short, human-typeable pairing code (8 hex chars). */
function newCode() {
  return crypto.randomBytes(4).toString('hex');
}

/** Create a fresh pairing session for a tenant. Returns the code + expiry. */
function createPairing(tenantId) {
  const code = newCode();
  const now = Date.now();
  sessions.set(code, {
    tenantId: String(tenantId),
    createdAt: now,
    expiresAt: now + TTL_MS,
    status: 'pending',
    result: null,
    used: false,
  });
  return { pairingCode: code, expiresAt: now + TTL_MS };
}

/** Fetch a session if it exists and hasn't expired; null otherwise. */
function getSession(code) {
  const s = sessions.get(code);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(code);
    return null;
  }
  return s;
}

/** Update a session's status (and optional result). No-op if not found. */
function setStatus(code, status, result) {
  const s = sessions.get(code);
  if (!s) return null;
  s.status = status;
  if (arguments.length >= 3) s.result = result ?? null;
  return s;
}

/** Mark a session consumed (single-use guard for mobile uploads). */
function markUsed(code) {
  const s = sessions.get(code);
  if (s) s.used = true;
}

/** Drop a session. */
function expire(code) {
  sessions.delete(code);
}

/** Periodically purge expired sessions to bound memory. */
let sweeper = null;
function startSweeper() {
  if (sweeper) return sweeper;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, s] of sessions) {
      if (now > s.expiresAt) sessions.delete(code);
    }
  }, SWEEP_MS);
  if (sweeper.unref) sweeper.unref(); // don't keep the process alive for this
  return sweeper;
}
startSweeper();

module.exports = {
  TTL_MS,
  createPairing,
  getSession,
  setStatus,
  markUsed,
  expire,
};