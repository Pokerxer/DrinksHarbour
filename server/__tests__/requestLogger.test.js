'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const requestLogger = require('../middleware/requestLogger');
test('production requests continue without verbose console logging', t => {
  const previous = process.env.NODE_ENV;
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  process.env.NODE_ENV = 'production';
  const logs = [];
  t.mock.method(console, 'log', (...args) => logs.push(args));
  let next = false;
  requestLogger({ method: 'GET', originalUrl: '/api/products', headers: {} }, {}, () => { next = true; });
  assert.equal(next, true); assert.equal(logs.length, 0);
});
test('development retains request diagnostics', t => {
  const previous = process.env.NODE_ENV;
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  process.env.NODE_ENV = 'development';
  const logs = [];
  t.mock.method(console, 'log', (...args) => logs.push(args));
  requestLogger({ method: 'GET', originalUrl: '/api/products', headers: {} }, {}, () => {});
  assert.equal(logs.length, 2);
});
