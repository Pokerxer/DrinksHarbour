'use strict';
// S5 Task 2: the service-charge financial line in the canonical venue bill —
// derived from the same frozen accepted lines and consent version as the
// minimum, excluded from commission, counted once across split payers.
const test = require('node:test'), assert = require('node:assert/strict'), mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
test('approved service charge freezes one typed line, excluded from commission and minimum, counted once across payers', async t => {
  await connectVenueMongo(t, 'service_charge_billing');
  const args = await fixture(), item = await beverage(args); item.quantity = 1;
  await require('../models/Size').updateOne({ _id: item.sizeId, tenant: args.tenantId }, { $set: { sellingPrice: 160000 } });
  await require('../models/SubProduct').updateOne({ _id: item.subProductId, tenant: args.tenantId }, { $set: { baseSellingPrice: 160000 } });
  await require('../services/venue/service-sessions').ensureIndexes(); await require('../services/venue/billing').ensureIndexes();
  await require('../services/venue/advances').ensureIndexes(); await require('../services/venue/payers').ensureIndexes();
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(args.tenantId); await require('../models/JournalEntry').createIndexes();
  for (const account of [['2250', 'Booking Advances', 'liability'], ['4050', 'Minimum Spend Shortfall', 'income'], ['4060', 'Service Charge', 'income']])
    await require('../models/Account').create({ tenant: args.tenantId, code: account[0], name: account[1], type: account[2] });
  const reviewer = new mongoose.Types.ObjectId(), customer = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertMany([{ _id: reviewer, role: 'super_admin', status: 'active' }, { _id: customer, role: 'customer', status: 'active' }]);
  const policy = { tenant: args.tenantId, location: args.locationId, version: 7, state: 'approved', approvedBy: reviewer, approvedAt: new Date(), decisionOwner: 'Synthetic finance review', currency: 'NGN', depositMinor: 0, paymentWindowSeconds: 600, minimumMinor: 20000000, minimumTerms: 'Disclosed minimum NGN200000 eligible net merchandise', cancellationTerms: 'Review', noShowTerms: 'Review', excessCreditTerms: 'Review', refundAuthority: 'owner_review', refundFunding: 'original_collection', taxTreatment: 'existing_merchandise', eligibility: 'merchandise_net', excludedSubProducts: [], shortfallClassification: 'service_shortfall', shortfallTaxRate: 0, shortfallTaxDecision: 'synthetic-exempt-policy-7', accounts: { advance: '2250', clearing: '1300', shortfall: '4050' },
    serviceCharge: { enabled: true, rateBps: 1250, appliesTo: 'merchandise_net', taxable: false, taxDecision: 'synthetic-service-charge-zero-tax-v7', countsTowardMinimum: false, accounts: { revenue: '4060' }, displayLabel: 'Service charge 12.5%' } };
  const booking = await require('../models/Booking').create({ tenant: args.tenantId, location: args.locationId, createdBy: customer, guest: { name: 'Guest', phone: '123' }, partySize: 2, bookingAt: new Date(), source: 'discovery', status: 'confirmed', acquisitionAuthority: 'server', financialPolicy: policy, financialTermsVersion: 7, financialTermsAcceptedAt: new Date() });
  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, bookingId: String(booking._id), idempotencyKey: 'arrival' });
  const accepted = await require('../services/venue/lines').setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [item], idempotencyKey: 'lines' });
  const command = { ...args, sessionId: visit.id, expectedVersion: accepted.version, lineVersion: accepted.lineVersion, ageVerified: true, idempotencyKey: 'freeze' };
  await require('../models/Booking').updateOne({ _id: booking._id }, { $unset: { financialTermsVersion: 1 } });
  await assert.rejects(require('../services/venue/billing').ensureBillOrder(command), e => e.code === 'FINANCIAL_TERMS_NOT_ACCEPTED');
  await require('../models/Booking').updateOne({ _id: booking._id }, { $set: { financialTermsVersion: 7, financialTermsAcceptedAt: new Date() } });
  const bill = await require('../services/venue/billing').ensureBillOrder(command);
  const serviceLines = bill.financialLines.filter(l => l.kind === 'service_charge');
  assert.equal(serviceLines.length, 1); // exactly one service_charge line
  assert.equal(serviceLines[0].amountMinor, 2000000); // 12.5% of 16000000 net
  assert.equal(serviceLines[0].taxMinor, 0); assert.equal(serviceLines[0].description, 'Service charge 12.5%');
  const snapshot = (await require('../models/Order').findById(bill.orderId).lean()).venueBillSnapshot;
  assert.equal(snapshot.financialLines.find(l => l.kind === 'service_charge').taxDecision, 'synthetic-service-charge-zero-tax-v7');
  assert.equal(snapshot.eligibleNetMinor, 16000000); // minimum unchanged by default: service charge excluded
  assert.equal(bill.totalMinor, 22000000); // 16000000 merchandise + 4000000 shortfall + 2000000 service charge
  assert.equal(bill.commissionMinor, 1440000); // commission on merchandise only — service charge excluded
  const again = await require('../services/venue/billing').ensureBillOrder(command);
  assert.equal(again.orderId, bill.orderId); assert.equal(again.quoteId, bill.quoteId);
  assert.deepEqual(again.financialLines, bill.financialLines); // byte-identical requote
  const previous = { VENUE_MONEY_ENABLED: process.env.VENUE_MONEY_ENABLED, VENUE_PAYER_SECRET: process.env.VENUE_PAYER_SECRET };
  Object.assign(process.env, { VENUE_MONEY_ENABLED: 'true', VENUE_PAYER_SECRET: 'service-charge-test-secret-with-32-chars' });
  t.after(() => { for (const [k, v] of Object.entries(previous)) v === undefined ? delete process.env[k] : process.env[k] = v; });
  const payers = require('../services/venue/payers');
  const portionCommand = { ...args, sessionId: visit.id, expectedVersion: bill.version, financialPolicyVersion: 7, equalCount: 2, idempotencyKey: 'portions' };
  const portions = (await payers.createPortions(portionCommand)).portions;
  assert.equal(portions.reduce((n, p) => n + p.amountMinor, 0), 22000000); // service charge is payable, split across payers
  t.mock.method(require('../services/venue/paystack'), 'initialize', async () => ({ authorizationUrl: 'https://checkout.paystack.com/local-fake' }));
  const receipts = [];
  for (const [index, portion] of portions.entries()) {
    const started = await payers.collectPortion({ customerId: String(customer), portionId: portion.id, token: portion.token, email: 'payer@example.test', idempotencyKey: `pay-${index}` });
    const attempt = await require('../models/VenuePaymentAttempt').findById(started.attemptId).lean();
    receipts.push(await require('../services/venue/collections').recordVerifiedPayment(attempt.reference, { success: true, status: 'paid', data: { reference: attempt.reference, amountMinor: portion.amountMinor, currency: 'NGN', transactionId: `sc-payer-${index}`, paidAt: new Date() } }));
    await require('../services/venue/settlement').settleVenueBill({ tenantId: args.tenantId, receiptId: receipts[index], actor: args.actor });
  }
  const settled = await require('../services/venue/settlement').settleVenueBill({ tenantId: args.tenantId, receiptId: receipts[1], actor: args.actor });
  assert.equal(settled.state, 'settled'); assert.equal(settled.outstandingMinor, 0);
  const allocations = await require('../models/VenuePaymentAllocation').find({ tenant: args.tenantId, billOrder: bill.orderId }).lean();
  assert.equal(allocations.length, 2); // retry settles once: no duplicate allocations
  assert.equal(allocations.reduce((n, a) => n + a.amountMinor, 0), 22000000); // payers covered the total incl. service charge exactly once
  assert.equal(allocations.reduce((n, a) => n + a.financialMinor, 0), 6000000); // shortfall + service charge counted once
  const revenue = await require('../models/JournalEntry').findOne({ refDoc: bill.orderId, entryType: 'sales_revenue' }).lean();
  const debit = line => revenue.lines.filter(l => l.account === line).reduce((n, l) => n + l.debit, 0);
  const credit = line => revenue.lines.filter(l => l.account === line).reduce((n, l) => n + l.credit, 0);
  assert.equal(debit('6000'), 14400); // commission posts on merchandise only, never on the service charge
  assert.equal(credit('4000'), 160000); assert.equal(credit('4050'), 40000); assert.equal(credit('4060'), 20000); // own account
  const order = await require('../models/Order').findById(bill.orderId).lean();
  const totals = require('../services/posReturnTotals.service').orderReturnTotals(order);
  assert.equal(totals.netSales, 200000); // analytics sales exclude the service charge
  assert.equal(totals.netCollections, 220000); // the cash was still collected
  require('../services/posAnalyticsNet.service').summarizeNetOrders([order]);
  assert.equal(require('../services/posAnalyticsNet.service').summarizeNetOrders([order]).totalSales, 200000);
});