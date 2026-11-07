'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { recoveryDelay, recoveryFailureState } = require('../services/venue/recovery');
test('retries_back_off_and_stop_automatically_after_eight_attempts', () => {
  assert.equal(recoveryDelay(1), 30000);
  assert.equal(recoveryDelay(8), 900000);
  assert.equal(recoveryFailureState(7), 'pending'); assert.equal(recoveryFailureState(8), 'needs_review');
});
