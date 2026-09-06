// scripts/lib/backdate.js
//
// Spread seeded orders and reviews across a historical window.
//
// WHY THIS EXISTS: an order book where 200 customers and 500 orders all share
// one timestamp is useless for the thing it is meant to support — revenue
// charts, cohort retention, month-over-month growth and "orders per day" all
// collapse to a single spike. Realistic date distribution is what makes the
// seeded dataset function as a development fixture.
//
// HOW DATES ARE APPLIED: the HTTP API always stamps `placedAt` as "now", and
// the seeder never writes to Mongo through the controllers' backs. So the
// orchestrator places every order through POST /api/orders first, then this
// module's applyOrderDate() issues ONE targeted update per order to move
// placedAt/createdAt into the window. That update is:
//   * gated on the database name ending in `_seed`,
//   * limited to the date fields plus the seed marker,
//   * tagged `seedSource: 'seed-script'` so every row it touches stays
//     identifiable and reversible.
//
// The marker is deliberately NOT optional. A seeded order must remain
// distinguishable from a real one for as long as it exists in the database.

const SEED_MARKER = 'seed-script';

/**
 * Parse `--date-range 2026-01-01..2026-09-04` into [Date, Date].
 * Also accepts a single date, which becomes a same-day range.
 */
function parseDateRange(value, fallback) {
  if (!value) return fallback;
  const str = String(value).trim();
  const parts = str.split('..').map((s) => s.trim()).filter(Boolean);
  const toDate = (s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${s}" in --date-range`);
    return d;
  };
  if (parts.length === 1) { const d = toDate(parts[0]); return [d, d]; }
  if (parts.length !== 2) throw new Error(`Invalid --date-range "${value}", expected "YYYY-MM-DD..YYYY-MM-DD"`);
  const [a, b] = parts.map(toDate);
  if (a > b) throw new Error(`--date-range start ${parts[0]} is after end ${parts[1]}`);
  return [a, b];
}

/**
 * Pick a plausible order timestamp inside [from, to].
 *
 * Two shaping rules keep the distribution from looking machine-generated:
 *   * Weekend uplift — Fri/Sat carry more drink orders than a Tuesday.
 *   * Trading hours — orders land 09:00–23:00 local, not 03:00.
 */
function randomOrderDate([from, to], random = Math.random) {
  const span = to.getTime() - from.getTime();
  if (span <= 0) return new Date(from);

  let date;
  // Rejection-sample a few times so weekend days are over-represented without
  // distorting the overall range.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = new Date(from.getTime() + random() * span);
    const day = candidate.getUTCDay(); // 0 Sun … 6 Sat
    const isWeekend = day === 5 || day === 6 || day === 0;
    if (isWeekend || random() < 0.55) { date = candidate; break; }
  }
  if (!date) date = new Date(from.getTime() + random() * span);

  // 09:00–22:59 UTC.
  date.setUTCHours(9 + Math.floor(random() * 14), Math.floor(random() * 60), Math.floor(random() * 60), 0);
  if (date > to) return new Date(to.getTime() - Math.floor(random() * 3600_000));
  return date;
}

/**
 * A review is written some days AFTER the order is delivered.
 * Returns a date in [orderDate + minDays, orderDate + maxDays], clamped to `to`.
 */
function reviewDateFor(orderDate, [, to], { minDays = 3, maxDays = 21 } = {}, random = Math.random) {
  const days = minDays + random() * (maxDays - minDays);
  const d = new Date(orderDate.getTime() + days * 86_400_000);
  d.setUTCHours(9 + Math.floor(random() * 13), Math.floor(random() * 60), 0, 0);
  return d > to ? new Date(to) : d;
}

/**
 * Guard: this module may only write to a seed database.
 * @param {import('mongoose').Connection} conn
 */
function assertSeedDatabase(conn) {
  const name = conn?.db?.databaseName || '';
  if (!/_seed$/.test(name)) {
    throw new Error(
      `backdate: refusing to modify database "${name}" — the name must end in "_seed". ` +
      'Clone the catalog with scripts/cloneToSeedDataset.js and point MONGODB_URI at it.',
    );
  }
  return name;
}

/**
 * Move one order's timestamps into the window and mark it as seeded.
 * Also backdates the status-history entries so the fulfilment trail is
 * consistent with placedAt rather than trailing months behind it.
 *
 * @param {import('mongoose').Connection} conn
 * @param {string} orderId
 * @param {Date} placedAt
 * @param {object} [opts]
 * @param {number} [opts.deliveryDays]  days from order to delivery
 */
async function applyOrderDate(conn, orderId, placedAt, { deliveryDays = 2 } = {}) {
  assertSeedDatabase(conn);
  const { ObjectId } = require('mongoose').Types;
  const orders = conn.db.collection('orders');

  const deliveredAt = new Date(placedAt.getTime() + deliveryDays * 86_400_000);

  const order = await orders.findOne({ _id: new ObjectId(orderId) }, { projection: { statusHistory: 1 } });

  const set = {
    placedAt,
    createdAt: placedAt,
    updatedAt: deliveredAt,
    deliveredAt,
    seedSource: SEED_MARKER,
    seedGeneratedAt: new Date(),
  };

  // Redistribute status-history timestamps evenly between order and delivery.
  if (Array.isArray(order?.statusHistory) && order.statusHistory.length) {
    const n = order.statusHistory.length;
    const step = (deliveredAt.getTime() - placedAt.getTime()) / Math.max(1, n);
    set.statusHistory = order.statusHistory.map((h, i) => ({
      ...h,
      changedAt: new Date(placedAt.getTime() + step * i),
      timestamp: new Date(placedAt.getTime() + step * i),
    }));
  }

  await orders.updateOne({ _id: new ObjectId(orderId) }, { $set: set });
  return { placedAt, deliveredAt };
}

/**
 * Move one review's timestamps and mark it as seeded.
 */
async function applyReviewDate(conn, reviewId, createdAt) {
  assertSeedDatabase(conn);
  const { ObjectId } = require('mongoose').Types;
  await conn.db.collection('reviews').updateOne(
    { _id: new ObjectId(reviewId) },
    { $set: { createdAt, updatedAt: createdAt, seedSource: SEED_MARKER, seedGeneratedAt: new Date() } },
  );
  return createdAt;
}

module.exports = {
  SEED_MARKER,
  parseDateRange,
  randomOrderDate,
  reviewDateFor,
  assertSeedDatabase,
  applyOrderDate,
  applyReviewDate,
};
