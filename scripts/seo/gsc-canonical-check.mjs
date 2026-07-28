#!/usr/bin/env node
/**
 * gsc-canonical-check.mjs
 *
 * Answers one question: for a pair of competing URL forms, which one actually
 * earns impressions in Google Search?
 *
 * Two canonical decisions were made on internal-link and content evidence alone,
 * because no Search Console access was available at the time:
 *
 *   536b351c  /categories/<slug>   -> canonicalized onto /shop?category=<slug>
 *   4a46f18b  /shop?brand=<slug>   -> canonicalized onto /brands/<slug>
 *
 * Note those point in OPPOSITE directions — that is deliberate, and it is
 * exactly why real impression data is worth checking. This script reads a
 * Search Console Pages export and reports, per pair, how clicks, impressions
 * and average position are split between the two forms, then states whether the
 * shipped decision is supported, contradicted, or simply unevidenced.
 *
 * Usage:
 *   node scripts/seo/gsc-canonical-check.mjs <Pages.csv> [more.csv ...]
 *   node scripts/seo/gsc-canonical-check.mjs --help
 *
 * See scripts/seo/README.md for how to produce the CSV.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── The pairs under test ──────────────────────────────────────────────────────
// `winner` is the form the shipped canonical points AT. If the loser out-earns
// the winner by a wide margin, the decision moved rankings onto the weaker URL
// and is worth revisiting.
const PAIRS = [
  {
    name: 'Brands',
    decision: '4a46f18b — /shop?brand= canonicalizes onto /brands/<slug>',
    winner: { label: '/brands/<slug>', test: (u) => /\/brands\/[^/?#]+/.test(u) },
    loser: { label: '/shop?brand=', test: (u) => /\/shop\?[^#]*\bbrand=/.test(u) },
  },
  {
    name: 'Categories',
    decision: '536b351c — /categories/<slug> canonicalizes onto /shop?category=',
    winner: { label: '/shop?category=', test: (u) => /\/shop\?[^#]*\bcategory=/.test(u) },
    loser: { label: '/categories/<slug>', test: (u) => /\/categories\/[^/?#]+/.test(u) },
  },
];

// ── CSV parsing ───────────────────────────────────────────────────────────────
// Search Console exports are comma-separated with quoted fields; numbers may
// carry thousands separators and CTR carries a '%'. Small hand-rolled parser —
// this reads one known file format, a dependency would be overkill.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Column names differ by locale and by which report was exported ("Top pages",
// "Page", "Address"). Match on substring rather than an exact header string.
function findColumns(header) {
  const lower = header.map((h) => h.toLowerCase().trim());
  const find = (...needles) =>
    lower.findIndex((h) => needles.some((n) => h.includes(n)));
  return {
    url: find('page', 'address', 'url'),
    clicks: find('click'),
    impressions: find('impression'),
    position: find('position'),
  };
}

function readPages(files) {
  const pages = [];
  for (const file of files) {
    const rows = parseCsv(fs.readFileSync(file, 'utf8'));
    if (!rows.length) {
      console.error(`  ! ${path.basename(file)}: empty, skipped`);
      continue;
    }
    const cols = findColumns(rows[0]);
    if (cols.url === -1 || cols.impressions === -1) {
      console.error(
        `  ! ${path.basename(file)}: no page/impressions columns (header: ${rows[0].join(', ')}) — is this the Pages report?`,
      );
      continue;
    }
    let n = 0;
    for (const row of rows.slice(1)) {
      const url = (row[cols.url] || '').trim();
      if (!url.startsWith('http')) continue;
      pages.push({
        url,
        clicks: cols.clicks === -1 ? 0 : num(row[cols.clicks]),
        impressions: num(row[cols.impressions]),
        position: cols.position === -1 ? 0 : num(row[cols.position]),
      });
      n++;
    }
    console.error(`  · ${path.basename(file)}: ${n} page rows`);
  }
  return pages;
}

// ── Reporting ─────────────────────────────────────────────────────────────────
function summarise(pages, side) {
  const hits = pages.filter((p) => side.test(p.url));
  const impressions = hits.reduce((s, p) => s + p.impressions, 0);
  const clicks = hits.reduce((s, p) => s + p.clicks, 0);
  // Position is a per-URL average; weight by impressions so a single
  // 1-impression outlier at position 3 can't outvote the body of the data.
  const weighted = hits.reduce((s, p) => s + p.position * p.impressions, 0);
  return {
    urls: hits.length,
    clicks,
    impressions,
    position: impressions ? weighted / impressions : 0,
    top: [...hits].sort((a, b) => b.impressions - a.impressions).slice(0, 5),
  };
}

const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '—');

function verdict(winner, loser) {
  const total = winner.impressions + loser.impressions;
  if (total === 0) {
    return {
      line: 'UNEVIDENCED — neither form has impressions in this export.',
      detail:
        'Either these pages are not indexed yet, the date range predates their launch, or the export was truncated before reaching them. This says nothing about the decision.',
    };
  }
  const winnerShare = winner.impressions / total;
  if (winnerShare >= 0.6) {
    return {
      line: 'SUPPORTED — the canonical target already earns the majority of impressions.',
      detail: 'Consolidation reinforces the URL Google is already surfacing. No action.',
    };
  }
  if (winnerShare >= 0.35) {
    return {
      line: 'MIXED — impressions are split without a clear leader.',
      detail:
        'Consolidating either way is defensible; the internal-link and entity-content evidence remains the tiebreaker. Re-run in 4-8 weeks — the canonical should pull the split toward the target.',
    };
  }
  return {
    line: 'CONTRADICTED — the form being canonicalized AWAY earns most of the impressions.',
    detail:
      'The decision is moving rankings onto the weaker URL. Weigh that against the internal-link evidence, and consider reversing (each commit message records its reversal steps).',
  };
}

function report(pages) {
  for (const pair of PAIRS) {
    const w = summarise(pages, pair.winner);
    const l = summarise(pages, pair.loser);
    const total = w.impressions + l.impressions;

    console.log(`\n${'─'.repeat(72)}`);
    console.log(`${pair.name}`);
    console.log(`  decision: ${pair.decision}`);
    console.log('');
    console.log(`  ${'form'.padEnd(22)} ${'URLs'.padStart(5)} ${'clicks'.padStart(8)} ${'impr'.padStart(9)} ${'share'.padStart(7)} ${'avg pos'.padStart(8)}`);
    for (const [side, s] of [[pair.winner, w], [pair.loser, l]]) {
      const tag = side === pair.winner ? '→ canonical target' : '  canonicalized away';
      console.log(
        `  ${side.label.padEnd(22)} ${String(s.urls).padStart(5)} ${String(s.clicks).padStart(8)} ${String(s.impressions).padStart(9)} ${pct(s.impressions, total).padStart(7)} ${(s.position ? s.position.toFixed(1) : '—').padStart(8)}   ${tag}`,
      );
    }

    const v = verdict(w, l);
    console.log(`\n  ${v.line}`);
    console.log(`  ${v.detail}`);

    for (const [side, s] of [[pair.winner, w], [pair.loser, l]]) {
      if (!s.top.length) continue;
      console.log(`\n  top ${side.label} by impressions:`);
      for (const p of s.top) {
        console.log(`    ${String(p.impressions).padStart(7)} impr  pos ${String(p.position.toFixed(1)).padStart(5)}  ${p.url}`);
      }
    }
  }
  console.log(`\n${'─'.repeat(72)}`);
}

// ── Entry ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`
Compare competing URL forms using a Search Console Pages export.

  node scripts/seo/gsc-canonical-check.mjs <Pages.csv> [more.csv ...]

Getting the CSV — Search Console > Performance > Search results:
  1. Set the date range to the last 3 months (or 12 for a slower-moving read).
  2. Do NOT filter. Open the "Pages" tab.
  3. Export > Download CSV. Use the Pages.csv from the zip.

The export caps at 1000 rows. If the report warns that it truncated, take two
exports instead — one with a "URL contains /brands/" filter and one with
"URL contains brand=" — and pass both files; they are merged.

Reads only. Nothing is written and no credentials are needed.
`.trim());
  process.exit(0);
}

const files = args.filter((a) => !a.startsWith('-'));
const missing = files.filter((f) => !fs.existsSync(f));
if (missing.length) {
  console.error(`Not found: ${missing.join(', ')}`);
  process.exit(1);
}

console.error('Reading:');
const pages = readPages(files);
if (!pages.length) {
  console.error('\nNo page rows parsed. Is this the Pages report rather than Queries?');
  process.exit(1);
}
console.error(`\n${pages.length} total page rows.`);

// GSC truncates its export at 1000 rows; past that, absent impressions may just
// be absent data, and a "CONTRADICTED" verdict could be a sampling artefact.
if (pages.length >= 999) {
  console.error(
    '! At/near the 1000-row export cap — results may be truncated. See --help for the two-export workaround.',
  );
}

report(pages);
