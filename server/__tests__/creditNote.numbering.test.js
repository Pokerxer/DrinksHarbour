// __tests__/creditNote.numbering.test.js
//
// Credit note numbers used to be `CN-${year}-${randomUUID().slice(0,13)}` —
// random, with no gap detection and nothing meaningful to quote to an auditor.
// These are now a per-tenant, per-year sequence assigned at POST time rather
// than at creation, so a discarded draft does not burn a number.
const test = require('node:test');
const assert = require('node:assert/strict');
const numbering = require('../services/creditNote.numbering');
const Counter = require('../models/Counter');

test('a number pads to six digits', () => {
  assert.equal(numbering.formatNumber({ year: 2026, seq: 1 }), 'CN-2026-000001');
  assert.equal(numbering.formatNumber({ year: 2026, seq: 42 }), 'CN-2026-000042');
  assert.equal(numbering.formatNumber({ year: 2026, seq: 999999 }), 'CN-2026-999999');
});

test('the year is carried in the number so it rolls over cleanly', () => {
  assert.equal(numbering.formatNumber({ year: 2027, seq: 1 }), 'CN-2027-000001');
});

test('sequence keys are scoped per tenant and per year', () => {
  const a = numbering.formatKey({ tenant: 'tenantA', year: 2026 });
  const b = numbering.formatKey({ tenant: 'tenantB', year: 2026 });
  const nextYear = numbering.formatKey({ tenant: 'tenantA', year: 2027 });
  assert.notEqual(a, b, 'two tenants must not share a sequence');
  assert.notEqual(a, nextYear, 'a new year must not continue the old sequence');
});

test('numbers increment from one', async (t) => {
  let seq = 0;
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ seq: ++seq }));
  assert.equal(await numbering.nextNumber({ tenant: 'tenantA', year: 2026 }), 'CN-2026-000001');
  assert.equal(await numbering.nextNumber({ tenant: 'tenantA', year: 2026 }), 'CN-2026-000002');
  assert.equal(await numbering.nextNumber({ tenant: 'tenantA', year: 2026 }), 'CN-2026-000003');
});

test('a duplicate-key race on the upsert is retried, not surfaced', async (t) => {
  // Two transactions can both fail to find the counter and both try to insert
  // it; one loses on the unique index. That is expected contention, not an
  // error the user should see.
  let calls = 0;
  t.mock.method(Counter, 'findOneAndUpdate', async () => {
    calls += 1;
    if (calls === 1) {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      throw err;
    }
    return { seq: 7 };
  });
  assert.equal(await numbering.nextNumber({ tenant: 'tenantA', year: 2026 }), 'CN-2026-000007');
  assert.equal(calls, 2, 'the first attempt should have been retried');
});

test('a duplicate-key error that persists is surfaced', async (t) => {
  t.mock.method(Counter, 'findOneAndUpdate', async () => {
    const err = new Error('E11000 duplicate key error');
    err.code = 11000;
    throw err;
  });
  await assert.rejects(
    numbering.nextNumber({ tenant: 'tenantA', year: 2026 }),
    /duplicate key/,
  );
});

test('the counter is read atomically, never find-then-increment', async (t) => {
  // A read followed by a write would hand two concurrent posts the same number.
  let args;
  t.mock.method(Counter, 'findOneAndUpdate', async (query, update) => {
    args = { query, update };
    return { seq: 1 };
  });
  await numbering.nextNumber({ tenant: 'tenantA', year: 2026 });
  assert.equal(args.update.$inc.seq, 1, 'must use $inc');
  assert.equal(args.query.tenant, 'tenantA');
  assert.equal(args.query.year, 2026);
});
