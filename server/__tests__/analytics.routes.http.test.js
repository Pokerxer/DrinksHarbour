// __tests__/analytics.routes.http.test.js
//
// Dispatches real HTTP requests through the analytics router on an ephemeral
// port, with no database and no server boot.
//
// This is the test that would have caught the original bug. The ten read
// endpoints had handlers in the service and no route, so every one answered 404
// with an error envelope carrying no `data` key. The client unwrapped
// `json.data` unconditionally, so a missing route surfaced as
// `Cannot read properties of undefined (reading 'traffic')` three layers away
// from the cause. Asserting on the router stack (analytics.routes.test.js)
// catches a missing route; this one also proves the request is actually
// authenticated rather than falling through to a handler.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const http = require('node:http');
const router = require('../routes/analytics.routes');

const READ_PATHS = [
  '/web-report', '/web-overview', '/acquisition', '/devices', '/traffic-sources', '/audience',
  '/conversions', '/goals', '/pages', '/retention', '/channels',
];

let server;
let base;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', router);
  // Mirrors the production error envelope (server.js). Express's default handler
  // would return HTML, and the whole point of the last test is the shape of the
  // JSON the client actually receives.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const get = (path) => new Promise((resolve) => {
  http.get(`${base}/api/analytics${path}`, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
});

const post = (path, payload) => new Promise((resolve) => {
  const data = JSON.stringify(payload);
  const req = http.request(`${base}/api/analytics${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.end(data);
});

test('every read endpoint is routed rather than 404', async () => {
  for (const path of READ_PATHS) {
    const { status } = await get(path);
    assert.notEqual(status, 404, `${path} is not registered — this is the bug that crashed the dashboard`);
  }
});

test('read endpoints reject an unauthenticated request', async () => {
  for (const path of READ_PATHS) {
    const { status } = await get(path);
    assert.equal(status, 401, `${path} served an anonymous request`);
  }
});

test('a rejected read request carries no data key for the client to unwrap', async () => {
  // The client used to return `json.data` whatever the status was, turning every
  // failure into a truthy-but-empty payload. The envelope must not look like a
  // successful one, and the client now checks `success` and `res.ok` as well.
  const { body } = await get('/web-overview');
  const json = JSON.parse(body);
  assert.equal(json.success, false);
  assert.equal(json.data, undefined, 'an error envelope must not carry a data key');
});

test('tracking stays reachable for logged-out storefront visitors', async () => {
  // 400 rather than 401: the request reached the handler and was rejected for a
  // missing body field. Requiring auth here would silently end all collection.
  const { status } = await post('/track', {});
  assert.equal(status, 400);
});
