// The escape contract. Every regex built from user input has to survive the
// metacharacters a person can actually type into a search box — a throw here
// becomes a 500 with a raw V8 message, not a validation error.
const test = require('node:test');
const assert = require('node:assert');
const { escapeRegex } = require('../utils/escapeRegex');

/** Characters that used to throw SyntaxError out of `new RegExp(x, 'i')`. */
const METACHARACTERS = ['(', ')', '[', ']', '{', '}', '*', '+', '?', '.', '^', '$', '|', '\\', '/'];

test('every metacharacter builds a valid case-insensitive regex', () => {
  for (const ch of METACHARACTERS) {
    const re = new RegExp(escapeRegex(ch), 'i');
    assert.ok(re instanceof RegExp, `${ch} produced no regex`);
    assert.strictEqual(re.test(ch), true, `${ch} should match itself`);
  }
});

test('the reported crash cases no longer throw', () => {
  // These four are verbatim the 500s from the purchase edit product search.
  for (const term of ['(', '[', '*', '?', 'a(b', 'C++']) {
    assert.doesNotThrow(
      () => new RegExp(escapeRegex(term), 'i'),
      `${term} must not throw`
    );
  }
});

test('escaped terms match themselves and nothing else', () => {
  const re = new RegExp(escapeRegex('a.b'), 'i');
  assert.strictEqual(re.test('a.b'), true, 'literal dot should match');
  assert.strictEqual(re.test('axb'), false, 'dot must not act as a wildcard');
});

test('ordinary text is untouched and still matches', () => {
  for (const term of ['wine', 'Sunblessed Vinho Tinto', 'SKU-OSLDEE-75CL', '']) {
    assert.strictEqual(escapeRegex(term), term === '' ? '' : term, term);
    assert.strictEqual(new RegExp(escapeRegex(term), 'i').test(term), true);
  }
});

test('a regex injection attempt is neutralised, not executed', () => {
  // "match everything" must behave as a literal search for that text.
  const re = new RegExp(escapeRegex('.*'), 'i');
  assert.strictEqual(re.test('.*'), true);
  assert.strictEqual(re.test('anything at all'), false, 'must not match as a wildcard');
});

test('null and undefined are safe rather than throwing', () => {
  assert.strictEqual(escapeRegex(null), '');
  assert.strictEqual(escapeRegex(undefined), '');
  assert.strictEqual(escapeRegex(undefined), escapeRegex(null));
});
