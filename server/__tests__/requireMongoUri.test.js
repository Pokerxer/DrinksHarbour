'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireMongoUri } = require('../utils/requireMongoUri');
test('operational scripts refuse to choose a database when none is configured', () => {
  assert.throws(() => requireMongoUri({}), /MONGODB_URI is required/);
});
test('explicit database configuration and the legacy alias are accepted', () => {
  assert.equal(requireMongoUri({ MONGODB_URI: 'mongodb://127.0.0.1:27017/test' }), 'mongodb://127.0.0.1:27017/test');
  assert.equal(requireMongoUri({ MONGO_URI: 'mongodb://127.0.0.1:27017/legacy' }), 'mongodb://127.0.0.1:27017/legacy');
});
test('invalid URI errors never disclose the supplied credential', () => {
  assert.throws(() => requireMongoUri({ MONGODB_URI: 'https://test-user:test-password@example.invalid' }), error =>
    error.message === 'MONGODB_URI must use mongodb:// or mongodb+srv://');
});
