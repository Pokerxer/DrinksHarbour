const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, validateSettings } = require('../services/priceChecker/validation');

test('compare/phone settings default on and validate as booleans', () => {
  assert.equal(defaults.enableCompare, true);
  assert.equal(defaults.enablePhoneScan, true);
  assert.deepEqual(
    validateSettings({ enableCompare: false, enablePhoneScan: false }),
    { enableCompare: false, enablePhoneScan: false }
  );
  assert.throws(() => validateSettings({ enableCompare: 'yes' }), /enableCompare/u);
});

test('language defaults to english and accepts en/ha/pig only', () => {
  assert.equal(defaults.language, 'en');
  assert.deepEqual(validateSettings({ language: 'ha' }).language, 'ha');
  assert.deepEqual(validateSettings({ language: 'pig' }).language, 'pig');
  assert.throws(() => validateSettings({ language: 'swahili' }), /language/u);
  assert.throws(() => validateSettings({ language: 42 }), /language/u);
});
