// server/__tests__/appraisalFeedbackOrdering.test.js
//
// Peer feedback anonymity has two halves. `projectFeedbackForViewer` removes
// the reviewer from each row; this file covers the other one — that the row's
// POSITION in the array says nothing either.
//
// The leak it closes: peer rows were returned in natural (creation) order,
// which is the order the subject's own nominations were approved, and the
// subject view labelled the cards "Peer feedback 1", "Peer feedback 2". An
// anonymous list that ranks itself in the order you nominated people is not
// anonymous to the person who nominated them.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const { orderFeedbackForViewer } = require('../services/appraisal.helpers');

const oid = () => new mongoose.Types.ObjectId();

const SUBJECT = { canSeeReviewerNames: false };
const HR = { canSeeReviewerNames: true };

function peerRows(n) {
  return Array.from({ length: n }, () => ({ _id: oid(), kind: 'peer' }));
}

const ids = (rows) => rows.map((r) => String(r._id));

test('a viewer who may see names gets the rows untouched', () => {
  const appraisal = oid();
  const rows = peerRows(5);
  const out = orderFeedbackForViewer(rows, appraisal, HR);
  assert.deepStrictEqual(ids(out), ids(rows));
});

test('peer rows are reordered away from creation order for the subject', () => {
  const appraisal = oid();
  // Enough rows that an unchanged order would be a 1-in-3.6-million accident.
  const rows = peerRows(10);
  const out = orderFeedbackForViewer(rows, appraisal, SUBJECT);
  assert.strictEqual(out.length, rows.length);
  assert.notDeepStrictEqual(ids(out), ids(rows));
});

test('no row is dropped, duplicated, or invented', () => {
  const appraisal = oid();
  const rows = [
    { _id: oid(), kind: 'self' },
    ...peerRows(4),
    { _id: oid(), kind: 'manager' },
  ];
  const out = orderFeedbackForViewer(rows, appraisal, SUBJECT);
  assert.deepStrictEqual(ids(out).slice().sort(), ids(rows).slice().sort());
});

test('the order is stable across calls — refreshing must not reshuffle', () => {
  const appraisal = oid();
  const rows = peerRows(6);
  const first = orderFeedbackForViewer(rows, appraisal, SUBJECT);
  const second = orderFeedbackForViewer(rows, appraisal, SUBJECT);
  assert.deepStrictEqual(ids(first), ids(second));
  // ...and independent of the order it was handed, or the input order would
  // still be recoverable by anyone who could influence it.
  const reversed = orderFeedbackForViewer(
    [...rows].reverse(),
    appraisal,
    SUBJECT
  );
  assert.deepStrictEqual(ids(first), ids(reversed));
});

test('the same reviewer set lands differently under a different appraisal', () => {
  const rows = peerRows(8);
  const a = orderFeedbackForViewer(rows, oid(), SUBJECT);
  const b = orderFeedbackForViewer(rows, oid(), SUBJECT);
  // Salted per appraisal, so a reviewer does not occupy the same slot in
  // every appraisal they contribute to.
  assert.notDeepStrictEqual(ids(a), ids(b));
});

test('self and manager rows keep their relative order and stay ahead of peers', () => {
  const appraisal = oid();
  const self = { _id: oid(), kind: 'self' };
  const manager = { _id: oid(), kind: 'manager' };
  const out = orderFeedbackForViewer(
    [self, ...peerRows(3), manager],
    appraisal,
    SUBJECT
  );
  assert.deepStrictEqual(
    out.slice(0, 2).map((r) => r.kind),
    ['self', 'manager']
  );
  assert.ok(out.slice(2).every((r) => r.kind === 'peer'));
});

test('tolerates an empty or absent list', () => {
  assert.deepStrictEqual(orderFeedbackForViewer([], oid(), SUBJECT), []);
  assert.deepStrictEqual(orderFeedbackForViewer(undefined, oid(), SUBJECT), []);
});
