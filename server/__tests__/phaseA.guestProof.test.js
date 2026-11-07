'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
test('guest proof is signed scoped expiring and grants no merchant command', () => {
 process.env.JWT_SECRET = 'phase-a-guest-proof-test';
 const proof = require('../services/guestOrderProof');
 const order = { _id: '650000000000000000000001', user: null, items: [] };
 const token = proof.issue(order);
 const actor = proof.actor({ get: () => token }, order);
 assert.equal(require('../services/orderAccess').project(order, actor)._id, order._id);
 assert.throws(() => proof.actor({ get: () => token }, { ...order, _id: '650000000000000000000002' }), e => e.statusCode === 404);
 assert.throws(() => require('../services/orderAccess').assertMutation(order, actor, { customer: true }), e => e.statusCode === 403);
 const expired = require('jsonwebtoken').sign({ purpose: 'guest_order', order: order._id }, process.env.JWT_SECRET, { expiresIn: -1 });
 assert.throws(() => proof.actor({ get: () => expired }, order), e => e.statusCode === 404);
});
