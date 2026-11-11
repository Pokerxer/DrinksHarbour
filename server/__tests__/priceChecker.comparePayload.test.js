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
    type: 'spirit',
    images: [],
    brand: null,
  },
  size: { size: 700, volumeMl: 700, displayName: '70cl', barcode: '123' },
  pricing: { price: 100, currency: 'NGN', taxLabel: '', originalPrice: 100 },
  stock: { availability: 'IN_STOCK', quantity: 5 },
};

test('compare products expose abv, volume and origin when compare is enabled', () => {
  const withCompare = publicProduct({ ...base, settings: {} });
  assert.equal(withCompare.abv, 40);
  assert.equal(withCompare.volume, '700 ml');
  assert.equal(withCompare.origin, 'Scotland');
  assert.equal(withCompare.volumeMl, 700);
  assert.equal(withCompare.beverageType, 'spirit');
});

test('detail-only fields are withheld when phone and comparison are both disabled', () => {
  const disabled = publicProduct({ ...base, settings: { enableCompare: false, enablePhoneScan: false } });
  assert.equal(disabled.abv, undefined);
  assert.equal(disabled.volume, undefined);
  assert.equal(disabled.origin, undefined);
  assert.equal(disabled.volumeMl, undefined);
  assert.equal(disabled.beverageType, 'spirit');
});

test('phone details keep exact size and public taxonomy even when comparison is disabled', () => {
  const bottle = publicProduct({
    ...base,
    product: {
      ...base.product,
      category: { name: 'White wine' },
      subCategory: { name: 'Torrontés', subType: 'argentine_varietal' },
      description: '<p>Apricot &amp; orange blossom.</p><script>private</script>',
    },
    settings: { enableCompare: false, enablePhoneScan: true },
  });
  assert.equal(bottle.category, 'White wine');
  assert.equal(bottle.subCategory, 'Torrontés');
  assert.deepEqual(bottle.grapeVarieties, ['Torrontés']);
  assert.equal(bottle.volumeMl, 700);
  assert.equal(bottle.description, 'Apricot & orange blossom.');
});
