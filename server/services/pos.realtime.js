// services/pos.realtime.js
//
// Emit helpers for POS realtime events.
//
// Socket.io is attached only when the process owns a long-running HTTP server;
// on serverless (Vercel) there is no io instance and no persistent connection,
// so every helper here treats "no io" as normal and does nothing. Callers must
// not branch on whether the emit happened — a deployment without websockets
// still works, it just finds out about other terminals on its next fetch.

/**
 * Room name for one terminal type of one tenant.
 * Derived from the verified token server-side — never from client input.
 */
function terminalRoom(tenantId, terminalType) {
  const t = ['retail', 'wholesale'].includes(terminalType)
    ? terminalType
    : 'retail';
  return `pos:${tenantId}:${t}`;
}

function getIo(app) {
  return app?.get?.('io') || null;
}

/** Broadcast an event to every connected device on one tenant terminal. */
function emitToTerminal(req, tenantId, terminalType, event, payload) {
  const io = getIo(req?.app);
  if (!io || !tenantId) return false;
  io.to(terminalRoom(tenantId, terminalType)).emit(event, {
    ...payload,
    at: new Date().toISOString(),
  });
  return true;
}

module.exports = { terminalRoom, emitToTerminal };
