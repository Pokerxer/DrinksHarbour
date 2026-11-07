'use strict';
// Task 2 (E3) — offer → bounded hold → acceptance race. The offer command
// reuses the EXISTING Phase-2 claim machinery: ONE waiting entry → a REAL
// VenueCapacityClaim (state 'held') over specific tables for a pending offer
// Booking, with the claim's expiresAt SET TO the offer's acceptance deadline —
// so the EXISTING capacity-expiry sweep releases it exactly at the deadline
// (additive: the sweep also flips the offered entry → expired). Covers:
// the hold blocks other claims (resource exclusivity — the same table is never
// promised to two guests); two concurrent candidates race for the same table
// (exactly one wins); the acceptance race (two accepts → one wins, loser
// STATE_CHANGED); accept after expiry → WAITLIST_OFFER_EXPIRED with NO
// confirmation and NO charge; the sweep releases expired holds without TTL
// deletion (Phase-2 semantics); payment-required acceptance → PAYMENT HOLD
// (claim stays 'held' with a deposit deadline — never an unconditional
// confirmation); decline/cancel release the hold via the existing release path.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const at = n => new Date(Date.now() + n * 60000).toISOString();

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));

async function boot(t, suffix, { money = false } = {}) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  process.env.VENUE_CAPACITY_ENABLED = 'true';
  t.after(() => delete process.env.VENUE_CAPACITY_ENABLED);
  const capacity = require('../services/venue/capacity');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueWaitlistEntry').createIndexes();
  await require('../models/VenueOperation').createIndexes();
  await capacity.ensureIndexes();
  const second = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: 'Table 2', seats: 4 });
  const resources = [...args.tableIds, String(second._id)];
  await capacity.savePolicy({ ...args, expectedVersion: 0, idempotencyKey: 'policy', input: {
    enabled: true, timezone: 'Africa/Lagos', resources, combinations: [resources],
    windows: [{ start: at(10), end: at(600) }], durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, holdSeconds: 60,
  } });
  if (money) {
    process.env.VENUE_MONEY_ENABLED = 'true';
    t.after(() => delete process.env.VENUE_MONEY_ENABLED);
    const reviewer = new mongoose.Types.ObjectId();
    await require('../models/User').collection.insertOne({ _id: reviewer, role: 'super_admin', status: 'active' });
    await require('../models/VenueFinancialPolicy').create({ tenant: args.tenantId, location: args.locationId, version: 1, state: 'approved', approvedBy: reviewer, approvedAt: new Date(), decisionOwner: 'Local test reviewer', currency: 'NGN', depositMinor: 5000000, paymentWindowSeconds: 600, minimumMinor: 0, cancellationTerms: 'Review', noShowTerms: 'Review', excessCreditTerms: 'Review', refundAuthority: 'owner_review', refundFunding: 'original_collection', taxTreatment: 'existing_merchandise', eligibility: 'merchandise_net', accounts: { advance: '2250', clearing: '1300' } });
    await require('../models/VenueCapacityPolicy').updateOne({ tenant: args.tenantId, location: args.locationId }, { $set: { financialPolicyVersion: 1 } });
  }
  const waitlist = require('../services/venue/waitlist');
  const entry = await waitlist.createStaff({ ...args, actor: { ...args.actor }, idempotencyKey: 'entry', input: {
    name: 'Ada Obi', phone: '+2348012345678', partySize: 4, verifiedContactRoute: 'sms',
    window: { earliestAt: at(20), latestAt: at(300) },
  } });
  return { ...args, resources, entryId: entry.id, entryVersion: entry.version, waitlist };
}

test('offer creates a real bounded hold; resource exclusivity; offer idempotency and state machine', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_offer');
  const waitlist = args.waitlist, capacity = require('../services/venue/capacity');
  const base = over => ({ tenantId: args.tenantId, actor: { ...args.actor }, entryId: args.entryId, expectedVersion: args.entryVersion, ...over });

  // validation first: offset-less bookingAt (the validateRequest rule), outside the entry window
  await assertFails(waitlist.offer(base({ idempotencyKey: 'off-0a', input: { bookingAt: new Date(Date.now() + 30 * 60000).toISOString().replace(/Z$/, '') } })), 'INVALID_INPUT', 400);
  await assertFails(waitlist.offer(base({ idempotencyKey: 'off-0b', input: { bookingAt: at(400) } })), 'INVALID_INPUT', 400); // outside window.latestAt

  // the offer: ONE waiting entry → a REAL held claim with the offer deadline
  // (the bookingAt is pinned once — the idempotency replay hash must match byte-for-byte)
  const offerAt = at(30);
  const offered = await waitlist.offer(base({ idempotencyKey: 'off-1', input: { bookingAt: offerAt, resourceIds: args.tableIds } }));
  assert.equal(offered.state, 'offered');
  assert.equal(offered.offer.claimRef != null, true);
  assert.equal(offered.offer.bookingRef != null, true);
  const claim = await require('../models/VenueCapacityClaim').findById(offered.offer.claimRef).lean();
  assert.equal(claim.state, 'held');
  assert.deepEqual(claim.resources.map(String), args.tableIds);
  // the acceptance deadline IS the claim's expiry (the existing sweep releases it there)
  assert.equal(claim.expiresAt.getTime(), new Date(offered.offer.expiresAt).getTime());
  assert.ok(new Date(offered.offer.expiresAt).getTime() > Date.now() + 14 * 60000); // bounded ~15 min by default
  const booking = await require('../models/Booking').findById(offered.offer.bookingRef).lean();
  assert.equal(booking.status, 'pending'); // the offer is NEVER a confirmed booking
  assert.equal(booking.requestReference != null, true);

  // resource exclusivity: the SAME table cannot be promised to another party meanwhile
  const rival = await require('../models/Booking').create({ tenant: args.tenantId, location: args.locationId, createdBy: args.actor.userId, guest: { name: 'Rival', phone: '999' }, partySize: 2, bookingAt: at(30), acquisitionAuthority: 'server' });
  await assertFails(capacity.claim({ ...args, bookingId: String(rival._id), resourceIds: args.tableIds, bookingAt: at(30), partySize: 2, policyVersion: 1, idempotencyKey: 'rival' }), 'CAPACITY_UNAVAILABLE', 409);

  // two concurrent candidates for the SAME table in the SAME interval (a second
  // waitlist entry's offer vs a plain claim): the claim machinery arbitrates —
  // exactly one wins, so the same table is never promised to two guests
  const rivalEntry = await waitlist.createStaff({ ...args, actor: { ...args.actor }, idempotencyKey: 'entry-2', input: { name: 'Bola', phone: '+2348020000000', partySize: 2, verifiedContactRoute: 'in_app', window: { earliestAt: at(20), latestAt: at(300) } } });
  const [a, b] = await Promise.allSettled([
    waitlist.offer({ ...args, actor: { ...args.actor }, entryId: rivalEntry.id, expectedVersion: rivalEntry.version, input: { bookingAt: at(30), resourceIds: [args.resources[1]] }, idempotencyKey: 'off-race-a' }),
    capacity.claim({ ...args, bookingId: String(rival._id), resourceIds: [args.resources[1]], bookingAt: at(30), partySize: 2, policyVersion: 1, idempotencyKey: 'rival-2' }),
  ]);
  assert.equal([a, b].filter(r => r.status === 'fulfilled').length, 1);

  // one active offer per entry: a second offer on an offered entry refuses
  await assertFails(waitlist.offer(base({ idempotencyKey: 'off-2', input: { bookingAt: at(30), resourceIds: [args.resources[1]] } })), 'STATE_CHANGED', 409);
  // idempotent replay
  assert.deepEqual(await waitlist.offer(base({ idempotencyKey: 'off-1', input: { bookingAt: offerAt, resourceIds: args.tableIds } })), offered);
  // availability shows the held tables busy while the offer is live
  const busy = await capacity.availability({ ...args, bookingAt: at(30), partySize: 2 });
  assert.equal(busy.options.length, 0);
});

test('acceptance race: first valid acceptance wins; payment-required acceptance stays a PAYMENT HOLD', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_offer_race', { money: true });
  const waitlist = args.waitlist;
  const base = over => ({ tenantId: args.tenantId, actor: { ...args.actor }, entryId: args.entryId, ...over });
  const offered = await waitlist.offer(base({ expectedVersion: args.entryVersion, idempotencyKey: 'off-m', input: { bookingAt: at(30), resourceIds: args.tableIds } }));
  assert.equal(offered.state, 'offered');
  const accept = key => waitlist.accept(base({ idempotencyKey: key }));
  const results = await Promise.allSettled([accept('acc-a'), accept('acc-b')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); // first valid acceptance wins
  const winner = results.find(r => r.status === 'fulfilled').value;
  assert.equal(winner.state, 'accepted');
  assert.equal(winner.acceptedBooking.status, 'confirmed');
  const booking = await require('../models/Booking').findById(offered.offer.bookingRef).lean();
  assert.equal(booking.status, 'confirmed');
  // PAYMENT HOLD: the deposit-required booking holds capacity on a DEADLINE —
  // the claim stays 'held' with the financial payment window; no deposit exists,
  // so nothing is confirmed unconditionally and nothing was charged.
  const claim = await require('../models/VenueCapacityClaim').findById(booking.capacityClaim).lean();
  assert.equal(claim.state, 'held');
  assert.equal(booking.depositDeadline != null, true);
  assert.equal(booking.moneyState, 'none');
  assert.equal(new Date(claim.expiresAt).getTime(), booking.depositDeadline.getTime());
  const loser = results.find(r => r.status === 'rejected');
  assert.equal(loser.reason.code, 'STATE_CHANGED');
});

test('expired offers: late accept cannot confirm or charge; the existing sweep releases the hold and expires the entry', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_offer_expiry');
  const waitlist = args.waitlist, capacity = require('../services/venue/capacity');
  const base = over => ({ tenantId: args.tenantId, actor: { ...args.actor }, entryId: args.entryId, ...over });
  const offered = await waitlist.offer(base({ expectedVersion: args.entryVersion, idempotencyKey: 'off-x', input: { bookingAt: at(30), resourceIds: args.tableIds } }));

  // late accept BEFORE the sweep has run: WAITLIST_OFFER_EXPIRED, no confirmation,
  // and the still-held claim is released through the existing release path
  await require('../models/VenueWaitlistEntry').updateOne({ _id: args.entryId }, { $set: { 'offer.expiresAt': new Date(Date.now() - 1) } });
  await assertFails(waitlist.accept(base({ idempotencyKey: 'acc-late' })), 'WAITLIST_OFFER_EXPIRED', 409);
  const claim = await require('../models/VenueCapacityClaim').findById(offered.offer.claimRef).lean();
  assert.equal(claim.state, 'released');
  const booking = await require('../models/Booking').findById(offered.offer.bookingRef).lean();
  assert.equal(booking.status, 'pending'); // NO confirmation
  assert.equal(booking.moneyState, 'none'); // NO charge
  // the released hold stops blocking (Phase-2 semantics: no TTL deletion) — all options free again
  assert.equal((await capacity.availability({ ...args, bookingAt: at(30), partySize: 2 })).options.length, 3);

  // sweep path: an offered entry whose claim expires → offered→expired (additive sweep transition)
  const second = await waitlist.createStaff({ ...args, actor: { ...args.actor }, idempotencyKey: 'entry-x2', input: { name: 'Bola', phone: '+2348020000000', partySize: 2, verifiedContactRoute: 'sms', window: { earliestAt: at(20), latestAt: at(300) } } });
  const offered2 = await waitlist.offer({ ...args, actor: { ...args.actor }, entryId: second.id, expectedVersion: second.version, input: { bookingAt: at(200), resourceIds: [args.resources[1]] }, idempotencyKey: 'off-x2' });
  await require('../models/VenueCapacityClaim').updateOne({ _id: offered2.offer.claimRef }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  const swept = await require('../services/venue/capacity-expiry').expireHolds({});
  assert.equal(swept.expired, 1);
  const expiredEntry = await require('../models/VenueWaitlistEntry').findById(second.id).lean();
  assert.equal(expiredEntry.state, 'expired'); // offered→expired by the sweep
  const sweptClaim = await require('../models/VenueCapacityClaim').findById(offered2.offer.claimRef).lean();
  assert.equal(sweptClaim.state, 'expired'); // expired rows remain (no TTL deletion)
  assert.equal((await capacity.availability({ ...args, bookingAt: at(200), partySize: 2 })).options.length, 3); // freed
  // accepting an already-swept offer is still WAITLIST_OFFER_EXPIRED
  await assertFails(waitlist.accept({ ...args, actor: { ...args.actor }, entryId: second.id, idempotencyKey: 'acc-swept' }), 'WAITLIST_OFFER_EXPIRED', 409);
  // decline after expiry is honest too
  await assertFails(waitlist.decline({ ...args, actor: { ...args.actor }, entryId: second.id, expectedVersion: expiredEntry.version, idempotencyKey: 'dec-expired' }), 'WAITLIST_OFFER_EXPIRED', 409);
});

test('decline/cancel release the hold via the existing release path; accept requires an offer', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_offer_release');
  const waitlist = args.waitlist, capacity = require('../services/venue/capacity');
  const base = over => ({ tenantId: args.tenantId, actor: { ...args.actor }, entryId: args.entryId, ...over });
  const offered = await waitlist.offer(base({ expectedVersion: args.entryVersion, idempotencyKey: 'off-d', input: { bookingAt: at(30), resourceIds: args.tableIds } }));

  // accept/decline on a plain waiting entry → WAITLIST_NOT_OFFERED (no offer exists;
  // a waiting entry is removed via the PATCH cancel command, not declined)
  const plain = await waitlist.createStaff({ ...args, actor: { ...args.actor }, idempotencyKey: 'entry-p', input: { name: 'Chidi', phone: '+2348030000000', partySize: 2, verifiedContactRoute: 'email', window: { earliestAt: at(20), latestAt: at(300) } } });
  await assertFails(waitlist.accept({ ...args, actor: { ...args.actor }, entryId: plain.id, idempotencyKey: 'acc-plain' }), 'WAITLIST_NOT_OFFERED', 409);
  await assertFails(waitlist.decline({ ...args, actor: { ...args.actor }, entryId: plain.id, expectedVersion: plain.version, idempotencyKey: 'dec-plain' }), 'WAITLIST_NOT_OFFERED', 409);

  // decline the OFFERED entry: hold released, entry declined
  const dec = await waitlist.decline(base({ expectedVersion: offered.version, idempotencyKey: 'dec-1' }));
  assert.equal(dec.state, 'declined');
  assert.equal((await require('../models/VenueCapacityClaim').findById(offered.offer.claimRef).lean()).state, 'released');
  assert.equal((await capacity.availability({ ...args, bookingAt: at(30), partySize: 2 })).options.length, 3);
  // PATCH-cancel an OFFERED entry: hold released in the same transaction
  const third = await waitlist.createStaff({ ...args, actor: { ...args.actor }, idempotencyKey: 'entry-c', input: { name: 'Derin', phone: '+2348040000000', partySize: 2, verifiedContactRoute: 'sms', window: { earliestAt: at(20), latestAt: at(300) } } });
  const offered3 = await waitlist.offer({ ...args, actor: { ...args.actor }, entryId: third.id, expectedVersion: third.version, input: { bookingAt: at(30), resourceIds: args.tableIds }, idempotencyKey: 'off-c' });
  const cancelled = await waitlist.patch({ ...args, actor: { ...args.actor }, entryId: third.id, expectedVersion: offered3.version, cancel: true, idempotencyKey: 'can-1' });
  assert.equal(cancelled.state, 'cancelled');
  assert.equal((await require('../models/VenueCapacityClaim').findById(offered3.offer.claimRef).lean()).state, 'released');

  // the plain acceptance (no financial policy): the offer converts into the
  // NORMAL acceptance flow — claim confirmed, booking confirmed, entry accepted
  const fourth = await waitlist.createStaff({ ...args, actor: { ...args.actor }, idempotencyKey: 'entry-a', input: { name: 'Emeka', phone: '+2348050000000', partySize: 2, verifiedContactRoute: 'sms', window: { earliestAt: at(20), latestAt: at(300) } } });
  await waitlist.offer({ ...args, actor: { ...args.actor }, entryId: fourth.id, expectedVersion: fourth.version, input: { bookingAt: at(30), resourceIds: args.tableIds }, idempotencyKey: 'off-a' });
  const accepted = await waitlist.accept({ ...args, actor: { ...args.actor }, entryId: fourth.id, idempotencyKey: 'acc-a' });
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.acceptedBooking.status, 'confirmed');
  assert.equal((await require('../models/VenueCapacityClaim').findOne({ booking: accepted.offer.bookingRef }).lean()).state, 'confirmed');
  assert.equal((await capacity.availability({ ...args, bookingAt: at(30), partySize: 2 })).options.length, 1); // the accepted hold owns T1; T2 remains
});
