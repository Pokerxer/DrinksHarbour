#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// What GET /api/erm/status actually costs, per tenant, with and without the
// usage cache.
//
// WHY. The admin's root layout fetches that endpoint server-side on EVERY
// render so it can decide whether to draw the read-only banner — which for a
// healthy tenant draws nothing. The question "is that a real cost?" was being
// answered by reasoning; this answers it by timing.
//
//   node scripts/measureErmStatusCost.js
//   node scripts/measureErmStatusCost.js --runs=20
//
// Read-only. It runs counts; it writes nothing.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const mongoose = require('mongoose');

const RUNS = (() => {
  const arg = process.argv.find((a) => a.startsWith('--runs='));
  const n = arg ? Number(arg.split('=')[1]) : 10;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
})();

function ms(hrDelta) {
  return Number((hrDelta / 1e6).toFixed(2));
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return { min: sorted[0], p50: at(50), p95: at(95), max: sorted[sorted.length - 1], mean: Number(mean.toFixed(2)) };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Run this where the server\'s env is.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const dbName = mongoose.connection.name;
  const host = mongoose.connection.host;

  const Tenant = require('../models/Tenant');
  const { countUsage, getUsage, clearUsageCache, USAGE_TTL_MS } = require('../services/ermUsage.service');
  const { countedShops } = require('../config/erm-plans');

  const tenants = await Tenant.find({}).select('_id slug plan posSettings.shops').lean();

  console.log(`\nGET /api/erm/status usage cost — ${host} / ${dbName}`);
  console.log(`${tenants.length} tenant(s), ${RUNS} run(s) each, cache TTL ${USAGE_TTL_MS} ms\n`);

  if (tenants.length === 0) {
    console.log('  No tenants. Nothing to measure.');
    await mongoose.disconnect();
    return;
  }

  for (const t of tenants) {
    const uncached = [];
    const cached = [];

    // Uncached: the three countDocuments, every time — what the endpoint did
    // before the cache existed, and what it still does on a cold entry.
    for (let i = 0; i < RUNS; i++) {
      const start = process.hrtime.bigint();
      await countUsage(t._id);
      uncached.push(ms(Number(process.hrtime.bigint() - start)));
    }

    // Cached: first call warms it, the rest are hits. Measured through the same
    // getUsage the controller calls, so this is the real path.
    clearUsageCache();
    for (let i = 0; i < RUNS; i++) {
      const start = process.hrtime.bigint();
      await getUsage(t._id);
      cached.push(ms(Number(process.hrtime.bigint() - start)));
    }
    const warm = summarise(cached.slice(1));
    const cold = summarise(uncached);

    const counts = await countUsage(t._id);
    console.log(`  ${t.slug} (${t.plan})`);
    console.log(`    rows: ${counts.skus} SKUs, ${counts.staff} staff, ${counts.warehouses} warehouses, ${countedShops(t)} shops`);
    console.log(`    uncached (3 countDocuments)  p50 ${cold.p50} ms   p95 ${cold.p95} ms   mean ${cold.mean} ms`);
    console.log(`    cache hit                    p50 ${warm.p50} ms   p95 ${warm.p95} ms   mean ${warm.mean} ms`);
    const saved = cold.mean - warm.mean;
    console.log(`    saved per page render        ~${saved.toFixed(2)} ms  (${((saved / cold.mean) * 100).toFixed(1)}%)\n`);
  }

  console.log('  Note: shops are counted from the tenant document already in memory,');
  console.log('  so they cost nothing and are not cached.\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
