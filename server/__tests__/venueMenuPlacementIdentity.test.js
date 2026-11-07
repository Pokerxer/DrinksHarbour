'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validateMenuV2 } = require('../services/venue/menu-taxonomy');
const subProductId = '507f1f77bcf86cd7994390ab';
const sizeId = '507f1f77bcf86cd7994390cd';
function menu(states, sizeIds = [sizeId, sizeId]) {
  const sections = states.map((published, index) => {
    const id = randomUUID();
    const categoryId = randomUUID();
    return {
      id,
      name: index ? 'Late night' : 'Dinner',
      categoryId,
      items: [{
        menuItemId: randomUUID(), categoryId,
        subProductId: index ? subProductId.toUpperCase() : subProductId,
        sizeId: sizeIds[index], servingVersion: 1, published,
      }],
    };
  });
  return {
    schemaVersion: 2,
    categories: sections.map(section => ({
      id: section.categoryId, sectionId: section.id,
      parentId: null, name: 'Main dishes', sortOrder: 0,
    })),
    sections: sections.map(({ categoryId, ...section }) => section),
  };
}
test('one published serving cannot resolve to two different menu contexts', () => {
  assert.throws(() => validateMenuV2(menu([true, true], [sizeId, sizeId.toUpperCase()])),
    error => error.code === 'INVALID_INPUT' && error.statusCode === 400 && /published/i.test(error.message));
});
test('draft placements may repeat a serving across menu contexts', () => {
  for (const states of [[false, false], [true, false], [false, true]]) {
    const result = validateMenuV2(menu(states));
    assert.equal(result.sections.length, 2);
    assert.deepEqual(result.sections.map(section => section.items[0].published), states);
  }
});
test('distinct portion IDs of the same product may be published in separate contexts', () => {
  const result = validateMenuV2(menu([true, true], [sizeId, '507f1f77bcf86cd7994390ef']));
  assert.equal(result.sections.flatMap(section => section.items).length, 2);
});
