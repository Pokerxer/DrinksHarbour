'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Banner = require('../models/Banner');
const tenant = { _id: 'a'.repeat(24) };
test('storefront banners query only current tenant, audience and valid schedules', async t => {
  const { listBanners } = require('../services/storefrontBanners.service');
  let query, limit;
  const chain = { select() { return this; }, sort() { return this; }, limit(n) { limit = n; return this; }, lean: async () => [{ _id: 'b'.repeat(24), title: 'My store', image: { url: 'https://example.com/a', publicId: 'private' }, notes: 'private', createdBy: 'private', tenant: 'private', ctaLink: '/shop', deviceTargeting: { mobile: true } }] };
  t.mock.method(Banner, 'find', q => { query = q; return chain; });
  const result = await listBanners(tenant, { placement: 'home_hero', device: 'mobile', limit: '4', tenant: 'foreign' });
  assert.equal(query.tenant, tenant._id); assert.equal(query.placement, 'home_hero');
  assert.equal(query['deviceTargeting.mobile'], true); assert.equal(query.isActive, true);
  assert.deepEqual(query.visibleTo, { $in: ['all', 'guests'] });
  assert.deepEqual(query.status, { $in: ['active', 'scheduled'] });
  assert.ok(query.$and); assert.equal(limit, 4);
  assert.equal(result[0].id, 'b'.repeat(24)); assert.equal(result[0].ctaLink, '/shop');
  assert.doesNotMatch(JSON.stringify(result), /private|publicId|createdBy|notes|tenant/);
});
test('storefront banners reject arbitrary query paths and unsafe legacy links', async t => {
  const { listBanners, publicBanner } = require('../services/storefrontBanners.service');
  for (const query of [{ placement: 'made-up' }, { device: '$where' }, { limit: '1000' }, { limit: ['1'] }]) {
    await assert.rejects(listBanners(tenant, query), e => e.statusCode === 400);
  }
  assert.equal(publicBanner({ _id: 'b'.repeat(24), image: { url: 'https://example.com/a' }, ctaLink: 'javascript:alert(1)' }).ctaLink, null);
});
