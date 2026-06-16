// server/__tests__/pricelist.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const { pickPricelistForShop } = require('../services/pricelist.service');

// Helpers to build pricelist-like plain objects
const pl = (over = {}) => ({
  _id: over._id || Math.random().toString(36).slice(2),
  name: over.name || 'PL',
  isSelectable: over.isSelectable ?? false,
  shops: over.shops || [],
  warehouses: over.warehouses || [],
  isDefault: over.isDefault ?? false,
  createdAt: over.createdAt || new Date('2020-01-01'),
});

test('shop binding wins over warehouse and default', () => {
  const shopPL = pl({ _id: 's', shops: ['shop1'] });
  const whPL = pl({ _id: 'w', warehouses: ['wh1'] });
  const defPL = pl({ _id: 'd', isDefault: true });
  const { resolved } = pickPricelistForShop({
    pricelists: [defPL, whPL, shopPL], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(String(resolved._id), 's');
});

test('warehouse binding wins over default when no shop match', () => {
  const whPL = pl({ _id: 'w', warehouses: ['wh1'] });
  const defPL = pl({ _id: 'd', isDefault: true });
  const { resolved } = pickPricelistForShop({
    pricelists: [defPL, whPL], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(String(resolved._id), 'w');
});

test('falls back to the default pricelist', () => {
  const defPL = pl({ _id: 'd', isDefault: true });
  const other = pl({ _id: 'o', shops: ['shopX'] });
  const { resolved } = pickPricelistForShop({
    pricelists: [other, defPL], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(String(resolved._id), 'd');
});

test('returns null when nothing matches', () => {
  const other = pl({ _id: 'o', shops: ['shopX'] });
  const { resolved } = pickPricelistForShop({
    pricelists: [other], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(resolved, null);
});

test('unscoped selectable is in allowed but never auto-resolves', () => {
  const unscoped = pl({ _id: 'u', isSelectable: true });
  const { resolved, allowed } = pickPricelistForShop({
    pricelists: [unscoped], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(resolved, null);
  assert.deepStrictEqual(allowed.map((p) => String(p._id)), ['u']);
});

test('built-in retail shop resolves via the default-warehouse tier', () => {
  // Built-in 'retail' has no direct shop binding; resolveShopWarehouse maps it
  // to the default warehouse, so a warehouse-bound pricelist should resolve.
  const whPL = pl({ _id: 'w', warehouses: ['whDefault'] });
  const { resolved } = pickPricelistForShop({
    pricelists: [whPL], shopId: 'retail', warehouseId: 'whDefault',
  });
  assert.strictEqual(String(resolved._id), 'w');
});

test('tie-break is deterministic by createdAt ascending', () => {
  const older = pl({ _id: 'old', shops: ['shop1'], createdAt: new Date('2021-01-01') });
  const newer = pl({ _id: 'new', shops: ['shop1'], createdAt: new Date('2022-01-01') });
  const { resolved } = pickPricelistForShop({
    pricelists: [newer, older], shopId: 'shop1', warehouseId: null,
  });
  assert.strictEqual(String(resolved._id), 'old');
});

test('allowed set dedups across tiers and includes default + unscoped', () => {
  const shopPL = pl({ _id: 's', shops: ['shop1'] });
  const defPL = pl({ _id: 'd', isDefault: true });
  const unscoped = pl({ _id: 'u', isSelectable: true });
  const irrelevant = pl({ _id: 'x', shops: ['other'] });
  const { allowed } = pickPricelistForShop({
    pricelists: [shopPL, defPL, unscoped, irrelevant], shopId: 'shop1', warehouseId: 'wh1',
  });
  const ids = allowed.map((p) => String(p._id)).sort();
  assert.deepStrictEqual(ids, ['d', 's', 'u']);
});

test('no warehouseId: warehouse tier is skipped safely', () => {
  const whPL = pl({ _id: 'w', warehouses: ['wh1'] });
  const { resolved, allowed } = pickPricelistForShop({
    pricelists: [whPL], shopId: 'shop1', warehouseId: null,
  });
  assert.strictEqual(resolved, null);
  assert.deepStrictEqual(allowed, []);
});
