const test = require('node:test');
const assert = require('node:assert/strict');
const { getSizesForType, STANDARD_SIZES } = require('../constants/productTypes');
const Size = require('../models/Size');

test('Electronics size guidance offers relevant screen and capacity dimensions', () => {
  const expected = {
    electronics_desktop: [...STANDARD_SIZES.STORAGE, ...STANDARD_SIZES.RAM],
    electronics_printer: ['unit-single'],
    electronics_storage: STANDARD_SIZES.STORAGE,
    electronics_laptop: [
      ...STANDARD_SIZES.STORAGE, ...STANDARD_SIZES.RAM,
      'screen-12.5', 'screen-13', 'screen-13.3', 'screen-14', 'screen-15',
      'screen-15.6', 'screen-16', 'screen-17.3', 'screen-18',
    ],
    electronics_tablet: [
      ...STANDARD_SIZES.STORAGE,
      'screen-7', 'screen-8', 'screen-8.7', 'screen-9', 'screen-10.1',
      'screen-10.9', 'screen-11', 'screen-12.4', 'screen-12.9', 'screen-13',
    ],
    electronics_tv_display: STANDARD_SIZES.SCREEN_INCH,
  };
  const enumSizes = new Set(Size.schema.path('size').enumValues);
  for (const [type, sizes] of Object.entries(expected)) {
    assert.ok(sizes.every(size => getSizesForType(type).includes(size)), type);
    assert.ok(getSizesForType(type).every((size) => enumSizes.has(size)), type);
  }
});
