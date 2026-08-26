// server/__tests__/posKitchenRounds.test.js
//
// Kitchen display pipeline, part B1: firing cart lines off a held tab as
// kitchen rounds, and bumping them through pending → preparing → ready →
// served.
//
// The contract that matters most is the line key. The client computes
// `subProductId[_sizeId][__ci_<comboInstance>|__bxgy_<rewardId>_<role>]` and
// sends those strings back when the cashier fires a course; the server must
// derive byte-identical keys from its own parked cartItems, or a fired round
// will silently miss the line it was aimed at. Everything else — snapshotting,
// remainder math, the forward-only bump — hangs off that identity.
//
// Round snapshots exist because the parked cart keeps changing after the
// kitchen was told something: lines get renamed, quantities edited, extras
// added. What the kitchen owes the pass is frozen at fire time, so the tests
// deliberately mutate cartItems AFTER firing and prove the round did not move.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const Order = require('../models/Order');
const POSTable = require('../models/POSTable');
const Tenant = require('../models/Tenant');
const pos = require('../controllers/pos.controller');
const bcrypt = require('bcryptjs');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const STAFF = oid();
const TABLE = oid();
const TAB_ID = oid();
const SP_A = oid();
const SIZE_75 = oid();
const SIZE_1L = oid();

/**
 * Minimal stand-in for a chained Mongoose query. Thenable as well as chainable,
 * because these handlers await some queries without calling `.lean()`.
 */
function chainable(doc) {
  const q = {
    select: () => q,
    populate: () => q,
    sort: () => q,
    lean: async () => doc,
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  };
  return q;
}

function res() {
  const r = {};
  r.status = (code) => { r.code = code; return r; };
  r.json = (payload) => { r.body = payload; return r; };
  return r;
}

/** A request from a till whose tenant runs venue mode. */
function venueReq(body, extra = {}) {
  return {
    tenant: { _id: TENANT, posSettings: { isBarRestaurant: true } },
    posUser: { _id: STAFF },
    body,
    params: {},
    ...extra,
  };
}

/** Capturing stand-in for the socket.io server attached to app. */
function makeIo() {
  const calls = [];
  return {
    calls,
    to(room) {
      const call = { room, event: null, payload: null };
      calls.push(call);
      return { emit(event, payload) { call.event = event; call.payload = payload; } };
    },
  };
}

/** A held tab whose parked cart (and any already-fired rounds) the test controls. */
function heldDoc(cartItems, firedRounds) {
  const meta = {
    tableId: String(TABLE),
    guests: 2,
    openedAt: '2026-08-01T10:00:00.000Z',
    cartItems,
  };
  if (firedRounds) meta.firedRounds = firedRounds;
  return {
    _id: TAB_ID,
    createdAt: new Date('2026-08-01T09:58:00Z'),
    status: 'hold',
    holdMetadata: meta,
    saved: false,
    markedModified: [],
    markModified(path) { this.markedModified.push(path); },
    async save() { this.saved = true; return this; },
  };
}

/** One cart line exactly as `pos-cart.tsx` parks it. */
function cartLine(over = {}) {
  return {
    subProductId: String(SP_A),
    sizeId: String(SIZE_75),
    name: 'Hennessy VS',
    variant: '75cl',
    price: 4000,
    quantity: 3,
    discount: 0,
    costPrice: 3000,
    ...over,
  };
}

// ─── Line-key identity ───────────────────────────────────────────────────────

test('buildPosItemKey mirrors the client format for every line shape', () => {
  assert.equal(pos.buildPosItemKey({ subProductId: 'sp1' }), 'sp1');
  assert.equal(
    pos.buildPosItemKey({ subProductId: 'sp1', sizeId: 'sz9' }),
    'sp1_sz9'
  );
  assert.equal(
    pos.buildPosItemKey({ subProductId: 'sp1', sizeId: 'sz9', comboRef: { instanceId: 'ci3' } }),
    'sp1_sz9__ci_ci3'
  );
  assert.equal(
    pos.buildPosItemKey({ subProductId: 'sp1', bxgyRef: { rewardId: 'rw7', role: 'buy' } }),
    'sp1__bxgy_rw7_buy'
  );
  // A line can carry both refs; combo grouping wins, matching the client's
  // else-if order.
  assert.equal(
    pos.buildPosItemKey({
      subProductId: 'sp1',
      sizeId: 'sz9',
      comboRef: { instanceId: 'ci3' },
      bxgyRef: { rewardId: 'rw7', role: 'get' },
    }),
    'sp1_sz9__ci_ci3'
  );
});

test('nextRoundStatus allows only forward movement along the pipeline', () => {
  assert.equal(pos.nextRoundStatus('pending'), 'preparing');
  assert.equal(pos.nextRoundStatus('preparing'), 'ready');
  assert.equal(pos.nextRoundStatus('ready'), 'served');
  assert.equal(pos.nextRoundStatus('served'), null, 'served is terminal');
  assert.equal(pos.nextRoundStatus('whatever'), null);
});

// ─── Remainder math ──────────────────────────────────────────────────────────

test('computeUnfiredLines nets every fired round off the cart, per line key', () => {
  const cart = [
    cartLine(),                                                    // 75cl ×3
    cartLine({ sizeId: String(SIZE_1L), variant: '1L', quantity: 2 }), // 1L ×2
  ];
  const firedRounds = [
    { roundNo: 1, items: [{ key: `${SP_A}_${SIZE_75}`, quantity: 1 }] },
    { roundNo: 2, items: [{ key: `${SP_A}_${SIZE_75}`, quantity: 2 }] },
  ];

  const lines = pos.computeUnfiredLines(cart, firedRounds);

  // The 75cl split across two rounds is fully fired → gone. The 1L, though it
  // shares a subProduct with the fired line, is a distinct size key and stays.
  assert.deepEqual(
    lines.map((l) => [l.key, l.remaining]),
    [[`${SP_A}_${SIZE_1L}`, 2]]
  );
});

test('a partially fired line keeps only its remainder', () => {
  const [line] = pos.computeUnfiredLines(
    [cartLine({ quantity: 3 })],
    [{ roundNo: 1, items: [{ key: `${SP_A}_${SIZE_75}`, quantity: 2 }] }]
  );
  assert.equal(line.remaining, 1);
  assert.equal(line.item.name, 'Hennessy VS');
});

// ─── Fire round ──────────────────────────────────────────────────────────────

test('fireRoundFromCart appends a frozen snapshot and tells the KDS', async (t) => {
  const doc = heldDoc([cartLine({ quantity: 3 })]);   // no firedRounds yet
  t.mock.method(Order, 'findOne', () => chainable(doc));

  const io = makeIo();
  const r = res();
  await pos.fireRoundFromCart(
    venueReq(
      { itemKeys: [`${SP_A}_${SIZE_75}`] },
      { params: { id: String(TAB_ID) }, app: { get: () => io } }
    ),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.body.success, true);
  assert.ok(doc.saved, 'the fire must persist through save()');
  assert.ok(doc.markedModified.includes('holdMetadata'));

  const rounds = doc.holdMetadata.firedRounds;
  assert.equal(rounds.length, 1);
  const round = rounds[0];
  assert.equal(round.roundNo, 1);
  assert.equal(round.status, 'pending');
  assert.equal(String(round.firedBy), String(STAFF));
  assert.ok(round.firedAt instanceof Date);
  assert.equal(round.bumpedAt, null);
  assert.equal(round.bumpedBy, null);

  // Snapshot carries what the kitchen needs, keyed the way later fires will
  // look the line up again.
  assert.deepEqual(round.items, [{
    key: `${SP_A}_${SIZE_75}`,
    name: 'Hennessy VS',
    variant: '75cl',
    quantity: 3,
    subProductId: String(SP_A),
  }]);

  // Snapshot immutability: the parked cart keeps living after the fire —
  // renaming and re-quantifying a line must not rewrite the fired ticket.
  doc.holdMetadata.cartItems[0].name = 'RENAMED';
  doc.holdMetadata.cartItems[0].quantity = 99;
  assert.equal(round.items[0].name, 'Hennessy VS');
  assert.equal(round.items[0].quantity, 3);

  // Realtime: the KDS room hears about it, derived from the token's tenant.
  assert.equal(io.calls.length, 1);
  assert.equal(io.calls[0].room, `kds:${TENANT}`);
  assert.equal(io.calls[0].event, 'kds:update');
  assert.equal(String(io.calls[0].payload.orderId), String(TAB_ID));
  assert.ok(io.calls[0].payload.at, 'the event carries a timestamp');
});

test('a later fire numbers itself past the last stored round and nets prior fires', async (t) => {
  const doc = heldDoc([cartLine({ quantity: 5 })], [
    { roundNo: 3, status: 'pending', items: [{ key: `${SP_A}_${SIZE_75}`, quantity: 2 }] },
  ]);
  t.mock.method(Order, 'findOne', () => chainable(doc));

  const r = res();
  await pos.fireRoundFromCart(
    venueReq({ itemKeys: [`${SP_A}_${SIZE_75}`] }, { params: { id: String(TAB_ID) } }),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.body.data.round.roundNo, 4, 'roundNo continues the stored sequence');
  assert.equal(r.body.data.round.items[0].quantity, 3, 'only the never-fired remainder goes out');
});

test('firing a key with nothing left to fire refuses and names the key', async (t) => {
  const doc = heldDoc([cartLine({ quantity: 2 })], [
    { roundNo: 1, status: 'pending', items: [{ key: `${SP_A}_${SIZE_75}`, quantity: 2 }] },
  ]);
  t.mock.method(Order, 'findOne', () => chainable(doc));

  const r = res();
  await pos.fireRoundFromCart(
    venueReq({ itemKeys: [`${SP_A}_${SIZE_75}`] }, { params: { id: String(TAB_ID) } }),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 400);
  assert.ok(r.body.message.includes(`${SP_A}_${SIZE_75}`));
  assert.equal(doc.saved, false, 'a refused fire must not persist anything');
});

test('a malformed itemKeys body is refused before anything else happens', async (t) => {
  // The tab exists and is reachable — only the body shape is wrong. (Flow
  // order per the endpoint: venue gate → tab lookup → body validation.)
  t.mock.method(Order, 'findOne', () => chainable(heldDoc([cartLine()])));

  for (const bad of [undefined, [], ['ok', 42], 'not-an-array']) {
    const r = res();
    await pos.fireRoundFromCart(
      venueReq({ itemKeys: bad }, { params: { id: String(TAB_ID) } }),
      r,
      (err) => { throw err; }
    );
    assert.equal(r.code, 400, `itemKeys ${JSON.stringify(bad)} must be rejected`);
  }
});

// ─── Kitchen board feed ──────────────────────────────────────────────────────

test('getKitchenActive serves unserved rounds oldest-fired first, naming tables', async (t) => {
  const servedOnlyTab = {
    _id: oid(),
    createdAt: new Date('2026-08-01T09:00:00Z'),
    holdMetadata: {
      tableId: String(TABLE),
      guests: 2,
      openedAt: '2026-08-01T08:50:00.000Z',
      firedRounds: [{ roundNo: 1, status: 'served', firedAt: '2026-08-01T09:05:00.000Z', items: [] }],
    },
  };
  const newerActiveTab = {
    _id: oid(),
    createdAt: new Date('2026-08-01T10:10:00Z'),
    holdMetadata: {
      tableId: String(TABLE),
      guests: 4,
      openedAt: '2026-08-01T10:00:00.000Z',
      firedRounds: [
        { roundNo: 1, status: 'served', firedAt: '2026-08-01T10:20:00.000Z', items: [] },
        { roundNo: 2, status: 'pending', firedAt: '2026-08-01T10:40:00.000Z', items: [{ key: 'k2', quantity: 1 }] },
      ],
    },
  };
  const olderActiveTab = {
    _id: TAB_ID,
    createdAt: new Date('2026-08-01T09:28:00Z'),
    holdMetadata: {
      tableId: String(TABLE),
      guests: 4,
      openedAt: '2026-08-01T09:25:00.000Z',
      firedRounds: [{ roundNo: 1, status: 'preparing', firedAt: '2026-08-01T09:30:00.000Z', items: [{ key: 'k1', quantity: 3 }] }],
    },
  };
  const walkInTab = {
    _id: oid(),
    createdAt: new Date('2026-08-01T11:00:00Z'),
    holdMetadata: { cartItems: [cartLine()] },   // parked, nothing ever fired
  };

  // Deliberately newest-first, like the DB would hand them back: the endpoint
  // owns the oldest-fired ordering.
  t.mock.method(Order, 'find', () => chainable([walkInTab, servedOnlyTab, newerActiveTab, olderActiveTab]));

  let tableFilter = null;
  let tableFindCalls = 0;
  t.mock.method(POSTable, 'find', (filter) => {
    tableFindCalls += 1;
    tableFilter = filter;
    return chainable([{ _id: TABLE, name: 'Bar 1' }]);
  });

  const r = res();
  await pos.getKitchenActive(venueReq({}, {}), r, (err) => { throw err; });

  assert.equal(r.body.success, true);
  const orders = r.body.data.orders;

  // Served-only and never-fired tabs never reach the board.
  assert.equal(orders.length, 2);
  assert.deepEqual(orders.map((o) => o.orderId), [olderActiveTab._id, newerActiveTab._id]);

  const [first, second] = orders;
  assert.equal(first.tableName, 'Bar 1');
  assert.equal(second.tableName, 'Bar 1');
  assert.equal(first.guests, 4);
  assert.equal(new Date(first.openedAt).toISOString(), '2026-08-01T09:25:00.000Z');

  // Served rounds drop out of each ticket even when newer ones stay.
  assert.equal(second.rounds.length, 1);
  assert.equal(second.rounds[0].roundNo, 2);

  // One table-name query for the whole batch, scoped to the tenant.
  assert.equal(tableFindCalls, 1);
  assert.equal(String(tableFilter.tenant), String(TENANT));
  assert.deepEqual(tableFilter._id.$in.map(String), [String(TABLE)]);
});

test('a tab with no table still reaches the board, falling back to createdAt', async (t) => {
  const bareTab = {
    _id: TAB_ID,
    createdAt: new Date('2026-08-01T11:00:00Z'),
    holdMetadata: {
      guests: 0,
      firedRounds: [{ roundNo: 1, status: 'pending', firedAt: '2026-08-01T11:05:00.000Z', items: [{ key: 'k', quantity: 1 }] }],
    },
  };
  t.mock.method(Order, 'find', () => chainable([bareTab]));
  const tableFind = t.mock.method(POSTable, 'find', () => chainable([]));

  const r = res();
  await pos.getKitchenActive(venueReq({}, {}), r, (err) => { throw err; });

  const [row] = r.body.data.orders;
  assert.equal(row.tableName, null);
  assert.equal(tableFind.mock.callCount(), 0, 'no table lookup needed when nobody sat down');
  assert.equal(new Date(row.openedAt).toISOString(), new Date(bareTab.createdAt).toISOString());
});

// ─── Bump ────────────────────────────────────────────────────────────────────

test('bumping forward stamps who bumped and persists', async (t) => {
  const doc = heldDoc([], [
    { roundNo: 1, status: 'pending', items: [], bumpedAt: null, bumpedBy: null },
  ]);
  t.mock.method(Order, 'findOne', () => chainable(doc));

  const before = new Date(Date.now() - 1000);
  const r = res();
  await pos.bumpKitchenRound(
    venueReq({ orderId: String(TAB_ID), roundNo: 1, nextStatus: 'preparing' }, {}),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.body.success, true);
  const round = r.body.data.round;
  assert.equal(round.status, 'preparing');
  assert.equal(String(round.bumpedBy), String(STAFF));
  assert.ok(new Date(round.bumpedAt) >= before);
  assert.ok(doc.saved);
  assert.ok(doc.markedModified.includes('holdMetadata'));
});

test('bumping a round backwards is refused and names the pipeline rule', async (t) => {
  const doc = heldDoc([], [
    { roundNo: 1, status: 'preparing', items: [], bumpedAt: new Date(), bumpedBy: STAFF },
  ]);
  t.mock.method(Order, 'findOne', () => chainable(doc));

  const r = res();
  await pos.bumpKitchenRound(
    venueReq({ orderId: String(TAB_ID), roundNo: 1, nextStatus: 'pending' }, {}),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 400);
  assert.match(r.body.message, /round is preparing, next is ready/);
  assert.equal(doc.saved, false);
});

test('bumping a round the tab does not have is a 404', async (t) => {
  const doc = heldDoc([], [
    { roundNo: 1, status: 'pending', items: [], bumpedAt: null, bumpedBy: null },
  ]);
  t.mock.method(Order, 'findOne', () => chainable(doc));

  const r = res();
  await pos.bumpKitchenRound(
    venueReq({ orderId: String(TAB_ID), roundNo: 9, nextStatus: 'preparing' }, {}),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 404);
  assert.equal(doc.saved, false);
});

// ─── Venue gate ──────────────────────────────────────────────────────────────

test('all three kitchen endpoints refuse to run when venue mode is off', async (t) => {
  // No DB mocks on purpose: the gate must fire before anything is touched.
  const plainReq = {
    tenant: { _id: TENANT },
    posUser: { _id: STAFF },
    body: {},
    params: {},
  };

  const r1 = res();
  await pos.fireRoundFromCart(plainReq, r1, (err) => { throw err; });
  assert.equal(r1.code, 400);
  assert.equal(r1.body.message, 'venue mode disabled');

  const r2 = res();
  await pos.getKitchenActive(plainReq, r2, (err) => { throw err; });
  assert.equal(r2.code, 400);
  assert.equal(r2.body.message, 'venue mode disabled');

  const r3 = res();
  await pos.bumpKitchenRound(plainReq, r3, (err) => { throw err; });
  assert.equal(r3.code, 400);
  assert.equal(r3.body.message, 'venue mode disabled');
});

// ─── kitchenAlertMins plumbing ───────────────────────────────────────────────

test('Tenant.posSettings declares kitchenAlertMins with a sane floor', () => {
  const p = Tenant.schema.path('posSettings.kitchenAlertMins');
  assert.ok(p, 'kitchenAlertMins is missing from Tenant.posSettings');
  assert.equal(p.defaultValue, 10);
  assert.equal(p.options.min, 1);
});

test('staffLogin passes kitchenAlertMins through with a default', async (t) => {
  const loginWith = async (posSettings) => {
    const tenant = {
      _id: oid(),
      slug: 'harbour-bar',
      name: 'Harbour Bar',
      primaryColor: '#000',
      logo: {},
      isActive: true,
      posSettings,
    };
    t.mock.method(Tenant, 'findOne', () => chainable(tenant));
    t.mock.method(require('../models/User'), 'findOne', () => chainable({
      _id: STAFF, email: 's@x.com', firstName: 'A', lastName: 'B',
      role: 'tenant_staff', tenant: tenant._id, posPermissions: ['pos:sell'],
      posPinHash: '$2a$10$placeholder',   // presence gates the PIN branch
    }));
    t.mock.method(bcrypt, 'compare', async () => true);

    const r = res();
    await pos.staffLogin(
      { body: { tenantSlug: 'harbour-bar', staffId: String(STAFF), pin: '1234' } },
      r,
      (err) => { throw err; }
    );
    assert.equal(r.body.success, true);
    return r.body.data.tenant.posSettings.kitchenAlertMins;
  };

  assert.equal(await loginWith({}), 10, 'unset setting falls back to 10 minutes');
  assert.equal(await loginWith({ kitchenAlertMins: 7 }), 7);
});

test('updatePOSSettings accepts whole-minute values of one or more only', async (t) => {
  const attempt = async (posSettings) => {
    let captured = null;
    t.mock.method(Tenant, 'findByIdAndUpdate', (id, update) => {
      captured = update;
      return Promise.resolve({ posSettings });
    });
    const r = res();
    await pos.updatePOSSettings(
      venueReq({ posSettings }, {}),
      r,
      (err) => { throw err; }
    );
    return { r, captured };
  };

  const ok = await attempt({ kitchenAlertMins: 12 });
  assert.equal(ok.r.body.success, true);
  assert.equal(ok.captured.$set['posSettings.kitchenAlertMins'], 12);

  for (const bad of [0, -3]) {
    const refused = await attempt({ kitchenAlertMins: bad });
    assert.equal(refused.r.code, 400, `kitchenAlertMins ${bad} must be refused`);
    assert.equal(refused.captured, null, 'nothing may persist below the floor');
  }
});
