// server/__tests__/adClick.test.js
// Public CPC click pipeline (phase 2 merchandising, Part B). Covers the
// ordered refusal/bill matrix of adClick.service.recordClick: unknown
// campaign, status refusals, daily rollover, budget exhaustion, click dedupe
// (NOT billed), prepaid wallet debit (billed exactly the configured tariff),
// and the success path asserting the exact $inc update document. Mocks follow
// the established t.mock.method patterns: model methods here, and the
// debitForClickSafe wrapper (module.exports-routed) for the wallet seam — the
// adWallet service owns the money, this pipeline only refuses or bills.

const test = require('node:test');
const assert = require('node:assert/strict');

const AdCampaign = require('../models/AdCampaign');
const AdClickDedupe = require('../models/AdClickDedupe');
const adWalletService = require('../services/adWallet.service');
const ads = require('../config/ads');
const service = require('../services/adClick.service');

const TENANT = '64b0000000000000000000aa';
const PRODUCT = '507f1f77bcf86cd799439012';
const CAMPAIGN = '507f1f77bcf86cd7994390aa';
const VISITOR = 'visitor-abc';

const today = () => new Date().toISOString().slice(0, 10);

// A settled row: active, counters already rolled to today, so the sweep is a
// no-op unless the test deliberately makes it stale. `product` is the
// populated shape (findById().populate('product', 'slug').lean()).
const campaignRow = (overrides = {}) => ({
  _id: CAMPAIGN,
  tenant: TENANT,
  name: 'PDP push',
  product: { _id: PRODUCT, slug: 'jameson-700ml' },
  surfaces: ['pdp'],
  status: 'active',
  dailyBudget: 1000,
  spentToday: 0,
  spentDay: today(),
  spentTotal: 0,
  clicksTotal: 0,
  impressionsTotal: 0,
  endsAt: null,
  ...overrides,
});

// The service loads via findById().populate('product','slug').lean() — mock
// the whole chain with plain objects.
const loadCampaign = (t, row) =>
  t.mock.method(AdCampaign, 'findById', () => ({
    populate: () => ({ lean: async () => row }),
  }));

// ─── refusals before anything is written or billed ───────────────────────────

test('recordClick refuses an unknown campaign without any write', async (t) => {
  loadCampaign(t, null);
  const dedupe = t.mock.method(AdClickDedupe, 'create', async () => ({}));
  const updates = t.mock.method(AdCampaign, 'updateOne', async () => ({}));
  const debits = t.mock.method(service, 'debitForClickSafe', async () => ({ ok: true, tx: {} }));

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(result, { ok: false, reason: 'not_found' });
  assert.equal(dedupe.mock.callCount(), 0, 'no dedupe row for an unknown campaign');
  assert.equal(updates.mock.callCount(), 0, 'no writes for an unknown campaign');
  assert.equal(debits.mock.callCount(), 0, 'no billing for an unknown campaign');
});

test('recordClick refuses a paused campaign with the status as reason, unbilled', async (t) => {
  loadCampaign(t, campaignRow({ status: 'paused' }));
  const dedupe = t.mock.method(AdClickDedupe, 'create', async () => ({}));
  const updates = t.mock.method(AdCampaign, 'updateOne', async () => ({}));
  const debits = t.mock.method(service, 'debitForClickSafe', async () => ({ ok: true, tx: {} }));

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(result, { ok: false, reason: 'paused' });
  assert.equal(dedupe.mock.callCount(), 0);
  assert.equal(updates.mock.callCount(), 0, 'refused statuses write nothing');
  assert.equal(debits.mock.callCount(), 0);
});

test('recordClick refuses a campaign whose endsAt has passed and persists expired', async (t) => {
  loadCampaign(t, campaignRow({ status: 'active', endsAt: new Date(Date.now() - 60_000).toISOString() }));
  const updates = t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    assert.equal(filter._id.toString(), CAMPAIGN);
    assert.equal(update.$set.status, 'expired');
    return {};
  });

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(result, { ok: false, reason: 'expired' });
  assert.equal(updates.mock.callCount(), 1);
});

// ─── daily cap: refuse BEFORE billing, persist budget_exhausted ──────────────

test('recordClick refuses when the daily budget cannot cover the tariff', async (t) => {
  loadCampaign(t, campaignRow({ dailyBudget: ads.CPC_TARIFF_NGN, spentToday: ads.CPC_TARIFF_NGN }));
  const dedupe = t.mock.method(AdClickDedupe, 'create', async () => ({}));
  const updates = t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    assert.equal(filter._id.toString(), CAMPAIGN);
    assert.equal(update.$set.status, 'budget_exhausted');
    return {};
  });
  const debits = t.mock.method(service, 'debitForClickSafe', async () => ({ ok: true, tx: {} }));

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(result, { ok: false, reason: 'budget_exhausted' });
  assert.equal(updates.mock.callCount(), 1, 'exhaustion is persisted');
  assert.equal(dedupe.mock.callCount(), 0, 'no dedupe row on a refused click');
  assert.equal(debits.mock.callCount(), 0, 'refused clicks are never billed');
});

// ─── dedupe: second click same visitor/campaign/day is NOT billed ────────────

test('recordClick refuses a duplicate visitor-day click without billing', async (t) => {
  loadCampaign(t, campaignRow());
  const dupeErr = new Error('E11000 duplicate key error collection: adclickdedupes');
  dupeErr.code = 11000;
  t.mock.method(AdClickDedupe, 'create', async () => { throw dupeErr; });
  const updates = t.mock.method(AdCampaign, 'updateOne', async () => ({}));
  const debits = t.mock.method(service, 'debitForClickSafe', async () => ({ ok: true, tx: {} }));

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(result, { ok: false, reason: 'duplicate' });
  assert.equal(debits.mock.callCount(), 0, 'duplicate clicks are not billed');
  assert.equal(updates.mock.callCount(), 0, 'duplicate clicks write nothing');
});

// ─── success path: dedupe row → wallet debit at tariff → exact $inc ──────────

test('recordClick bills one click: dedupe, wallet debit at the tariff, exact $inc', async (t) => {
  loadCampaign(t, campaignRow());
  let dedupeDoc;
  t.mock.method(AdClickDedupe, 'create', async (doc) => { dedupeDoc = doc; return { _id: 'd1', ...doc }; });
  const safeCalls = [];
  t.mock.method(service, 'debitForClickSafe', async (...args) => {
    safeCalls.push(args);
    return { ok: true, tx: { _id: 'tx1' } };
  });
  let billUpdate;
  t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    billUpdate = { filter, update };
    return {};
  });

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(dedupeDoc, {
    campaign: CAMPAIGN,
    visitorKey: VISITOR,
    day: today(),
  });
  assert.deepEqual(safeCalls, [[TENANT, CAMPAIGN, ads.CPC_TARIFF_NGN]],
    'the wallet is debited exactly CPC_TARIFF_NGN');
  assert.deepEqual(billUpdate.filter, { _id: CAMPAIGN });
  assert.deepEqual(billUpdate.update.$inc, {
    clicksTotal: 1,
    spentToday: ads.CPC_TARIFF_NGN,
    spentTotal: ads.CPC_TARIFF_NGN,
  });
  assert.equal(billUpdate.update.$set.spentDay, today());
  assert.deepEqual(result, {
    ok: true,
    redirect: '/product/jameson-700ml',
    campaignId: CAMPAIGN,
  });
});

test('debitForClickSafe delegates to the adWallet service debitForClick', async (t) => {
  const calls = [];
  t.mock.method(adWalletService, 'debitForClick', async (...args) => {
    calls.push(args);
    return { ok: true, tx: { _id: 'tx' } };
  });

  const result = await service.debitForClickSafe(TENANT, CAMPAIGN, ads.CPC_TARIFF_NGN);

  assert.ok(result.ok);
  assert.deepEqual(calls, [[TENANT, CAMPAIGN, ads.CPC_TARIFF_NGN]]);
});

// ─── insufficient wallet balance: campaign pauses, click refuses ─────────────

test('recordClick pauses the campaign and refuses when the wallet is empty', async (t) => {
  loadCampaign(t, campaignRow());
  t.mock.method(AdClickDedupe, 'create', async () => ({ _id: 'd1' }));
  t.mock.method(service, 'debitForClickSafe', async () => ({ ok: false, reason: 'insufficient_balance' }));
  const updates = t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    assert.equal(filter._id.toString(), CAMPAIGN);
    assert.equal(update.$set.status, 'paused', 'wallet-empty pauses, it does not exhaust');
    return {};
  });

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.deepEqual(result, { ok: false, reason: 'insufficient_balance' });
  assert.equal(updates.mock.callCount(), 1, 'the pause is persisted');
});

// ─── daily rollover: stale counters reset before the cap check ───────────────

test('recordClick rolls a stale spentDay to today before the budget check', async (t) => {
  // Yesterday's counter is huge — but it belongs to yesterday, so today's
  // spend is zero and the campaign is NOT exhausted.
  loadCampaign(t, campaignRow({
    dailyBudget: ads.CPC_TARIFF_NGN,
    spentToday: 9999,
    spentDay: '2020-01-01',
  }));
  t.mock.method(AdClickDedupe, 'create', async () => ({ _id: 'd1' }));
  t.mock.method(service, 'debitForClickSafe', async () => ({ ok: true, tx: { _id: 'tx' } }));
  const updates = [];
  t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    updates.push({ filter, update });
    return {};
  });

  const result = await service.recordClick(CAMPAIGN, VISITOR, '10.0.0.1');

  assert.equal(result.ok, true, 'a stale counter must not read as an exhausted budget');
  assert.equal(updates.length, 2, 'rollover persist + bill update');
  assert.deepEqual(updates[0].update.$set, { spentToday: 0, spentDay: today() });
  assert.equal(updates[1].update.$set.spentDay, today());
});

// ─── visitor-key fallback: sha256 hex slice of the IP ────────────────────────

test('recordClick falls back to a stable hash of the IP when no visitor key', async (t) => {
  loadCampaign(t, campaignRow());
  let dedupeDoc;
  t.mock.method(AdClickDedupe, 'create', async (doc) => { dedupeDoc = doc; return { _id: 'd1' }; });
  t.mock.method(service, 'debitForClickSafe', async () => ({ ok: true, tx: { _id: 'tx' } }));
  t.mock.method(AdCampaign, 'updateOne', async () => ({}));

  await service.recordClick(CAMPAIGN, undefined, '203.0.113.7');

  assert.equal(dedupeDoc.visitorKey, service.hashVisitorKey('203.0.113.7'));
  assert.equal(dedupeDoc.visitorKey, service.hashVisitorKey('203.0.113.7'),
    'the same IP hashes to the same key');
  assert.notEqual(dedupeDoc.visitorKey, service.hashVisitorKey('203.0.113.8'));
});

// ─── impressions: fire-and-forget counter that never rejects ─────────────────

test('recordImpression increments impressionsTotal and never rejects', async (t) => {
  let captured;
  t.mock.method(AdCampaign, 'updateOne', (filter, update) => {
    captured = { filter, update };
    return { catch: () => {} };
  });

  await service.recordImpression(CAMPAIGN);

  assert.equal(captured.filter._id.toString(), CAMPAIGN);
  assert.deepEqual(captured.update.$inc, { impressionsTotal: 1 });
});

test('recordImpression swallows a failing counter write', async (t) => {
  t.mock.method(AdCampaign, 'updateOne', () => Promise.reject(new Error('db down')));
  await assert.doesNotReject(() => service.recordImpression(CAMPAIGN));
});
