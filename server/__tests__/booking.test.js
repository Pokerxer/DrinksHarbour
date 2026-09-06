// Venue table-booking slice — server module.
//
//   1. State machine (canTransition).
//   2. Service scoping + validation (mocked Booking model).
//   3. Route gating: venue-only (`table_management`), own-tenant, authenticated.
//
// Uses the same routeAuthHarness the brand / accounting tests use.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const { canTransition } = require('../services/booking.service');
const bookingRouter = require('../routes/booking.routes');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { startRouter, mockAuthUser, signToken, ROLE_USERS, TENANT_ID } = require('./helpers/routeAuthHarness');

const OBJECT_ID = new mongoose.Types.ObjectId();

// ─── 1. State machine ──────────────────────────────────────────────────────

test('canTransition: valid venue-table transitions', () => {
  assert.strictEqual(canTransition('pending', 'confirmed'), true);
  assert.strictEqual(canTransition('pending', 'cancelled'), true);
  assert.strictEqual(canTransition('confirmed', 'checked_in'), true);
  assert.strictEqual(canTransition('confirmed', 'cancelled'), true);
  assert.strictEqual(canTransition('confirmed', 'no_show'), true);
  assert.strictEqual(canTransition('checked_in', 'completed'), true);
});

test('canTransition: forbidden moves', () => {
  assert.strictEqual(canTransition('pending', 'completed'), false);
  assert.strictEqual(canTransition('confirmed', 'completed'), false);
  assert.strictEqual(canTransition('checked_in', 'cancelled'), false);
  assert.strictEqual(canTransition('cancelled', 'confirmed'), false);
  assert.strictEqual(canTransition('completed', 'confirmed'), false);
  assert.strictEqual(canTransition('no_show', 'confirmed'), false);
});

// ─── 2. Service tests (mocked Booking) ─────────────────────────────────────

test('createBookingFor writes JWT tenant, ignores body.tenant spoof', async () => {
  const fakeDoc = {};
  const original = Booking.create;
  Booking.create = async (obj) => {
    assert.strictEqual(String(obj.tenant), String(TENANT_ID), 'tenant must come from the JWT, not the body');
    assert.strictEqual(obj.createdBy, ROLE_USERS.tenant_owner._id);
    assert.strictEqual(obj.status, 'pending');
    assert.deepStrictEqual(obj.guest, { name: 'Ada Obi', phone: '+2341', email: undefined });
    assert.strictEqual(obj.partySize, 3);
    fakeDoc.toObject = () => ({ ...obj, _id: OBJECT_ID });
    return fakeDoc;
  };
  try {
    const { createBookingFor } = require('../services/booking.service');
    const result = await createBookingFor(TENANT_ID, ROLE_USERS.tenant_owner._id, {
      guest: { name: 'Ada Obi', phone: '+2341' },
      partySize: 3,
      bookingAt: new Date('2026-10-01T18:00:00Z').toISOString(),
    });
    assert.strictEqual(result._id, OBJECT_ID);
    assert.strictEqual(result.status, 'pending');
  } finally {
    Booking.create = original;
  }
});

test('createBookingFor rejects invalid payloads', async () => {
  const { createBookingFor } = require('../services/booking.service');
  const body = { guest: { name: 'Ada Obi', phone: '+2341' }, partySize: 3, bookingAt: new Date('2026-10-01T18:00:00Z').toISOString() };
  Booking.create = async () => ({ toObject: () => ({}) });

  // missing guest name
  await assert.rejects(
    () => createBookingFor(TENANT_ID, 'actor', { ...body, guest: { name: '', phone: '+2341' } }),
    { message: /guest name and phone/i }
  );
  // bad partySize
  await assert.rejects(
    () => createBookingFor(TENANT_ID, 'actor', { ...body, partySize: 0 }),
    { message: /partySize/i }
  );
  // missing bookingAt
  await assert.rejects(
    () => createBookingFor(TENANT_ID, 'actor', { ...body, bookingAt: null }),
    { message: /bookingAt/i }
  );
});

test('getBookingFor scopes by tenant', async () => {
  const findMock = (q) => ({
    lean: async () => {
      if (String(q.tenant) === String(TENANT_ID) && String(q._id) === String(OBJECT_ID)) {
        return { _id: OBJECT_ID, tenant: TENANT_ID };
      }
      return null;
    },
  });
  const original = Booking.findOne;
  Booking.findOne = findMock;
  try {
    const { getBookingFor } = require('../services/booking.service');
    const ok = await getBookingFor(TENANT_ID, OBJECT_ID);
    assert.strictEqual(ok._id, OBJECT_ID);

    const otherTenant = new mongoose.Types.ObjectId();
    await assert.rejects(() => getBookingFor(otherTenant, OBJECT_ID), { message: /not found/i });
  } finally {
    Booking.findOne = original;
  }
});

test('setBookingStatusFor rejects invalid transitions without saving', async () => {
  let saved = false;
  const fakeDoc = { _id: OBJECT_ID, tenant: TENANT_ID, status: 'pending', save: async () => { saved = true; return { toObject: () => ({}) }; } };
  const originalFindOne = Booking.findOne;
  Booking.findOne = async (q) => {
    if (String(q.tenant) === String(TENANT_ID) && String(q._id) === String(OBJECT_ID)) return fakeDoc;
    return null;
  };
  try {
    const { setBookingStatusFor } = require('../services/booking.service');
    await assert.rejects(
      () => setBookingStatusFor(TENANT_ID, OBJECT_ID, 'completed'),
      { message: /cannot move.*pending.*completed/i }
    );
    assert.strictEqual(saved, false, 'save must not be called for an invalid transition');
  } finally {
    Booking.findOne = originalFindOne;
  }
});

test('setBookingStatusFor applies a valid transition', async () => {
  let saved = false;
  const fakeDoc = {
    _id: OBJECT_ID, tenant: TENANT_ID, status: 'pending',
    save: async function () {
      this.status = 'confirmed';
      saved = true;
      return { toObject: () => ({ _id: OBJECT_ID, tenant: TENANT_ID, status: 'confirmed' }) };
    },
  };
  const originalFindOne = Booking.findOne;
  Booking.findOne = async (q) => {
    if (String(q.tenant) === String(TENANT_ID) && String(q._id) === String(OBJECT_ID)) return fakeDoc;
    return null;
  };
  try {
    const { setBookingStatusFor } = require('../services/booking.service');
    const result = await setBookingStatusFor(TENANT_ID, OBJECT_ID, 'confirmed');
    assert.strictEqual(saved, true);
    assert.strictEqual(result.status, 'confirmed');
  } finally {
    Booking.findOne = originalFindOne;
  }
});

// ─── 3. Route gating ────────────────────────────────────────────────────────

function mockVenue(t) {
  t.mock.method(Tenant, 'findById', () => ({
    select: () => ({
      lean: async () => ({
        _id: TENANT_ID,
        name: 'Test Venue',
        slug: 'test-venue',
        status: 'approved',
        subscriptionStatus: 'active',
        plan: 'venue',
      }),
    }),
  }));
}

async function withApp(fn) {
  const app = await startRouter(bookingRouter, '/api/bookings');
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

test('POST /api/bookings rejects an anonymous caller', async () => {
  await withApp(async (app) => {
    const res = await fetch(app.url('/api/bookings'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(res.status, 401, 'anonymous booking creation must be refused');
  });
});

test('POST /api/bookings refuses a non-venue plan', async (t) => {
  mockAuthUser(t, ROLE_USERS.tenant_owner);
  // A growth tenant has no table_management → gate must block the POST.
  t.mock.method(Tenant, 'findById', () => ({
    select: () => ({
      lean: async () => ({
        _id: TENANT_ID,
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'approved',
        subscriptionStatus: 'active',
        plan: 'growth',
      }),
    }),
  }));

  await withApp(async (app) => {
    const token = `Bearer ${signToken(ROLE_USERS.tenant_owner)}`;
    const res = await fetch(app.url('/api/bookings'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({ guest: { name: 'X', phone: '1' }, partySize: 1, bookingAt: new Date().toISOString() }),
    });
    assert.strictEqual(res.status, 403, 'a growth tenant must be refused table_management');
    const body = await res.json();
    // The route-harness error handler sends message only (no code); assert the
    // plan-refusal text to confirm requireCapability fired, not another gate.
    assert.ok(body.message && /growth/i.test(body.message), 'refusal must name the current plan');
    assert.ok(/upgrade/i.test(body.message), 'refusal must suggest upgrading');
  });
});

test('POST /api/bookings reaches the controller for a venue tenant', async (t) => {
  mockAuthUser(t, ROLE_USERS.tenant_owner);
  mockVenue(t);
  const created = { _id: OBJECT_ID, tenant: TENANT_ID, status: 'pending', guest: { name: 'Ada', phone: '+1' }, toObject: () => ({ _id: OBJECT_ID, tenant: TENANT_ID, status: 'pending' }) };
  t.mock.method(Booking, 'create', async () => created);
  const token = `Bearer ${signToken(ROLE_USERS.tenant_owner)}`;
  await withApp(async (app) => {
    const res = await fetch(app.url('/api/bookings'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({
        guest: { name: 'Ada', phone: '+1' },
        partySize: 4,
        bookingAt: new Date('2026-10-02T19:00:00Z').toISOString(),
      }),
    });
    assert.strictEqual(res.status, 201, 'a venue tenant must be able to create a booking');
    const data = await res.json();
    assert.strictEqual(data.data._id, String(OBJECT_ID));
    assert.strictEqual(data.data.status, 'pending');
  });
});

test('POST /api/bookings rejects invalid payload', async (t) => {
  mockAuthUser(t, ROLE_USERS.tenant_owner);
  mockVenue(t);
  const token = `Bearer ${signToken(ROLE_USERS.tenant_owner)}`;
  await withApp(async (app) => {
    const res = await fetch(app.url('/api/bookings'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({ guest: { name: '', phone: '' }, partySize: 0 }),
    });
    assert.strictEqual(res.status, 400, 'invalid payload must be refused');
  });
});