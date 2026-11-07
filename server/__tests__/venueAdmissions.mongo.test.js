'use strict';
// Task 2 (E2) — admission entitlements + the shared-cap redemption ledger.
// ONE capacity ledger (umbrella invariant 1): occurrence.guestsAdmitted is the atomic
// shared counter guarded by $expr against capacity.maxGuests — guest-list, vip and
// (E4/E5) table/ticket admissions all consume it in the SAME transaction as the
// per-entitlement usedCount and the redemption row insert. Documented counter
// semantics: `guestsAdmitted` counts guests admitted through the door; re-entry rows
// reference the original entry and NEVER touch the counter (exiting guests re-enter
// within their original count); a token's entry redemption is unique per
// {tenant, token} — a reused token fails TOKEN_ALREADY_USED, and under concurrency
// exactly one winner commits. Door responses carry MINIMUM details only.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const { businessDate } = require('../services/venue/clock');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const plusDays = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };

async function boot(t, suffix, { maxGuests = 50, maxReEntries } = {}) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 }, $addToSet: { 'venueServices.capabilities': 'events' } });
  for (const model of ['VenueEventOccurrence', 'VenueEventGuestList', 'VenueAdmissionEntitlement', 'VenueAdmissionRedemption', 'VenueHostAlert', 'VenueOperation']) await require(`../models/${model}`).createIndexes();
  const endAt = new Date(plusDays(7).getTime() + 4 * 3600000);
  const occurrence = await require('../models/VenueEventOccurrence').create({
    tenant: args.tenantId, location: args.locationId, eventSlug: 'afro-night', name: 'Afro Night',
    occurrenceDate: businessDate(plusDays(7), 'UTC', 240), startAt: plusDays(7), endAt,
    capacity: { maxGuests }, agePolicy: { minimumAge: 18, admissionTerms: '18+ with valid ID at the door.' },
    publication: 'published', version: 0,
    ...(maxReEntries === undefined ? {} : { admissionPolicy: { maxReEntries } }),
  });
  const guestList = await require('../models/VenueEventGuestList').create({
    tenant: args.tenantId, location: args.locationId, occurrence: occurrence._id,
    name: 'Ada Obi', phone: '+2348012345678', partySize: 4, state: 'approved', allowedCount: 4,
    cutoffAt: new Date(Date.now() + 3600000), version: 1,
  });
  return { ...args, occurrenceId: String(occurrence._id), endAt, guestListId: String(guestList._id) };
}

test('issueEntitlement: approved-guest-list gate, token, age-policy snapshot, expiry; closed/cutoff gates; vip kind', { skip: !uri }, async t => {
  const args = await boot(t, 'admissions_issue');
  const admissions = require('../services/venue/admissions');
  const guestlists = require('../services/venue/guestlists');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // unapproved lists cannot issue (approval gates issuance)
  const pending = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'ad-0', input: { name: 'Bola', phone: '+2348023456789', partySize: 2 } }));
  await assertFails(admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: pending.id, idempotencyKey: 'ad-1' })), 'INVALID_INPUT', 400);

  const issued = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: args.guestListId, idempotencyKey: 'ad-2' }));
  assert.equal(issued.kind, 'guestlist');
  assert.equal(issued.issuedCount, 4);
  assert.equal(issued.usedCount, 0);
  assert.equal(issued.tokens.length, 1);
  assert.match(issued.tokens[0].token, /^gl-[0-9a-f]{32}$/);
  assert.equal(issued.tokens[0].partySize, 4);
  assert.deepEqual(issued.agePolicySnapshot, { version: 0, minimumAge: 18, admissionTerms: '18+ with valid ID at the door.' });
  assert.equal(new Date(issued.expiresAt).toISOString(), new Date(args.endAt).toISOString());
  // replay with a fresh key refuses (already issued); unknown list → NOT_FOUND
  await assertFails(admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: args.guestListId, idempotencyKey: 'ad-3' })), 'INVALID_INPUT', 400);
  await assertFails(admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: String(new mongoose.Types.ObjectId()), idempotencyKey: 'ad-4' })), 'NOT_FOUND', 404);

  // vip-flagged list issues kind 'vip' (same shared-cap path)
  const vipList = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'ad-5', input: { name: 'Derin', phone: '+2348044567890', partySize: 6 } }));
  await guestlists.approve(base({ guestListId: vipList.id, expectedVersion: 0, idempotencyKey: 'ad-6', input: { cutoffAt: new Date(Date.now() + 3600000).toISOString(), allowedCount: 2, vip: { reason: 'Birthday host' } } }));
  const vip = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: vipList.id, idempotencyKey: 'ad-7' }));
  assert.equal(vip.kind, 'vip');
  assert.equal(vip.issuedCount, 2);

  // cut-off passed at issuance → refused; closed (cancelled) occurrence → EVENT_CLOSED
  const late = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'ad-8', input: { name: 'Chidi', phone: '+2348033456789', partySize: 2 } }));
  const GuestList = require('../models/VenueEventGuestList');
  await GuestList.collection.updateOne({ _id: new mongoose.Types.ObjectId(late.id) }, { $set: { state: 'approved', allowedCount: 2, cutoffAt: new Date(Date.now() - 60000), version: 1 } });
  await assertFails(admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: late.id, idempotencyKey: 'ad-9' })), 'INVALID_INPUT', 400);
  await require('../models/VenueEventOccurrence').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.occurrenceId) }, { $set: { publication: 'cancelled', cancelledAt: new Date() } });
  await assertFails(admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: args.guestListId, idempotencyKey: 'ad-10' })), 'EVENT_CLOSED', 409);
});

test('redeem: shared cap counter, partial party, duplicate token, party size, wrong occurrence, age refusal, closed, ledger', { skip: !uri }, async t => {
  const args = await boot(t, 'admissions_redeem');
  const admissions = require('../services/venue/admissions');
  const door = require('../services/venue/door');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  await door.assignDoorStaff(base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'rd-0' }));
  const entitlement = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: args.guestListId, idempotencyKey: 'rd-1' }));
  const token = entitlement.tokens[0].token;
  const redeem = over => admissions.redeem(base({ occurrenceId: args.occurrenceId, ageVerified: true, ...over }));

  // partial-party arrival: 2 of the 4 allowedCount are present now
  const first = await redeem({ token, guests: 2, idempotencyKey: 'rd-2' });
  assert.deepEqual(Object.keys(first).sort(), ['name', 'partySize', 'result']); // MINIMUM details only
  assert.equal(first.name, 'Ada Obi');
  assert.equal(first.partySize, 4);
  assert.equal(first.result, 'admitted');
  const Occurrence = require('../models/VenueEventOccurrence');
  let occurrence = await Occurrence.findOne({ _id: args.occurrenceId }).lean();
  assert.equal(occurrence.guestsAdmitted, 2); // the exact consumed count, not partySize

  // reused token → TOKEN_ALREADY_USED (sequential)
  await assertFails(redeem({ token, guests: 2, idempotencyKey: 'rd-3' }), 'TOKEN_ALREADY_USED', 409);

  // party-size mismatch: more guests than the token allows (a FRESH token — the
  // first token's used-state check runs before its allowance is even consulted)
  const wide = await require('../models/VenueEventGuestList').create({ tenant: args.tenantId, location: args.locationId, occurrence: new mongoose.Types.ObjectId(args.occurrenceId), name: 'Wide Party', phone: '+2348098765432', partySize: 6, state: 'approved', allowedCount: 6, cutoffAt: new Date(Date.now() + 3600000), version: 1 });
  const wideEntitlement = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: String(wide._id), idempotencyKey: 'rd-4' }));
  await assertFails(redeem({ token: wideEntitlement.tokens[0].token, guests: 7, idempotencyKey: 'rd-5' }), 'PARTY_SIZE_EXCEEDED', 409);

  // wrong occurrence → NOT_FOUND; unknown token → NOT_FOUND
  await assertFails(redeem({ occurrenceId: String(new mongoose.Types.ObjectId()), token, guests: 1, idempotencyKey: 'rd-6' }), 'NOT_FOUND', 404);
  await assertFails(redeem({ token: 'gl-deadbeefdeadbeefdeadbeefdeadbeef', guests: 1, idempotencyKey: 'rd-7' }), 'NOT_FOUND', 404);

  // age policy refusal discloses the terms; an unverified age never admits
  await assertFails(redeem({ token: wideEntitlement.tokens[0].token, guests: 1, ageVerified: false, idempotencyKey: 'rd-8' }), 'ADMISSION_POLICY_REFUSED', 409);

  // cancelled occurrence → EVENT_CLOSED (a token issued BEFORE the cancel still scans
  // against the closed occurrence and must fail closed)
  const third = await require('../models/VenueEventGuestList').create({ tenant: args.tenantId, location: args.locationId, occurrence: new mongoose.Types.ObjectId(args.occurrenceId), name: 'Late Party', phone: '+2348076543210', partySize: 2, state: 'approved', allowedCount: 2, cutoffAt: new Date(Date.now() + 3600000), version: 1 });
  const thirdEntitlement = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: String(third._id), idempotencyKey: 'rd-9' }));
  await require('../models/VenueEventOccurrence').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.occurrenceId) }, { $set: { publication: 'cancelled', cancelledAt: new Date() } });
  await assertFails(redeem({ token: thirdEntitlement.tokens[0].token, guests: 1, idempotencyKey: 'rd-10' }), 'EVENT_CLOSED', 409);

  // the ledger lists redemptions scoped to the occurrence
  const ledger = await admissions.listRedemptions(base({ occurrenceId: args.occurrenceId }));
  assert.equal(ledger.items.length, 1);
  assert.equal(ledger.items[0].kind, 'entry');
  assert.equal(ledger.items[0].guests, 2);
});

test('concurrency: one winner per token; cap race one loser; re-entry never double-decrements', { skip: !uri }, async t => {
  const args = await boot(t, 'admissions_cap', { maxGuests: 4, maxReEntries: 1 });
  const admissions = require('../services/venue/admissions');
  const door = require('../services/venue/door');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  await door.assignDoorStaff(base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'cap-0' }));
  const Entitlement = require('../models/VenueAdmissionEntitlement');

  // directly-created 'vip' kind entitlement (E4/E5 kinds share the enum + cap path)
  const vip = await Entitlement.create({ tenant: args.tenantId, location: args.locationId, occurrence: args.occurrenceId, kind: 'vip', label: 'VIP table host', issuedCount: 2, tokens: [{ token: 'gl-vip-token-0000000000000001', partySize: 2 }], agePolicySnapshot: { version: 0, admissionTerms: '18+' } });
  const second = await Entitlement.create({ tenant: args.tenantId, location: args.locationId, occurrence: args.occurrenceId, kind: 'guestlist', label: 'Second party', issuedCount: 2, tokens: [{ token: 'gl-second-token-0000000000001', partySize: 2 }], agePolicySnapshot: { version: 0, admissionTerms: '18+' } });
  const third = await Entitlement.create({ tenant: args.tenantId, location: args.locationId, occurrence: args.occurrenceId, kind: 'guestlist', label: 'Third party', issuedCount: 2, tokens: [{ token: 'gl-third-token-00000000000001', partySize: 2 }], agePolicySnapshot: { version: 0, admissionTerms: '18+' } });
  const never = await Entitlement.create({ tenant: args.tenantId, location: args.locationId, occurrence: args.occurrenceId, kind: 'guestlist', label: 'Never arrived', issuedCount: 2, tokens: [{ token: 'gl-never-token-00000000000001', partySize: 2 }], agePolicySnapshot: { version: 0, admissionTerms: '18+' } });

  // duplicate-token race: two simultaneous scans of ONE token → exactly one winner
  const token = vip.tokens[0].token;
  const same = await Promise.allSettled([
    admissions.redeem(base({ occurrenceId: args.occurrenceId, token, guests: 2, ageVerified: true, idempotencyKey: 'dup-1' })),
    admissions.redeem(base({ occurrenceId: args.occurrenceId, token, guests: 2, ageVerified: true, idempotencyKey: 'dup-2' })),
  ]);
  assert.equal(same.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(same.filter(row => row.status === 'rejected').length, 1);
  assert.equal(codeOf(same.find(row => row.status === 'rejected').reason), 'TOKEN_ALREADY_USED');

  // cap race: 4 slots, 2 admitted above; two parties of 2 race the last 2 slots →
  // exactly one commits, one CAPACITY_UNAVAILABLE
  const races = await Promise.allSettled([
    admissions.redeem(base({ occurrenceId: args.occurrenceId, token: second.tokens[0].token, guests: 2, ageVerified: true, idempotencyKey: 'cap-1' })),
    admissions.redeem(base({ occurrenceId: args.occurrenceId, token: third.tokens[0].token, guests: 2, ageVerified: true, idempotencyKey: 'cap-2' })),
  ]);
  assert.equal(races.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(codeOf(races.find(row => row.status === 'rejected').reason), 'CAPACITY_UNAVAILABLE');
  const Occurrence = require('../models/VenueEventOccurrence');
  const occurrence = await Occurrence.findOne({ _id: args.occurrenceId }).lean();
  assert.equal(occurrence.guestsAdmitted, 4); // 2 (dup winner) + 2 (cap winner) — loser rolled back

  // re-entry: the winner's party exits and 1 guest returns — the counter NEVER moves;
  // the re-entry row references the original entry; the policy limit is per token
  const ledgerBefore = await admissions.listRedemptions(base({ occurrenceId: args.occurrenceId }));
  const entry = ledgerBefore.items.find(row => row.token === token);
  const reentered = await admissions.redeemReEntry(base({ occurrenceId: args.occurrenceId, token, guests: 1, idempotencyKey: 're-1' }));
  assert.equal(reentered.result, 're_entered');
  const after = await Occurrence.findOne({ _id: args.occurrenceId }).lean();
  assert.equal(after.guestsAdmitted, 4); // NO double-decrement on re-entry
  const ledgerAfter = await admissions.listRedemptions(base({ occurrenceId: args.occurrenceId }));
  const reEntry = ledgerAfter.items.find(row => row.kind === 're-entry');
  assert.equal(String(reEntry.reEntryOf), String(entry.id));
  // re-entry above the entry count refused; the per-token limit (1) is now exhausted
  await assertFails(admissions.redeemReEntry(base({ occurrenceId: args.occurrenceId, token, guests: 3, idempotencyKey: 're-2' })), 'PARTY_SIZE_EXCEEDED', 409);
  await assertFails(admissions.redeemReEntry(base({ occurrenceId: args.occurrenceId, token, guests: 1, idempotencyKey: 're-3' })), 'ADMISSION_POLICY_REFUSED', 409);
  // a token that never entered cannot "re-enter" (real entitlement, no entry row);
  await assertFails(admissions.redeemReEntry(base({ occurrenceId: args.occurrenceId, token: never.tokens[0].token, guests: 1, idempotencyKey: 're-4' })), 'INVALID_INPUT', 400);
});

test('door role: assignment gate + door occurrence picker (assigned only)', { skip: !uri }, async t => {
  const args = await boot(t, 'admissions_door');
  const door = require('../services/venue/door');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  // an unassigned actor's picker is EMPTY (no leak, no error) — the hard gate is on scans
  const empty = await door.listDoorOccurrences(base({}));
  assert.deepEqual(empty.items, []);
  const assigned = await door.assignDoorStaff(base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'door-1' }));
  assert.deepEqual(assigned.doorStaffIds, [args.actor.userId]);
  const picker = await door.listDoorOccurrences(base({}));
  assert.deepEqual(picker.items.map(row => row.id), [args.occurrenceId]);
  assert.equal(picker.items[0].guestsAdmitted, 0);
  // assignment is validated against active tenant users
  await assertFails(door.assignDoorStaff(base({ occurrenceId: args.occurrenceId, staffIds: [String(new mongoose.Types.ObjectId())], idempotencyKey: 'door-2' })), 'NOT_FOUND', 404);
});

test('vip host alerts: persisted post-commit with provenance, emitted payload carries PERMITTED info only, idempotent replay', { skip: !uri }, async t => {
  const args = await boot(t, 'admissions_vip_alerts');
  const admissions = require('../services/venue/admissions');
  const door = require('../services/venue/door');
  const guestlists = require('../services/venue/guestlists');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  await door.assignDoorStaff(base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'va-0' }));

  // a flagged VIP guest list → vip-kind entitlement → redeem → alert
  const vipList = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'va-1', input: { name: 'Derin', phone: '+2348044567890', partySize: 6 } }));
  await guestlists.approve(base({ guestListId: vipList.id, expectedVersion: 0, idempotencyKey: 'va-2', input: { cutoffAt: new Date(Date.now() + 3600000).toISOString(), vip: { reason: 'Birthday host' } } }));
  const vipEntitlement = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: vipList.id, idempotencyKey: 'va-3' }));
  const token = vipEntitlement.tokens[0].token;

  // a capture io — the emitted payload is the security surface (permitted info only)
  const emitted = [];
  const fakeIo = { to: room => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
  const req = { app: { get: () => fakeIo } };

  const admitted = await admissions.redeem(base({ occurrenceId: args.occurrenceId, token, guests: 4, ageVerified: true, idempotencyKey: 'va-4', req }));
  assert.deepEqual(Object.keys(admitted).sort(), ['name', 'partySize', 'result']); // scan response stays minimum
  const Alert = require('../models/VenueHostAlert');
  const alert = await Alert.findOne({ tenant: args.tenantId, occurrence: args.occurrenceId }).lean();
  assert.ok(alert, 'vip arrival alert persisted post-commit');
  assert.equal(alert.kind, 'vip_arrival');
  assert.deepEqual(alert.permittedInfo, { name: 'Derin', partySize: 4, action: 'admitted' });
  assert.equal(String(alert.provenance.flaggedBy), args.actor.userId); // the flagging staff member
  assert.equal(alert.provenance.reason, 'Birthday host');
  assert.ok(alert.provenance.at);
  // room + payload discipline: the venue-host room, MINIMUM info, never spend/notes/phone
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].room, `venue-host:${args.tenantId}:${args.locationId}`);
  assert.equal(emitted[0].event, 'venue.vip.arrived');
  assert.deepEqual(Object.keys(emitted[0].payload).sort(), ['action', 'alertId', 'at', 'name', 'occurrenceId', 'partySize', 'provenance']);
  assert.equal(JSON.stringify(emitted[0].payload).includes('phone'), false);
  // replaying the redemption op does NOT duplicate the alert (unique redemptionRef)
  await admissions.redeem(base({ occurrenceId: args.occurrenceId, token, guests: 4, ageVerified: true, idempotencyKey: 'va-4', req }));
  assert.equal(await Alert.countDocuments({ tenant: args.tenantId }), 1);
  // a plain guestlist redemption emits NO host alert
  const plain = await admissions.issueEntitlement(base({ occurrenceId: args.occurrenceId, guestListId: args.guestListId, idempotencyKey: 'va-5' }));
  await admissions.redeem(base({ occurrenceId: args.occurrenceId, token: plain.tokens[0].token, guests: 1, ageVerified: true, idempotencyKey: 'va-6', req }));
  assert.equal(await Alert.countDocuments({ tenant: args.tenantId }), 1);
  // host listing (staff, scoped, acknowledged flag)
  const listing = await require('../services/venue/host-alerts').listHostAlerts(base({ occurrenceId: args.occurrenceId }));
  assert.equal(listing.items.length, 1);
  assert.equal(listing.items[0].name, 'Derin');
  assert.equal(listing.items[0].acknowledged, false);
});
