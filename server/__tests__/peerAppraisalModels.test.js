const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Cycle = require('../models/AppraisalCycle');
const Participant = require('../models/PeerAppraisalParticipant');
const Rating = require('../models/PeerAppraisalRating');
const id = () => new mongoose.Types.ObjectId();
test('peer cycles need no template while standard cycles still do', () => {
  const base = { tenant: id(), name: 'October' };
  assert.equal(new Cycle({ ...base, mode: 'peer_rating' }).validateSync(), undefined);
  assert.ok(new Cycle(base).validateSync().errors.template);
});
test('ratings and money reject fractions and bounds at persistence boundary', () => {
  const base = { tenant: id(), cycle: id(), reviewer: id(), subject: id() };
  for (const rating of [0, 1.2, 6]) assert.ok(new Rating({ ...base, rating }).validateSync());
  assert.equal(new Rating({ ...base, rating: 5 }).validateSync(), undefined);
  assert.ok(new Participant({ tenant: id(), cycle: id(), employee: id(), displayName: 'Ada', allocationMinor: -1 }).validateSync());
});

test('participant appraiser permission defaults to true for existing cycle behavior', () => {
  const base = { tenant: id(), cycle: id(), employee: id(), displayName: 'Ada', allocationMinor: 0 };
  assert.equal(new Participant(base).isAppraiser, true);
  assert.equal(new Participant({ ...base, isAppraiser: false }).isAppraiser, false);
});
