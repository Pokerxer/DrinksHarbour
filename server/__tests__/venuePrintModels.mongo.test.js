'use strict';
// Task 1 (S4) — PreparationPrintJob model (spec §2): unique jobId per tenant
// ({tenant, jobId} unique index, enforced via audit-indexes), deliveryState
// enum queued|delivered|acknowledged|failed, frozen Mixed payload, duplicateOf
// /lineIds/roundId/deviceId/attempts/ackAt/lastDeliveredAt/lastError. Plus the
// device-bridge registration on VenueLocationProfile: a stations.write route
// mints a 32-byte URL-safe token, stores ONLY its sha-256 hash (the raw token
// is returned once, never persisted), re-registration replaces the hash (the
// old token stops working), revoke clears. Suffix: print_models.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');

async function indexes() {
  await require('../services/venue/audit-indexes').applyPrintModelIndexes(mongoose.connection.db);
  await require('../models/VenueLocationProfile').createIndexes();
}

test('PreparationPrintJob: uniqueness, enums, defaults (model level)', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'print_models_model');
  await indexes();
  const PrintJob = require('../models/PreparationPrintJob');
  const tenant = new mongoose.Types.ObjectId();
  const base = over => ({ tenant, location: new mongoose.Types.ObjectId(), session: new mongoose.Types.ObjectId(),
    stationId: new mongoose.Types.ObjectId(), jobId: 'pj:0123456789abcdef0123', actionType: 'print', payload: { items: [] }, ...over });

  const created = await PrintJob.create(base({}));
  assert.equal(created.deliveryState, 'queued');
  assert.equal(created.attempts, 0);
  assert.equal(created.duplicateOf, undefined);
  assert.equal(created.ackAt, undefined);
  assert.equal(created.lastDeliveredAt, undefined);
  assert.equal(created.lastError, undefined);

  // jobId unique per tenant: same jobId, same tenant → 11000; another tenant is free
  await assert.rejects(PrintJob.create(base({})), error => error.code === 11000);
  await PrintJob.create(base({ jobId: 'pj:0123456789abcdef0123', tenant: new mongoose.Types.ObjectId() }));

  // deliveryState enum + actionType enum (Schema validation, not status-coded)
  await assert.rejects(PrintJob.create(base({ jobId: 'pj:other1', deliveryState: 'pending' })));
  await assert.rejects(PrintJob.create(base({ jobId: 'pj:other2', actionType: 'newsletter' })));
  const ok = await PrintJob.create(base({ jobId: 'pj:other4', actionType: 'amendment', deliveryState: 'failed', lastError: 'cap', duplicateOf: 'pj:0123456789abcdef0123' }));
  assert.equal(ok.actionType, 'amendment');
  assert.equal(ok.duplicateOf, 'pj:0123456789abcdef0123');

  // indexes ensured idempotently through the audit-indexes core
  const preview = await require('../services/venue/audit-indexes').previewPrintModelIndexes(mongoose.connection.db);
  assert.deepEqual(preview.find(row => row.model === 'PreparationPrintJob').missing, []);
});

test('device bridge registration: token shown once, only the hash stored, replace + revoke', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'print_models_bridge');
  await indexes();
  const args = await fixture();
  const stations = require('../services/venue/stations');
  const Profile = require('../models/VenueLocationProfile');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // register: 32-byte URL-safe token, returned once; stored value is the sha-256 hash
  const first = await stations.registerBridge(base({}));
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/, '32 bytes base64url = 43 URL-safe chars');
  const stored = await Profile.findOne({ tenant: args.tenantId, location: args.locationId }).lean();
  assert.equal(stored.deviceBridge.tokenHash, sha256(first.token));
  assert.notEqual(stored.deviceBridge.tokenHash, first.token, 'the raw token is never stored');
  assert.ok(stored.deviceBridge.registeredAt);
  assert.equal(stored.deviceBridge.registeredBy, args.actor.userId);
  assert.equal(typeof first.registeredAt, 'string', 'registration metadata may be echoed; the raw token may not be persisted');

  // re-register replaces the hash — the old token is no longer authorized
  const second = await stations.registerBridge(base({}));
  assert.notEqual(second.token, first.token);
  const replaced = await Profile.findOne({ tenant: args.tenantId, location: args.locationId }).lean();
  assert.equal(replaced.deviceBridge.tokenHash, sha256(second.token));
  assert.notEqual(replaced.deviceBridge.tokenHash, sha256(first.token));
  assert.equal(replaced.deviceBridge.registeredBy, args.actor.userId);

  // revoke clears the config — any token is then unauthorized
  await stations.revokeBridge(base({}));
  const revoked = await Profile.findOne({ tenant: args.tenantId, location: args.locationId }).lean();
  assert.equal(revoked.deviceBridge.tokenHash, null);
  assert.equal(revoked.deviceBridge.registeredAt, null);

  // eligibility: stations.write is enforced inside the service
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['stations.write'] } });
  await assertFails(stations.registerBridge(base({})), 'VENUE_PERMISSION_DENIED', 403);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: [] } });

  // tenancy: a foreign location is NOT_FOUND at eligibility
  const other = await fixture();
  await assertFails(stations.registerBridge({ ...base({}), locationId: other.locationId }), 'NOT_FOUND', 404);
});
