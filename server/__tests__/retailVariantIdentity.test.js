'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { variantIdentity, variantColorFields } = require('../utils/retailVariantIdentity');
const Size = require('../models/Size');

test('same size supports separate colour identities while normalizing case and spaces', () => {
  assert.notEqual(variantIdentity('m', 'Red'), variantIdentity('m', 'Blue'));
  assert.equal(variantIdentity('m', 'Red'), variantIdentity('M', ' red '));
  assert.equal(variantIdentity('m'), variantIdentity('m', ' '));
  assert.deepEqual(variantColorFields({ colorName: ' Red ' }), {
    colorName: 'Red', colorHexCode: undefined, optionName: '', variantColorKey: '["red",null]',
  });
});

test('retail unique index guards size and colour without changing venue serving identity', () => {
  const indexes = Size.schema.indexes();
  const retail = indexes.find(([, options]) => options.name === 'size_retail_v1_color_unique');
  assert.deepEqual(retail[0], { subproduct: 1, size: 1, variantColorKey: 1 });
  assert.equal(retail[1].unique, true);
  assert.deepEqual(retail[1].partialFilterExpression, { servingSchemaVersion: 1 });
  assert.ok(indexes.some(([, options]) => options.name === 'size_venue_v2_code_unique'));
});

test('variant image data supports a clear operation and rejects unsafe URLs', () => {
  const { variantImageFields } = require('../utils/retailVariantIdentity');
  assert.deepEqual(variantImageFields({}), {});
  assert.deepEqual(variantImageFields({ image: null }), { image: null });
  assert.deepEqual(variantImageFields({ image: { url: 'https://example.com/blue.png', alt: 'Blue shirt' } }), {
    image: { url: 'https://example.com/blue.png', alt: 'Blue shirt' },
  });
  assert.throws(() => variantImageFields({ image: { url: 'javascript:alert(1)' } }));
});


test('the same size and colour can represent distinct named configurations', () => {
  assert.notEqual(variantIdentity('storage-256gb', 'Black', '8 GB RAM'), variantIdentity('storage-256gb', 'Black', '16 GB RAM'));
  assert.equal(variantIdentity('30ml', undefined, ' Citrus '), variantIdentity('30ML', '', 'citrus'));
  assert.notEqual(variantIdentity('30ml', 'Citrus'), variantIdentity('30ml', '', 'Citrus'));
});
