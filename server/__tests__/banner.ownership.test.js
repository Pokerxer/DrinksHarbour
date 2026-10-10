'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const owner = 'a'.repeat(24);
test('tenant banner authority ignores forged selectors and platform-global flags', () => {
  const { adminScope, bannerInput } = require('../services/bannerOwnership');
  const req = { user: { role: 'tenant_admin', tenant: owner }, body: { tenant: 'b'.repeat(24) }, query: { tenant: 'b'.repeat(24) } };
  assert.deepEqual(adminScope(req), { tenant: owner });
  const data = bannerInput(req, { title: 'Summer', tenant: 'b'.repeat(24), isGlobal: true, impressions: 900, createdBy: 'fake', image: { url: 'https://example.com/banner.jpg' } });
  assert.equal(data.tenant, owner); assert.equal(data.isGlobal, false);
  assert.equal(data.impressions, undefined); assert.equal(data.createdBy, undefined);
});
test('tenant role without JWT tenant is refused even with resolved context', () => {
  const { adminScope } = require('../services/bannerOwnership');
  assert.throws(() => adminScope({ user: { role: 'tenant_admin' }, tenant: { _id: owner } }), e => e.statusCode === 403);
});
test('banner link and media inputs refuse unsafe URLs', () => {
  const { bannerInput } = require('../services/bannerOwnership');
  const req = { user: { role: 'tenant_owner', tenant: owner } };
  for (const ctaLink of ['javascript:alert(1)', '//evil.test', 'data:text/html,x']) {
    assert.throws(() => bannerInput(req, { ctaLink }), e => e.statusCode === 400);
  }
  assert.throws(() => bannerInput(req, { image: { url: 'http://example.com/a' } }), e => e.statusCode === 400);
  assert.equal(bannerInput(req, { ctaLink: '/shop', image: { url: 'https://example.com/a' } }).ctaLink, '/shop');
});
test('saving scheduled draft and paused banners does not silently publish them', async t => {
  const Banner = require('../models/Banner');
  t.mock.method(Banner.collection, 'insertOne', async () => ({ acknowledged: true }));
  for (const status of ['draft', 'paused']) {
    const banner = new Banner({ slug: 'sample-' + status, image: { url: 'https://example.com/a' }, status,
      isScheduled: true, startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) });
    await banner.save(); assert.equal(banner.status, status);
  }
});
