// server/__tests__/tenantDocNumberIndexes.test.js
//
// Document numbers (PO-000001, RET-2026-0001, …) are sequences generated PER
// TENANT, so uniqueness must be enforced per tenant too. A field-level
// `unique: true` builds a GLOBAL index and makes tenant B's first document
// collide with tenant A's ("E11000 dup key: { poNumber: 'RFQ-000001' }").
const test = require('node:test');
const assert = require('node:assert');

const CASES = [
  ['PurchaseOrder', require('../models/PurchaseOrder'), 'poNumber'],
  ['PurchaseAgreement', require('../models/PurchaseAgreement'), 'agreementNumber'],
  ['VendorBill', require('../models/VendorBill'), 'billNumber'],
  ['VendorReturn', require('../models/VendorReturn'), 'returnNumber'],
  ['SalesOrder', require('../models/SalesOrder'), 'soNumber'],
  ['StockTransfer', require('../models/StockTransfer'), 'transferNumber'],
];

for (const [name, Model, field] of CASES) {
  test(`${name}.${field} has no global unique index`, () => {
    assert.notStrictEqual(
      Model.schema.path(field).options.unique,
      true,
      `${name}.${field} declares field-level unique — that index is global, not per tenant`,
    );
    const globalUnique = Model.schema
      .indexes()
      .filter(([key, opts]) => opts && opts.unique)
      .filter(([key]) => Object.keys(key).length === 1 && key[field] !== undefined);
    assert.deepStrictEqual(globalUnique, [], `${name} declares a single-field unique index on ${field}`);
  });

  test(`${name} enforces uniqueness of ${field} within a tenant`, () => {
    const compound = Model.schema
      .indexes()
      .find(([key]) => key.tenant !== undefined && key[field] !== undefined);
    assert.ok(compound, `${name} has no { tenant, ${field} } index`);
    assert.strictEqual(
      compound[1] && compound[1].unique,
      true,
      `${name}'s { tenant, ${field} } index is not unique — duplicate numbers can be issued`,
    );
  });
}
