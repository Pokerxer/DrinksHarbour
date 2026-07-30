// Tests for the admin tenant create/edit payload mapping.
//
// The bug these pin down: Mongoose does NOT flatten nested paths in an update.
// `$set: { purchaseSettings: {...} }` REPLACES the whole sub-document, so every
// admin edit silently wiped the purchase settings the form doesn't expose
// (rfqValidityDays, defaultLeadTimeDays, lockConfirmedOrders, defaultCurrency)
// and the geocoder's address.formatted. Dot paths restore merge semantics.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const { buildTenantData, flattenForUpdate } = require('../controllers/tenant.controller');

test('flattenForUpdate turns nested objects into dot paths', () => {
  const flat = flattenForUpdate({
    name: 'Acme',
    address: { street: '12 Adeola', city: 'Lagos' },
    purchaseSettings: { requirePOApproval: true, approvalThreshold: 0 },
  });

  assert.deepStrictEqual(flat, {
    name: 'Acme',
    'address.street': '12 Adeola',
    'address.city': 'Lagos',
    'purchaseSettings.requirePOApproval': true,
    'purchaseSettings.approvalThreshold': 0,
  });

  // No whole-subdocument keys survive — those are what caused the data loss
  assert.ok(!('address' in flat));
  assert.ok(!('purchaseSettings' in flat));
});

test('flattenForUpdate treats arrays, dates and null as leaves', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const flat = flattenForUpdate({
    supportedCurrencies: ['NGN', 'USD'],
    bankAccounts: [{ bankName: 'GTB', accountNumber: '0123456789' }],
    trialEndsAt: date,
    packMarkupPercentage: null,
  });

  assert.deepStrictEqual(flat.supportedCurrencies, ['NGN', 'USD']);
  assert.deepStrictEqual(flat.bankAccounts, [{ bankName: 'GTB', accountNumber: '0123456789' }]);
  assert.strictEqual(flat.trialEndsAt, date);
  assert.strictEqual(flat.packMarkupPercentage, null);
  // An array must not be exploded into numeric-index paths
  assert.ok(!('supportedCurrencies.0' in flat));
  assert.ok(!('bankAccounts.0.bankName' in flat));
});

test('flattenForUpdate keeps ObjectIds and Buffers intact', () => {
  // Descending into an ObjectId would produce approvedBy.buffer.0 … .11 and
  // write garbage instead of the approving admin's id
  const approvedBy = new mongoose.Types.ObjectId();
  const flat = flattenForUpdate({ status: 'approved', approvedBy });

  assert.strictEqual(flat.approvedBy, approvedBy);
  assert.ok(!Object.keys(flat).some((k) => k.startsWith('approvedBy.')), 'ObjectId must not be exploded');
});

test('a partial purchase-settings edit only touches the keys it sent', () => {
  const data = buildTenantData({ psRequirePOApproval: 'false', psApprovalThreshold: '50000' }, true);
  const flat = flattenForUpdate(data);

  assert.deepStrictEqual(flat, {
    'purchaseSettings.requirePOApproval': false,
    'purchaseSettings.approvalThreshold': 50000,
  });
  // Untouched settings are absent from the update, so Mongo leaves them alone
  for (const key of ['rfqValidityDays', 'defaultLeadTimeDays', 'lockConfirmedOrders', 'defaultCurrency']) {
    assert.ok(!(`purchaseSettings.${key}` in flat), `${key} must not be in the update`);
  }
});

test('an address edit leaves the geocoder-owned formatted field alone', () => {
  const flat = flattenForUpdate(buildTenantData({ addressStreet: '39 Gana St', addressCity: 'Abuja' }, true));

  assert.deepStrictEqual(flat, {
    'address.street': '39 Gana St',
    'address.city': 'Abuja',
  });
  assert.ok(!('address.formatted' in flat));
});

test('bill control policy maps onto the schema field name', () => {
  // The schema field is defaultBillControlPolicy; the older psBillControlPolicy
  // spelling stays accepted so in-flight clients keep working.
  assert.strictEqual(
    buildTenantData({ psDefaultBillControlPolicy: 'ordered' }, true).purchaseSettings.defaultBillControlPolicy,
    'ordered'
  );
  assert.strictEqual(
    buildTenantData({ psBillControlPolicy: 'ordered' }, true).purchaseSettings.defaultBillControlPolicy,
    'ordered'
  );
});

test('billing IDs map to the Paystack fields the schema actually defines', () => {
  const data = buildTenantData({
    paystackCustomerId: 'CUS_abc',
    paystackSubscriptionCode: 'SUB_xyz',
    paystackPlanCode: 'PLN_123',
    stripeCustomerId: 'cus_dropped',
  }, true);

  assert.strictEqual(data.paystackCustomerId, 'CUS_abc');
  assert.strictEqual(data.paystackSubscriptionCode, 'SUB_xyz');
  assert.strictEqual(data.paystackPlanCode, 'PLN_123');
  // Stripe fields don't exist on the Tenant schema — they must not be forwarded
  assert.ok(!('stripeCustomerId' in data));
});

test('pack rates clear on empty string but keep zero', () => {
  assert.strictEqual(buildTenantData({ packMarkupPercentage: '' }, true).packMarkupPercentage, null);
  assert.strictEqual(buildTenantData({ packMarkupPercentage: '0' }, true).packMarkupPercentage, 0);
  assert.strictEqual(buildTenantData({ packCommissionPercentage: '' }, true).packCommissionPercentage, null);
  assert.strictEqual(buildTenantData({ packCommissionPercentage: '8' }, true).packCommissionPercentage, 8);
});

test('bankAccounts is parsed from JSON and stripped of blank rows', () => {
  const data = buildTenantData({
    bankAccounts: JSON.stringify([
      { bankName: 'GTB', accountNumber: '0123456789', accountName: 'Acme Ltd' },
      { bankName: '', accountNumber: '', accountName: '' },
    ]),
  }, true);

  assert.deepStrictEqual(data.bankAccounts, [
    { bankName: 'GTB', accountNumber: '0123456789', accountName: 'Acme Ltd' },
  ]);
});

test('bvn is never accepted from the admin form', () => {
  const data = buildTenantData({ bvn: '12345678901', bankName: 'GTB' }, true);
  assert.ok(!('bvn' in data));
  assert.strictEqual(data.bankName, 'GTB');
});

test('unsent fields stay out of the update entirely', () => {
  // An edit that only renames the tenant must not reset anything else
  assert.deepStrictEqual(flattenForUpdate(buildTenantData({ name: 'Renamed' }, true)), { name: 'Renamed' });
});
