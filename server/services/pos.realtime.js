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
  const t = (['retail', 'wholesale', 'legacy'].includes(terminalType) || /^[a-f\d]{24}$/i.test(terminalType))
    ? terminalType
    : 'retail';
  return `pos:${tenantId}:${t}`;
}

/**
 * Room name for one tenant's kitchen display screens.
 * One room per tenant — every KDS device sees every ticket for the business,
 * unlike terminals which split by retail/wholesale.
 */
function kdsRoom(tenantId) {
  return `kds:${tenantId}`;
}

/**
 * Room name for one LOCATION's venue preparation surfaces (S3 Task 5 —
 * `venue.preparation.changed`). Scoped per location so a multi-location
 * tenant's stations only hear their own tickets. The tenant id always comes
 * from the verified token server-side; the location is within-tenant selection
 * (same trust level as the kds room, which shows every location at once).
 */
function venuePrepRoom(tenantId, locationId) {
  return `venue-prep:${tenantId}:${locationId}`;
}

/**
 * Room name for one tenant's marketplace-order feed. Every POS device of the
 * tenant joins this room automatically at connection (see socket/index.js) —
 * there is no join message, so the client never names a room and the tenant
 * comes only from the verified token. A marketplace order emitted here
 * reaches every terminal and KDS screen of the tenant the moment it is placed.
 */
function ordersRoom(tenantId) {
  return `orders:${tenantId}`;
}

/**
 * Room name for one LOCATION's VIP host floor (Phase-4 E2 — `venue.vip.arrived`).
 * Same scoping as the venue-prep room: per location, tenant from the verified
 * token. The payload carries PERMITTED INFO ONLY (name/partySize/action +
 * provenance) — never spend, notes, phone or guest history.
 */
function venueHostRoom(tenantId, locationId) {
  return `venue-host:${tenantId}:${locationId}`;
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

/** Broadcast an event to every kitchen display of one tenant. */
function emitToKds(req, tenantId, event, payload) {
  const io = getIo(req?.app);
  if (!io || !tenantId) return false;
  io.to(kdsRoom(tenantId)).emit(event, {
    ...payload,
    at: new Date().toISOString(),
  });
  return true;
}

/**
 * Broadcast a venue preparation event to one location's room (S3 Task 5).
 * Same contract as emitToKds: no io means no-op; callers never branch on it.
 */
function emitToVenuePrep(req, tenantId, locationId, event, payload) {
  const io = getIo(req?.app);
  if (!io || !tenantId || !locationId) return false;
  io.to(venuePrepRoom(tenantId, locationId)).emit(event, {
    ...payload,
    at: new Date().toISOString(),
  });
  return true;
}

/**
 * Broadcast a marketplace-order event to every connected POS device of one
 * tenant (terminals + KDS — all auto-joined). Same contract as emitToKds:
 * no io means no-op; callers never branch on it.
 */
function emitToTenantOrders(req, tenantId, event, payload) {
  const io = getIo(req?.app);
  if (!io || !tenantId) return false;
  io.to(ordersRoom(tenantId)).emit(event, {
    ...payload,
    at: new Date().toISOString(),
  });
  return true;
}

/**
 * Broadcast a VIP host event to one location's host-floor room (Phase-4 E2).
 * Same contract as emitToVenuePrep: no io means no-op; callers never branch on it.
 */
function emitToVenueHost(req, tenantId, locationId, event, payload) {
  const io = getIo(req?.app);
  if (!io || !tenantId || !locationId) return false;
  io.to(venueHostRoom(tenantId, locationId)).emit(event, {
    ...payload,
    at: new Date().toISOString(),
  });
  return true;
}

module.exports = { terminalRoom, kdsRoom, venuePrepRoom, venueHostRoom, ordersRoom, emitToTerminal, emitToKds, emitToVenuePrep, emitToVenueHost, emitToTenantOrders };
