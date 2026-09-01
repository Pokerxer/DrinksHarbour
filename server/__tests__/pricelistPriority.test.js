// server/__tests__/pricelistPriority.test.js
//
// Automatic rule priority. `sequence` decides the order the pricing engines
// stack rules in, and it is now derived rather than dragged. The ranking is
// server-owned because both engines read `sequence` off the stored document —
// a client-side ordering would display one order and charge another.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const {
  rankedRules,
  resequenceRules,
  priorityReason,
} = require('../services/pricelistPriority.service');

const oid = () => new mongoose.Types.ObjectId();
const r = (over) => ({ _id: oid(), priceType: 'discount', minQuantity: 0, ...over });
const types = (list) => list.map((x) => x.priceType);

test('base-setting rules rank before modifiers', () => {
  // applyPriceRules assigns `result =` for fixed/formula, so either one landing
  // after a discount discards that discount outright. This is the one tier that
  // exists for correctness rather than presentation.
  const discount = r({ priceType: 'discount' });
  const fixed = r({ priceType: 'fixed' });
  assert.deepStrictEqual(types(rankedRules([discount, fixed])), ['fixed', 'discount']);
});

test('formula ranks before fixed — an explicit price is the final word', () => {
  const fixed = r({ priceType: 'fixed' });
  const formula = r({ priceType: 'formula' });
  assert.deepStrictEqual(types(rankedRules([fixed, formula])), ['formula', 'fixed']);
});

test('per-line rules rank before bundle and cart_threshold', () => {
  // Neither is in PER_LINE_PRICE_TYPES, so they never compete with the per-line
  // pool; grouping them last keeps the displayed list honest about that.
  const ranked = types(rankedRules([
    r({ priceType: 'cart_threshold' }),
    r({ priceType: 'bundle' }),
    r({ priceType: 'discount' }),
    r({ priceType: 'formula' }),
  ]));
  assert.deepStrictEqual(ranked, ['formula', 'discount', 'bundle', 'cart_threshold']);
});

test('product-specific rules rank before all-products rules', () => {
  const sub = oid();
  const global = r({ priceType: 'discount' });
  const specific = r({ priceType: 'discount', subProduct: sub });
  const ranked = rankedRules([global, specific]);
  assert.strictEqual(String(ranked[0]._id), String(specific._id));
});

test('specificity outranks rule kind', () => {
  // A product-specific discount still sorts above an all-products fixed rule:
  // findMatchingPriceRules shadows entire pools, so the two never stack anyway.
  const sub = oid();
  const globalFixed = r({ priceType: 'fixed' });
  const specificDiscount = r({ priceType: 'discount', subProduct: sub });
  const ranked = rankedRules([globalFixed, specificDiscount]);
  assert.strictEqual(String(ranked[0]._id), String(specificDiscount._id));
});

test('higher volume tiers rank first within the same kind', () => {
  // Mirrors findMatchingPriceRules' own descending-minQuantity tiebreak.
  const low = r({ priceType: 'discount', minQuantity: 0 });
  const high = r({ priceType: 'discount', minQuantity: 12 });
  const mid = r({ priceType: 'discount', minQuantity: 6 });
  assert.deepStrictEqual(
    rankedRules([low, high, mid]).map((x) => x.minQuantity),
    [12, 6, 0]
  );
});

test('ties break on _id, so the order survives a refetch', () => {
  const a = r({ _id: oid(), priceType: 'discount' });
  const b = r({ _id: oid(), priceType: 'discount' });
  const forward = rankedRules([a, b]).map((x) => String(x._id));
  const reverse = rankedRules([b, a]).map((x) => String(x._id));
  assert.deepStrictEqual(forward, reverse);
});

test('ranking does not mutate the array it was given', () => {
  const fixed = r({ priceType: 'fixed' });
  const discount = r({ priceType: 'discount' });
  const input = [discount, fixed];
  rankedRules(input);
  assert.deepStrictEqual(types(input), ['discount', 'fixed']);
});

test('resequenceRules writes contiguous sequences from the rank', () => {
  const rules = [
    r({ priceType: 'discount', minQuantity: 0 }),
    r({ priceType: 'fixed' }),
    r({ priceType: 'bundle' }),
  ];
  resequenceRules(rules);
  const bySeq = [...rules].sort((a, b) => a.sequence - b.sequence);
  assert.deepStrictEqual(types(bySeq), ['fixed', 'discount', 'bundle']);
  assert.deepStrictEqual(bySeq.map((x) => x.sequence), [0, 1, 2]);
});

test('resequenceRules leaves the stored array order alone', () => {
  // Same discipline as the reorder endpoint: only `sequence` is authoritative.
  // Reordering a Mongoose DocumentArray in place is what we are avoiding.
  const rules = [r({ priceType: 'discount' }), r({ priceType: 'fixed' })];
  const idsBefore = rules.map((x) => String(x._id));
  resequenceRules(rules);
  assert.deepStrictEqual(rules.map((x) => String(x._id)), idsBefore);
});

test('resequenceRules is idempotent', () => {
  const rules = [r({ priceType: 'bundle' }), r({ priceType: 'formula' }), r({ priceType: 'discount' })];
  resequenceRules(rules);
  const once = rules.map((x) => x.sequence);
  resequenceRules(rules);
  assert.deepStrictEqual(rules.map((x) => x.sequence), once);
});

test('resequenceRules copes with an empty rule list', () => {
  assert.deepStrictEqual(resequenceRules([]), []);
  assert.deepStrictEqual(resequenceRules(undefined), []);
});

test('priorityReason names why a rule sits where it does', () => {
  const sub = oid();
  assert.strictEqual(priorityReason(r({ priceType: 'fixed', subProduct: sub })), 'Specific product · sets the price');
  assert.strictEqual(priorityReason(r({ priceType: 'formula' })), 'All products · sets the price');
  assert.strictEqual(priorityReason(r({ priceType: 'discount', minQuantity: 6 })), 'All products · adjusts the price · qty 6+');
  assert.strictEqual(priorityReason(r({ priceType: 'bundle' })), 'All products · bundle');
  assert.strictEqual(priorityReason(r({ priceType: 'cart_threshold' })), 'All products · whole cart');
});
