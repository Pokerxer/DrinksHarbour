// server/__tests__/salesOrderDetailPopulate.test.js
//
// getSalesOrder populated nothing, so warehouseId and fulfillments[].by reached
// the client as raw ObjectIds — unrenderable. The detail page showed neither.
//
// It also carried no remittance account, so the printed invoice had nowhere to
// tell the customer to pay. Those are read from the tenant here, server-side.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const SalesOrder = require('../models/SalesOrder');
const Tenant = require('../models/Tenant');
const ctrl = require('../controllers/salesOrder.controller');

const oid = () => new mongoose.Types.ObjectId();

/** Mock the tenant-scoped order lookup, recording every populate() call. */
function mockOrder(t, doc) {
  const populated = [];
  t.mock.method(SalesOrder, 'findOne', () => {
    const chain = {
      populate(path, select) { populated.push(`${path}:${select}`); return chain; },
      then(resolve) { return Promise.resolve(doc).then(resolve); },
    };
    return chain;
  });
  return populated;
}

/** Mock the payer lookup, recording the projection it asked for. */
function mockPayer(t, tenant) {
  const selects = [];
  t.mock.method(Tenant, 'findById', () => {
    const chain = {
      select(fields) { selects.push(fields); return chain; },
      lean: async () => tenant,
    };
    return chain;
  });
  return selects;
}

test('getSalesOrder populates the warehouse and the person on every fulfilment', async (t) => {
  const tenantId = oid();
  const soId = oid();
  const doc = { _id: soId, tenant: tenantId, soNumber: 'SO00002', toObject() { return { _id: soId, soNumber: 'SO00002' }; } };

  const populated = mockOrder(t, doc);
  const selects = mockPayer(t, { bankAccounts: [] });

  let payload;
  const req = { params: { id: String(soId) }, tenant: { _id: tenantId } };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await ctrl.getSalesOrder(req, res, (err) => { throw err; });

  assert.strictEqual(payload.data.soNumber, 'SO00002');
  // warehouseId carries address/contact too — the printed quotation/invoice
  // presents the selected warehouse as the issuing entity (PO parity).
  assert.ok(populated.includes('warehouseId:name code type address contact'));
  assert.ok(populated.includes('fulfillments.warehouseId:name'));
  assert.ok(populated.includes('fulfillments.by:firstName lastName'));
  // Only the remittance fields are read off the tenant — never a second
  // document's worth of payload, and never the public branding endpoint. The
  // settlement account (bankName/bankAccountName/bankAccountNumber) is
  // deliberately NOT selected: it is where the platform pays the tenant out,
  // not where a customer remits an invoice.
  assert.ok(selects.includes('bankAccounts'));
  assert.ok(!selects.includes('bankAccountNumber'));
});

test('getSalesOrder attaches the tenant remittance accounts for the invoice', async (t) => {
  const tenantId = oid();
  const soId = oid();
  const doc = { _id: soId, soNumber: 'SO00003', toObject() { return { _id: soId, soNumber: 'SO00003' }; } };

  mockOrder(t, doc);
  mockPayer(t, {
    bankAccounts: [
      { bankName: ' GTBank ', accountName: ' DrinksHarbour Ltd ', accountNumber: ' 0123456789 ' },
      { bankName: 'Zenith', accountName: 'DrinksHarbour Ltd', accountNumber: '9876543210' },
    ],
  });

  let payload;
  const req = { params: { id: String(soId) }, tenant: { _id: tenantId } };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await ctrl.getSalesOrder(req, res, (err) => { throw err; });

  assert.deepStrictEqual(payload.data.issuerBankAccounts, [
    { bankName: 'GTBank', accountName: 'DrinksHarbour Ltd', accountNumber: '0123456789' },
    { bankName: 'Zenith', accountName: 'DrinksHarbour Ltd', accountNumber: '9876543210' },
  ]);
});

test('getSalesOrder never prints the settlement account as a remittance destination', async (t) => {
  const tenantId = oid();
  const soId = oid();
  const doc = { _id: soId, soNumber: 'SO00004', toObject() { return { _id: soId }; } };

  mockOrder(t, doc);
  // A tenant that filled in the settlement block but never added invoice
  // accounts. Those are different accounts — the settlement account is where
  // Paystack pays the tenant OUT to — so an invoice must offer no destination
  // at all rather than direct a customer transfer at the tenant's payout
  // account.
  mockPayer(t, {
    bankAccounts: [],
    bankName: 'UBA',
    bankAccountName: 'DrinksHarbour Ltd',
    bankAccountNumber: '3011223344',
  });

  let payload;
  const req = { params: { id: String(soId) }, tenant: { _id: tenantId } };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await ctrl.getSalesOrder(req, res, (err) => { throw err; });

  assert.deepStrictEqual(payload.data.issuerBankAccounts, []);
});

test('getSalesOrder drops a half-filled account the invoice could not print', async (t) => {
  const tenantId = oid();
  const soId = oid();
  const doc = { _id: soId, soNumber: 'SO00005', toObject() { return { _id: soId }; } };

  mockOrder(t, doc);
  // Data written before the Settings form validated its rows: a number with no
  // bank, a bank with no number, and one complete account. Only the complete
  // one is payable, so only that one is offered.
  mockPayer(t, {
    bankAccounts: [
      { bankName: '', accountName: 'DrinksHarbour Ltd', accountNumber: '0123456789' },
      { bankName: 'Zenith', accountName: 'DrinksHarbour Ltd', accountNumber: '' },
      { bankName: ' GTBank ', accountName: ' DrinksHarbour Ltd ', accountNumber: ' 9876543210 ' },
    ],
  });

  let payload;
  const req = { params: { id: String(soId) }, tenant: { _id: tenantId } };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await ctrl.getSalesOrder(req, res, (err) => { throw err; });

  assert.deepStrictEqual(payload.data.issuerBankAccounts, [
    { bankName: 'GTBank', accountName: 'DrinksHarbour Ltd', accountNumber: '9876543210' },
  ]);
});

test('getSalesOrder sends an empty list — never a null — when nothing is on file', async (t) => {
  const tenantId = oid();
  const soId = oid();
  const doc = { _id: soId, toObject() { return { _id: soId }; } };

  mockOrder(t, doc);
  mockPayer(t, null);

  let payload;
  const req = { params: { id: String(soId) }, tenant: { _id: tenantId } };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await ctrl.getSalesOrder(req, res, (err) => { throw err; });

  assert.deepStrictEqual(payload.data.issuerBankAccounts, []);
});
