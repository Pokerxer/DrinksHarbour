'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const modifiers = require('../services/venue/menu-modifiers');
const { normalizeQuantities } = require('../services/venue/menu-acceptance');

const choices = [
  { groupId: 'protein:extra', optionId: 'chicken', quantity: 1 },
  { groupId: 'protein', optionId: 'extra:chicken', quantity: 1 },
];
test('distinct modifier tuples retain their own quantities during normalization', () => {
  assert.deepEqual(normalizeQuantities(choices), choices);
});
test('selection acceptance retains both valid separator-bearing modifier identities', () => {
  const item = { modifierSchemaVersion: 2, modifierGroups: choices.map(choice => ({
    id: choice.groupId, name: choice.groupId, required: false,
    options: [{ id: choice.optionId, label: 'Instruction', type: 'instruction' }],
  })) };
  assert.deepEqual(modifiers.assertValidSelection(item, choices), choices);
});
test('accepted line signatures cannot collide through modifier separators', () => {
  for (const quantity of [undefined, 1]) {
    const select = (groupId, optionId) => [{ groupId, optionId, ...(quantity ? { quantity } : {}) }];
    assert.notEqual(modifiers.choiceSignature(select('protein:extra', 'chicken')),
      modifiers.choiceSignature(select('protein', 'extra:chicken')));
    assert.notEqual(modifiers.choiceSignature(select('a', 'b|c:d')),
      modifiers.choiceSignature([...select('a', 'b'), ...select('c', 'd')]));
    assert.notEqual(modifiers.choiceSignature(select('a', '%3A')),
      modifiers.choiceSignature(select('a', ':')));
  }
});
