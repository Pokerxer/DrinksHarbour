'use strict';

// Planning-prompting accuracy: per-occasion briefs, size-aware catalogue
// annotations and structured-overview headers. Requires: node --test.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  WEDDING_BEVERAGE_BRIEF, generationPrompt, occasionBrief, OCCASION_BRIEFS,
} = require('../services/weddingBeveragePrompt');
const { planOccasion } = require('../services/occasionChat.service');
const chatbotService = require('../services/chatbot.service');

const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');

const chainable = (data) => {
  const obj = {};
  ['select', 'populate', 'limit', 'sort', 'skip'].forEach((m) => { obj[m] = () => obj; });
  obj.lean = async () => data;
  return obj;
};

test('occasionBrief keeps the weddings brief byte-identical and profiles all other occasions', () => {
  assert.equal(occasionBrief('wedding'), WEDDING_BEVERAGE_BRIEF);
  assert.ok(WEDDING_BEVERAGE_BRIEF.startsWith('You are DrinksHarbour\'s wedding beverage planner'));
  const profiled = ['corporate event', 'house party', 'gift', 'bulk order', 'occasion'];
  assert.deepEqual(Object.keys(OCCASION_BRIEFS).sort(), [...profiled, 'wedding'].sort());
  const texts = profiled.map(occasion => occasionBrief(occasion));
  assert.equal(new Set(texts).size, profiled.length, 'each occasion must have a distinct profile');
  assert.strictEqual(occasionBrief('wedding'), occasionBrief('weddings'), 'wedding aliases resolve to the weddings brief');
  for (const occasion of profiled) {
    const brief = occasionBrief(occasion);
    assert.match(brief, /guest|recipient/i, `${occasion}: guest/recipient planning missing`);
    assert.match(brief, /budget/i, `${occasion}: budget discipline missing`);
    assert.match(brief, /catalogue/i, `${occasion}: catalogue grounding missing`);
    assert.match(brief, /assumptions?/i, `${occasion}: explicit assumptions missing`);
  }
  assert.match(occasionBrief('gift'), /packaging/i, 'gifting must plan packaging, not guest quotas');
  assert.match(occasionBrief('corporate event'), /non.?drink|policy/i, 'corporate must respect workplace drinking variety');
  assert.match(occasionBrief('house party'), /hour/i, 'house parties must reason in servings per hour');
  assert.match(occasionBrief('bulk order'), /case|pack/i, 'bulk must reason in packs/cases');
});

function providers() {
  const calls = [];
  return {
    calls,
    deps: {
      callClaude: async (prompt, system) => { calls.push({ prompt, system }); return 'A working plan.'; },
      analyzeImage: async () => null,
      buildFullCatalogContext: async () => 'Public catalogue: Fixed Wine 75cl (750ml), ₦3,000.',
      loadCatalog: async () => ({ text: 'Public catalogue: Fixed Wine 75cl (750ml), ₦3,000.', entries: [] }),
    },
  };
}

test('non-wedding occasion chat uses its occasion profile plus the planning-checks paragraph', async () => {
  const { calls, deps } = providers();
  await planOccasion({ occasion: 'corporate', query: '40 guests, budget NGN 200000' }, deps);
  assert.match(calls[0].system, /corporate event/i);
  assert.match(calls[0].system, /PLANNING CHECKS/);
  assert.match(calls[0].system, /150ml|25ml|prescribed/i, 'size-aware serving math must be requested');
  assert.match(calls[0].system, /REPLY CHECK/, 'boundary paragraph must survive');
});

test('weddings chat system prompt is unchanged apart from existing shared paragraphs', async () => {
  const { calls, deps } = providers();
  await planOccasion({ occasion: 'weddings', query: 'Plan my wedding' }, deps);
  assert.ok(calls[0].system.startsWith(WEDDING_BEVERAGE_BRIEF + '\n'));
  assert.doesNotMatch(calls[0].system, /corporate event planner|PLANNING CHECKS/);
});

test('generationPrompt uses the occasion profile for every occasion and demands size justification', () => {
  const request = { categories: ['beer'], budget: 50000, guests: 30, selections: [] };
  const common = { request, selected: [], candidates: [] };
  const wedding = generationPrompt({ ...common, remaining: 50000, occasion: 'weddings', wedding: true });
  assert.ok(wedding.startsWith(WEDDING_BEVERAGE_BRIEF), 'weddings structured brief unchanged');
  const corporate = generationPrompt({ ...common, remaining: 50000, occasion: 'corporate', wedding: false });
  assert.match(corporate, /corporate event/i);
  assert.match(corporate, /size|format/i);
  assert.match(corporate, /coverageExplanation/, 'per-category coverage must be requested');
  const party = generationPrompt({ ...common, remaining: 50000, occasion: 'house-parties', wedding: false });
  assert.match(party, /house party|house parties/i);
});

test('catalog text annotates verified size volumes and a category structure header', async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();
  t.mock.method(Tenant, 'find', () => chainable([
    { _id: tenantId, name: 'Test Tenant', revenueModel: 'markup', markupPercentage: 25, commissionPercentage: 12 },
  ]));
  t.mock.method(Product, 'find', () => chainable([
    { _id: productId, name: 'Course Wine', slug: 'course-wine', type: 'wine', images: [], category: { _id: new mongoose.Types.ObjectId(), name: 'Champagne', slug: 'champagne' }, subCategory: { _id: new mongoose.Types.ObjectId(), name: 'Rose', slug: 'rose' } },
  ]));
  t.mock.method(SubProduct, 'find', () => chainable([
    { _id: new mongoose.Types.ObjectId(), product: productId, tenant: tenantId, baseSellingPrice: 1000, costPrice: 1000, availableStock: 10, sizes: [sizeId] },
  ]));
  t.mock.method(Size, 'find', () => chainable([
    { _id: sizeId, size: '75cl', volumeMl: 750, stock: 10, status: 'active', availability: 'available', costPrice: 1000, sellingPrice: 1000 },
  ]));
  const text = await chatbotService.buildFullCatalogContext(String(tenantId));
  assert.match(text, /• 75cl \(750ml\): ₦/, 'verified volume must be annotated next to the size label');
  assert.match(text, /CATALOGUE STRUCTURE/, 'category overview header missing');
  assert.match(text, /Champagne > Rose/, 'category > subcategory must be listed');
  assert.match(text, /1 product\b/, 'category counts must be listed');
});
