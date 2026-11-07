'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test('channel replacement removes omitted accounts and exact audited pause survives lost readiness', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'channel_recovery');
  const Channel = require('../models/SalesChannel');
  const Country = require('../models/CountryConfiguration');
  const Audit = require('../models/AuditLog');
  const { saveChannel } = require('../services/salesChannels/management');
  const { resolveChannelSnapshot } = require('../services/salesChannels');
  await Channel.createIndexes();
  await Country.collection.insertOne({ code: 'NG', currency: 'NGN', active: true, version: 1, capabilities: { marketplace: true, storefront: true, erm: true } });
  const actor = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
  const owner = { type: 'platform', reference: 'synthetic-legal-owner' };
  const base = { tenant: null, kind: 'marketplace', code: 'SYNTHETIC_NG', market: 'NG', currency: 'NGN', active: true,
    legalOwner: owner, paymentOwner: { ...owner, provider: 'paystack', account: 'platform' },
    allowedPaymentOwners: [{ ...owner, provider: 'wallet', account: 'platform' }],
    pricingPolicy: { code: 'SYNTHETIC_TERMS', version: 1, termsReference: 'test-only-reviewed-terms' } };
  let saved = await saveChannel({ configuration: base, reason: 'Synthetic reviewed account bindings' }, actor);
  await t.test('omitted optional accounts are removed instead of retaining old gateway approval', async () => {
    const replacement = { ...base }; delete replacement.allowedPaymentOwners;
    saved = await saveChannel({ configuration: replacement, expectedVersion: saved.version, reason: 'Remove previously reviewed additional accounts' }, actor, String(saved._id));
    assert.equal(saved.allowedPaymentOwners, undefined);
    assert.equal((await Channel.findById(saved._id).lean()).allowedPaymentOwners, undefined);
    await assert.rejects(() => resolveChannelSnapshot({ kind: 'marketplace', provider: 'wallet', account: 'platform' }), /reviewed/);
  });
  // Restore the old array explicitly so the independent pause scenario starts with exact known terms.
  saved = await saveChannel({ configuration: base, expectedVersion: saved.version, reason: 'Restore explicit synthetic account binding' }, actor, String(saved._id));
  await Country.collection.updateOne({ code: 'NG' }, { $set: { currency: 'GBP', active: false, version: 2 } });
  await t.test('active pause cannot hide changed commercial terms or bypass version and reviewer authority', async () => {
    const withoutAccounts = { ...base, active: false }; delete withoutAccounts.allowedPaymentOwners;
    for (const config of [
      { ...base, active: false, paymentOwner: { ...base.paymentOwner, account: 'OTHER_ACCOUNT' } },
      { ...base, active: false, pricingPolicy: { ...base.pricingPolicy, version: 2 } },
      withoutAccounts,
      { ...base, active: false, allowedPaymentOwners: [] },
    ]) await assert.rejects(() => saveChannel({ configuration: config, expectedVersion: saved.version, reason: 'Pause cannot smuggle changed synthetic terms' }, actor, String(saved._id)));
    await assert.rejects(() => saveChannel({ configuration: { ...base, active: false }, expectedVersion: saved.version - 1, reason: 'Stale pause must fail' }, actor, String(saved._id)), /changed/);
    await assert.rejects(() => saveChannel({ configuration: { ...base, active: false }, expectedVersion: saved.version, reason: 'Unprivileged pause must fail' }, { ...actor, role: 'tenant_admin' }, String(saved._id)), /authority/);
    assert.equal((await Channel.findById(saved._id).lean()).active, true);
    assert.equal(await Audit.countDocuments({ targetId: saved._id }), 3);
  });
  await t.test('exact pause is available after current market readiness is withdrawn', async () => {
    const priorVersion = saved.version;
    saved = await saveChannel({ configuration: { ...base, active: false }, expectedVersion: priorVersion, reason: 'Pause only after synthetic readiness withdrawal' }, actor, String(saved._id));
    assert.equal(saved.active, false); assert.equal(saved.version, priorVersion + 1);
    const audit = await Audit.findOne({ targetId: saved._id, 'changes.after.version': saved.version }).lean();
    assert.equal(audit.changes.before.active, true); assert.equal(audit.changes.after.active, false);
    assert.equal(audit.changes.after.paymentOwner.account, 'platform');
  });
  await t.test('readiness bypass cannot modify terms, omit accounts or reactivate', async () => {
    for (const config of [
      { ...base, active: false, paymentOwner: { ...base.paymentOwner, account: 'OTHER_ACCOUNT' } },
      { ...base, active: false, pricingPolicy: { ...base.pricingPolicy, version: 2 } },
      { ...base, active: true },
      { ...base, active: false, allowedPaymentOwners: [] },
    ]) await assert.rejects(() => saveChannel({ configuration: config, expectedVersion: saved.version, reason: 'Cannot use pause to change synthetic terms' }, actor, String(saved._id)));
    assert.equal((await Channel.findById(saved._id).lean()).version, saved.version);
    assert.equal(await Audit.countDocuments({ targetId: saved._id }), 4);
  });
});
