#!/usr/bin/env node
/**
 * Find genuine duplicate rows in the Product catalogue.
 *
 * READ-ONLY. This script never writes, updates or deletes anything, and has no
 * flag that makes it do so. Merging duplicates is a separate, reviewed step —
 * every candidate here needs a human decision about which row survives and what
 * happens to the SubProducts pointing at the loser.
 *
 *   node scripts/find-duplicate-products.js            # human-readable report
 *   node scripts/find-duplicate-products.js --json     # machine-readable
 *
 * ── Why whole-name matching, not fuzzy ──────────────────────────────────────
 * The catalogue is full of near-names that are NOT duplicates, and a fuzzy
 * matcher merges them enthusiastically:
 *
 *   Monte do Barao Reserva Vinho Tinto   vs  Monte do Barão Vinho Tinto
 *      → different wines (one is a Reserva) that share a producer
 *   Monte do Barao Colheita ... Vinho Tinto vs ... Vinho Branco
 *      → red vs white, deliberately distinct rows
 *
 * So the identity key is the ENTIRE name, accent-folded and punctuation-
 * stripped, plus volume. "Vinho Tinto" and "Vinho Branco" normalise to
 * different strings and stay apart; "Perdigoes" and "Perdigões" normalise to
 * the same one and collapse. Volume is part of the key because the same wine in
 * 375ml and 750ml is two legitimate catalogue rows.
 *
 * Barcode collisions are reported separately: a shared barcode is a much
 * stronger identity claim than a shared name, and worth seeing even when the
 * names differ.
 */

require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Accent-fold and strip a product name down to its identity.
 * NFD splits "õ" into "o" + a combining tilde; the range below removes the mark.
 */
function normaliseName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identity key: the whole normalised name plus volume. */
function identityKey(product) {
  const volume = product.volumeMl == null ? '' : String(product.volumeMl);
  return `${normaliseName(product.name)}|${volume}`;
}

/**
 * Words that describe the DRINK TYPE and carry no distinguishing information
 * when everything else about two names matches. "Tenjaku Whisky" and "Tenjaku
 * Anime Whisky" are a known duplicate pair; "Clase Azul Reposado" and "Clase
 * Azul Reposado Tequila" likewise.
 *
 * What is deliberately NOT here, and must never be added:
 *   colour   red white rose rosé tinto branco blanc noir
 *   quality  reserva reserve superior gran special selection privee
 *   vintages any 4-digit year
 * Those are exactly what separates real products. The 2026-07-29 audit found
 * red/white pairs "dominate any name-similarity search" and are legitimately
 * distinct — treating a colour word as noise would merge a red into a white.
 */
const TYPE_NOISE = new Set([
  'tequila', 'whisky', 'whiskey', 'vodka', 'gin', 'rum', 'wine', 'champagne',
  'liqueur', 'brandy', 'cognac', 'beer', 'cider', 'sake', 'mezcal', 'bourbon',
]);

function tokensOf(name) {
  return normaliseName(name).split(' ').filter(Boolean);
}

/**
 * Word-order-insensitive key: the same tokens in any order.
 * Catches "Casamigos Reposado Tequila" vs "Casamigos Tequila Reposado".
 * Volume stays in the key for the same reason as identityKey.
 */
function tokenSetKey(product) {
  const volume = product.volumeMl == null ? '' : String(product.volumeMl);
  return `${[...new Set(tokensOf(product.name))].sort().join(' ')}|${volume}`;
}

/**
 * Is `b` just `a` plus some drink-type noise? Directional containment, used to
 * surface "X" vs "X Whisky" without claiming the two are certainly the same.
 * Returns false when the extra words carry meaning (a colour, a Reserva, a
 * vintage), which is the whole safety property.
 */
function differsOnlyByTypeNoise(a, b) {
  const setA = new Set(tokensOf(a));
  const setB = new Set(tokensOf(b));
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];

  for (const token of small) {
    if (!large.has(token)) return false; // not a subset — genuinely different names
  }
  const extra = [...large].filter((t) => !small.has(t));
  if (extra.length === 0) return false; // identical sets, handled by tokenSetKey
  return extra.every((t) => TYPE_NOISE.has(t));
}

/** Pairs whose names differ only by drink-type noise. O(n²) over a small set. */
function noiseOnlyPairs(products) {
  const pairs = [];
  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      const a = products[i];
      const b = products[j];
      const volA = a.volumeMl == null ? '' : String(a.volumeMl);
      const volB = b.volumeMl == null ? '' : String(b.volumeMl);
      if (volA !== volB) continue; // different sizes are legitimate rows
      if (differsOnlyByTypeNoise(a.name, b.name)) pairs.push({ members: [a, b] });
    }
  }
  return pairs;
}

/**
 * Which row should survive a merge.
 *
 * Ordered by how expensive the mistake is: a row with SubProducts attached has
 * tenants depending on it, so losing it costs real listings; an approved row is
 * already through review; a published one is live on the storefront and may
 * hold inbound links. Age breaks the remaining ties — the older id is the one
 * more likely to be referenced from elsewhere.
 *
 * This is a SUGGESTION for a human to confirm, not a decision.
 */
function suggestKeeper(candidates) {
  return [...candidates].sort((a, b) => {
    if (b.subProductCount !== a.subProductCount) return b.subProductCount - a.subProductCount;
    const approved = (p) => (p.status === 'approved' ? 1 : 0);
    if (approved(b) !== approved(a)) return approved(b) - approved(a);
    const published = (p) => (p.isPublished ? 1 : 0);
    if (published(b) !== published(a)) return published(b) - published(a);
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  })[0];
}

/** Group products by a key, keeping only the groups with more than one member. */
function collisionsBy(products, keyFn) {
  const groups = new Map();
  for (const p of products) {
    const key = keyFn(p);
    if (!key || key.endsWith('|') === false && !key.trim()) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({ key, members }));
}

async function main() {
  const asJson = process.argv.includes('--json');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const db = mongoose.connection.db;
  const products = await db
    .collection('products')
    .find({}, { projection: { name: 1, volumeMl: 1, status: 1, isPublished: 1, barcode: 1, brand: 1, createdAt: 1 } })
    .toArray();

  // One grouped count rather than a query per product.
  const counts = await db
    .collection('subproducts')
    .aggregate([{ $group: { _id: '$product', n: { $sum: 1 }, tenants: { $addToSet: '$tenant' } } }])
    .toArray();
  const byProduct = new Map(counts.map((c) => [String(c._id), c]));

  const enriched = products.map((p) => {
    const c = byProduct.get(String(p._id));
    return {
      _id: String(p._id),
      name: p.name,
      volumeMl: p.volumeMl ?? null,
      status: p.status,
      isPublished: !!p.isPublished,
      barcode: p.barcode || null,
      createdAt: p.createdAt || null,
      subProductCount: c ? c.n : 0,
      tenantCount: c ? c.tenants.filter(Boolean).length : 0,
    };
  });

  const nameGroups = collisionsBy(enriched, identityKey).map((g) => ({
    ...g,
    keeper: suggestKeeper(g.members)._id,
  }));

  const barcodeGroups = collisionsBy(
    enriched.filter((p) => p.barcode),
    (p) => `barcode:${String(p.barcode).trim()}`,
  ).map((g) => ({ ...g, keeper: suggestKeeper(g.members)._id }));

  // Same tokens, different order. Exclude anything the exact pass already
  // caught so a pair is not reported twice.
  const exactKeys = new Set(nameGroups.map((g) => g.key));
  const reorderGroups = collisionsBy(enriched, tokenSetKey)
    .filter((g) => !g.members.every((m) => exactKeys.has(identityKey(m))))
    .map((g) => ({ ...g, keeper: suggestKeeper(g.members)._id }));

  const noiseGroups = noiseOnlyPairs(enriched).map((g) => ({
    key: `${g.members[0].name}  ~=  ${g.members[1].name}`,
    ...g,
    keeper: suggestKeeper(g.members)._id,
  }));

  if (asJson) {
    console.log(JSON.stringify({ nameGroups, reorderGroups, noiseGroups, barcodeGroups }, null, 2));
  } else {
    report('CONFIRMED — same normalised name + volume', nameGroups);
    report('CONFIRMED — same barcode (names may differ)', barcodeGroups);
    report('LIKELY — same words, different order', reorderGroups);
    report('REVIEW — differ only by a drink-type word', noiseGroups);
    console.log(`\nScanned ${enriched.length} products.`);
    console.log(`  exact name+volume collisions: ${nameGroups.length} group(s), ${nameGroups.reduce((n, g) => n + g.members.length - 1, 0)} redundant row(s)`);
    console.log(`  barcode collisions:           ${barcodeGroups.length} group(s)`);
    console.log(`  word-order collisions:        ${reorderGroups.length} group(s)`);
    console.log(`  type-word-only differences:   ${noiseGroups.length} pair(s)`);
    console.log('\nNo changes were made. This script cannot write.');
    console.log('To merge a confirmed pair, use the existing tool:');
    console.log('  FROM_SLUG=<loser> TO_SLUG=<keeper> DRY_RUN=true node scripts/merge-product-sizes.js');
  }

  await mongoose.disconnect();
}

function report(title, groups) {
  console.log(`\n=== ${title} — ${groups.length} group(s) ===`);
  for (const g of groups) {
    console.log(`\n  [${g.key}]`);
    for (const m of g.members) {
      const mark = m._id === g.keeper ? 'KEEP?' : '  dup';
      console.log(
        `   ${mark} ${m._id}  ${String(m.status).padEnd(9)} pub=${String(m.isPublished).padEnd(5)}` +
        ` subs=${String(m.subProductCount).padStart(3)} tenants=${m.tenantCount}  ${m.name}`,
      );
    }
  }
}

module.exports = { normaliseName, identityKey, suggestKeeper, collisionsBy, tokenSetKey, differsOnlyByTypeNoise, noiseOnlyPairs };

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
