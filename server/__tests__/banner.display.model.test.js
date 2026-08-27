// Display-control fields on the hero banner: defaults, ranges, and the
// overlayOpacity cap that used to reject every admin-set value.
const test = require('node:test');
const assert = require('node:assert');
const Banner = require('../models/Banner');

const makeBanner = (overrides = {}) =>
  new Banner({ image: { url: 'https://example.com/hero.jpg' }, ...overrides });

test('display fields default to today\'s appearance', () => {
  const banner = makeBanner();
  assert.strictEqual(banner.imageFit, 'contain');
  assert.strictEqual(banner.gradientIntensity, 100);
  assert.strictEqual(banner.blurIntensity, 100);
  assert.strictEqual(banner.overlayOpacity, 0);
});

test('overlayOpacity accepts the 0-100 range the admin slider emits', () => {
  // Regression: the schema declared max 1 while the slider emitted 0-100, so
  // every non-trivial overlay failed validation on save.
  assert.strictEqual(makeBanner({ overlayOpacity: 40 }).validateSync(), undefined);
  assert.strictEqual(makeBanner({ overlayOpacity: 100 }).validateSync(), undefined);
  assert.ok(makeBanner({ overlayOpacity: 101 }).validateSync());
  assert.ok(makeBanner({ overlayOpacity: -1 }).validateSync());
});

test('gradientIntensity and blurIntensity are bounded to 0-100', () => {
  for (const field of ['gradientIntensity', 'blurIntensity']) {
    assert.strictEqual(makeBanner({ [field]: 0 }).validateSync(), undefined, `${field} 0`);
    assert.strictEqual(makeBanner({ [field]: 55 }).validateSync(), undefined, `${field} 55`);
    assert.ok(makeBanner({ [field]: 101 }).validateSync(), `${field} 101 should fail`);
    assert.ok(makeBanner({ [field]: -1 }).validateSync(), `${field} -1 should fail`);
  }
});

test('imageFit is restricted to cover and contain', () => {
  assert.strictEqual(makeBanner({ imageFit: 'contain' }).validateSync(), undefined);
  assert.strictEqual(makeBanner({ imageFit: 'cover' }).validateSync(), undefined);
  assert.ok(makeBanner({ imageFit: 'stretch' }).validateSync());
});
