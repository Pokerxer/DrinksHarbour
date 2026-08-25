// server/__tests__/posSocketGateway.test.js
//
// The security contract of the POS realtime gateway.
//
// A websocket client must never get to name the room it listens on. Rooms are
// `pos:<tenantId>:<terminal>`, and everything listening there is live session
// state for that tenant — receipts, totals, who is behind the counter. If the
// join message took a tenant from the client, any browser could subscribe to
// any tenant's feed by opening a socket and asking.
//
// So both halves of the room come from the POS JWT verified at handshake, and
// this test drives the exact middleware/handler pair that production wires up,
// through a stand-in io, asserting what each rejects and what it derives.

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { attachPosGateway } = require('../socket');

/** Minimal io/socket stand-ins capturing the middleware + handlers. */
function makeHarness() {
  const middleware = [];
  const handlers = {};
  const io = {
    use: (fn) => middleware.push(fn),
    on: (event, fn) => {
      handlers[event] = fn;
    },
  };
  attachPosGateway(io);
  return {
    middleware,
    connectionHandler: handlers.connection,
    async runHandshake(socket) {
      for (const mw of middleware) {
        await new Promise((resolve, reject) => {
          mw(socket, (err) => (err ? reject(err) : resolve()));
        });
      }
    },
  };
}

function makeSocket(auth = {}) {
  const rooms = new Set();
  return {
    handshake: { auth },
    data: {},
    joinedRooms: rooms,
    join: (room) => rooms.add(room),
  };
}

const signPOS = (tenantId) =>
  jwt.sign({ type: 'pos', userId: 'u1', tenantId }, process.env.JWT_SECRET);

test('a valid POS token passes the handshake and pins the tenant', async () => {
  const h = makeHarness();
  const socket = makeSocket({ token: signPOS('64f000000000000000000001') });

  await h.runHandshake(socket);

  assert.equal(
    socket.data.tenantId,
    '64f000000000000000000001',
    'the gateway did not pin the tenant from the token'
  );
});

test('a non-POS token is rejected at the handshake', async () => {
  // Admin JWTs are valid tokens for the REST API; they still buy nothing here.
  const h = makeHarness();
  const adminToken = jwt.sign(
    { userId: 'u2' },
    process.env.JWT_SECRET
  );
  const socket = makeSocket({ token: adminToken });

  await assert.rejects(() => h.runHandshake(socket), /not a POS token/);
});

test('a garbage token and a missing token are rejected', async () => {
  const h = makeHarness();

  await assert.rejects(
    () => h.runHandshake(makeSocket({ token: 'not-a-jwt' })),
    /invalid token/
  );
  await assert.rejects(
    () => h.runHandshake(makeSocket({})),
    /auth required/
  );
});

test('pos:join derives the room from the pinned tenant, not the payload', () => {
  // The client asks to join "retail"; the TENANT comes from its verified
  // token. A tampered tenantId in the join message changes nothing.
  const h = makeHarness();
  const socket = makeSocket({ token: signPOS('64f000000000000000000001') });
  socket.data.tenantId = '64f000000000000000000001';
  const registered = {};
  socket.on = (event, fn) => {
    registered[event] = fn;
  };

  h.connectionHandler(socket);
  registered['pos:join'](
    { terminalType: 'retail', tenantId: 'SOMEONE_ELSE' },
    undefined
  );

  assert.ok(
    socket.joinedRooms.has('pos:64f000000000000000000001:retail'),
    `joined ${[...socket.joinedRooms]} instead of the token's own room`
  );
  assert.ok(
    !socket.joinedRooms.has('pos:SOMEONE_ELSE:retail'),
    'a client-supplied tenant leaked into the room name'
  );
});

test('an unknown terminal type falls back to retail', () => {
  const h = makeHarness();
  const socket = makeSocket({ token: signPOS('64f000000000000000000002') });
  socket.data.tenantId = '64f000000000000000000002';
  const registered = {};
  socket.on = (event, fn) => {
    registered[event] = fn;
  };
  h.connectionHandler(socket);

  let ackResult = null;
  registered['pos:join']({ terminalType: '../../admin' }, (r) => (ackResult = r));

  assert.ok(
    socket.joinedRooms.has('pos:64f000000000000000000002:retail'),
    'a path-shaped terminal type reached the room name unvalidated'
  );
  assert.equal(ackResult.room, 'pos:64f000000000000000000002:retail');
});
