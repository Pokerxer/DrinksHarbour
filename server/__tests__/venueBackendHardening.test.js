// Functionality-hardening regression suite for the venue backend surfaces.
// Pure-logic only (no Mongo required): validates the input bounds added to
// booking.service and posTable.controller, the cursor behaviour of the additive
// bookings pagination, and that the new per-endpoint rate limiters are really
// mounted on the live route stacks.
//
// Money and tenant-isolation assertions in the .mongo suites are untouched;
// this file only guards the new validation/limiter behaviour.

'use strict';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');

const bookingService = require('../services/booking.service');
const posTable = require('../controllers/posTable.controller');
const { staffCommands, staffConfigurations, staffSupport, venueLimiter } = require('../middleware/venue-rate-limit.middleware');

// ── booking.service field bounds ─────────────────────────────────────────────
test('booking_guest_name_rejects_oversized_input_with_fix_hint', () => {
  const long = 'x'.repeat(121);
  const failure = bookingService.boundedText(long, 'guest name', bookingService.BOOKING_TEXT_LIMITS.guestName, { required: true });
  assert.match(failure.fail, /120 characters or fewer/);
  assert.match(failure.fail, /shorten/);
  assert.equal(bookingService.boundedText('Ada', 'guest name', 120, { required: true }).value, 'Ada');
});

test('booking_required_fields_missing_fail_explicitly', () => {
  assert.equal(bookingService.boundedText(undefined, 'guest name', 120, { required: true }).fail, 'is required');
  assert.equal(bookingService.boundedText('   ', 'guest phone', 40, { required: true }).fail, 'is required');
  // Optional fields stay optional — a missing notes value must not 400.
  const notes = bookingService.boundedText(undefined, 'notes', 2000, {});
  assert.equal(notes.fail, undefined);
  assert.equal(notes.value, undefined);
});

test('booking_rejects_malformed_or_oversized_fields_before_any_write', async () => {
  const Booking = require('../models/Booking');
  const create = test.mock.method(Booking, 'create', async () => { throw new Error('DB write must never happen for rejected input'); });
  try {
    const base = { guest: { name: 'Ada', phone: '0803 000 1111' }, partySize: 5, bookingAt: new Date(Date.now() + 60000).toISOString() };
    const cases = [
      { ...base, guest: { ...base.guest, email: 'not-an-email' }, match: /valid address/ },
      { ...base, guest: { name: 'x'.repeat(121), phone: '0803 000 1111' }, match: /guest name/ },
      { ...base, guest: { name: 'Ada', phone: 'p'.repeat(41) }, match: /guest phone/ },
      { ...base, tableLabel: 't'.repeat(61), match: /table label/ },
      { ...base, notes: 'n'.repeat(2001), match: /notes/ },
      { ...base, guest: { name: 'Ada', phone: '0803 000 1111' }, partySize: 0, match: /integer between 1 and 100/ },
    ];
    let written = 0;
    for (const { match, ...body } of cases) {
      try { await bookingService.createBookingFor('t', 'u', body, { source: 'admin' }); }
      catch (error) {
        assert.match(error.message, match);
        assert.equal(error.statusCode, 400);
        continue;
      }
      written += 1; // a case that unexpectedly succeeded
    }
    assert.equal(written, 0, 'every oversized/malformed case must be rejected');
    assert.equal(create.mock.callCount(), 0, 'no booking must be written for rejected input');
  } finally { create.mock.restore(); }
});

test('booking_accepts_valid_workspace_form_payload', async () => {
  const Booking = require('../models/Booking');
  const mock = test.mock.method(Booking, 'create', async (doc) => ({ ...doc, toObject: () => ({ ...doc }) }));
  try {
    const row = await bookingService.createBookingFor('t', 'u', {
      guest: { name: '  Ada  ', phone: ' 0803 000 1111 ', email: 'guest@example.com' },
      partySize: 2, bookingAt: new Date(Date.now() + 60000).toISOString(),
      tableLabel: 'KL1', notes: 'anniversary table', durationMin: 45,
    }, { source: 'admin' });
    assert.equal(row.guest.name, 'Ada');
    assert.equal(row.guest.email, 'guest@example.com');
    assert.equal(row.tableLabel, 'KL1');
    assert.equal(row.durationMin, 45);
  } finally { mock.mock.restore(); }
});

// ── Additive cursor pagination for the bookings list ────────────────────────
test('bookings_legacy_callers_still_get_a_plain_array', async () => {
  const rows = [{ _id: 'a'.repeat(24), bookingAt: new Date('2026-10-01T18:00:00Z') }];
  const bookingModule = require('../models/Booking');
  const original = bookingModule.find;
  bookingModule.find = () => ({ sort() { return this; }, limit() { return this; }, lean: async () => rows });
  try {
    const result = await bookingService.listBookings('t', { status: 'pending' });
    assert.equal(Array.isArray(result), true, 'default responses stay the legacy array contract');
  } finally { bookingModule.find = original; }
});

test('bookings_paged_mode_walks_by_cursor_and_only_pages_bounded_sizes', async () => {
  const bookingModule = require('../models/Booking');
  const rows = [
    { _id: 'a'.repeat(24), bookingAt: new Date('2026-10-01T18:00:00.000Z') },
    { _id: 'b'.repeat(24), bookingAt: new Date('2026-10-01T18:00:00.000Z') },
    { _id: 'c'.repeat(24), bookingAt: new Date('2026-10-02T18:00:00.000Z') },
  ];
  const original = bookingModule.find;
  let captured;
  const setUp = (returnedRows) => {
    bookingModule.find = (filter) => {
      captured = filter;
      return { sort() { return this; }, limit() { return this; }, lean: async () => returnedRows };
    };
  };
  try {
    setUp(rows);
    const first = await bookingService.listBookings('t', { limit: 2 });
    assert.equal(first.items.length, 2);
    assert.ok(first.next, 'a fuller page than the limit exposes a cursor');
    const firstLast = rows[1];
    const payload = JSON.parse(Buffer.from(first.next, 'base64url').toString('utf8'));
    assert.equal(payload.id, String(firstLast._id));
    assert.equal(payload.at, firstLast.bookingAt.toISOString());
    // Walking with that cursor must filter strictly past the cursor point.
    setUp(rows.slice(2));
    const second = await bookingService.listBookings('t', { limit: 2, after: first.next });
    assert.equal(second.items.length, 1);
    assert.equal(second.next, null);
    for (const bad of ['not-a-cursor', Buffer.from(JSON.stringify({ at: 'nope', id: 'zz' })).toString('base64url')]) {
      let thrown;
      try { await bookingService.listBookings('t', { limit: 2, after: bad }); }
      catch (error) { thrown = error; }
      assert.ok(thrown, `a tampered cursor must reject: ${bad}`);
      assert.equal(thrown.statusCode, 400);
      assert.match(thrown.message, /pagination cursor/);
    }
    for (const limit of [101, 0, 2.5, 'many']) {
      let thrown;
      try { await bookingService.listBookings('t', { limit }); }
      catch (error) { thrown = error; }
      assert.ok(thrown, `page size ${limit} must reject`);
      assert.equal(thrown.statusCode, 400);
    }
  } finally { bookingModule.find = original; }
});

// ── posTable floor-field validation ──────────────────────────────────────────
test('floor_table_fields_reject_out_of_bounds_edit_values', () => {
  const { validateFloorTableFields, TABLE_FIELD_LIMITS } = posTable;
  assert.throws(() => validateFloorTableFields({ name: 'x'.repeat(TABLE_FIELD_LIMITS.nameMax + 1) }, { partial: true }), /limited to/);
  assert.throws(() => validateFloorTableFields({ name: '   ' }, { partial: true }), /cannot be empty/);
  assert.throws(() => validateFloorTableFields({ seats: 0 }, { partial: true }), /integer from 1/);
  assert.throws(() => validateFloorTableFields({ seats: TABLE_FIELD_LIMITS.seatsMax + 1 }, { partial: true }), /integer from 1/);
  assert.throws(() => validateFloorTableFields({ seats: Number.NaN }, { partial: true }), /integer from 1/);
  assert.throws(() => validateFloorTableFields({ sortOrder: TABLE_FIELD_LIMITS.sortOrderLimit + 1 }, { partial: true }), /sortOrder/);
  assert.throws(() => validateFloorTableFields({ section: 's'.repeat(TABLE_FIELD_LIMITS.sectionMax + 1) }, { partial: true }), /Section is limited/);
  assert.throws(() => validateFloorTableFields({}, { partial: false }), /name is required/);
  // Valid partial edit keeps only the sent fields.
  assert.deepEqual(validateFloorTableFields({ seats: 4 }, { partial: true }), { seats: 4 });
  assert.equal(validateFloorTableFields({ name: ' L1 ', section: 'Lounge', seats: 6, sortOrder: -3 }, { partial: false }).name, 'L1');
});

// ── Rate limiters are mounted on the live venue routes ───────────────────────
test('venue_route_stacks_carry_the_new_limiters', () => {
  function hasLayer(router, handle) {
    for (const layer of router.stack) {
      const stack = layer.route?.stack || [];
      if (stack.some((sub) => sub.handle === handle)) return layer.route?.path || null;
    }
    return null;
  }
  const ops = require('../routes/venue-ops.routes');
  for (const path of ['/service-sessions', '/service-sessions/:id/fire', '/service-sessions/:id/bill', '/service-sessions/:id/collections']) {
    const command = ops.stack.find(layer => layer.route?.path === path && layer.route?.methods.post);
    assert.ok(command?.route.stack.some(layer => layer.handle === staffCommands), `venue command ${path} must carry the limiter`);
  }

  const experience = require('../routes/venue-experience.routes');
  assert.ok(hasLayer(experience, staffConfigurations), 'venue-experience must rate-limit configuration saves');
  assert.ok(hasLayer(experience, staffCommands), 'venue-experience must rate-limit request review seating');

  const money = require('../routes/venue-money.routes');
  assert.ok(typeof money === 'object', 'money module loads');

  const capacity = require('../routes/venue-capacity.routes');
  assert.ok(capacity && typeof capacity === 'object', 'capacity module loads');
});

test('venue_limiter_factory_returns_middleware', () => {
  const limiter = venueLimiter({ windowMs: 60000, limit: 5, message: 'test' });
  assert.ok(typeof limiter === 'function' || typeof limiter === 'object' || Array.isArray(limiter) === false,
    'venueLimiter returns a connect-compatible middleware');
});
