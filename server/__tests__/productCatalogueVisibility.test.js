// Catalogue visibility — which slice of the Product collection a search sees.
//
// Regression origin: the admin sub-product picker could only ever see
// approved+published products, because searchProducts hard-coded
// `{status:'approved', isPublished:true}` and never destructured a status param
// at all. Measured against the live database at the time: 584 products visible,
// but 405 pending+unpublished and 13 approved-but-unpublished were not — 42% of
// the catalogue — and 0 of 1000 sub-products shared a product across tenants,
// i.e. catalogue reuse had never once happened. An operator who cannot find an
// existing product creates a second copy, against AGENTS.md's "the central
// Product catalog is the single source of truth — no duplicates, ever".
//
// The defaults are the load-bearing assertion here: the storefront and SEO both
// depend on approved-and-published, and every pre-existing caller passes
// neither param.
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCatalogueVisibilityQuery } = require('../services/product.service');

test('the default is unchanged: approved AND published', () => {
  assert.deepEqual(buildCatalogueVisibilityQuery(), {
    status: 'approved',
    isPublished: true,
  });
});

test('called with no argument at all it still defaults closed', () => {
  assert.deepEqual(buildCatalogueVisibilityQuery(undefined), {
    status: 'approved',
    isPublished: true,
  });
});

test('a status array widens to pending without dropping the constraint', () => {
  assert.deepEqual(
    buildCatalogueVisibilityQuery({ status: ['approved', 'pending'], includeUnpublished: true }),
    { status: { $in: ['approved', 'pending'] } },
  );
});

test("status 'any' drops the status constraint entirely", () => {
  assert.deepEqual(
    buildCatalogueVisibilityQuery({ status: 'any', includeUnpublished: true }),
    {},
  );
});

// The two flags are deliberately independent. Widening one must not widen the
// other — that is what makes the public endpoint's `status:'approved'` pin
// sufficient on its own.
test('includeUnpublished alone still constrains status', () => {
  assert.deepEqual(buildCatalogueVisibilityQuery({ includeUnpublished: true }), {
    status: 'approved',
  });
});

test('a status widening alone still requires published', () => {
  assert.deepEqual(buildCatalogueVisibilityQuery({ status: ['approved', 'pending'] }), {
    status: { $in: ['approved', 'pending'] },
    isPublished: true,
  });
});

// Pending products are unpublished by definition, so this combination — the
// picker's — is the one that actually reveals them.
test("the picker's combination reveals pending products", () => {
  const q = buildCatalogueVisibilityQuery({
    status: ['approved', 'pending'],
    includeUnpublished: true,
  });
  assert.ok(q.status.$in.includes('pending'));
  assert.equal(q.isPublished, undefined);
});

test('archived is not included by the picker default', () => {
  const q = buildCatalogueVisibilityQuery({
    status: ['approved', 'pending'],
    includeUnpublished: true,
  });
  assert.ok(!q.status.$in.includes('archived'), 'relinking to an archived entry would resurrect it');
});
