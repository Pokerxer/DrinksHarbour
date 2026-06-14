// Run: node scripts/test-purchase-settings.js   (from server/)
const assert = require('node:assert');
const { requiresApproval, poTotal } = require('../controllers/purchaseOrder.controller');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok - ${name}`); }

test('approval off → never requires approval', () => {
  assert.strictEqual(requiresApproval(1000, { requirePOApproval: false, approvalThreshold: 0 }), false);
  assert.strictEqual(requiresApproval(1000, { requirePOApproval: false, approvalThreshold: 500 }), false);
});
test('threshold 0 → all POs require approval', () => {
  assert.strictEqual(requiresApproval(0, { requirePOApproval: true, approvalThreshold: 0 }), true);
  assert.strictEqual(requiresApproval(50, { requirePOApproval: true, approvalThreshold: 0 }), true);
});
test('below threshold → auto-approve (no approval needed)', () => {
  assert.strictEqual(requiresApproval(499, { requirePOApproval: true, approvalThreshold: 500 }), false);
});
test('at/above threshold → requires approval', () => {
  assert.strictEqual(requiresApproval(500, { requirePOApproval: true, approvalThreshold: 500 }), true);
  assert.strictEqual(requiresApproval(900, { requirePOApproval: true, approvalThreshold: 500 }), true);
});
test('poTotal sums unitCost * quantity', () => {
  assert.strictEqual(poTotal({ items: [{ unitCost: 100, quantity: 2 }, { unitCost: 50, quantity: 3 }] }), 350);
  assert.strictEqual(poTotal({ items: [] }), 0);
  assert.strictEqual(poTotal({}), 0);
});

console.log(`\n${passed} passed`);
