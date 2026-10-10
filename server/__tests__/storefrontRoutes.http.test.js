'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const keys = require('../services/apiKey.service');
const catalog = require('../services/storefrontCatalog.service');
const cart = require('../services/storefrontCart.service');
const checkout = require('../services/storefrontCheckout.service');
const router = require('../routes/storefrontIntegration.routes');
let server, base;
test.before(async () => {
  const app = express(); app.use(express.json()); app.use('/api/integrations/v1', router);
  server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(s)); s.on('error', reject); });
  base = `http://127.0.0.1:${server.address().port}/api/integrations/v1`;
});
test.after(() => server ? new Promise(resolve => server.close(resolve)) : undefined);
function auth(t) {
  t.mock.method(keys, 'authenticateKey', async (secret, scope) => {
    assert.equal(secret, 'secret');
    return { tenant: { _id: 'own', name: 'Store', slug: 'own', logo: { url: 'https://logo', publicId: 'private' } }, key: { _id: 'key' } };
  });
}
test('store refuses unauthenticated requests', async () => {
  const response = await fetch(`${base}/store`);
  assert.equal(response.status, 401);
});
test('store returns branding without billing or internal logo fields', async t => {
  auth(t);
  const response = await fetch(`${base}/store`, { headers: { Authorization: 'Bearer secret' } });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).data.name, 'Store');
});
test('product lists retain pagination and ignore client tenant selectors', async t => {
  auth(t);
  t.mock.method(catalog, 'listProducts', async tenant => { assert.equal(tenant._id, 'own'); return { data: [], pagination: { total: 0 } }; });
  const response = await fetch(`${base}/products?tenant=foreign`, { headers: { Authorization: 'Bearer secret' } });
  assert.equal((await response.json()).pagination.total, 0);
});
test('quote strips internal accounting snapshots from response', async t => {
  auth(t);
  t.mock.method(cart, 'quoteCart', async () => ({ items: [], total: 5000, orderItems: [{ costPrice: 10 }] }));
  const response = await fetch(`${base}/cart/quote`, { method: 'POST', headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' }, body: '{}' });
  const data = await response.json(); assert.equal(data.data.total, 5000); assert.equal(data.data.orderItems, undefined);
});
test('checkout returns 202 and a recovery handle for uncertain initialization', async t => {
  auth(t);
  t.mock.method(checkout, 'createCheckout', async (tenant, key, body, token) => {
    assert.equal(token, 'request-1'); return { id: 'checkout', status: 'uncertain', authorizationUrl: null };
  });
  const response = await fetch(`${base}/checkout`, { method: 'POST', headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json', 'Idempotency-Key': 'request-1' }, body: '{}' });
  assert.equal(response.status, 202); assert.equal((await response.json()).data.id, 'checkout');
});
test('throttled keys get Retry-After and a stable error code', async t => {
  t.mock.method(keys, 'authenticateKey', async () => { const err = new Error('Too many requests'); err.statusCode = 429; throw err; });
  const response = await fetch(`${base}/store`, { headers: { Authorization: 'Bearer secret' } });
  assert.equal(response.status, 429); assert.ok(response.headers.get('retry-after'));
  assert.equal((await response.json()).code, 'rate_limited');
});
test('every checkout mutation rejects a caller with no API key', async () => {
  for (const path of ['/cart/quote', '/checkout', '/checkout/' + 'a'.repeat(64) + '/verify', '/checkout/' + 'a'.repeat(64) + '/cancel']) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401, path);
  }
});
test('JWT-shaped tokens cannot impersonate a tenant integration key', async () => {
  const response = await fetch(base + '/store', { headers: { Authorization: 'Bearer fake.jwt.token' } });
  assert.equal(response.status, 401);
});
test('banner REST feed requires the storefront scope and uses the key tenant', async t => {
  const banners = require('../services/storefrontBanners.service');
  const missing = await fetch(`${base}/banners`); assert.equal(missing.status, 401);
  t.mock.method(keys, 'authenticateKey', async (secret, scope) => {
    assert.equal(scope, 'storefront:read'); return { tenant: { _id: 'own' }, key: { _id: 'key' } };
  });
  t.mock.method(banners, 'listBanners', async (tenant, query) => {
    assert.equal(tenant._id, 'own'); assert.equal(query.placement, 'home_hero'); return [{ id: 'banner', title: 'My store' }];
  });
  const response = await fetch(`${base}/banners?placement=home_hero&tenant=foreign`, { headers: { Authorization: 'Bearer secret' } });
  assert.equal(response.status, 200); assert.equal((await response.json()).data[0].title, 'My store');
});
