// socket/index.js
//
// POS realtime gateway.
//
// A terminal learns that another device opened, closed or switched the cashier
// on its session the moment it happens, instead of whenever its next poll
// lands. The security shape matters here: a websocket client must never be
// able to name the room it joins. Both the tenant and the terminal come from
// the verified POS JWT — the same token the REST API already demands — so a
// forged or foreign token cannot eavesdrop on another tenant's session feed.

const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const { terminalRoom, kdsRoom, venuePrepRoom, venueHostRoom, ordersRoom } = require('../services/pos.realtime');

function attachPosGateway(io) {
  // Authenticate once at handshake. Reject anything that is not a POS token;
  // admin dashboards read reports over REST and have no business in this room.
  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token;
    // Tokenless sockets (kiosk phone-pairing) are tagged with a null tenantId
    // and may join nothing below — every privileged join needs a verified
    // tenantId. They exist purely for the public pairing rooms in
    // attachKioskPairing, which carry only public product payloads.
    if (!token) {
      socket.data.tenantId = null;
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'pos') return next(new Error('not a POS token'));
      socket.data.tenantId = String(decoded.tenantId);
      return next();
    } catch (err) {
      return next(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Unauthenticated sockets never get near a POS room.
    if (!socket.data.tenantId) return;
    // Marketplace-order feed. Joined automatically at connection — there is
    // no join message, so the client never names a room and the tenant comes
    // only from the verified token (same trust shape as kds:join). A
    // marketplace order emitted on `orders:<tenantId>` reaches every terminal
    // and KDS screen of this tenant the moment it is placed.
    socket.join(ordersRoom(socket.data.tenantId));

    socket.on('pos:join', async ({ shopId = 'retail' } = {}, ack) => {
      try {
        if (shopId !== 'retail') {
          if (!/^[a-f\d]{24}$/i.test(shopId)) throw new Error('Invalid shop');
          const tenant = await Tenant.findOne({ _id: socket.data.tenantId, isActive: true }).select('posSettings.shops').lean();
          if (!tenant?.posSettings?.shops?.some(s => String(s._id) === shopId && s.active !== false)) throw new Error('Shop unavailable');
        }
        const room = terminalRoom(socket.data.tenantId, shopId);
        if (socket.data.posRoom && socket.data.posRoom !== room) await socket.leave(socket.data.posRoom);
        socket.join(room); socket.data.posRoom = room;
        if (typeof ack === 'function') ack({ ok: true, room });
      } catch { if (typeof ack === 'function') ack({ ok: false, message: 'Shop unavailable' }); }
    });

    // Kitchen display screens. Same rule as pos:join: the tenant comes from
    // the verified POS JWT, never from the join message.
    socket.on('kds:join', (_payload, ack) => {
      const room = kdsRoom(socket.data.tenantId);
      socket.join(room);
      if (typeof ack === 'function') ack({ ok: true, room });
    });

    // Venue preparation surfaces (S3 Task 5 — venue.preparation.changed).
    // Same rule as kds:join: the tenant comes from the verified POS JWT, so a
    // foreign token can never hear another tenant's preparation feed. The
    // location is within-tenant selection (the token carries no location) —
    // the room stays per location so one venue's stations hear only their own
    // tickets, and no cross-tenant escalation is possible.
    socket.on('venue-prep:join', ({ locationId = '' } = {}, ack) => {
      if (!/^[a-f\d]{24}$/i.test(locationId)) {
        if (typeof ack === 'function') ack({ ok: false, message: 'Invalid location' });
        return;
      }
      const room = venuePrepRoom(socket.data.tenantId, locationId);
      socket.join(room);
      if (typeof ack === 'function') ack({ ok: true, room });
    });

    // VIP host floor (Phase-4 E2 — venue.vip.arrived). Same rule as venue-prep:join:
    // the tenant comes from the verified POS JWT, never from the join message; the
    // location is within-tenant selection. The feed carries PERMITTED INFO ONLY
    // (name/partySize/action + provenance) — never spend, notes or guest history.
    socket.on('venue-host:join', ({ locationId = '' } = {}, ack) => {
      if (!/^[a-f\d]{24}$/i.test(locationId)) {
        if (typeof ack === 'function') ack({ ok: false, message: 'Invalid location' });
        return;
      }
      const room = venueHostRoom(socket.data.tenantId, locationId);
      socket.join(room);
      if (typeof ack === 'function') ack({ ok: true, room });
    });
  });
}

function attachKioskPairing(io) {
  // Kiosk phone-pairing rooms. The pairing code in the QR URL is the only
  // credential — the same capability model as the purchases Scan & Match
  // flow. Rooms receive only the public product payloads /scan already serves.
  io.on('connection', (socket) => {
    socket.on('pkiosk:join', (session) => {
      if (typeof session === 'string' && /^[a-z0-9-]{10,64}$/.test(session))
        socket.join(`pkiosk:${session}`);
    });
  });
}

module.exports = { attachPosGateway, attachKioskPairing };
