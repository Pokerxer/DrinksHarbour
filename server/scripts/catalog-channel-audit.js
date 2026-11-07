// Static scan of public central-catalog read sites so channel gating coverage is
// explicit (03 §2: "audit all beverage-only forms, validators, search filters,
// embeddings, product cards, imports and exports"). Output: markdown table.
//
// Companion doc: docs/superpowers/plans/venue-phase-3/s1-channel-audit.md — the
// table below is the "scanned" evidence; the doc adds the `gated?` verdict per
// row (gated / deferred / n-a) after reading the route registration for each
// entry point. Run: `cd server && node scripts/catalog-channel-audit.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  // Plan-specified targets (S1 Task 3)
  'controllers/product.controller.js',
  'controllers/subproduct.controller.js',
  'services/product.service.js',
  'services/product.service.improved.js',
  'services/product.personalized.service.js',
  'services/search.service.js',
  'services/embedding.service.js',
  'services/subProductImport.service.js',
  'controllers/productStock.controller.js',
  // Discovered during audit (grep `Product.find|Product.findOne|Product.paginate`
  // across server/ excluding node_modules and __tests__)
  'services/marketCatalog.js',
  'controllers/category.controller.js',
  'controllers/subcategory.controller.js',
  'controllers/blog.controller.js',
  'controllers/store.controller.js',
  'services/chatbot.service.js',
  'services/cart.service.js',
  'services/wishlist.service.js',
  'services/product.personalized.js',
  'services/storefrontCatalog.service.js',
  'services/storefrontMetadata.service.js',
  'services/scanMatch.service.js',
  'services/coupon.service.js',
  'services/promotion.service.js',
  'services/search.service.js',
].map((rel) => path.join(ROOT, rel));
const PATTERNS = [/Product\.find\(/g, /Product\.findOne\(/g, /Product\.paginate\(/g, /getProducts[^(]*\(/g, /catalogKind/g];
for (const file of TARGETS) {
  const rel = path.relative(ROOT, file);
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { console.log(`| ${rel} | missing | not scanned |`); continue; }
  const hits = PATTERNS.flatMap((p) => (text.match(p) || []).map((m) => `${m} @ ${text.slice(0, text.indexOf(m)).split('\n').length}`));
  console.log(`| ${rel} | ${hits.length ? 'has public/inner queries' : 'no Product reads'} | ${hits.slice(0, 12).join('; ') || '-'} |`);
}
