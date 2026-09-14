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
const { terminalRoom, kdsRoom } = require('../services/pos.realtime');

function attachPosGateway(io) {
  // Authenticate once at handshake. Reject anything that is not a POS token;
  // admin dashboards read reports over REST and have no business in this room.
  io.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token;
      if (!token) return next(new Error('auth required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'pos') return next(new Error('not a POS token'));
      socket.data.tenantId = String(decoded.tenantId);
      return next();
    } catch (err) {
      return next(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
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
  });
}

module.exports = { attachPosGateway };
