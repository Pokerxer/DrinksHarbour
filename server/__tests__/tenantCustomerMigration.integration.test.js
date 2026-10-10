'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const baseUri = process.env.DRINKSHARBOUR_AUTH_TEST_MONGO_URI;
const uri = baseUri ? `${baseUri}_migration` : undefined;
test(
  'namespace migration previews without writes and preserves account ownership when replacing global index',
  { skip: !uri },
  async (t) => {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_auth_test_[\w]+$/);
    await mongoose.connect(uri);
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    const collection = mongoose.connection.db.collection('users');
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    await collection.insertMany([
      {
        _id: a,
        email: 'old@example.com',
        role: 'customer',
        tenant: b,
        passwordHash: 'unchanged',
      },
      {
        email: 'platform@example.com',
        role: 'customer',
        passwordHash: 'unchanged-platform',
      },
    ]);
    await collection.createIndex({ email: 1 }, { unique: true });
    const { migrate } = require('../scripts/migrate-customer-login-scope');
    const preview = await migrate(mongoose.connection.db);
    assert.equal(preview.namespaceUpdates, 2);
    assert.equal((await collection.findOne({ _id: a })).loginScope, undefined);
    await migrate(mongoose.connection.db, true);
    const after = await collection.findOne({ _id: a });
    assert.equal(String(after.tenant), String(b));
    assert.equal(after.passwordHash, 'unchanged');
    assert.equal(after.loginScope, `tenant:${b}`);
    assert.equal(
      (await collection.indexes()).some((i) => i.name === 'email_1'),
      false,
    );
    await collection.insertOne({
      email: 'old@example.com',
      role: 'customer',
      loginScope: 'platform',
    });
    await assert.rejects(
      collection.insertOne({
        email: 'old@example.com',
        role: 'customer',
        tenant: b,
        loginScope: `tenant:${b}`,
      }),
      (e) => e.code === 11000,
    );
  },
);
