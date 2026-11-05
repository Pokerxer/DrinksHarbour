const test = require('node:test');
const assert = require('node:assert/strict');
const { publicProduct } = require('../services/priceChecker/serialization');

const base = {
  product: {
    name: 'Glen Grant',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 750,
    originCountry: 'Scotland',
    images: [],
    brand: null,
  },
  size: { size: 700, displayName: '70cl', barcode: '123' },
  pricing: { price: 100, currency: 'NGN', taxLabel: '', originalPrice: 100 },
  stock: { availability: 'IN_STOCK', quantity: 5 },
};

test('compare products expose abv, volume and origin when compare is enabled', () => {
  const withCompare = publicProduct({ ...base, settings: {} });
  assert.equal(withCompare.abv, 40);
  assert.equal(withCompare.volume, '750 ml');
  assert.equal(withCompare.origin, 'Scotland');
});

test('compare fields are withheld when the kiosk disables the comparison tool', () => {
  const disabled = publicProduct({ ...base, settings: { enableCompare: false } });
  assert.equal(disabled.abv, undefined);
  assert.equal(disabled.volume, undefined);
  assert.equal(disabled.origin, undefined);
});
