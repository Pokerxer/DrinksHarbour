// Run: node scripts/test-pricelist-history.js   (from server/)
const assert = require('node:assert');
const {
  HISTORY_CAP,
  changePercent,
  pushHistory,
  applyPOItemsToPricelist,
} = require('../utils/pricelistHistory');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// changePercent
test('changePercent: normal increase', () => {
  assert.strictEqual(changePercent(100, 125), 25);
});
test('changePercent: decrease is signed', () => {
  assert.strictEqual(changePercent(200, 150), -25);
});
test('changePercent: from zero/undefined prev is 0', () => {
  assert.strictEqual(changePercent(0, 100), 0);
  assert.strictEqual(changePercent(undefined, 100), 0);
});

// pushHistory caps at HISTORY_CAP and stamps previousPrice
test('pushHistory caps and records previousPrice', () => {
  const line = { unitPrice: 10, priceHistory: [] };
  for (let i = 1; i <= HISTORY_CAP + 5; i++) {
    pushHistory(line, { unitPrice: i, basePrice: i, source: 'po', changePercent: 0 });
  }
  assert.strictEqual(line.priceHistory.length, HISTORY_CAP);
  // oldest dropped: first remaining entry is unitPrice 6 (5 dropped)
  assert.strictEqual(line.priceHistory[0].unitPrice, 6);
  // newest is last
  assert.strictEqual(line.priceHistory[line.priceHistory.length - 1].unitPrice, HISTORY_CAP + 5);
});

// applyPOItemsToPricelist: new line added with initial history
test('applyPOItemsToPricelist adds new line with history', () => {
  const pl = { items: [] };
  const res = applyPOItemsToPricelist(
    pl,
    [{ subProductId: 'A', subProductName: 'Beer', unitCost: 100 }],
    { now: new Date(), userId: 'u1', poId: 'po1', poNumber: 'PO-1' }
  );
  assert.strictEqual(res.added, 1);
  assert.strictEqual(res.changed, 1);
  assert.strictEqual(pl.items.length, 1);
  assert.strictEqual(pl.items[0].unitPrice, 100);
  assert.strictEqual(pl.items[0].priceHistory.length, 1);
  assert.strictEqual(pl.items[0].priceHistory[0].source, 'po');
});

// applyPOItemsToPricelist: existing line price change logs history + previousPrice
test('applyPOItemsToPricelist updates changed line', () => {
  const pl = {
    items: [{ subProductId: 'A', sizeId: null, unitPrice: 100, basePrice: 100, priceHistory: [] }],
  };
  const res = applyPOItemsToPricelist(
    pl,
    [{ subProductId: 'A', unitCost: 120 }],
    { now: new Date(), userId: 'u1', poId: 'po1', poNumber: 'PO-2' }
  );
  assert.strictEqual(res.updated, 1);
  assert.strictEqual(res.changed, 1);
  assert.strictEqual(pl.items[0].unitPrice, 120);
  assert.strictEqual(pl.items[0].previousPrice, 100);
  assert.strictEqual(pl.items[0].priceHistory.at(-1).changePercent, 20);
});

// applyPOItemsToPricelist: unchanged price logs nothing
test('applyPOItemsToPricelist skips unchanged price', () => {
  const pl = { items: [{ subProductId: 'A', sizeId: null, unitPrice: 100, basePrice: 100, priceHistory: [] }] };
  const res = applyPOItemsToPricelist(pl, [{ subProductId: 'A', unitCost: 100 }], { now: new Date() });
  assert.strictEqual(res.changed, 0);
  assert.strictEqual(pl.items[0].priceHistory.length, 0);
});

// applyPOItemsToPricelist: zero/blank cost never overwrites
test('applyPOItemsToPricelist ignores zero cost', () => {
  const pl = { items: [{ subProductId: 'A', sizeId: null, unitPrice: 100, basePrice: 100, priceHistory: [] }] };
  const res = applyPOItemsToPricelist(pl, [{ subProductId: 'A', unitCost: 0 }], { now: new Date() });
  assert.strictEqual(res.changed, 0);
  assert.strictEqual(pl.items[0].unitPrice, 100);
});

console.log(`\n${passed} passed`);
