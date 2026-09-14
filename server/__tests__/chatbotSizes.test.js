const test = require('node:test');
const assert = require('node:assert/strict');
const { sizeLabel, sizeKey } = require('../utils/chatbotSizes');

test('equivalent bottle units share a key, distinct volumes and packs do not', () => {
  assert.equal(sizeKey('75cl'), sizeKey('750 ml'));
  assert.equal(sizeKey('1L'), sizeKey('100cl'));
  assert.notEqual(sizeKey('70cl'), sizeKey('75cl'));
  assert.notEqual(sizeKey('6 x 75cl'), sizeKey('75cl'));
});
test('labels come from saved sizes or volume, never invented index names', () => {
  assert.equal(sizeLabel({ size: '75cl', volumeMl: 700 }), '75cl');
  assert.equal(sizeLabel({ volumeMl: 750 }), '75cl');
  assert.equal(sizeLabel({}), null);
});
