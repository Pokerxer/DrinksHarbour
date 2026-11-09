// Read-only perf/consistency probe for the storefront catalogue paths.
// Pinned by the 2026-11-08 300s-timeout incident (docs/memory/
// api-response-speed-300s-timeouts.md). Run from server/: `node scripts/api-perf-probe.js`.
// Targets the MONGODB_URI in .env — verify it points where you intend before
// running! `.env` in this repo points at the PRODUCTION cluster.
require('dotenv').config({ path: require('path').resolve('.env') });
(async () => {
  const db = require('./config/db');
  const ps = require('./services/product.service');
  await db.connectDB();

  // ── A. searchProducts equivalence vs pre-fix shape ──────────────────────
  let s = Date.now();
  const r1 = await ps.searchProducts({ query: 'bombay', page: 1, limit: 8, inStock: true, status: 'approved', includeUnpublished: false, catalogChannel: 'retail' });
  console.log(`search#1 ${(Date.now() - s) / 1000}s prods=${r1.products.length} total=${r1.pagination.totalResults} exact=${r1.pagination.isExactCount} pages=${r1.pagination.totalPages}`);
  const first = r1.products[0];
  console.log('  keys ok:', !!first.name, !!first.priceRange?.min !== undefined, first.pricingInfo?.lowestPrice !== undefined, (first.availableAt || [])[0]?.sizes?.[0]?.pricing?.formatPrice);

  s = Date.now();
  const r2 = await ps.searchProducts({ query: 'bombay', page: 1, limit: 8, inStock: true, status: 'approved', includeUnpublished: false, catalogChannel: 'retail' });
  console.log(`search#2 ${(Date.now() - s) / 1000}s total=${r2.pagination.totalResults} (demand-cache warm)`);

  s = Date.now();
  const r3 = await ps.searchProducts({ query: 'bombay', page: 1, limit: 8, inStock: true, status: 'approved', includeUnpublished: false, catalogChannel: 'retail' });
  console.log(`search#3 ${(Date.now() - s) / 1000}s total=${r3.pagination.totalResults}`);
  if (r1.pagination.totalResults !== r2.pagination.totalResults) { console.error('FAIL count drift'); process.exit(1); }

  // ── B. page 2 shape-correct (no dupes) ─────────────────────────────────
  const page2 = await ps.searchProducts({ query: 'whisky', page: 2, limit: 8, inStock: true, status: 'approved', includeUnpublished: false, catalogChannel: 'retail' });
  const page1 = await ps.searchProducts({ query: 'whisky', page: 1, limit: 8, inStock: true, status: 'approved', includeUnpublished: false, catalogChannel: 'retail' });
  const ids1 = page1.products.map((p) => String(p._id));
  const ids2 = page2.products.map((p) => String(p._id));
  const overlap = ids1.filter((i) => ids2.includes(i));
  console.log(`whisky pages: p1=${ids1.length} p2=${ids2.length} overlap=${overlap.length} total=${page1.pagination.totalResults} total2=${page2.pagination.totalResults}`);
  if (overlap.length) { console.error('FAIL pagination overlap'); process.exit(1); }
  if (page1.pagination.totalResults !== page2.pagination.totalResults) { console.error('FAIL count mismatch page1 vs page2'); process.exit(1); }

  // ── C. trending ─────────────────────────────────────────────────────────
  s = Date.now();
  const tr = await ps.getTrendingProducts(10, 7);
  console.log(`trending ${(Date.now() - s) / 1000}s n=${tr.length} first=${tr[0]?.name} hasPrice=${tr[0]?.priceRange?.display ? 'y' : tr[0]?.priceRange?.min ? 'y' : 'check'}`);
  s = Date.now();
  const tr2 = await ps.getTrendingProducts(10, 7);
  console.log(`trending#2 ${(Date.now() - s) / 1000}s n=${tr2.length}`);
  const t1ids = tr.map((p) => String(p._id));
  const t2ids = tr2.map((p) => String(p._id));
  console.log('  trending order stable:', JSON.stringify(t1ids) === JSON.stringify(t2ids) ? 'yes' : 'no (check)');
  if (tr.some((p) => !p || !p.name)) { console.error('FAIL trending contains null product'); process.exit(1); }

  // ── D. shoppingLocation branch unchanged ────────────────────────────────
  const loc = { lat: 9.07, lon: 7.49 }; // Abuja-ish
  s = Date.now();
  const rl = await ps.searchProducts({ query: 'bombay', page: 1, limit: 8, inStock: true, status: 'approved', includeUnpublished: false, catalogChannel: 'retail', shoppingLocation: loc });
  console.log(`search+location ${(Date.now() - s) / 1000}s prods=${rl.products.length} total=${rl.pagination.totalResults} pages=${rl.pagination.totalPages}`);

  // ── E. admin subproducts search (escaped regex) ─────────────────────────
  const sps = require('./services/subproduct.service');
  s = Date.now();
  const sub = await sps.getAllSubProducts({ search: 'b(o)+', limit: 50 });
  console.log(`subproducts search 'b(o)+' (ReDoS-escaped) ${(Date.now() - s) / 1000}s n=${sub.subProducts.length} total=${sub.pagination.total}`);
  s = Date.now();
  const sub2 = await sps.getAllSubProducts({ search: 'bomb', limit: 50 });
  console.log(`subproducts search 'bomb' ${(Date.now() - s) / 1000}s n=${sub2.subProducts.length}`);

  await require('mongoose').disconnect();
  console.log('VERIFY-DONE');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
