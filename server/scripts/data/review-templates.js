// scripts/data/review-templates.js
//
// Review copy selection for the purchase seeder.
//
// Composition (one concern per file):
//   review-copy/families.js — (type, subType) -> copy family
//   review-copy/bodies.js   — family -> { high, mid, low } tiers of {title, comment}
//   review-copy/closers.js  — optional trailing remark about the order itself
//
// WHY THIS WAS REBUILT
// The first version had 8 families and ~26 total comments, tier-blind. Across
// 210 seeded reviews that produced only 10 distinct titles, each repeating ~20
// times with identical bodies, and — worse — 3-star reviews carrying glowing
// copy ("Rich, rounded and genuinely smooth"). It also gave a gin the same
// "warm smoky notes ... neat over a single large cube" text as an Islay malt.
//
// Now: 22 families x 3 sentiment tiers, resolved on subType first, with the
// tier chosen from the rating so the words match the score.
//
// HARD CONSTRAINT: submitProductReview rejects any comment under 10 characters
// after trim (server/controllers/product.controller.js). assertCopyValid()
// runs at require-time so a bad edit fails here, not on the 200th HTTP call.

const { resolveFamily } = require('./review-copy/families');
const { BODIES } = require('./review-copy/bodies');
const {
  NEUTRAL_CLOSERS, POSITIVE_CLOSERS, LUKEWARM_CLOSERS,
} = require('./review-copy/closers');

/** Map a 1–5 rating onto a copy tier. */
function tierForRating(rating) {
  const r = Number(rating);
  if (r >= 5) return 'high';
  if (r === 4) return 'mid';
  return 'low';                 // 1–3: lukewarm or negative copy
}

/** Pick from a pool, falling back through tiers then to the generic family. */
function selectPool(family, tier) {
  const fam = BODIES[family] || BODIES.generic;
  // Prefer the exact tier; fall back to an adjacent one rather than inventing copy.
  const order = tier === 'high' ? ['high', 'mid', 'low']
              : tier === 'mid'  ? ['mid', 'high', 'low']
              :                   ['low', 'mid', 'high'];
  for (const t of order) {
    if (Array.isArray(fam[t]) && fam[t].length) return fam[t];
  }
  return BODIES.generic.mid;
}

/**
 * Pick a review body for a product.
 *
 * @param {object} opts
 * @param {string} opts.type            Product.type      (e.g. 'spirit')
 * @param {string} [opts.subType]       Product.subType   (e.g. 'gin')
 * @param {number} [opts.rating]        1–5; drives which sentiment tier is used
 * @param {() => number} [opts.random]  injectable RNG for reproducible runs
 * @returns {{ title: string, comment: string, family: string, tier: string }}
 */
function pickReview({ type, subType, rating = 5, random = Math.random }) {
  const family = resolveFamily(type, subType);
  const tier = tierForRating(rating);
  const pool = selectPool(family, tier);
  const base = pool[Math.floor(random() * pool.length)];

  // Closer must agree with the sentiment — "will reorder" under a 3★ reads false.
  const closerPool = tier === 'low'
    ? [...LUKEWARM_CLOSERS, ...NEUTRAL_CLOSERS]
    : [...POSITIVE_CLOSERS, ...NEUTRAL_CLOSERS];
  const closer = closerPool[Math.floor(random() * closerPool.length)];

  return {
    title: base.title,
    comment: `${base.comment}${closer}`,
    family,
    tier,
  };
}

/** Count how many distinct (title, comment) pairs the bank can produce. */
function copyStats() {
  let titles = new Set();
  let comments = new Set();
  let families = 0;
  for (const [, tiers] of Object.entries(BODIES)) {
    families += 1;
    for (const tier of ['high', 'mid', 'low']) {
      for (const entry of tiers[tier] || []) {
        titles.add(entry.title);
        comments.add(entry.comment);
      }
    }
  }
  return { families, distinctTitles: titles.size, distinctComments: comments.size };
}

// Fail at require-time rather than mid-run.
function assertCopyValid() {
  const MIN = 10;
  for (const [family, tiers] of Object.entries(BODIES)) {
    const present = ['high', 'mid', 'low'].filter((t) => Array.isArray(tiers[t]) && tiers[t].length);
    if (present.length === 0) {
      throw new Error(`review-templates: family "${family}" has no tiers`);
    }
    for (const tier of present) {
      for (const entry of tiers[tier]) {
        if (typeof entry.comment !== 'string' || entry.comment.trim().length < MIN) {
          throw new Error(
            `review-templates: ${family}.${tier} comment is under the server's ` +
            `${MIN}-character minimum: ${JSON.stringify(entry.comment)}`,
          );
        }
        if (typeof entry.title !== 'string' || !entry.title.trim()) {
          throw new Error(`review-templates: ${family}.${tier} has an empty title`);
        }
      }
    }
  }
  // Closers are appended to comments, so they must never push a body under the
  // minimum on their own — they only ever add length, but guard the type.
  for (const list of [NEUTRAL_CLOSERS, POSITIVE_CLOSERS, LUKEWARM_CLOSERS]) {
    for (const c of list) {
      if (typeof c !== 'string') throw new Error('review-templates: closer is not a string');
    }
  }
}

assertCopyValid();

module.exports = {
  BODIES,
  resolveFamily,
  tierForRating,
  pickReview,
  copyStats,
  assertCopyValid,
};
