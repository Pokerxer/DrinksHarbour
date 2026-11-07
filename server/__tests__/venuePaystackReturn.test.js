'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
test('provider_return_uses_staff_surface_without_trusting_a_client_redirect', () => {
  const { returnPath } = require('../services/venue/paystack');
  assert.equal(returnPath({ session: 'visit' }, true), '/pos/sell?venueSession=visit');
  assert.equal(returnPath({ session: 'visit' }, false), '/venue-completion?visit=visit');
});
