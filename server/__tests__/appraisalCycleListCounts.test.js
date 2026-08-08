// server/__tests__/appraisalCycleListCounts.test.js
//
// GET /api/appraisal-cycles returned bare cycle documents — {_id, name,
// status, deadlines, peerReviewEnabled} — so the cycles list page could show
// HR *that* a cycle existed but not how far through it was. "12 of 40
// released" per row needs counts, and the only honest way to get them is to
// aggregate them into this one response: a request per row is an N+1 that
// grows with the tenant's history.
//
// Idiom follows appraisalCycleProgress.test.js: stub the model statics with
// hand-written fakes and call the controller directly. No supertest, no
// in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const AppraisalCycle = require('../models/AppraisalCycle');
const Appraisal = require('../models/Appraisal');
const cycles = require('../controllers/appraisalCycle.controller');

const oid = () => new mongoose.Types.ObjectId();

function fakeReqRes(tenantId) {
  let jsonBody;
  let statusCode = 200;
  const res = {
    status(c) { statusCode = c; return res; },
    json(body) { jsonBody = body; return res; },
  };
  const req = { tenant: { _id: tenantId }, user: { _id: oid() }, params: {}, body: {} };
  return { req, res, getBody: () => jsonBody, getStatus: () => statusCode };
}

/**
 * Drives listCycles over `cycleDocs` with `appraisals` (each `{cycle, state}`)
 * standing in for the collection. Returns the response body.
 */
async function listWith({ cycleDocs, appraisals, aggregateThrows = false }) {
  const tenantId = oid();
  const originalFind = AppraisalCycle.find;
  const originalAggregate = Appraisal.aggregate;

  AppraisalCycle.find = (filter) => {
    assert.strictEqual(
      String(filter.tenant), String(tenantId),
      'cycle list must stay tenant-scoped'
    );
    const chain = {
      sort() { return chain; },
      lean: async () => cycleDocs.map((c) => ({ ...c })),
    };
    return chain;
  };

  Appraisal.aggregate = async (pipeline) => {
    if (aggregateThrows) throw new Error('aggregate exploded');
    // The counts query must be tenant-scoped in its own right: $match is the
    // ONLY thing standing between this pipeline and every tenant's appraisals,
    // because aggregate bypasses every schema-level default and hook.
    const match = pipeline[0].$match;
    assert.ok(match, 'counts pipeline must start with a $match');
    assert.strictEqual(
      String(match.tenant), String(tenantId),
      'counts pipeline must be tenant-scoped'
    );
    const buckets = new Map();
    for (const a of appraisals) {
      const key = `${a.cycle}|${a.state}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return [...buckets.entries()].map(([key, count]) => {
      const [cycle, state] = key.split('|');
      return { _id: { cycle: new mongoose.Types.ObjectId(cycle), state }, count };
    });
  };

  const { req, res, getBody, getStatus } = fakeReqRes(tenantId);
  let thrown = null;
  try {
    await cycles.listCycles(req, res, (err) => { thrown = err; });
  } finally {
    AppraisalCycle.find = originalFind;
    Appraisal.aggregate = originalAggregate;
  }
  return { body: getBody(), status: getStatus(), thrown, tenantId };
}

test('listCycles attaches per-cycle state counts', async () => {
  const a = oid();
  const b = oid();
  const { body } = await listWith({
    cycleDocs: [
      { _id: a, name: 'H1 2026', status: 'collecting' },
      { _id: b, name: 'H2 2026', status: 'draft' },
    ],
    appraisals: [
      { cycle: String(a), state: 'collecting' },
      { cycle: String(a), state: 'collecting' },
      { cycle: String(a), state: 'released' },
      { cycle: String(a), state: 'cancelled' },
      { cycle: String(b), state: 'draft' },
    ],
  });

  const rows = body.data;
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[0].byState, {
    collecting: 2, released: 1, cancelled: 1,
  });
  assert.deepStrictEqual(rows[1].byState, { draft: 1 });
});

test('a cycle with no appraisals gets an empty map, not a missing key', async () => {
  // The client tells "not launched" (empty map) from "broken" by the SHAPE
  // being there. A missing key would make every never-launched cycle look the
  // same as a cycle whose counts failed to load.
  const a = oid();
  const { body } = await listWith({
    cycleDocs: [{ _id: a, name: 'Draft cycle', status: 'draft' }],
    appraisals: [],
  });
  assert.deepStrictEqual(body.data[0].byState, {});
});

test('counts never bleed between cycles of the same tenant', async () => {
  const a = oid();
  const b = oid();
  const { body } = await listWith({
    cycleDocs: [
      { _id: a, name: 'A', status: 'collecting' },
      { _id: b, name: 'B', status: 'collecting' },
    ],
    appraisals: [
      { cycle: String(a), state: 'released' },
      { cycle: String(b), state: 'released' },
      { cycle: String(b), state: 'released' },
    ],
  });
  assert.deepStrictEqual(body.data[0].byState, { released: 1 });
  assert.deepStrictEqual(body.data[1].byState, { released: 2 });
});

test('the cycle documents themselves still come through untouched', async () => {
  const a = oid();
  const deadline = new Date('2026-09-01T00:00:00.000Z');
  const { body } = await listWith({
    cycleDocs: [{
      _id: a, name: 'H1 2026', status: 'collecting',
      feedbackDeadline: deadline, peerReviewEnabled: true,
    }],
    appraisals: [{ cycle: String(a), state: 'collecting' }],
  });
  const row = body.data[0];
  assert.strictEqual(row.name, 'H1 2026');
  assert.strictEqual(row.status, 'collecting');
  assert.strictEqual(row.peerReviewEnabled, true);
  assert.strictEqual(Number(row.feedbackDeadline), Number(deadline));
});

test('a failed counts aggregate surfaces as an error, not as zero everywhere', async () => {
  // Same rule cycleProgress documents: reporting "no appraisals in any cycle"
  // because a query broke is worse than a 500, because it looks like a
  // legitimate answer and HR would act on it.
  const { thrown, body } = await listWith({
    cycleDocs: [{ _id: oid(), name: 'H1', status: 'collecting' }],
    appraisals: [],
    aggregateThrows: true,
  });
  assert.ok(thrown instanceof Error, 'must hand the error to next()');
  assert.strictEqual(body, undefined, 'must not answer 200 with empty counts');
});
