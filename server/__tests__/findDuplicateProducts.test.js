// Duplicate detection for the Product catalogue.
//
// The load-bearing tests here are the NEGATIVE ones. The catalogue is full of
// near-names that must stay separate, and an over-eager matcher merges real
// wines into each other:
//
//   Monte do Barao Reserva Vinho Tinto  vs  Monte do Barão Vinho Tinto
//   Monte do Barao ... Vinho Tinto      vs  Monte do Barao ... Vinho Branco
//
// Both pairs share a producer and differ only in a word. The first is a Reserva
// and the second is red vs white — merging either would destroy a real product.
// Whole-name matching keeps them apart while still collapsing pure accent and
// punctuation variants.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normaliseName,
  identityKey,
  suggestKeeper,
  collisionsBy,
  tokenSetKey,
  differsOnlyByTypeNoise,
} = require('../scripts/find-duplicate-products');

// ── The word-order and type-noise passes ────────────────────────────────────
// These widen detection beyond exact names, so their NEGATIVE guarantees are
// what keeps them safe to act on.

test('word order does not create a new product', () => {
  assert.equal(
    tokenSetKey({ name: 'Casamigos Reposado Tequila', volumeMl: 750 }),
    tokenSetKey({ name: 'Casamigos Tequila Reposado', volumeMl: 750 }),
  );
});

test('a reordered name at a different volume is still two rows', () => {
  assert.notEqual(
    tokenSetKey({ name: 'Casamigos Reposado Tequila', volumeMl: 750 }),
    tokenSetKey({ name: 'Casamigos Tequila Reposado', volumeMl: 700 }),
  );
});

test('a trailing drink-type word is noise', () => {
  assert.equal(differsOnlyByTypeNoise('Clase Azul Reposado', 'Clase Azul Reposado Tequila'), true);
});

test('a COLOUR word is never noise', () => {
  assert.equal(
    differsOnlyByTypeNoise('Four Cousins Sweet Red', 'Four Cousins Sweet Red White'),
    false,
    'merging a red into a white would destroy a real product',
  );
  assert.equal(differsOnlyByTypeNoise('Vinho Tinto', 'Vinho Tinto Branco'), false);
});

test('a QUALITY word is never noise', () => {
  assert.equal(differsOnlyByTypeNoise('Monte do Barao', 'Monte do Barao Reserva'), false);
  assert.equal(differsOnlyByTypeNoise('Tignanello Toscana', 'Tignanello Toscana Superior'), false);
});

test('a VINTAGE is never noise', () => {
  assert.equal(differsOnlyByTypeNoise('Tignanello Toscana', 'Tignanello Toscana 2020'), false);
});

test('an edition or region word is never noise', () => {
  // Judged duplicates by the 2026-07-29 human audit, but not safely decidable
  // by rule — "Anime" could be a distinct edition, "Kentucky" a distinct origin.
  // The detector must abstain rather than guess.
  assert.equal(differsOnlyByTypeNoise('Tenjaku Whisky', 'Tenjaku Anime Whisky'), false);
  assert.equal(differsOnlyByTypeNoise('Pinhook Straight Rye', 'Pinhook Kentucky Straight Rye'), false);
});

test('identical token sets are left to the exact pass', () => {
  assert.equal(differsOnlyByTypeNoise('Krug Grande Cuvee', 'Krug Grande Cuvee'), false);
});

test('accent variants normalise to the same string', () => {
  assert.equal(
    normaliseName('Monte dos Perdigões Superior'),
    normaliseName('Monte dos Perdigoes Superior'),
  );
  assert.equal(normaliseName('Monte do Barão'), normaliseName('Monte do Barao'));
});

test('case and punctuation are irrelevant', () => {
  assert.equal(normaliseName("Moët & Chandon"), normaliseName('moet and chandon'));
  assert.equal(normaliseName('Veuve  Clicquot!'), 'veuve clicquot');
});

test('a Reserva is NOT the same product as the plain bottling', () => {
  assert.notEqual(
    normaliseName('Monte do Barao Reserva Vinho Tinto'),
    normaliseName('Monte do Barão Vinho Tinto'),
  );
});

test('red and white are NOT duplicates', () => {
  assert.notEqual(
    normaliseName('Monte do Barao Colheita Selectionada Vinho Tinto'),
    normaliseName('Monte do Barao Colheita Selectionada Vinho Branco'),
  );
});

test('the same wine in two sizes is two legitimate rows', () => {
  const a = { name: 'Krug Grande Cuvée', volumeMl: 750 };
  const b = { name: 'Krug Grande Cuvee', volumeMl: 375 };
  assert.notEqual(identityKey(a), identityKey(b));
});

test('the same wine at the same size collapses', () => {
  assert.equal(
    identityKey({ name: 'Krug Grande Cuvée', volumeMl: 750 }),
    identityKey({ name: 'krug  grande cuvee', volumeMl: 750 }),
  );
});

test('collisionsBy returns only groups with more than one member', () => {
  const rows = [
    { name: 'Krug Grande Cuvée', volumeMl: 750 },
    { name: 'Krug Grande Cuvee', volumeMl: 750 },
    { name: 'Dom Pérignon', volumeMl: 750 },
  ];
  const groups = collisionsBy(rows, identityKey);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 2);
});

test('the row with listings attached is the suggested keeper', () => {
  const keeper = suggestKeeper([
    { _id: 'a', subProductCount: 0, status: 'approved', isPublished: true, createdAt: '2020-01-01' },
    { _id: 'b', subProductCount: 4, status: 'pending', isPublished: false, createdAt: '2024-01-01' },
  ]);
  assert.equal(keeper._id, 'b', 'losing a row with tenant listings on it is the expensive mistake');
});

test('with listings equal, approved beats pending', () => {
  const keeper = suggestKeeper([
    { _id: 'a', subProductCount: 1, status: 'pending', isPublished: false, createdAt: '2020-01-01' },
    { _id: 'b', subProductCount: 1, status: 'approved', isPublished: true, createdAt: '2024-01-01' },
  ]);
  assert.equal(keeper._id, 'b');
});

test('all else equal, the older row wins', () => {
  const keeper = suggestKeeper([
    { _id: 'new', subProductCount: 1, status: 'approved', isPublished: true, createdAt: '2025-01-01' },
    { _id: 'old', subProductCount: 1, status: 'approved', isPublished: true, createdAt: '2019-01-01' },
  ]);
  assert.equal(keeper._id, 'old', 'the older id is likelier to be referenced elsewhere');
});
