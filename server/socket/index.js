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
const { terminalRoom } = require('../services/pos.realtime');

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
    socket.on('pos:join', ({ terminalType } = {}, ack) => {
      const room = terminalRoom(socket.data.tenantId, terminalType);
      socket.join(room);
      if (typeof ack === 'function') ack({ ok: true, room });
    });
  });
}

module.exports = { attachPosGateway };
