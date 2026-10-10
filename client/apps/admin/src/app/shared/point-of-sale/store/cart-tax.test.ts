import { expect, test } from 'vitest';
import { salesOrderToCartItems } from '../components/pos-sales-order-lines';
import { computeCartTax, computeQuotationTax } from './cart-tax';
import { computeSubtotal } from './cart-pricing';
import type { POSCartItem } from '../types';

const quoted = (taxRate = 7.5, fulfilledQty = 0) => salesOrderToCartItems({items: [{
  subproduct: 'bottle', quantity: 10, unitPrice: 4000, discount: 2000,
  promoDiscount: 500, taxRate, fulfilledQty,
}]}, []);

/** An ordinary walk-up sale line: no quotation, so no tax of its own. */
const plain = (over: Partial<POSCartItem> = {}): POSCartItem => ({
  subProductId: 'bottle', productId: 'p1', name: 'Jameson', variant: '750ml',
  sku: 'JAM-750', price: 10000, quantity: 1, discount: 0, stock: 10, ...over,
});

test('tax follows outstanding quantities and the quoted post-discount base', () => {
  const items = quoted(7.5, 6);
  expect(computeSubtotal(items)).toBe(15000);
  expect(computeQuotationTax(items)).toBe(1125);
  expect(computeSubtotal(items) + computeQuotationTax(items)).toBe(16125);
});

test('mixed rates, zero tax and ordinary lines stay distinct', () => {
  const items = [...quoted(7.5, 6), ...quoted(10, 8), ...quoted(0)];
  items.push({...items[0], quotationLine: false, taxRate: 99});
  expect(computeQuotationTax(items)).toBe(1875);
});

test('quote tax uses the same whole-line rounding as SalesOrder', () => {
  const items = quoted();
  items[0] = {...items[0], quantity: 1, price: 99};
  expect(computeQuotationTax(items)).toBe(7);
});

test('changing quantity or applying a line discount updates tax', () => {
  const items = quoted();
  items[0] = {...items[0], quantity: 4, discount: 20};
  expect(computeQuotationTax(items)).toBe(900);
});

test('an active pricelist cannot reprice a quoted tax base', () => {
  const items = quoted(7.5, 6);
  const pricelist = {rules: [{priceType: 'fixed', fixedPrice: 100, sequence: 1}]};
  expect(computeSubtotal(items, pricelist)).toBe(15000);
});

// ── Tenant VAT at the till ─────────────────────────────────────────────────────
// The server charges tax whenever the tenant is registered for VAT, and rejects
// a receipt whose total does not include it. If the till showed a net total the
// order would be refused at payment, so these figures have to agree with
// posTax.service.js exactly.

test('an ordinary sale is untaxed while the tenant has VAT off', () => {
  expect(computeCartTax([plain()], { enabled: false, rate: 7.5 })).toBe(0);
  expect(computeCartTax([plain()])).toBe(0);
});

test('a VAT-registered tenant is taxed on ordinary sales', () => {
  expect(computeCartTax([plain()], { enabled: true, rate: 7.5 })).toBe(750);
});

test('the tenant rate applies to the post-discount amount', () => {
  const items = [plain({ price: 10000, quantity: 2, discount: 10 })];
  // 2 x 10,000 less 10% = 18,000 net; 7.5% of that is 1,350.
  expect(computeCartTax(items, { enabled: true, rate: 7.5 })).toBe(1350);
});

test('a quoted line keeps its own rate, not the tenant default', () => {
  const items = [...quoted(5, 6), plain()];
  const tax = computeCartTax(items, { enabled: true, rate: 7.5 });
  // Quoted: 15,000 net at 5% = 750. Ordinary: 10,000 at 7.5% = 750.
  expect(tax).toBe(1500);
});

test('a zero-rated quotation is not re-taxed at the tenant rate', () => {
  const items = [...quoted(0), plain()];
  // The quoted line is zero-rated and must stay that way even with VAT on.
  expect(computeCartTax(items, { enabled: true, rate: 7.5 })).toBe(750);
});

test('a zero-rate tenant setting charges nothing', () => {
  expect(computeCartTax([plain()], { enabled: true, rate: 0 })).toBe(0);
});

test('a cart mixing quoted and ordinary lines totals both correctly', () => {
  const items = [...quoted(7.5, 6), plain({ price: 4000, quantity: 1 })];
  expect(computeSubtotal(items)).toBe(19000);
  // Quoted 15,000 at 7.5% = 1,125. Ordinary 4,000 at 7.5% = 300.
  expect(computeCartTax(items, { enabled: true, rate: 7.5 })).toBe(1425);
});

// ── Cross-layer parity ────────────────────────────────────────────────────────
// The till sends a tax-inclusive total and the server refuses the receipt with a
// 409 if the figures disagree, so a drift between this file and
// server/services/posTax.service.js does not produce a small error — it refuses
// the sale. These rows are duplicated in server/__tests__/posTax.test.js on
// purpose. If one side is changed, the other side's copy fails.
const PARITY = [
  { name: 'no tenant tax, no quotation', line: 10000, rate: 0, tax: 0 },
  { name: 'tenant VAT on a walk-up sale', line: 10000, rate: 7.5, tax: 750 },
  { name: 'a line whose amount rounds a kobo down', line: 999, rate: 7.5, tax: 75 },
  { name: 'a line whose amount rounds a kobo up', line: 101, rate: 7.5, tax: 8 },
  { name: 'a zero-rated line', line: 10000, rate: 0, tax: 0 },
  { name: 'an exempt line above the small-claims threshold', line: 50000, rate: 0, tax: 0 },
];

test.each(PARITY)('parity: $name', ({ line, rate, tax }) => {
  const one = [plain({ price: line, quantity: 1, discount: 0 })];
  expect(computeCartTax(one, { enabled: rate > 0, rate })).toBe(tax);
});
