'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
test('actual-cost bills never also expense the accepted estimated line cost', () => {
  const { venuePostings } = require('../services/venue/accounting');
  const postings = venuePostings({ venueBillSnapshot: { costMode:'actual',totalMinor:5000,netMinor:5000,commissionMinor:0,taxMinor:0,acceptedLines:[{quantity:1,costMinor:2000}] } },{provider:'cash'});
  assert.deepEqual(postings.map(p=>p.entryType), ['sales_revenue']);
});
