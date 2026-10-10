'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('../models/User');
const Banner = require('../models/Banner');
const Tenant = require('../models/Tenant');
const ApiKey = require('../models/ApiKey');
const service = require('../services/banner.service');
const { bannerInput } = require('../services/bannerOwnership');
const feed = require('../services/storefrontBanners.service');
const uri = process.env.DRINKSHARBOUR_TEST_MONGO_URI;
test('real MongoDB tenant banner lifecycle and API feed', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_rest_test_[\w]+\?/);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Banner.init(); await ApiKey.init();
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = { _id: oid(), name: 'Banner store', slug: 'banner-store', status: 'approved', subscriptionStatus: 'active', plan: 'pro' };
  const foreign = oid(), actor = oid();
  await Tenant.collection.insertMany([tenant, { ...tenant, _id: foreign, slug: 'foreign-store' }]);
  const req = { user: { _id: actor, role: 'tenant_owner', tenant: tenant._id } };
  const scope = { tenant: String(tenant._id) };
  const make = (title, overrides = {}) => bannerInput(req, { title, image: { url: 'https://example.com/banner.jpg' }, placement: 'home_hero', status: 'draft', ...overrides });
  let created;
  await t.test('create forces ownership, list statistics count own documents and edit/publish works', async () => {
    created = await service.createBanner(make('Owned banner', { tenant: foreign, isGlobal: true, notes: 'PRIVATE' }), actor);
    assert.equal(String(created.tenant._id), String(tenant._id)); assert.equal(created.isGlobal, false);
    assert.equal((await feed.listBanners(tenant)).length, 0);
    await service.updateBanner(created._id, { title: 'Edited banner' }, actor, scope);
    await service.updateBannerStatus(created._id, 'active', actor, scope);
    const list = await service.getAllBanners({ tenant: foreign }, scope);
    assert.equal(list.banners.length, 1); assert.equal(list.stats.total, 1);
    assert.equal((await feed.listBanners(tenant))[0].title, 'Edited banner');
  });
  await t.test('different stores can create banners with identical campaign titles', async () => {
    const input = make('Edited banner');
    input.tenant = foreign;
    const duplicate = await service.createBanner(input, actor);
    assert.notEqual(duplicate.slug, (await Banner.findById(created._id).lean()).slug);
    await service.deleteBanner(duplicate._id, { tenant: foreign });
  });
  const foreignBanner = await Banner.create({ title: 'Foreign', slug: 'foreign', tenant: foreign, isGlobal: true, status: 'active', image: { url: 'https://example.com/foreign' } });
  await t.test('detail/edit/clone/status/delete/bulk cannot touch another tenant', async () => {
    for (const operation of [() => service.getBannerById(foreignBanner._id, scope), () => service.updateBanner(foreignBanner._id, { title: 'Attack' }, actor, scope),
      () => service.cloneBanner(foreignBanner._id, actor, scope), () => service.updateBannerStatus(foreignBanner._id, 'paused', actor, scope), () => service.deleteBanner(foreignBanner._id, scope)]) {
      await assert.rejects(operation(), e => e.statusCode === 404);
    }
    await service.bulkUpdateBannerStatus([String(foreignBanner._id)], 'paused', actor, scope);
    assert.equal((await Banner.findById(foreignBanner._id).lean()).status, 'active');
  });
  await t.test('schedule/visibility/device feed excludes drafts, paused, future, expired and foreign banners', async () => {
    const now = new Date(), past = new Date(now.getTime() - 60000), future = new Date(now.getTime() + 60000);
    await Banner.collection.insertMany([
      { _id: oid(), tenant: tenant._id, slug: 'due', title: 'Due', image: { url: 'https://example.com/due' }, placement: 'home_hero', isActive: true, status: 'scheduled', isScheduled: true, startDate: past, endDate: future, visibleTo: 'all', deviceTargeting: { mobile: true, desktop: false } },
      ...[
        ['draft', { status: 'draft' }], ['paused', { status: 'paused' }], ['future', { isScheduled: true, startDate: future }], ['expired', { isScheduled: true, endDate: past }], ['vip', { visibleTo: 'vip' }], ['scheduled-without-dates', { status: 'scheduled', isScheduled: false }],
      ].map(([slug, values]) => ({ _id: oid(), tenant: tenant._id, slug, title: slug, image: { url: 'https://example.com/a' }, placement: 'home_hero', isActive: true, status: 'active', isScheduled: false, visibleTo: 'all', ...values })),
    ]);
    assert.deepEqual((await feed.listBanners(tenant, {}, now)).map(b => b.title).sort(), ['Due', 'Edited banner']);
    assert.deepEqual((await feed.listBanners(tenant, { device: 'desktop' }, now)).map(b => b.title), ['Edited banner']);
  });
  await t.test('clone resets to draft; pause removes public banner and deletion removes it', async () => {
    const cloned = await service.cloneBanner(created._id, actor, scope);
    assert.equal(cloned.status, 'draft'); assert.equal(cloned.isActive, false);
    await service.deleteBanner(cloned._id, scope);
    await service.updateBannerStatus(created._id, 'paused', actor, scope);
    assert.equal((await feed.listBanners(tenant)).some(b => b.title === 'Edited banner'), false);
  });
  await t.test('key-authenticated HTTP banner feed returns safe presentation fields', async () => {
    const issued = await require('../services/apiKey.service').issueKey(tenant, actor, { name: 'Website', scopes: ['storefront:read'] });
    const express = require('express'), app = express();
    app.use('/api/integrations/v1', require('../routes/storefrontIntegration.routes'));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
      const url = `http://127.0.0.1:${server.address().port}/api/integrations/v1/banners?placement=home_hero&device=mobile`;
      assert.equal((await fetch(url)).status, 401);
      const result = await fetch(url, { headers: { Authorization: 'Bearer ' + issued.secret } });
      assert.equal(result.status, 200);
      const body = await result.json(); assert.equal(body.data[0].title, 'Due');
      assert.doesNotMatch(JSON.stringify(body), /PRIVATE|createdBy|updatedBy|foreign-store|impressions|isGlobal/);
    } finally { await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  });
});
