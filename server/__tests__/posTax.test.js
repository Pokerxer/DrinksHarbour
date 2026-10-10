const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveLineTaxRate,
  resolveTillTaxSettings,
  lineTaxAmount,
} = require('../services/posTax.service');

// VAT at the till is a tenant decision, not a platform default. Nigeria levies
// VAT only above a turnover threshold, so the switch is default-off and a tenant
// that is not registered for VAT must never be charged.

test('no tax is charged by default', () => {
  assert.equal(resolveLineTaxRate({ tenantPosSettings: {} }), 0);
  assert.equal(resolveLineTaxRate({}), 0);
});

test('the tenant rate applies once the tenant enables tax', () => {
  assert.equal(
    resolveLineTaxRate({ tenantPosSettings: { taxEnabled: true, taxRate: 7.5 } }),
    7.5
  );
});

test('a quotation line keeps its own negotiated rate', () => {
  // The agreed rate on a loaded quotation is server-owned and must survive the
  // tenant's default being changed afterwards, or a signed quote silently
  // becomes a different price.
  assert.equal(
    resolveLineTaxRate({
      tenantPosSettings: { taxEnabled: true, taxRate: 7.5 },
      quotationTaxRate: 5,
    }),
    5
  );
});

test('a quotation rate of zero is honoured, not treated as absent', () => {
  // A zero-rated quotation is a real instruction. `||` would fall through to
  // the tenant default and tax a zero-rated supply.
  assert.equal(
    resolveLineTaxRate({
      tenantPosSettings: { taxEnabled: true, taxRate: 7.5 },
      quotationTaxRate: 0,
    }),
    0
  );
});

test('a missing or out-of-range tenant rate falls back to no tax', () => {
  assert.equal(resolveLineTaxRate({ tenantPosSettings: { taxEnabled: true } }), 0);
  assert.equal(
    resolveLineTaxRate({ tenantPosSettings: { taxEnabled: true, taxRate: -5 } }),
    0
  );
  assert.equal(
    resolveLineTaxRate({ tenantPosSettings: { taxEnabled: true, taxRate: 250 } }),
    0
  );
});

test('a non-numeric tenant rate is rejected rather than coerced to NaN', () => {
  assert.equal(
    resolveLineTaxRate({ tenantPosSettings: { taxEnabled: true, taxRate: 'seven' } }),
    0
  );
});

test('the till settings say whether tax is on and at what rate', () => {
  assert.deepEqual(resolveTillTaxSettings(undefined), {
    enabled: false,
    rate: 0,
  });
  assert.deepEqual(
    resolveTillTaxSettings({ taxEnabled: true, taxRate: 7.5 }),
    { enabled: true, rate: 7.5 }
  );
  // Enabled but no usable rate: not chargeable, so report it as off rather than
  // letting the till believe it is collecting tax when it is not.
  assert.deepEqual(resolveTillTaxSettings({ taxEnabled: true }), {
    enabled: false,
    rate: 0,
  });
});

// ── Cross-layer parity ────────────────────────────────────────────────────────
// The till sends a tax-inclusive total and the server refuses the receipt with a
// 409 if the figures disagree, so a drift between this service and
// client/store/cart-tax.ts does not produce a small error — it refuses the sale.
// The cases below are duplicated there on purpose. If one side is changed, the
// other side's copy fails.
const PARITY = [
  { name: 'no tenant tax, no quotation', line: 10000, rate: 0, tax: 0 },
  { name: 'tenant VAT on a walk-up sale', line: 10000, rate: 7.5, tax: 750 },
  { name: 'a line whose amount rounds a kobo down', line: 999, rate: 7.5, tax: 75 },
  { name: 'a line whose amount rounds a kobo up', line: 101, rate: 7.5, tax: 8 },
  { name: 'a zero-rated line', line: 10000, rate: 0, tax: 0 },
  { name: 'an exempt line above the small-claims threshold', line: 50000, rate: 0, tax: 0 },
];

for (const c of PARITY) {
  test(`parity: ${c.name}`, () => {
    assert.equal(lineTaxAmount(c.line, c.rate), c.tax);
  });
}
