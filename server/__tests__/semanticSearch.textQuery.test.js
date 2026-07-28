// server/__tests__/semanticSearch.textQuery.test.js
//
// The search modal lets shoppers type provenance terms ("bordeaux", "médoc",
// "speyside") rather than product names. These lock in the fields the free-text
// $match covers, and that a matching document actually satisfies the clause.

const test = require('node:test');
const assert = require('node:assert');
const {
  buildExpandedTextQuery,
  buildRelevanceScore,
  TEXT_SEARCH_FIELDS,
} = require('../services/semanticSearch.service');

const fieldsOf = (q) => q.$or.map((clause) => Object.keys(clause)[0]);

/** Evaluate a single `{ path: RegExp }` clause against a plain document. */
const clauseMatches = (clause, doc) => {
  const [path, matcher] = Object.entries(clause)[0];
  const value = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), doc);
  if (value === undefined || value === null) return false;
  if (matcher instanceof RegExp) {
    return Array.isArray(value)
      ? value.some((v) => matcher.test(String(v)))
      : matcher.test(String(value));
  }
  return value === matcher;
};

const docMatches = (q, doc) => q.$or.some((clause) => clauseMatches(clause, doc));

test('free-text search covers provenance fields, not just name and description', () => {
  const fields = fieldsOf(buildExpandedTextQuery('bordeaux'));

  for (const field of ['originCountry', 'region', 'appellation', 'producer',
    'wineryName', 'distilleryName', 'breweryName']) {
    assert.ok(fields.includes(field), `expected provenance field ${field} to be searched`);
  }
});

test('free-text search covers maturation, tasting notes and awards', () => {
  const fields = fieldsOf(buildExpandedTextQuery('sherry cask'));

  for (const field of ['ageStatement', 'caskType', 'finish', 'style', 'foodPairings',
    'tastingNotes.nose', 'tastingNotes.palate', 'tastingNotes.finish',
    'awards.title', 'awards.organization']) {
    assert.ok(fields.includes(field), `expected ${field} to be searched`);
  }
});

test('an appellation-only match satisfies the query', () => {
  // Nothing in this product's name, description or region says "médoc".
  const product = {
    name: 'Thomas Barton Réserve',
    description: 'A structured claret.',
    originCountry: 'France',
    region: 'Bordeaux',
    appellation: 'Médoc',
  };

  assert.ok(docMatches(buildExpandedTextQuery('médoc'), product));
  assert.ok(docMatches(buildExpandedTextQuery('bordeaux'), product));
  assert.ok(docMatches(buildExpandedTextQuery('france'), product));
  assert.ok(!docMatches(buildExpandedTextQuery('rioja'), product));
});

test('a tasting-note-only match satisfies the query', () => {
  const product = {
    name: 'Ardbeg 10',
    region: 'Islay',
    tastingNotes: { nose: ['Peat smoke', 'Tar'], palate: ['Espresso', 'Sea salt'] },
  };

  assert.ok(docMatches(buildExpandedTextQuery('espresso'), product));
  assert.ok(docMatches(buildExpandedTextQuery('tar'), product));
  assert.ok(!docMatches(buildExpandedTextQuery('elderflower'), product));
});

test('a bare 4-digit year matches vintage numerically, not by regex', () => {
  const clauses = buildExpandedTextQuery('2015').$or;
  const vintageClause = clauses.find((c) => 'vintage' in c);

  assert.ok(vintageClause, 'expected a vintage clause for a bare year');
  assert.strictEqual(vintageClause.vintage, 2015, 'vintage is a Number — a RegExp would never match');

  assert.ok(docMatches(buildExpandedTextQuery('2015'), { name: 'Château X', vintage: 2015 }));
  assert.ok(!docMatches(buildExpandedTextQuery('2015'), { name: 'Château X', vintage: 2016 }));
});

test('a non-year query adds no vintage clause', () => {
  assert.ok(!fieldsOf(buildExpandedTextQuery('bordeaux')).includes('vintage'));
  assert.ok(!fieldsOf(buildExpandedTextQuery('12 year old')).includes('vintage'));
});

test('accents fold both ways — nobody types "Médoc" into a search box', () => {
  const accented = {
    name: 'Château Citran',
    region: 'Bordeaux',
    appellation: 'Médoc',
    producer: 'Moët Hennessy',
  };
  const plain = { name: 'Cotes de Provence Rose', appellation: 'Medoc' };

  // unaccented query → accented data
  assert.ok(docMatches(buildExpandedTextQuery('medoc'), accented));
  assert.ok(docMatches(buildExpandedTextQuery('chateau'), accented));
  assert.ok(docMatches(buildExpandedTextQuery('moet'), accented));
  // accented query → unaccented data
  assert.ok(docMatches(buildExpandedTextQuery('médoc'), plain));
  assert.ok(docMatches(buildExpandedTextQuery('côtes'), plain));
  // folding must not turn everything into a match
  assert.ok(!docMatches(buildExpandedTextQuery('rioja'), accented));
});

test('accent folding leaves regex metacharacters escaped', () => {
  // A query full of metacharacters must stay literal, not become a wildcard.
  const q = buildExpandedTextQuery('a.*b');
  assert.ok(!docMatches(q, { name: 'axxxb' }), 'must not behave as a wildcard');
  assert.ok(docMatches(q, { name: 'literal a.*b here' }));
});

test('filler words are not OR\'d in on their own', () => {
  // "de" alone used to be an alternation term, so "cotes de provence" matched
  // every product whose description happened to contain "de" — all 439 of them.
  const q = buildExpandedTextQuery('cotes de provence');
  const noise = { name: 'Glenfiddich 18', description: 'Matured in de luxe oak casks.' };

  assert.ok(!docMatches(q, noise), '"de" must not drag in unrelated products');
  assert.ok(docMatches(q, { name: 'Whispering Angel', appellation: 'Côtes de Provence' }));
  assert.ok(docMatches(q, { name: 'Rare Rose', region: 'Provence' }));
});

test('a short query is still searched as a whole', () => {
  // The filler rule drops tokens of 2 characters or fewer, but the full query
  // is always kept — otherwise "XO" would match nothing at all.
  assert.ok(docMatches(buildExpandedTextQuery('xo'), { name: 'Hennessy XO' }));
  assert.ok(docMatches(buildExpandedTextQuery('of'), { name: 'Spirit of Kent' }));
});

test('barcode and sku still require an exact match, not a substring', () => {
  const clauses = buildExpandedTextQuery('5000267023656').$or;
  const sku = clauses.find((c) => 'sku' in c).sku;

  assert.ok(sku.test('5000267023656'));
  assert.ok(!sku.test('5000267023656X'), 'sku must stay anchored');
});

test('every searched field is a declared path (no typos in TEXT_SEARCH_FIELDS)', () => {
  const Product = require('../models/Product');
  for (const field of TEXT_SEARCH_FIELDS) {
    assert.ok(
      Product.schema.path(field) || Product.schema.path(field.split('.')[0]),
      `${field} is not a path on the Product schema`,
    );
  }
});

test('relevance ranks appellation above country, and both above prose', () => {
  const score = buildRelevanceScore('bordeaux', false);
  // Each entry is { $cond: [ { $regexMatch: { input: {$ifNull:[path, '']} } }, weight, 0 ] }
  const weightFor = (path) => {
    const entry = score.$add.find(
      (e) => e.$cond?.[0]?.$regexMatch?.input?.$ifNull?.[0] === `$${path}`,
    );
    return entry ? entry.$cond[1] : null;
  };

  assert.ok(weightFor('appellation') > weightFor('region'));
  assert.ok(weightFor('region') > weightFor('originCountry'));
  assert.ok(weightFor('originCountry') > weightFor('description'));
});
