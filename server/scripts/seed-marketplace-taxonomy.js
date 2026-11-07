#!/usr/bin/env node
'use strict';
/**
 * Marketplace taxonomy rollout — PER-BUSINESS model (2026-11-03).
 *
 *   node scripts/seed-marketplace-taxonomy.js                     # read-only preview (all verticals)
 *   node scripts/seed-marketplace-taxonomy.js --only=electronics  # one business only
 *   node scripts/seed-marketplace-taxonomy.js --only=electronics --apply
 *   node scripts/seed-marketplace-taxonomy.js --backfill-industry [--apply]
 *   node scripts/seed-marketplace-taxonomy.js --rollback [--apply]           # undo seeded docs
 *
 * Applies constants/marketplaceTaxonomy.js to a reviewed database,
 * IDEMPOTENTLY, ONE BUSINESS VERTICAL AT A TIME (user direction
 * 2026-11-03): each vertical owns its own categories → subcategories tree;
 * a tenant sees only the taxonomy of its own vertical(s).
 *
 * --only=<vertical-slug> restricts EVERY operation of the run to one
 * vertical (the per-business workflow). The registry is the single source
 * of vocabulary; slugs derive from names.
 *
 * Idempotency: existing docs are skipped, never modified; an existing slug
 * with a different name fails loudly (human decision, never a silent merge).
 *
 * --backfill-industry: writes the vertical's industry onto EXISTING
 * registry-matching docs ONLY when the field is absent (adoption of legacy
 * docs, e.g. home-living/kitchen-and-dining); never overwrites/renames.
 *
 * --rollback: undoes what this script seeded — deletes ONLY documents
 * matching the registry slug+name AND the seed markers (status 'active' +
 * displayOrder 500) AND with zero Product references; $unsets the
 * backfilled industry on adopted legacy docs (only when the value equals
 * the registry's own). Never touches legacy documents or product-linked
 * taxonomy.
 *
 * READ-ONLY by default. --apply/--rollback are operator actions on an
 * explicit MONGODB_URI; never runs at import time, never inside tests,
 * never on request paths.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const taxonomy = require('../constants/marketplaceTaxonomy');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const backfillIndustry = argv.includes('--backfill-industry');
  const rollback = argv.includes('--rollback');
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.split('=')[1] : null;
  const unknown = argv.filter((a) => a.startsWith('--') && !['--apply', '--backfill-industry', '--rollback'].includes(a) && !a.startsWith('--only='));
  if (unknown.length) throw new Error(`Unknown argument(s) ${JSON.stringify(unknown)} — supported: --apply, --backfill-industry, --rollback, --only=<vertical-slug> (read-only preview when no mutating flag)`);
  if (rollback && (backfillIndustry || only)) throw new Error('--rollback runs alone (it fully reverses seeded docs).');
  const verticals = only
    ? taxonomy.CATEGORY_HORIZONTALS.filter((v) => v.slug === only)
    : [...taxonomy.CATEGORY_HORIZONTALS];
  if (only && verticals.length === 0) throw new Error(`--only=${only} matches no registry vertical. Registered: ${taxonomy.CATEGORY_HORIZONTALS.map((v) => v.slug).join(', ')}`);
  if (only) console.log(`🔒 --only=${only}: this run touches ONLY the "${verticals[0].name}" vertical.`);

  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    const db = mongoose.connection.db;
    const catDocs = db.collection('categories');
    const subDocs = db.collection('subcategories');
    const productDocs = db.collection('products');

    // ── ROLLBACK ────────────────────────────────────────────────────────────
    if (rollback) {
      // Two target families, both marker-checked (status 'active' +
      // displayOrder 500 = docs THIS script created; legacy docs are
      // status 'published' and never match):
      // (a) the legacy BUNDLED seed (2026-11-02): one root category per
      //     vertical + its 44 subs — those root names/slugs left the registry
      //     when it was restructured to the per-business tree, so they are
      //     targeted EXPLICITLY here (slug+name+marker);
      // (b) the current per-business tree seeds (registry-driven).
      const LEGACY_BUNDLED_ROOTS = [
        { slug: 'electronics', name: 'Electronics & Tech' },
        { slug: 'fashion', name: 'Fashion' },
        { slug: 'beauty', name: 'Beauty & Personal Care' },
        // The bundled seed's Home root used the pre-adoption slug 'home'.
        { slug: 'home', name: 'Home & Living' },
        { slug: 'food-service', name: 'Food Service & Venue' },
      ];
      // Bundled-seed subs that were parented to the ADOPTED legacy
      // `home-living` category (per 2026-11-03 adoption they are no longer
      // registry subcategories, but the bundled seed DID create them).
      // Marker-checked exactly like every other rollback deletion.
      const LEGACY_BUNDLED_ORPHAN_SUBS = [
        'cookware-and-bakeware', 'home-decor', 'furniture',
        'bedding-and-textiles', 'storage-and-organisation',
        'cleaning-and-household', 'small-appliances',
      ];
      // Docs ADOPTED from legacy (never deleted — only their backfilled
      // industry is unset, and only when it still equals the registry value):
      const ADOPTED_DOCS = [
        { docs: catDocs, slug: 'home-living', industry: 'home', label: 'Home & Living (home-living)' },
        { docs: subDocs, slug: 'kitchen-and-dining', industry: 'home', label: 'Kitchen & Dining (kitchen-and-dining)' },
      ];

      const deletions = [];
      const seen = new Set();
      const planDelete = (docs, filter, label, extra = {}) => {
        const key = `${docs === catDocs ? 'c' : 's'}:${filter._id}`;
        if (seen.has(key)) return;
        seen.add(key);
        deletions.push({ docs, filter, label, ...extra });
      };
      const planDeletionsForRoot = async (rootSlug, rootName) => {
        const cat = await catDocs.findOne({ slug: rootSlug });
        if (!cat || cat.name !== rootName) return;
        const isSeedDoc = cat.status === 'active' && cat.displayOrder === 500;
        if (!isSeedDoc) return; // legacy/adopted category — never deleted
        const children = await subDocs.find({ parent: cat._id }).toArray();
        for (const child of children) {
          const childLinked = await productDocs.countDocuments({ subCategory: child._id });
          if (childLinked > 0) throw new Error(`Subcategory "${child.slug}" has ${childLinked} product(s) — refusing rollback.`);
          planDelete(subDocs, { _id: child._id }, `${cat.slug}/${child.slug}`);
        }
        planDelete(catDocs, { _id: cat._id }, cat.slug);
      };

      for (const root of LEGACY_BUNDLED_ROOTS) {
        await planDeletionsForRoot(root.slug, root.name);
      }
      for (const subSlug of LEGACY_BUNDLED_ORPHAN_SUBS) {
        const sub = await subDocs.findOne({ slug: subSlug });
        if (!sub) continue;
        const isSeedDoc = sub.status === 'active' && sub.displayOrder === 500;
        if (!isSeedDoc) continue; // adopted legacy sub — excluded
        const childLinked = await productDocs.countDocuments({ subCategory: sub._id });
        if (childLinked > 0) throw new Error(`Subcategory "${sub.slug}" has ${childLinked} product(s) — refusing rollback.`);
        deletions.push({ docs: subDocs, filter: { _id: sub._id }, label: `(orphan seeded sub) home-living/${sub.slug}` });
      }
      for (const vertical of verticals) {
        await planDeletionsForRoot(vertical.slug, vertical.name);
        for (const category of vertical.categories) {
          await planDeletionsForRoot(taxonomy.slugify(category.name), category.name);
          // Partial-run strays: when the slug scheme renamed a duplicated
          // subcategory (e.g. Women's "Trousers & Jeans" → womens-trousers-
          // and-jeans), an interrupted earlier apply may have left the bare
          // slug under the same parent. Remove it (marker-checked), or the
          // category ends up with both forms.
          const registrySubs = taxonomy.subcategories.filter(
            (s) => s.verticalSlug === vertical.slug && s.parentSlug === taxonomy.slugify(category.name)
          );
          for (const sub of registrySubs) {
            const bare = taxonomy.slugify(sub.name);
            if (bare === sub.slug) continue;
            const stray = await subDocs.findOne({ slug: bare, industry: sub.industry });
            if (!stray) continue;
            const isSeedDoc = stray.status === 'active' && stray.displayOrder === 500;
            if (!isSeedDoc) continue;
            const childLinked = await productDocs.countDocuments({ subCategory: stray._id });
            if (childLinked > 0) throw new Error(`Stray subcategory "${stray.slug}" has ${childLinked} product(s) — refusing rollback.`);
            deletions.push({ docs: subDocs, filter: { _id: stray._id }, label: `(renamed-stray) ${taxonomy.slugify(category.name)}/${stray.slug}` });
          }
        }
      }
      for (const adopted of ADOPTED_DOCS) {
        const doc = await adopted.docs.findOne({ slug: adopted.slug });
        if (doc && doc.industry === adopted.industry) {
          deletions.push({ docs: adopted.docs, filter: { _id: doc._id }, unsetIndustry: true, label: `industry unset: ${adopted.label} (${adopted.industry} → legacy)` });
        }
      }

      console.log(`📋 ROLLBACK plan: ${deletions.length} operation(s).`);
      for (const d of deletions) console.log(`   ${d.label}`);
      if (!apply) {
        console.log('ℹ️  Preview only. Re-run with --apply to execute.');
        process.exitCode = deletions.length ? 2 : 0;
        return;
      }
      let done = 0;
      for (const d of deletions) {
        if (d.unsetIndustry) {
          await d.docs.updateOne(d.filter, { $unset: { industry: '' } });
        } else {
          await d.docs.deleteOne(d.filter);
        }
        done += 1;
      }
      console.log(`🏁 Rollback complete. ${done} operation(s) executed.`);
      return;
    }

    // ── Seed plan (preview by default) ──────────────────────────────────────
    let created = 0;
    const plan = [];

    for (const vertical of verticals) {
      for (const category of vertical.categories) {
        const slug = taxonomy.slugify(category.name);
        const existing = await catDocs.findOne({ slug });
        if (existing) {
          if (String(existing.name) !== category.name) {
            throw new Error(`Category slug "${slug}" already exists with a different name ("${existing.name}" ≠ "${category.name}"). Reconcile manually.`);
          }
          continue;
        }
        plan.push({ kind: 'category', verticalSlug: vertical.slug, industry: category.industry ?? vertical.industry, name: category.name, slug });
      }
    }

    const parentIds = new Map();
    for (const vertical of verticals) {
      for (const category of vertical.categories) {
        const slug = taxonomy.slugify(category.name);
        const existing = await catDocs.findOne({ slug });
        if (existing) parentIds.set(slug, existing._id);
      }
    }
    const plannedCategories = new Set(plan.filter((p) => p.kind === 'category').map((p) => p.slug));

    for (const vertical of verticals) {
      for (const category of vertical.categories) {
        const parentSlug = taxonomy.slugify(category.name);
        // Slugs come from the REGISTRY flat list (which disambiguates
        // duplicate-named subcategories — e.g. Women/Men both having
        // "Trousers & Jeans"); never recompute here.
        const registrySubs = taxonomy.subcategories.filter(
          (s) => s.verticalSlug === vertical.slug && s.parentSlug === parentSlug
        );
        for (const sub of registrySubs) {
          const parentId = parentIds.get(parentSlug);
          const existing = await subDocs.findOne({ parent: parentId, slug: sub.slug })
            ?? await subDocs.findOne({ 'parent.slug': vertical.slug, slug: sub.slug });
          if (existing) continue;
          if (!parentId && !plannedCategories.has(parentSlug)) {
            throw new Error(`Parent category "${parentSlug}" exists neither in this database nor in this run's creation plan — reconcile manually (possible legacy duplicate).`);
          }
          plan.push({ kind: 'subcategory', verticalSlug: vertical.slug, industry: sub.industry, name: sub.name, slug: sub.slug, parentSlug });
        }
      }
    }

    // ── Backfill industry (adopted legacy docs) ─────────────────────────────
    let backfillPlan = [];
    if (backfillIndustry) {
      for (const vertical of verticals) {
        for (const category of vertical.categories) {
          const slug = taxonomy.slugify(category.name);
          const existing = await catDocs.findOne({ slug });
          if (existing && existing.industry == null) {
            const industry = category.industry ?? vertical.industry;
            backfillPlan.push({ docs: catDocs, label: `${category.name} (${slug}) → ${industry}`, filter: { _id: existing._id }, industry });
          }
        }
      }
      for (const vertical of verticals) {
        for (const category of vertical.categories) {
          const parentSlug = taxonomy.slugify(category.name);
          const registrySubs = taxonomy.subcategories.filter(
            (s) => s.verticalSlug === vertical.slug && s.parentSlug === parentSlug
          );
          for (const sub of registrySubs) {
            const existing = await subDocs.findOne({ slug: sub.slug, industry: { $exists: false } })
              ?? await subDocs.findOne({ slug: sub.slug, industry: null });
            if (existing) {
              backfillPlan.push({ docs: subDocs, label: `${sub.name} (${sub.slug}) → ${sub.industry}`, filter: { _id: existing._id }, industry: sub.industry });
            }
          }
        }
      }
    }

    console.log(`📋 Plan: ${plan.length} document(s) would be created.`);
    for (const item of plan) console.log(`   ${item.kind}: ${item.name} (slug=${item.slug}, industry=${item.industry}${item.parentSlug ? `, parent=${item.parentSlug}` : ''})`);
    console.log(`📋 Industry backfill: ${backfillPlan.length} document(s) would gain an industry${backfillIndustry ? '' : ' (pass --backfill-industry to plan this step)'}.`);
    for (const item of backfillPlan) console.log(`   ${item.label}`);

    if (!apply) {
      console.log('ℹ️  Preview only. Re-run with --apply to insert the missing documents.');
      process.exitCode = (plan.length || backfillPlan.length) ? 2 : 0; // nothing-to-do exits 0
      return;
    }

    // ── Apply: categories first, then children linked to real parents ───────
    for (const item of plan.filter((p) => p.kind === 'category')) {
      await catDocs.insertOne({
        name: item.name,
        slug: item.slug,
        industry: item.industry,
        description: `${item.name} — ${item.verticalSlug} vertical`,
        displayOrder: 500,
        status: 'active',
      });
      const doc = await catDocs.findOne({ slug: item.slug });
      parentIds.set(item.slug, doc._id);
      created += 1;
      console.log(`✅ category: ${item.name} (${item.slug})`);
    }
    for (const item of plan.filter((p) => p.kind === 'subcategory')) {
      const parentId = parentIds.get(item.parentSlug);
      if (!parentId) throw new Error(`Parent "${item.parentSlug}" vanished mid-run — aborting, nothing deleted.`);
      await subDocs.insertOne({
        name: item.name,
        slug: item.slug,
        parent: parentId,
        industry: item.industry,
        displayOrder: 500,
        status: 'active',
      });
      created += 1;
      console.log(`✅ subcategory: ${item.name} (${item.parentSlug}/${item.slug})`);
    }

    for (const item of backfillPlan) {
      await item.docs.updateOne(item.filter, { $set: { industry: item.industry } });
      console.log(`✅ industry: ${item.label}`);
    }

    console.log(`🏁 Done. Created ${created} document(s), backfilled industry on ${backfillPlan.length}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(err => {
  console.error('Marketplace taxonomy rollout failed:', err.message);
  process.exitCode = 1;
});
module.exports = { main };
