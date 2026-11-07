'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const oid = () => new mongoose.Types.ObjectId();
const report = args => require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-10-01', toDate: '2026-10-31', basis: 'recorded' });
async function setup(t, suffix) {
  await connectVenueMongo(t, suffix); const args = await fixture();
  await require('../models/User').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.actor.userId) }, { $set: { posPermissions: ['pos:sell', 'venue:profitability_read'] } });
  const roles = { rawInventory: '1210', preparedInventory: '1220', issuedService: '1230', cogs: '7100', waste: '7200' };
  await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.locationId) }, { $set: { 'venueServices.catalogCosting.policy': { version: 1, state: 'approved', approvedBy: new mongoose.Types.ObjectId(args.actor.userId), approvedAt: new Date('2026-09-01'), currency: 'NGN', recognitionTiming: 'canonical_sale', accounts: roles } } });
  await require('../models/Account').collection.insertMany(Object.entries(roles).map(([role, code]) => ({ tenant: new mongoose.Types.ObjectId(args.tenantId), code, name: role, type: ['cogs', 'waste'].includes(role) ? 'expense' : 'asset', isActive: true })));
  return args;
}
async function bill(args, { netMinor = 5000, costMinor = 2000, at = '2026-10-20T14:00:00Z', lineId = 'dish', actual = false, journal = true, pending = true, status = 'verified' } = {}) {
  const billId = oid(), sessionId = oid(), eventId = oid(), costId = oid(), movementId = oid(), journalId = oid(), sourceId = oid();
  const tenant = new mongoose.Types.ObjectId(args.tenantId), location = new mongoose.Types.ObjectId(args.locationId), date = new Date(at);
  const line = { lineId, revision: 1, product: oid(), subproduct: oid(), size: oid(), name: 'Rice', quantity: 1, firedQuantity: 1, netMinor, taxMinor: 0, costMinor, unitPriceMinor: netMinor };
  await require('../models/Order').collection.insertOne({ _id: billId, tenant, posWarehouse: location, venueIdentityVersion: 1, venueBillForSession: sessionId, venueServiceSession: sessionId, currency: 'NGN', createdAt: date, venueSettlementState: 'settled', accountingStatus: 'posted', venueBillSnapshot: { acceptedLines: [line], netMinor, commissionMinor: 0, rateBps: 0, taxMinor: 0, locationId: args.locationId, createdAt: date, ...(actual ? { costMode: 'actual' } : {}) }, ...(actual ? { venueCostRecognition: { status: 'verified', policyVersion: 1, costSnapshotIds: [costId], journalIds: costMinor ? [journalId] : [] } } : {}) });
  await require('../models/JournalEntry').collection.insertOne({ _id: sourceId, tenant, refDoc: billId, refDocType: 'Order', entryType: 'sales_revenue', source: 'venue', status: 'posted', date, lines: [{ account: '4000', credit: netMinor / 100, debit: 0 }, { account: '1000', debit: netMinor / 100, credit: 0 }] });
  if (actual) {
    await require('../models/VenueCostSnapshot').collection.insertOne({ _id: costId, tenant, location, effectKey: `physical:${eventId}`, sourceKind: 'recipe_issue', sourceEvent: eventId, session: sessionId, billOrder: billId, lineId, revision: 1, quantity: { amountScaled: 1, scale: 1, unit: 'count' }, sourceAllocations: [{ movementId, lotId: oid(), receiptId: oid(), allocatedCostMinor: costMinor, quantity: { amountScaled: 100, scale: 100, unit: 'g' }, sourceTimestamp: date }], amountMinor: costMinor, status, currency: 'NGN', policyVersion: 1, recordedAt: date });
    await require('../models/InventoryMovement').collection.insertOne({ _id: movementId, tenant, warehouse: location, status: 'confirmed', type: 'shipped', quantity: 1, createdAt: date });
    await require('../models/VenueConsumptionEvent').collection.insertOne({ _id: eventId, tenant, location, session: sessionId, billOrder: billId, lineId, revision: 1, fireDelta: 1, physicalCoverage: 'complete', movementIds: [movementId], costSnapshotId: costId });
    if (pending && costMinor) await require('../models/JournalEntry').collection.insertOne({ tenant, refDoc: eventId, refDocType: 'VenueConsumptionEvent', entryType: 'inventory_adjust', source: 'venue_physical_cost', status: 'posted', date, venueCostSnapshotIds: [costId], lines: [{ account: '1230', debit: costMinor / 100, credit: 0 }, { account: '1210', credit: costMinor / 100, debit: 0 }] });
    if (journal && costMinor) await require('../models/JournalEntry').collection.insertOne({ _id: journalId, tenant, refDoc: billId, refDocType: 'Order', entryType: 'cogs', source: 'venue_actual_cost', status: 'posted', date, venueCostSnapshotIds: [costId], lines: [{ account: '7100', debit: costMinor / 100, credit: 0 }, { account: '1230', credit: costMinor / 100, debit: 0 }] });
  }
  return { billId, sourceId, costId, journalId, line };
}

test('recorded margin requires matched physical and posted cost evidence; legacy bills stay estimated', { skip: !uri }, async t => {
  const args = await setup(t, 'profit_evidence');
  await bill(args); await bill(args, { actual: true, lineId: 'verified' }); await bill(args, { actual: true, journal: false, lineId: 'unposted' });
  const result = await report(args);
  assert.equal(result.rows.length, 3);
  const verified = result.rows.find(row => row.lineId === 'verified');
  assert.equal(verified.recordedCogsMinor, 2000); assert.equal(verified.grossMarginPct, 60); assert.equal(verified.markupPct, 150);
  assert.equal(result.rows.find(row => row.lineId === 'dish').recordedCogsMinor, null);
  assert.equal(result.rows.find(row => row.lineId === 'unposted').recordedCogsMinor, null);
  assert.equal(result.totals.grossProfitMinor, null); assert.equal(result.totals.knownSubtotals.grossProfitMinor, 3000);
  const estimated = await require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-10-01', toDate: '2026-10-31', basis: 'estimated' });
  assert.equal(estimated.totals.grossProfitMinor, 9000); assert.equal(estimated.rows[0].basis, 'estimated');
  const ledger = await require('../services/accounting.service').getProfitLoss(args.tenantId, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(ledger.cogs.total, 20); assert.equal(ledger.cogs.source, 'journal');
});

test('evidenced zero needs no invented zero journal; positive cost requires the original issued-service journal', { skip: !uri }, async t => {
  const args = await setup(t, 'profit_pending'); await bill(args, { actual: true, costMinor: 0, lineId: 'free_source' }); await bill(args, { actual: true, pending: false, lineId: 'missing_source_journal' });
  const result = await report(args);
  const zero = result.rows.find(row => row.lineId === 'free_source'); assert.equal(zero.recordedCogsMinor, 0); assert.equal(zero.grossProfitMinor, 5000);
  assert.equal(result.rows.find(row => row.lineId === 'missing_source_journal').recordedCogsMinor, null);
});

test('full-filter totals and stable cursor are independent of page size and foreign tenant records', { skip: !uri }, async t => {
  const args = await setup(t, 'profit_pages'); await bill(args, { actual: true, lineId: 'a' }); await bill(args, { actual: true, lineId: 'b' });
  const foreign = await fixture(); await bill(foreign, { actual: true, netMinor: 990000, lineId: 'foreign' });
  const page = await require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-10-01', toDate: '2026-10-31', basis: 'recorded', limit: 1 });
  assert.equal(page.rows.length, 1); assert.equal(page.totals.netMerchandiseMinor, 10000); assert.equal(page.totals.grossProfitMinor, 6000); assert.ok(page.nextCursor);
  const next = await require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-10-01', toDate: '2026-10-31', basis: 'recorded', limit: 1, cursor: page.nextCursor });
  assert.notEqual(next.rows[0].sourceId, page.rows[0].sourceId); assert.equal(next.totals.grossProfitMinor, 6000); assert.equal(next.asOf, page.asOf);
  await assert.rejects(report({ ...args, locationId: foreign.locationId }), { code: 'NOT_FOUND' });
  await require('../models/User').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.actor.userId) }, { $set: { venueDeniedActions: ['profitability.read'] } });
  await assert.rejects(report(args), { code: 'VENUE_PERMISSION_DENIED' });
});

test('refund-only period uses posted merchandise reversal, retains served cost and leaves provider fee unknown', { skip: !uri }, async t => {
  const args = await setup(t, 'profit_refund'); const original = await bill(args, { actual: true, at: '2026-09-20T14:00:00Z' }); const caseId = oid(), tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/VenuePaymentReversal').collection.insertOne({ tenant, location: new mongoose.Types.ObjectId(args.locationId), caseId, billOrder: original.billId, amountMinor: 1000, appliedMinor: 1000, taxMinor: 0, financialMinor: 0, commissionMinor: 0 });
  await require('../models/JournalEntry').collection.insertOne({ tenant, refDoc: caseId, refDocType: 'VenueRefundCase', entryType: 'refund', source: 'venue_refund', status: 'posted', date: new Date('2026-10-20T14:00:00Z'), lines: [{ account: '4000', debit: 10 }, { account: '1300', credit: 10 }] });
  const result = await report(args); assert.equal(result.rows.length, 1); assert.equal(result.totals.netMerchandiseMinor, -1000); assert.equal(result.totals.recordedCogsMinor, 0); assert.equal(result.totals.grossProfitMinor, -1000); assert.equal(result.totals.grossMarginPct, null); assert.equal(result.totals.contributionMinor, null);
});

test('location business cutoff and DST use service date while invalid ranges/currencies are refused', { skip: !uri }, async t => {
  const args = await setup(t, 'profit_dates'); await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.locationId) }, { $set: { 'venueServices.timezone': 'America/New_York', 'venueServices.businessDayStartMinutes': 240 } });
  await bill(args, { actual: true, at: '2026-03-08T06:30:00Z' });
  const result = await require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-03-07', toDate: '2026-03-07', basis: 'recorded' }); assert.equal(result.rows.length, 1); assert.equal(result.rows[0].businessDate, '2026-03-07');
  const outside = await bill(args, { at: '2026-09-20T14:00:00Z' }); await require('../models/Order').collection.updateOne({ _id: outside.billId }, { $set: { currency: 'USD' } });
  const unchanged = await require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-03-07', toDate: '2026-03-07', basis: 'recorded' }); assert.equal(unchanged.rows.length, 1);
  await assert.rejects(require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-02-30', toDate: '2026-03-01', basis: 'recorded' }), { code: 'INVALID_INPUT' });
  await assert.rejects(require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2025-01-01', toDate: '2026-10-31', basis: 'recorded' }), { code: 'INVALID_INPUT' });
  await assert.rejects(require('../services/venue/profitability').getMarginReport({ ...args, fromDate: '2026-10-01', toDate: '2026-10-31', basis: 'recorded', currency: 'USD' }), { code: 'INVALID_CURRENCY' });
});
