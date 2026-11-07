'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../constants/catalogKind');

test('catalogKind constants', () => {
  // Additive retail verticals (2026-11-02): the four general-retail industries
  // landed KINDS.retail WITHOUT changing legacy semantics — RETAIL_KINDS is
  // the retail-channel allowlist and now includes both legacy (beverage) and
  // the industry-vertical kind; VENUE_KINDS unchanged.
  assert.deepEqual(c.VALUES, ['beverage', 'prepared_beverage', 'prepared_food', 'ingredient', 'consumable', 'retail']);
  assert.deepEqual(c.RETAIL_KINDS, ['beverage', 'retail']);
  assert.deepEqual(c.VENUE_KINDS, ['beverage', 'prepared_beverage', 'prepared_food']);
});

test('kind classification is legacy-safe (missing kind stays beverage)', () => {
  assert.equal(c.isRetailCatalogKind(undefined), true); // legacy docs default to beverage
  assert.equal(c.isVenueCatalogKind(undefined), true);
  assert.equal(c.isRetailCatalogKind('prepared_food'), false);
  assert.equal(c.isVenueCatalogKind('prepared_food'), true);
  assert.equal(c.isVenueCatalogKind('consumable'), false);
  // Industry verticals: retail-kind rows are retail-sellable, never venue-service.
  assert.equal(c.isRetailCatalogKind('retail'), true);
  assert.equal(c.isVenueCatalogKind('retail'), false);
  assert.equal(c.isVenueServiceProduct({ type: 'fashion_top', catalogKind: 'retail' }), false);
});

test('retailWhereClause matches legacy docs without catalogKind and beverage/retail docs', () => {
  const clause = c.retailWhereClause().$or;
  assert.ok(Array.isArray(clause) && clause.length === 2);
  assert.deepEqual(clause[0], { catalogKind: { $exists: false } });
  assert.deepEqual(clause[1], { catalogKind: { $in: ['beverage', 'retail'] } });
});

// DRI-5 (board 2026-11-05): the /platform marketplace surface is beverage-kind
// only. Retail-kind stock (Fashion/Electronics/Beauty/Home + hospitality_
// lounge stock) sells through tenant store surfaces, never the platform
// marketplace. Legacy docs (no catalogKind) behave as beverages.
test('marketplaceWhereClause matches legacy and beverage docs only', () => {
  const clause = c.marketplaceWhereClause().$or;
  assert.ok(Array.isArray(clause) && clause.length === 2);
  assert.deepEqual(clause[0], { catalogKind: { $exists: false } });
  assert.deepEqual(clause[1], { catalogKind: 'beverage' });
  // The retail kind must never leak through the marketplace clause —
  // keying on the constant, not a string literal, is what keeps this test
  // honest if the kind values are ever renamed.
  assert.ok(!JSON.stringify(clause).includes('retail'));
});

const Product = require('../models/Product');

test('Product catalogKind defaults to beverage and accepts venue-prepared kinds', () => {
  const legacy = new Product({ name: 'X', slug: 'x', type: 'gin' });
  assert.equal(legacy.catalogKind, 'beverage');
  const food = new Product({ name: 'Jollof', slug: 'jollof', type: 'gin', catalogKind: 'prepared_food', portionGrams: 400 });
  assert.equal(food.catalogKind, 'prepared_food');
  const errors = new Product({ name: 'Y', slug: 'y', type: 'gin', catalogKind: 'car' }).validateSync().errors;
  assert.ok(errors.catalogKind, 'unknown kind must fail');
  const grams = new Product({ name: 'Z', slug: 'z', type: 'gin', catalogKind: 'prepared_food', portionGrams: 0 }).validateSync().errors;
  assert.ok(grams.portionGrams, 'portionGrams must be at least 1');
});

// ── S1 Task 3: channel audit + primary public listing gate ──────────────────
const fs = require('node:fs');
const path = require('node:path');

test('S1 channel audit doc exists and records gated primary sites', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../../docs/superpowers/plans/venue-phase-3/s1-channel-audit.md'), 'utf8');
  assert.ok(doc.includes('| file |') || doc.includes('| file|'), 'audit table header present');
  assert.ok(doc.includes('gated'), 'at least one site recorded as gated');
  // The primary public listing funnel must be recorded as gated by name — the
  // audit doc is the artifact later slices consult when widening channels.
  assert.ok(doc.includes('services/product.service.js') && doc.includes('searchProducts'), 'primary listing funnel documented');
});

test('S1 gate source files require catalogKind and pin the retail channel', () => {
  // Pure static assertion: the gate must be reachable from the controller
  // territory (pinned catalogChannel) AND merge the shared clause in the
  // service, without any test DB.
  const service = fs.readFileSync(path.join(__dirname, '../services/product.service.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '../controllers/product.controller.js'), 'utf8');
  assert.ok(service.includes("require('../constants/catalogKind')"), 'service imports catalogKind');
  assert.match(service, /catalogChannel === 'retail'/, 'service gates on catalogChannel: retail');
  assert.match(controller, /catalogChannel: 'retail'/, 'controller pins retail channel for the public route');
  // Admin twin must exist and must NOT carry the pin.
  assert.ok(controller.includes('getAllProductsAdmin'), 'admin listing twin handler exists');
  const adminHandler = controller.slice(controller.indexOf('const getAllProductsAdmin'), controller.indexOf('result = await productService.searchProducts', controller.indexOf('const getAllProductsAdmin')));
  assert.ok(!adminHandler.includes("catalogChannel"), 'admin listing is ungated (operator view sees all kinds)');
});

// DRI-5: channel semantics after the beverage-only enforcement.
test('product.service applies the beverage-only clause to the retail channel and keeps retailWhereClause for the store channel', () => {
  const service = fs.readFileSync(path.join(__dirname, '../services/product.service.js'), 'utf8');
  // The public retail channel merges the beverage-only marketplace clause.
  assert.match(
    service,
    /catalogChannel === 'retail'[\s\S]{0,200}catalogKind\.marketplaceWhereClause\(\)/,
    'retail channel now applies marketplaceWhereClause (beverage-only)',
  );
  // The tenant storefront channel keeps the beverage+retail clause.
  assert.match(
    service,
    /catalogChannel === 'store'[\s\S]{0,200}catalogKind\.retailWhereClause\(\)/,
    'store channel keeps retailWhereClause (tenant storefronts sell retail kinds)',
  );
  // No stale "retail channel lists beverages only" comment may survive (the
  // comment contradicted the constant before DRI-5; now the semantics moved
  // to marketplaceWhereClause and the comments must say so).
  assert.ok(!service.includes('retail channel lists beverages only'), 'strip comments updated to DRI-5 semantics');
});

test('store.controller pins the store channel for tenant storefront listings', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../controllers/store.controller.js'), 'utf8');
  assert.match(controller, /catalogChannel: 'store'/, 'tenant storefront listings declare the store channel');
});

test('chatbot surfaces use the beverage-only marketplace clause, not the retail-sellability clause', () => {
  const chatbot = fs.readFileSync(path.join(__dirname, '../services/chatbot.service.js'), 'utf8');
  assert.ok(chatbot.includes('marketplaceWhereClause'), 'chatbot applies the marketplace clause');
  assert.ok(!chatbot.includes('retailWhereClause'), 'chatbot no longer applies the retail(=beverage+retail) clause');
});

test('catalogKind header records the beverage-only marketplace semantics (DRI-5)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../constants/catalogKind.js'), 'utf8');
  assert.match(src, /beverage-only/i, 'header states the platform marketplace is beverage-only');
});
