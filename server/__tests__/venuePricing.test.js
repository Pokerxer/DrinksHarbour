'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { priceAcceptedLine, validateCart } = require('../services/venue/pricing');
test('tampered_cart_price_is_not_authority_and_configured_tax_is_frozen', () => {
  const line = priceAcceptedLine({ sp: { product: 'p', baseSellingPrice: 1000, costPrice: 500 }, size: { sellingPrice: 1000 }, tenant: { posSettings: { taxEnabled: true, taxRate: 7.5 } }, input: { quantity: 2, price: 1, clientPrice: 1 }, actor: { permissions: [] } });
  assert.equal(line.unitPriceMinor, 100000); assert.equal(line.netMinor, 200000); assert.equal(line.taxMinor, 15000);
});
test('override_requires_permission_and_reason', () => {
  const args = { sp: { baseSellingPrice: 1000 }, tenant: {}, input: { quantity: 1, override: { unitPriceMinor: 90000, reason: 'Manager approved' } }, actor: { permissions: [] } };
  assert.throws(() => priceAcceptedLine(args), /permission/i);
  assert.equal(priceAcceptedLine({ ...args, actor: { permissions: ['pos:price_override'] } }).unitPriceMinor, 90000);
});
test('unsupported_cart_rules_and_fractional_units_fail_before_service', () => {
  for (const cart of [{ tipAmount: 1 }, { appliedRewards: [{ kind: 'loyalty' }] }, { linkedSalesOrderId: 'id' }, { discountValue: 5 }]) assert.throws(() => validateCart(cart), /unsupported/i);
  assert.throws(() => priceAcceptedLine({ sp: {}, tenant: {}, input: { quantity: 1.5 }, actor: {} }), /quantity/i);
});
test('line_validation_rejects_duplicate_ObjectIds_with_different_letter_case', () => {
  const { validateVenueLineInputs } = require('../services/venue/pricing');
  const input = { subProductId: 'abcdefabcdefabcdefabcdef', sizeId: 'fedcbafedcbafedcbafedcba', quantity: 1 };
  assert.throws(() => validateVenueLineInputs([input, { ...input, subProductId: input.subProductId.toUpperCase(), sizeId: input.sizeId.toUpperCase() }]), /duplicate/i);
});
