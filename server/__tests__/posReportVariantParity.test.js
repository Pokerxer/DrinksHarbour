'use strict';
// DRI-10 — server variant-identity parity for the POS report surfaces.
//
// The till cart composes an industry-aware variant label per line
// (displayName · colorName · optionName joined with ' · ' — client util
// client/apps/admin/src/utils/size-variant-label.ts). Two server gaps used to
// drop that identity on the report side:
//
//   1. `posReportOrder.service.js` fell back to bare `size?.displayName` when
//      `_variant` was absent, so a Fashion row's colour/option identity was
//      lost and reports aged differently from the till.
//   2. `buildProductBreakdown` (pos.report.controller.js) keyed by product
//      only, so two colour variants of one product collapsed into one Z-report
//      row.
//
// Both now share `orderLineVariant`, and this file pins the contract in both
// directions: retail rows keep colour/option identity, legacy beverage rows —
// rows without colour data — emit the exact same string the pre-change formula
// (`_variant || size?.displayName || ''`) emitted.
//
// Run: node --test __tests__/posReportVariantParity.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapReportOrder,
  mapReportLine,
  sizeVariantLabel,
  orderLineVariant,
} = require('../services/posReportOrder.service');
// buildProductBreakdown is the breakdown contract behind the session
// (Z-report), daily and range report surfaces.
const { buildProductBreakdown } = require('../controllers/pos.report.controller');

/** One authority on "the string the pre-change server emitted" — the oracle
 *  every byte-parity assertion below is written against. */
const preChangeVariant = (item) =>
  ((item._variant || (typeof item.size === 'object' ? item.size?.displayName : undefined)) || '');

const oid = () => new (require('mongoose').Types.ObjectId)();
// One product id reused across the breakdown tests — the row key is product+variant.
const P = oid();

const line = (over = {}) => ({
  _name: 'Line',
  quantity: 1,
  priceAtPurchase: 500,
  itemSubtotal: 500,
  taxAmount: 0,
  discountAmount: 0,
  ...over,
});

test('sizeVariantLabel composes displayName · colorName · optionName', () => {
  assert.equal(
    sizeVariantLabel({ displayName: 'One-size gown — Emerald', colorName: 'Emerald', optionName: 'Emerald gown' }),
    'One-size gown — Emerald · Emerald · Emerald gown'
  );
  // Option-only identity (electronics / beverage style SKUs): colour dropped.
  assert.equal(
    sizeVariantLabel({ displayName: 'storage-256gb', optionName: '16 GB RAM' }),
    'storage-256gb · 16 GB RAM'
  );
});

test('legacy rows without colour data compose byte-identical to the pre-change formula', () => {
  const legacy = [
    { _name: 'DRI-10 Lager', quantity: 1, priceAtPurchase: 500, itemSubtotal: 500, size: { displayName: 'DRI-10 Lager 330ml' } },
    { _name: 'Raw control', quantity: 1, priceAtPurchase: 500, itemSubtotal: 500, size: {} },
    { _name: 'Unsized rows', quantity: 1, priceAtPurchase: 500, itemSubtotal: 500 },
  ];
  for (const item of legacy) {
    assert.equal(orderLineVariant(item), preChangeVariant(item), JSON.stringify(item));
    assert.equal(mapReportLine(item, {}).variant, preChangeVariant(item));
    assert.ok(!mapReportLine(item, {}).variant.includes(' · '), 'colourless rows must never gain a separator');
  }
  assert.equal(orderLineVariant(legacy[0]), 'DRI-10 Lager 330ml');
  assert.equal(orderLineVariant(legacy[1]), '');
  assert.equal(orderLineVariant(legacy[2]), '');
});

test('retail rows keep colour/option identity through the composed fallback', () => {
  const item = line({
    size: { displayName: 'Portable speaker — Graphite', colorName: 'Graphite', optionName: 'Graphite speaker', costPrice: 90 },
  });
  const composed = orderLineVariant(item);
  assert.equal(composed, 'Portable speaker — Graphite · Graphite · Graphite speaker');
  // Parity with the till semantics for displayName-bearing sizes: identical to
  // the client's sizeVariantLabel (client/apps/admin/src/utils/size-variant-label.ts).
  // The deliberately un-replicated part is the client's `displayName ?? size`
  // head: server rows without a displayName must keep emitting the pre-change
  // string (''), which the byte-parity guarantee above requires.
  const clientSemantics = [item.size.displayName, item.size.colorName, item.size.optionName]
    .filter(Boolean).join(' · ');
  assert.equal(composed, clientSemantics);
  // A colour-only size (no optionName) joins colour after the size.
  assert.equal(
    sizeVariantLabel({ displayName: 'Hamper wrap', colorName: 'Red ribbon' }),
    'Hamper wrap · Red ribbon'
  );
});

test('the till-snapped `_variant` snapshot wins over the composed fallback', () => {
  const item = line({
    _variant: 'One-size gown — Ivory · Ivory · Ivory gown',
    size: { displayName: 'One-size gown — Ivory', colorName: 'Ivory', optionName: 'Ivory gown' },
  });
  assert.equal(orderLineVariant(item), 'One-size gown — Ivory · Ivory · Ivory gown');
  assert.equal(mapReportLine(item, {}).variant, item._variant);
});

test('a receipt maps colour variants on every line without changing the money', () => {
  const order = {
    _id: 'o1', totalAmount: 3000, subtotal: 3000, taxAmount: 0, discountTotal: 0,
    paymentMethod: 'cash', status: 'confirmed', paymentStatus: 'paid',
    items: [
      line({ _name: 'Skyline Ankara Gown', priceAtPurchase: 1000, itemSubtotal: 2000, quantity: 2,
        size: { displayName: 'One-size gown — Emerald', colorName: 'Emerald', optionName: 'Emerald gown' } }),
      line({ _name: 'Skyline Ankara Gown', priceAtPurchase: 1000, itemSubtotal: 1000, quantity: 1,
        size: { displayName: 'One-size gown — Ivory', colorName: 'Ivory', optionName: 'Ivory gown' } }),
    ],
    refunds: [],
    lineNetTotals: [{ netSales: 2000, netQuantity: 2 }, { netSales: 1000, netQuantity: 1 }],
  };
  const r = mapReportOrder(order);
  assert.deepEqual(
    r.items.map((i) => i.variant),
    [
      'One-size gown — Emerald · Emerald · Emerald gown',
      'One-size gown — Ivory · Ivory · Ivory gown',
    ],
    'the two colour variants must stay distinct in every report line'
  );
  assert.equal(r.netSales, 3000);
});

test('buildProductBreakdown returns one row per variant of a two-variant product', () => {
  const orders = [{
    status: 'confirmed',
    items: [
      { product: P, _name: 'Skyline Ankara Gown', quantity: 2,
        priceAtPurchase: 1000, discountAmount: 0,
        size: { displayName: 'One-size gown — Emerald', colorName: 'Emerald', optionName: 'Emerald gown' } },
      { product: P, _name: 'Skyline Ankara Gown', quantity: 1,
        priceAtPurchase: 1000, discountAmount: 0,
        size: { displayName: 'One-size gown — Ivory', colorName: 'Ivory', optionName: 'Ivory gown' } },
    ],
  }];
  const rows = buildProductBreakdown(orders);
  assert.deepEqual(
    rows.map((r) => r.name),
    [
      'Skyline Ankara Gown · One-size gown — Emerald · Emerald · Emerald gown',
      'Skyline Ankara Gown · One-size gown — Ivory · Ivory · Ivory gown',
    ],
    'the Z-report must not collapse two colour variants into one row'
  );
  assert.deepEqual(
    rows.map((r) => [r.qty, r.net]),
    [[2, 2000], [1, 1000]],
    'each variant row keeps its own quantity and net'
  );
});

test('buildProductBreakdown keeps legacy no-variant rows exactly as before', () => {
  const orders = [{
    status: 'confirmed',
    items: [
      { product: P, _name: 'DRI-10 Lager', quantity: 3, priceAtPurchase: 500, discountAmount: 0,
        size: { displayName: 'DRI-10 Lager 330ml' } },
      { product: P, _name: 'DRI-10 Lager', quantity: 2, priceAtPurchase: 500, discountAmount: 0,
        size: { displayName: 'DRI-10 Lager 330ml' } },
    ],
  }];
  const rows = buildProductBreakdown(orders);
  assert.deepEqual(
    rows.map((r) => r.name),
    ['DRI-10 Lager · DRI-10 Lager 330ml'],
    'colourless legacy rows aggregate into one row under one label'
  );
});

test('buildProductBreakdown renders no dangling separator and no variant-only keying for unsized legacy rows', () => {
  const rows = buildProductBreakdown([{
    status: 'confirmed',
    items: [
      { _name: 'Harbour Lager', quantity: 1, priceAtPurchase: 500, discountAmount: 0 },   // no product ref, no size
      { product: P, quantity: 1, priceAtPurchase: 700, discountAmount: 0 },              // a product ref with no snapshot name
    ],
  }]);
  assert.deepEqual(
    rows.map((r) => r.name),
    ['Unknown', 'Harbour Lager'],
    'empty variants must never render as "Name · " — the label is the name alone (rows sort by net)'
  );
  assert.ok(rows.every((r) => !r.name.includes(' · ')), `no dangling separator: ${JSON.stringify(rows.map((r) => r.name))}`);
});

test('buildProductBreakdown keys populated product docs by _id, labels by the product name', () => {
  // Persisted receipts have `_name` strict-stripped; the report queries
  // populate `items.product` with `name`, which is the durable label source.
  const rows = buildProductBreakdown([{
    status: 'confirmed',
    items: [
      { product: { _id: P, name: 'Harbour Signature Bottle' }, quantity: 2, priceAtPurchase: 1000, discountAmount: 0,
        size: { displayName: '750ml — Green bottle', colorName: 'Green', optionName: 'Green bottle' } },
      { product: { _id: P, name: 'Harbour Signature Bottle' }, quantity: 1, priceAtPurchase: 1000, discountAmount: 0,
        size: { displayName: '750ml — Amber bottle', colorName: 'Amber', optionName: 'Amber bottle' } },
    ],
  }]);
  assert.deepEqual(
    rows.map((r) => r.name),
    [
      'Harbour Signature Bottle · 750ml — Green bottle · Green · Green bottle',
      'Harbour Signature Bottle · 750ml — Amber bottle · Amber · Amber bottle',
    ],
    'variant rows must stay separate AND carry the product name, not "Unknown"'
  );
});

test('buildProductBreakdown still excludes voided orders', () => {
  const rows = buildProductBreakdown([{
    status: 'voided',
    items: [{ product: P, _name: 'Voided stout', quantity: 9, priceAtPurchase: 1000, discountAmount: 0 }],
  }]);
  assert.deepEqual(rows, []);
});
