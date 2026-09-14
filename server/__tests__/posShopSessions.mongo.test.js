const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const POSSession = require('../models/POSSession');
test('database allows parallel shops but rejects racing opens for the same shop', async t => {
  const dbName = `pos_shop_test_${crypto.randomBytes(8).toString('hex')}`;
  const connection = mongoose.createConnection(process.env.POS_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 1500 });
  try { await connection.asPromise(); } catch {
    await connection.close().catch(() => {});
    t.skip('Local MongoDB unavailable; unique index concurrency not verified'); return;
  }
  try {
    const Session = connection.model('POSSession', POSSession.schema);
    await Session.init();
    const tenant = new mongoose.Types.ObjectId(), openedBy = new mongoose.Types.ObjectId();
    const attempts = await Promise.allSettled([
      Session.create({ tenant, openedBy, shopId: 'a' }),
      Session.create({ tenant, openedBy, shopId: 'a' }),
      Session.create({ tenant, openedBy, shopId: 'b' }),
    ]);
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 2);
    assert.equal(attempts.find(x => x.status === 'rejected').reason.code, 11000);
    await Session.updateOne({ tenant, shopId: 'a' }, { $set: { status: 'closed' } });
    await Session.create({ tenant, openedBy, shopId: 'a' });
    assert.equal(await Session.countDocuments({ status: 'open' }), 2);
  } finally { await connection.dropDatabase(); await connection.close(); }
});
