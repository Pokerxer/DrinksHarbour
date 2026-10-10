const test = require('node:test');
const assert = require('node:assert/strict');
const { stockProductImage } = require('../services/stockProductImage');
test('stock image prefers tenant primary image then catalogue image, without broken empty URLs', () => {
  assert.equal(stockProductImage({ imagesOverride: [{ url: 'first' }, { url: 'primary', isPrimary: true }], product: { images: [{ url: 'catalogue' }] } }), 'primary');
  assert.equal(stockProductImage({ imagesOverride: [{ url: '' }], product: { images: [{ url: 'catalogue' }] } }), 'catalogue');
  assert.equal(stockProductImage({}), null);
});
