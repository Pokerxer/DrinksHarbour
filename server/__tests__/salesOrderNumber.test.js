// server/__tests__/salesOrderNumber.test.js
//
// The number generator used to be SalesOrder.countDocuments({}) + 1 — a count,
// across every tenant. Three consequences, one test each below: a new tenant
// inherited the platform's count, a delete made the count go backwards and
// re-issued a number still in use (the unique {tenant, soNumber} index then
// rejects it), and the sequence was not the tenant's own.
//
// Test strategy follows the rest of this suite (salesOrder.api.test.js,
// salesOrder.quotation.test.js): node:test's t.mock.method over Mongoose model
// methods, no live DB.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const { generateSalesOrderNumber } = require('../utils/orderUtils');

const oid = () => new mongoose.Types.ObjectId();

// Stub findOne(...).sort(...).select(...).lean() and capture the query.
function stubHighest(t, highestSoNumber) {
  const seen = {};
  t.mock.method(SalesOrder, 'findOne', (query) => {
    seen.query = query;
    return {
      sort: () => ({
        select: () => ({
          lean: async () =>
            highestSoNumber ? { soNumber: highestSoNumber } : null,
        }),
      }),
    };
  });
  return seen;
}

test('first number for a tenant is SO00001, and the query is scoped to that tenant', async (t) => {
  const tenantId = oid();
  const seen = stubHighest(t, null);

  const n = await generateSalesOrderNumber(tenantId);

  assert.strictEqual(n, 'SO00001');
  assert.strictEqual(String(seen.query.tenant), String(tenantId));
});

test('the next number is one above the tenant\'s highest, not a count of documents', async (t) => {
  // Only three documents exist, but the highest number issued is SO00007.
  // A count would return SO00004 and collide with a live number.
  stubHighest(t, 'SO00007');

  assert.strictEqual(await generateSalesOrderNumber(oid()), 'SO00008');
});

test('a tenant sequence is its own — tenant B starts at SO00001 while tenant A holds forty', async (t) => {
  const tenantA = oid();
  const tenantB = oid();
  const byTenant = { [String(tenantA)]: 'SO00040', [String(tenantB)]: null };

  t.mock.method(SalesOrder, 'findOne', (query) => ({
    sort: () => ({
      select: () => ({
        lean: async () => {
          const hit = byTenant[String(query.tenant)];
          return hit ? { soNumber: hit } : null;
        },
      }),
    }),
  }));

  assert.strictEqual(await generateSalesOrderNumber(tenantA), 'SO00041');
  assert.strictEqual(await generateSalesOrderNumber(tenantB), 'SO00001');
});

test('a tenantId is required — a missing one would silently number across all tenants', async () => {
  await assert.rejects(
    () => generateSalesOrderNumber(),
    /requires a tenantId/
  );
});

// ── withSoNumber: the race the highest-number rule cannot close ──────────────
// Two creates reading the same highest number both claim it; the loser gets an
// E11000 from the unique {tenant, soNumber} index. That used to surface as a
// 500. It should cost one extra round-trip instead.

const svc = require('../services/salesOrder.service');

function dupKeyError() {
  const err = new Error('E11000 duplicate key error collection: test.salesorders');
  err.code = 11000;
  err.keyPattern = { tenant: 1, soNumber: 1 };
  return err;
}

test('a duplicate soNumber retries with a fresh number', async (t) => {
  let highest = 'SO00007';
  t.mock.method(SalesOrder, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => ({ soNumber: highest }) }) }),
  }));

  const attempts = [];
  const persist = async (soNumber) => {
    attempts.push(soNumber);
    if (attempts.length === 1) {
      highest = 'SO00008'; // the winner's document now exists
      throw dupKeyError();
    }
    return { soNumber };
  };

  const doc = await svc.withSoNumber(oid(), persist);

  assert.deepStrictEqual(attempts, ['SO00008', 'SO00009']);
  assert.strictEqual(doc.soNumber, 'SO00009');
});

test('a non-duplicate error is not retried', async (t) => {
  t.mock.method(SalesOrder, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => null }) }),
  }));

  let calls = 0;
  const persist = async () => {
    calls += 1;
    throw new Error('validation failed');
  };

  await assert.rejects(() => svc.withSoNumber(oid(), persist), /validation failed/);
  assert.strictEqual(calls, 1);
});

test('a persistent duplicate gives up rather than looping forever', async (t) => {
  t.mock.method(SalesOrder, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => null }) }),
  }));

  let calls = 0;
  const persist = async () => { calls += 1; throw dupKeyError(); };

  await assert.rejects(() => svc.withSoNumber(oid(), persist), /E11000/);
  assert.strictEqual(calls, 5);
});
