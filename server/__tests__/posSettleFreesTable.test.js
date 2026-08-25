// server/__tests__/posSettleFreesTable.test.js
//
// Settling a tab: paying for a held order through createPOSOrder must also
// free the table the tab sits at and retire the hold itself.
//
// The flow splits in two halves, tested separately:
//
//   assertSettleClaim   — the pre-money gate. Given the table doc loaded from
//                         the DB, is this sale allowed to act as the settle?
//                         Pure, no mocks: it decides 404 vs 409 vs go, and it
//                         runs BEFORE any stock deduction or wallet charge so
//                         a table settled on another device never moves money.
//
//   settleTableAfterSale— the post-sale write. The sale has persisted, so both
//                         writes are guarded/idempotent: the free only lands
//                         while this exact tab still owns the table row, and
//                         the recall only touches an order still parked as a
//                         hold. Failures here are logged upstream, never fatal.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const POSTable = require('../models/POSTable');
const pos = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const TABLE = oid();
const TAB_ID = oid();
const OTHER_TAB = oid();

function tableDoc(over = {}) {
  return { _id: TABLE, tenant: TENANT, name: 'Bar 1', status: 'occupied', currentTabId: TAB_ID, ...over };
}

// ─── assertSettleClaim ───────────────────────────────────────────────────────

test('assertSettleClaim: unknown table is a 404 shape', () => {
  const claim = pos.assertSettleClaim(null, String(TAB_ID));

  assert.equal(claim.ok, false);
  assert.equal(claim.status, 404);
  assert.ok(claim.message, 'the caller needs a message to send');
});

test('assertSettleClaim: a table held by ANOTHER tab refuses with a 409', () => {
  const claim = pos.assertSettleClaim(tableDoc({ currentTabId: OTHER_TAB }), String(TAB_ID));

  assert.equal(claim.ok, false, 'money must not move when the tab moved tables');
  assert.equal(claim.status, 409);
  assert.match(claim.message, /another device/);
});

test('assertSettleClaim: string/ObjectId id forms compare equal', () => {
  const claim = pos.assertSettleClaim(tableDoc(), String(TAB_ID));

  assert.equal(claim.ok, true, 'currentTabId stores an ObjectId; the till sends a string');
});

test('assertSettleClaim: a free table or the very tab holding it can settle', () => {
  const free = pos.assertSettleClaim(tableDoc({ status: 'available', currentTabId: null }), String(TAB_ID));
  assert.deepEqual(free, { ok: true, tableName: 'Bar 1' });

  const owner = pos.assertSettleClaim(tableDoc({ name: 'Table 5' }), String(TAB_ID));
  assert.equal(owner.ok, true);
  assert.equal(owner.tableName, 'Table 5');
});

// ─── settleTableAfterSale ────────────────────────────────────────────────────

test('settleTableAfterSale frees only the claimed tab\u2019s table and recalls its hold', async (t) => {
  let freeFilter = null;
  let freeUpdate = null;
  t.mock.method(POSTable, 'findOneAndUpdate', (filter, update) => {
    freeFilter = filter;
    freeUpdate = update;
    return Promise.resolve(tableDoc({ status: 'available', currentTabId: null }));
  });
  let recallFilter = null;
  let recallUpdate = null;
  t.mock.method(Order, 'updateOne', (filter, update) => {
    recallFilter = filter;
    recallUpdate = update;
    return Promise.resolve({ matchedCount: 1 });
  });

  const freed = await pos.settleTableAfterSale({
    tableId: String(TABLE),
    heldOrderId: String(TAB_ID),
    tenantId: TENANT,
  });

  assert.equal(freed, true);

  // Conditional on THIS tab still owning the row — that guard is what makes a
  // double settle a no-op instead of freeing a stranger's table.
  assert.equal(String(freeFilter._id), String(TABLE));
  assert.equal(String(freeFilter.tenant), String(TENANT));
  assert.equal(String(freeFilter.currentTabId), String(TAB_ID));
  assert.equal(freeUpdate.$set.status, 'available');
  assert.equal(freeUpdate.$set.currentTabId, null);

  // The consumed hold leaves every holds list for good, still tenant-scoped.
  assert.equal(String(recallFilter._id), String(TAB_ID));
  assert.equal(recallFilter.status, 'hold');
  assert.ok(recallFilter.$or, 'the recall must stay inside the tenant scope');
  assert.equal(String(recallFilter.$or[0].tenant), String(TENANT));
  assert.equal(recallUpdate.$set.status, 'recalled');
  assert.equal(recallUpdate.$set.paymentStatus, 'cancelled');
});

test('settleTableAfterSale still recalls the hold when the table row has moved on', async (t) => {
  // findOneAndUpdate matched nothing: freed already, re-claimed by a newer
  // tab, or deleted between the guard and settlement. The hold must not stay
  // parked forever just because its table row drifted.
  t.mock.method(POSTable, 'findOneAndUpdate', async () => null);
  let recallCalls = 0;
  t.mock.method(Order, 'updateOne', async () => {
    recallCalls += 1;
    return {};
  });

  const freed = await pos.settleTableAfterSale({
    tableId: String(TABLE),
    heldOrderId: String(TAB_ID),
    tenantId: TENANT,
  });

  assert.equal(freed, false);
  assert.equal(recallCalls, 1, 'the stale-row path still retires the hold');
});
