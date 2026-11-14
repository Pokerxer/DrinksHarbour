// server/__tests__/adCampaign.test.js
// Self-serve sponsored-placement campaigns (phase 2 merchandising, Part B).
// Covers create validation (surfaces/budget/dates), wallet-gated activation,
// the on-read budget sweep (expiry, daily-cap, daily rollover), and the
// pause/delete rules. Mocks follow the established t.mock.method patterns:
// the model methods here, and the adWallet SERVICE for the wallet seam —
// the service reaches it through module.exports.getWalletSafe (a thin
// wrapper) so the mock intercepts at call time.

const test = require('node:test');
const assert = require('node:assert/strict');

const AdCampaign = require('../models/AdCampaign');
const Product = require('../models/Product');
const ads = require('../config/ads');
const adWalletService = require('../services/adWallet.service');
const service = require('../services/adCampaign.service');

const TENANT = '64b0000000000000000000aa';
const USER = '507f1f77bcf86cd799439099';
const PRODUCT = '507f1f77bcf86cd799439012';
const CAMPAIGN = '507f1f77bcf86cd7994390aa';

const today = () => new Date().toISOString().slice(0, 10);

// A settled row: no expiry, counters already rolled to today, so the sweep
// is a no-op unless the test deliberately makes it stale.
const campaignRow = (overrides = {}) => ({
  _id: CAMPAIGN,
  tenant: TENANT,
  name: 'PDP push',
  product: PRODUCT,
  surfaces: ['pdp'],
  status: 'draft',
  dailyBudget: 1000,
  spentToday: 0,
  spentDay: today(),
  spentTotal: 0,
  clicksTotal: 0,
  impressionsTotal: 0,
  endsAt: null,
  ...overrides,
});

// ─── createCampaign validation ───────────────────────────────────────────────

test('createCampaign rejects empty, invalid and duplicated surfaces', async () => {
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: [], dailyBudget: 1000,
    }),
    /Surfaces/
  );
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: ['header'], dailyBudget: 1000,
    }),
    /Surfaces/
  );
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: ['pdp', 'pdp'], dailyBudget: 1000,
    }),
    /Surfaces/
  );
});

test('createCampaign rejects a daily budget below the CPC tariff', async () => {
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: ['pdp'], dailyBudget: ads.CPC_TARIFF_NGN - 1,
    }),
    /at least the CPC tariff/
  );
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: ['pdp'], dailyBudget: 12.5,
    }),
    /at least the CPC tariff/
  );
});

test('createCampaign rejects a past endsAt and an over-long name', async () => {
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: ['pdp'], dailyBudget: 1000,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    }),
    /future/
  );
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'y'.repeat(121), product: PRODUCT, surfaces: ['pdp'], dailyBudget: 1000,
    }),
    /120/
  );
});

test('createCampaign rejects an unknown product and persists a draft', async (t) => {
  let created;
  t.mock.method(Product, 'countDocuments', async () => 0);
  await assert.rejects(
    () => service.createCampaign(TENANT, USER, {
      name: 'x', product: PRODUCT, surfaces: ['pdp'], dailyBudget: 1000,
    }),
    /Unknown product/
  );

  t.mock.method(Product, 'countDocuments', async () => 1);
  t.mock.method(AdCampaign, 'create', async (doc) => { created = doc; return { _id: 'row1', ...doc }; });
  const row = await service.createCampaign(TENANT, USER, {
    name: '  PDP push  ', product: PRODUCT, surfaces: ['pdp', 'cart'], dailyBudget: 1000,
  });

  assert.equal(row._id, 'row1');
  assert.equal(created.tenant.toString(), TENANT, 'tenant scoping is server-authoritative');
  assert.equal(created.name, 'PDP push', 'name is trimmed');
  assert.equal(created.status, 'draft', 'campaigns start as drafts');
  assert.ok(created.startsAt instanceof Date, 'startsAt defaults to now');
  assert.deepEqual(created.surfaces, ['pdp', 'cart']);
});

// ─── activation is gated on the prepaid wallet ───────────────────────────────

test('activateCampaign refuses when the wallet balance is below the tariff', async (t) => {
  t.mock.method(AdCampaign, 'findOne', async () => campaignRow());
  t.mock.method(AdCampaign, 'updateOne', async () => ({}));
  t.mock.method(adWalletService, 'getWallet', async () => ({ balance: ads.CPC_TARIFF_NGN - 1 }));

  await assert.rejects(
    () => service.activateCampaign(TENANT, CAMPAIGN),
    /Load your ad wallet to activate/
  );
});

test('activateCampaign activates a funded draft, scoped to the tenant', async (t) => {
  let captured;
  t.mock.method(AdCampaign, 'findOne', async (filter) => { captured = { filter }; return campaignRow(); });
  t.mock.method(AdCampaign, 'updateOne', async () => ({}));
  t.mock.method(adWalletService, 'getWallet', async () => ({ balance: 5000 }));
  t.mock.method(AdCampaign, 'findOneAndUpdate', async (filter, update) => {
    captured = { filter, update };
    return campaignRow({ status: 'active' });
  });

  const row = await service.activateCampaign(TENANT, CAMPAIGN);

  assert.equal(row.status, 'active');
  assert.equal(captured.filter.tenant.toString(), TENANT, 'tenant filter present');
  assert.equal(captured.filter._id.toString(), CAMPAIGN);
  assert.equal(captured.update.$set.status, 'active');
});

test('activateCampaign refuses a campaign the sweep marked expired', async (t) => {
  t.mock.method(AdCampaign, 'findOne', async () =>
    campaignRow({ status: 'active', endsAt: new Date(Date.now() - 60_000).toISOString() }));
  t.mock.method(AdCampaign, 'updateOne', async () => ({}));
  t.mock.method(adWalletService, 'getWallet', async () => ({ balance: 5000 }));

  await assert.rejects(
    () => service.activateCampaign(TENANT, CAMPAIGN),
    /expired/
  );
});

// ─── pause / delete rules ────────────────────────────────────────────────────

test('pauseCampaign pauses an active campaign; drafts cannot be paused', async (t) => {
  let captured;
  t.mock.method(AdCampaign, 'findOne', async () => campaignRow({ status: 'active' }));
  t.mock.method(AdCampaign, 'findOneAndUpdate', async (filter, update) => {
    captured = { filter, update };
    return campaignRow({ status: 'paused' });
  });

  const row = await service.pauseCampaign(TENANT, CAMPAIGN);
  assert.equal(row.status, 'paused');
  assert.equal(captured.update.$set.status, 'paused');

  t.mock.method(AdCampaign, 'findOne', async () => campaignRow({ status: 'draft' }));
  await assert.rejects(
    () => service.pauseCampaign(TENANT, CAMPAIGN),
    /Only an active campaign/
  );
});

test('deleteCampaign refuses an active campaign and deletes a paused one', async (t) => {
  t.mock.method(AdCampaign, 'findOne', async () => campaignRow({ status: 'active' }));
  await assert.rejects(
    () => service.deleteCampaign(TENANT, CAMPAIGN),
    /Pause the campaign before deleting/
  );

  let deleted;
  t.mock.method(AdCampaign, 'findOne', async () => campaignRow({ status: 'paused' }));
  t.mock.method(AdCampaign, 'findOneAndDelete', async (filter) => {
    deleted = filter;
    return campaignRow({ status: 'paused' });
  });
  const row = await service.deleteCampaign(TENANT, CAMPAIGN);
  assert.equal(row.status, 'paused');
  assert.equal(deleted.tenant.toString(), TENANT, 'delete is tenant-scoped');
});

test('updateCampaignStatus routes active/paused and refuses anything else', async (t) => {
  t.mock.method(service, 'activateCampaign', async () => ({ status: 'active' }));
  t.mock.method(service, 'pauseCampaign', async () => ({ status: 'paused' }));

  assert.deepEqual(await service.updateCampaignStatus(TENANT, CAMPAIGN, 'active'), { status: 'active' });
  assert.deepEqual(await service.updateCampaignStatus(TENANT, CAMPAIGN, 'paused'), { status: 'paused' });
  await assert.rejects(
    () => service.updateCampaignStatus(TENANT, CAMPAIGN, 'suspended'),
    /active.*paused|paused.*active/i
  );
});

// ─── on-read budget sweep ────────────────────────────────────────────────────

test('sweep resets spentToday when spentDay is a previous day', async (t) => {
  let captured;
  t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    captured = { filter, update };
    return {};
  });

  const row = await service.sweepCampaignRow(TENANT, campaignRow({
    status: 'active', spentDay: '2020-01-01', spentToday: 40, dailyBudget: 50,
  }));

  assert.equal(captured.filter.tenant.toString(), TENANT);
  assert.equal(captured.filter._id.toString(), CAMPAIGN);
  assert.equal(captured.update.$set.spentToday, 0, 'stale counter rolls over to zero');
  assert.equal(captured.update.$set.spentDay, today());
  assert.equal(row.spentToday, 0, 'the returned row reflects the reset');
});

test('sweep marks an active campaign budget_exhausted when the daily cap is hit', async (t) => {
  let captured;
  t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    captured = { filter, update };
    return {};
  });

  const row = await service.sweepCampaignRow(TENANT, campaignRow({
    status: 'active', dailyBudget: 50, spentToday: 50,
  }));

  assert.equal(captured.update.$set.status, 'budget_exhausted');
  assert.equal(row.status, 'budget_exhausted');
});

test('sweep does not mistake stale-day spend for an exhausted budget', async (t) => {
  let captured;
  t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    captured = { filter, update };
    return {};
  });

  const row = await service.sweepCampaignRow(TENANT, campaignRow({
    status: 'active', dailyBudget: 50, spentToday: 50, spentDay: '2020-01-01',
  }));

  assert.equal(captured.update.$set.status, undefined, 'rollover clears the cap, no exhaustion');
  assert.equal(row.status, 'active');
});

test('listCampaigns sweeps on read: expiry is persisted and returned', async (t) => {
  let findFilter;
  let swept;
  t.mock.method(AdCampaign, 'find', async (filter, _proj, opts) => {
    findFilter = { filter, opts };
    return [campaignRow({ status: 'active', endsAt: new Date(Date.now() - 60_000).toISOString() })];
  });
  t.mock.method(AdCampaign, 'updateOne', async (filter, update) => {
    swept = { filter, update };
    return {};
  });

  const rows = await service.listCampaigns(TENANT);

  assert.equal(findFilter.filter.tenant.toString(), TENANT, 'list is tenant-scoped');
  assert.deepEqual(findFilter.opts.sort, { createdAt: -1 }, 'newest first');
  assert.equal(swept.update.$set.status, 'expired', 'past-endsAt campaign expires on read');
  assert.equal(rows[0].status, 'expired');
});

// ─── summary ─────────────────────────────────────────────────────────────────

test('getCampaignSummary returns the wallet balance, CPC tariff and campaigns', async (t) => {
  t.mock.method(service, 'listCampaigns', async () => [campaignRow({ status: 'active' })]);
  t.mock.method(adWalletService, 'getWallet', async () => ({ balance: 500 }));

  const summary = await service.getCampaignSummary(TENANT);

  assert.equal(summary.balance, 500);
  assert.equal(summary.cpcTariff, ads.CPC_TARIFF_NGN, 'the client needs the tariff for budget helper text');
  assert.equal(summary.campaigns.length, 1);
});
