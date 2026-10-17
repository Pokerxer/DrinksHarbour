const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');
const controller = require('../controllers/appraisalCycle.controller');
test('existing create endpoint delegates peer mode without creating a template', async () => {
  const user = { _id: new mongoose.Types.ObjectId(), tenant: new mongoose.Types.ObjectId(), role: 'tenant_owner' };
  const h = makeHarness({ users: [user] });
  try {
    const res = capture(); let error;
    await controller.createCycle(asUser(user, { body: { name: 'Peer', mode: 'peer_rating' } }), res, e => { error = e; });
    assert.ifError(error);
    assert.equal(res.body.data.mode, 'peer_rating');
    assert.equal(h.db.templates.length, 0);
  } finally { h.restore(); }
});
