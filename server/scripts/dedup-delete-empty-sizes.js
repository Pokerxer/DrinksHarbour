/**
 * dedup-delete-empty-sizes.js
 *
 * One-shot migration: delete duplicate central Products that carry only
 * empty-sizes SubProducts, where another Product doc with the SAME name
 * already exists with a properly sized SubProduct. The empty-sizes
 * SubProducts are deleted along with their orphaned Product docs.
 *
 * Special case (Option B): "Tomatin 18 Year Oloroso Sherry Cask" is the
 * only group where BOTH Product docs are `approved`. Before deleting the
 * doomed (empty-sizes) Product, its richer metadata (abv, volumeMl,
 * originCountry, subCategory) and clean slug are merged into the kept
 * Product so no catalog data is lost.
 *
 * Modes:
 *   --dry-run (default) — prints every planned mutation, writes nothing
 *   --apply              — executes per-group transaction; rollback on error
 *
 * Idempotent: safe to re-run; skips already-deleted IDs.
 *
 * Usage:
 *   node scripts/dedup-delete-empty-sizes.js            # dry-run
 *   node scripts/dedup-delete-empty-sizes.js --apply    # execute
 */

const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema;

const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const AuditLog = require('../models/AuditLog');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour';

// System actor for AuditLog entries (no human user driving this migration)
const SYSTEM_ACTOR = {
  actorRole: 'system',
  actorEmail: 'system@drinksharbour.com',
};

const isApply = process.argv.includes('--apply');
const mode = isApply ? 'APPLY' : 'DRY-RUN';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ts() {
  return new Date().toISOString();
}

function obj(id) {
  return new mongoose.Types.ObjectId(String(id));
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1 — compute the doomed set live
// ────────────────────────────────────────────────────────────────────────────
async function computeDoomedSet(db) {
  const subcoll = db.collection('subproducts');
  const prodcoll = db.collection('products');

  // per-Product size presence
  const perProduct = await subcoll.aggregate([
    { $match: { sizes: { $exists: true } } },
    {
      $project: {
        _id: 0,
        product: 1,
        isEmpty: { $eq: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
      },
    },
    {
      $group: {
        _id: '$product',
        hasSized: { $max: { $cond: [{ $not: '$isEmpty' }, 1, 0] } },
        hasEmpty: { $max: { $cond: ['$isEmpty', 1, 0] } },
      },
    },
  ]).toArray();
  const map = new Map();
  for (const r of perProduct) map.set(String(r._id), r);

  // duplicate-name Product groups
  const dupGroups = await prodcoll.aggregate([
    { $group: { _id: '$name', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 }, _id: { $ne: null } } },
  ]).toArray();

  // For each mixed group (sized doc + empty doc), the "doomed" Product docs
  // are those whose SubProducts are ALL empty-sizes (hasEmpty && !hasSized).
  const groups = [];
  for (const g of dupGroups) {
    let gSized = false;
    let gEmpty = false;
    for (const id of g.ids) {
      const r = map.get(String(id));
      if (r?.hasSized) gSized = true;
      if (r?.hasEmpty) gEmpty = true;
    }
    if (!(gSized && gEmpty)) continue; // not a mixed group

    const doomedDocs = [];
    const keptDocs = [];
    for (const id of g.ids) {
      const r = map.get(String(id));
      if (r && r.hasEmpty && !r.hasSized) {
        doomedDocs.push(id);
      } else {
        keptDocs.push(id);
      }
    }
    if (doomedDocs.length === 0 || keptDocs.length === 0) continue;

    // fetch the doomed SubProducts under each doomed Product
    const doomedSubs = [];
    for (const id of doomedDocs) {
      const subs = await subcoll
        .find({ product: obj(id) }, { projection: { _id: 1, sku: 1, tenant: 1 } })
        .toArray();
      for (const s of subs) {
        doomedSubs.push({
          _id: String(s._id),
          sku: s.sku,
          tenant: String(s.tenant),
          product: id,
        });
      }
    }

    // canonical kept Product = approved first, then earliest createdAt
    const keptDocsData = await prodcoll
      .find({ _id: { $in: keptDocs.map(obj) } })
      .toArray();
    keptDocsData.sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (b.status === 'approved' && a.status !== 'approved') return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    const canonical = keptDocsData[0];

    groups.push({
      name: g._id,
      doomedProductIds: doomedDocs,
      doomedSubProducts: doomedSubs,
      keptProductIds: keptDocs.map(String),
      canonicalKeptId: String(canonical._id),
      canonicalStatus: canonical.status,
    });
  }

  return groups;
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2 — Option B: merge metadata from doomed approved product into kept
// Only fires for the Tomatin 18 Oloroso case (both docs approved).
// ────────────────────────────────────────────────────────────────────────────
const METADATA_FIELDS_TO_MERGE = [
  'abv',
  'volumeMl',
  'proof',
  'originCountry',
  'region',
  'producer',
  'subCategory',
  'type',
  'subType',
  'shortDescription',
  'description',
  'tastingNotes',
  'barcode',
  'gtin',
];

async function buildMetadataMerge(db, group) {
  const prodcoll = db.collection('products');

  // Only merge when at least one doomed doc is approved AND the canonical
  // is also approved (i.e. an approved-vs-approved duplicate group).
  const doomedDocs = await prodcoll
    .find({ _id: { $in: group.doomedProductIds.map(obj) } })
    .toArray();
  const canonical = await prodcoll.findOne({ _id: obj(group.canonicalKeptId) });

  const doomedApproved = doomedDocs.find((d) => d.status === 'approved');
  if (!doomedApproved || !canonical || canonical.status !== 'approved') {
    return null; // no Option-B merge needed for this group
  }

  const mergeUpdate = {};
  const slugOverride = doomedApproved.slug;

  // copy any populated field from doomed that is missing/null/empty on canonical
  for (const f of METADATA_FIELDS_TO_MERGE) {
    const dv = doomedApproved[f];
    const cv = canonical[f];
    const dHas =
      dv !== undefined && dv !== null && dv !== '' &&
      !(Array.isArray(dv) && dv.length === 0) &&
      !(dv && typeof dv === 'object' && !Array.isArray(dv) && Object.keys(dv).length === 0);
    const cMissing =
      cv === undefined || cv === null || cv === '' ||
      !(Array.isArray(cv) && cv.length > 0) && Array.isArray(cv) && cv.length === 0 ||
      (cv && typeof cv === 'object' && !Array.isArray(cv) && Object.keys(cv).length === 0);
    if (dHas && (cv === undefined || cv === null || cv === '' || cMissing)) {
      mergeUpdate[f] = dv;
    }
  }

  // move the clean slug over (doomed has the clean one, canonical has the
  // timestamp-suffixed one). Verify the canonical slug is actually suffixed
  // so we don't accidentally clobber a perfectly clean canonical slug.
  if (
    slugOverride &&
    canonical.slug &&
    canonical.slug !== slugOverride &&
    /-\d{10,}$/.test(canonical.slug) // ends in a long numeric timestamp suffix
  ) {
    mergeUpdate.slug = slugOverride;
  }

  return {
    doomedApprovedId: String(doomedApproved._id),
    canonicalId: String(canonical._id),
    mergeUpdate,
    doomedSnapshot: doomedApproved,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3 — execute one group inside a transaction (apply mode only)
// ────────────────────────────────────────────────────────────────────────────
async function applyGroup(db, session, group, mergePlan) {
  const subcoll = db.collection('subproducts');
  const prodcoll = db.collection('products');
  const auditcoll = db.collection('auditlogs');

  const doomedSubIds = group.doomedSubProducts.map((s) => obj(s._id));
  const doomedProdIds = group.doomedProductIds.map(obj);

  // 1) Hard delete doomed SubProducts FIRST (frees any sub-level refs)
  if (doomedSubIds.length) {
    await subcoll.deleteMany({ _id: { $in: doomedSubIds } }, { session });
  }

  // 2) Hard delete doomed Product docs SECOND (frees the slug unique index
  //    so the Option-B metadata merge can move that clean slug onto the canonical)
  if (doomedProdIds.length) {
    await prodcoll.deleteMany({ _id: { $in: doomedProdIds } }, { session });
  }

  // 3) Option B metadata merge LAST (now the doomed doc's slug is free)
  if (mergePlan && Object.keys(mergePlan.mergeUpdate).length > 0) {
    await prodcoll.updateOne(
      { _id: obj(mergePlan.canonicalId) },
      { $set: mergePlan.mergeUpdate },
      { session },
    );
  }

  // 4) AuditLog entry
  await auditcoll.insertOne(
    {
      actorRole: SYSTEM_ACTOR.actorRole,
      actorEmail: SYSTEM_ACTOR.actorEmail,
      action: 'DEDUP_DELETE_EMPTY_SIZES',
      actionCategory: 'delete',
      targetType: 'Product',
      targetId: obj(group.canonicalKeptId),
      targetTenantId: group.doomedSubProducts[0]
        ? obj(group.doomedSubProducts[0].tenant)
        : null,
      justification:
        'Removed duplicate central Product(s) that carried only empty-sizes SubProducts; ' +
        'a same-named Product with sized SubProducts already exists in the catalog.',
      changes: {
        before: {
          name: group.name,
          doomedProductIds: group.doomedProductIds,
          doomedSubProductIds: group.doomedSubProducts.map((s) => s._id),
          doomedSubProductSkus: group.doomedSubProducts.map((s) => s.sku),
        },
        after: {
          canonicalKeptId: group.canonicalKeptId,
          metadataMergeApplied:
            mergePlan && Object.keys(mergePlan.mergeUpdate).length > 0
              ? Object.keys(mergePlan.mergeUpdate)
              : null,
        },
      },
      result: 'success',
      timestamp: new Date(),
    },
    { session },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[${ts()}] dedup-delete-empty-sizes — MODE: ${mode}\n`);

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`[${ts()}] Connected to MongoDB.\n`);

  const db = mongoose.connection.db;

  const groups = await computeDoomedSet(db);
  console.log(
    `[${ts()}] Computed ${groups.length} mixed duplicate-name groups ` +
    `(${groups.reduce((n, g) => n + g.doomedProductIds.length, 0)} doomed Products, ` +
    `${groups.reduce((n, g) => n + g.doomedSubProducts.length, 0)} doomed SubProducts).\n`,
  );

  if (groups.length === 0) {
    console.log(`[${ts()}] Nothing to do. Exiting.`);
    await mongoose.disconnect();
    return;
  }

  // Pre-compute Option-B merge plans for all groups
  const mergePlans = [];
  for (const g of groups) {
    const mp = await buildMetadataMerge(db, g);
    mergePlans.push(mp);
  }

  // ── Dry-run report ───────────────────────────────────────────────────────
  console.log('─'.repeat(80));
  console.log('PLANNED MUTATIONS:');
  console.log('─'.repeat(80));
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const mp = mergePlans[i];
    console.log(`\nGroup ${i + 1}/${groups.length}: "${g.name}"`);
    console.log(`  canonical kept Product:  ${g.canonicalKeptId} (${g.canonicalStatus})`);
    console.log(`  doomed Product(s):       ${g.doomedProductIds.join(', ')}`);
    console.log(
      `  doomed SubProduct(s):     ${g.doomedSubProducts.length} — ` +
      g.doomedSubProducts.map((s) => `sku=${s.sku} subId=${s._id}`).join(' | '),
    );
    if (mp && Object.keys(mp.mergeUpdate).length > 0) {
      console.log(
        `  Option-B metadata merge → ${mp.canonicalId}: ` +
        `will set fields ${Object.keys(mp.mergeUpdate).join(', ')}`,
      );
    } else if (mp) {
      console.log(`  Option-B merge: no fields to copy (canonical already populated)`);
    } else {
      console.log(`  Option-B merge: N/A (doomed doc not approved)`);
    }
  }
  console.log('\n' + '─'.repeat(80));
  console.log(
    `TOTALS: ${groups.length} groups | ` +
    `${groups.reduce((n, g) => n + g.doomedProductIds.length, 0)} Products to delete | ` +
    `${groups.reduce((n, g) => n + g.doomedSubProducts.length, 0)} SubProducts to delete | ` +
    `${mergePlans.filter((m) => m && Object.keys(m.mergeUpdate).length > 0).length} metadata merges`,
  );
  console.log('─'.repeat(80) + '\n');

  if (!isApply) {
    console.log(`[${ts()}] DRY-RUN complete. No data was modified.`);
    console.log(`[${ts()}] Re-run with --apply to execute these mutations.`);
    await mongoose.disconnect();
    return;
  }

  // ── Apply mode ───────────────────────────────────────────────────────────
  console.log(`[${ts()}] APPLYING mutations (per-group transactions)...\n`);

  let applied = 0;
  let failed = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const mp = mergePlans[i];
    try {
      await mongoose.connection.transaction(async (session) => {
        await applyGroup(db, session, g, mp);
      });
      applied++;
      console.log(
        `[${ts()}] ✓ Group ${i + 1}/${groups.length} applied: "${g.name}" ` +
        `(${g.doomedProductIds.length} Products, ${g.doomedSubProducts.length} SubProducts deleted)`,
      );
    } catch (err) {
      failed++;
      console.error(
        `[${ts()}] ✗ Group ${i + 1}/${groups.length} FAILED: "${g.name}" — ${err.message}`,
      );
      // continue with the next group; failed group is rolled back by the transaction
    }
  }

  console.log(`\n[${ts()}] APPLY complete. ${applied} groups applied, ${failed} failed.`);

  // ── Post-verification ────────────────────────────────────────────────────
  console.log(`\n[${ts()}] Post-verification (read-only)...\n`);
  const subTotal = await db.collection('subproducts').countDocuments();
  const emptySharedName = await computeDoomedSet(db);
  console.log(`  SubProducts total now:      ${subTotal}`);
  console.log(`  Remaining mixed dup groups: ${emptySharedName.length}`);
  if (emptySharedName.length > 0) {
    console.log('  Remaining groups:');
    for (const g of emptySharedName) console.log(`    - "${g.name}"`);
  }

  await mongoose.disconnect();
  console.log(`\n[${ts()}] Done.\n`);
}

main().catch((e) => {
  console.error(`[${ts()}] FATAL:`, e);
  process.exit(1);
});