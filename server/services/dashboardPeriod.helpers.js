'use strict';

/**
 * Pure date-window resolution for the analytics dashboard.
 *
 * Separated from the controller so it can be unit-tested without a database,
 * following the same pattern as salesFulfill.helpers.js.
 *
 * Two comparison strategies:
 *   - Calendar-aligned periods (month/quarter/year) compare to the previous
 *     calendar unit, which preserves the dashboard's original behaviour.
 *   - Rolling periods (today/7d/30d/custom) compare to an equal-length window
 *     ending immediately before the range starts.
 */

const MS_DAY = 86_400_000;
const MAX_CUSTOM_DAYS = 366;

const PERIOD_KEYS = ['today', '7d', '30d', 'month', 'quarter', 'year', 'custom'];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Rolling comparison: same-length window ending the day before rangeStart. */
function rollingPrevious(rangeStart, dayCount) {
  const prevEnd = endOfDay(addDays(rangeStart, -1));
  const prevStart = startOfDay(addDays(prevEnd, -(dayCount - 1)));
  return { prevStart, prevEnd };
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function resolveCustom(query, now) {
  const from = new Date(query.from);
  const to = new Date(query.to);

  // Missing or unparseable dates → fall back to the default period.
  if (!query.from || !query.to || !isValidDate(from) || !isValidDate(to)) {
    return resolvePeriod({ period: 'month' }, now);
  }

  // Reversed range → swap.
  let [lo, hi] = from <= to ? [from, to] : [to, from];
  let rangeStart = startOfDay(lo);
  const rangeEnd = endOfDay(hi);

  // Clamp over-long ranges to bound aggregation cost, keeping the end fixed.
  const spanDays = Math.round((rangeEnd - rangeStart) / MS_DAY);
  if (spanDays > MAX_CUSTOM_DAYS) {
    rangeStart = startOfDay(addDays(rangeEnd, -(MAX_CUSTOM_DAYS - 1)));
  }

  const dayCount = Math.round((endOfDay(rangeEnd) - rangeStart) / MS_DAY) || 1;
  const { prevStart, prevEnd } = rollingPrevious(rangeStart, dayCount);

  const fmt = (d) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    key: 'custom',
    rangeStart,
    rangeEnd,
    prevStart,
    prevEnd,
    label: `${fmt(rangeStart)} – ${fmt(rangeEnd)}`,
    comparisonLabel: 'vs previous period',
  };
}

/**
 * @param {object} query   Express req.query (or any {period, from, to} bag)
 * @param {Date}   now     Reference "now", injectable for tests
 */
function resolvePeriod(query = {}, now = new Date()) {
  const raw = query && typeof query.period === 'string' ? query.period : '';
  const key = PERIOD_KEYS.includes(raw) ? raw : 'month';

  if (key === 'custom') return resolveCustom(query, now);

  if (key === 'today') {
    const rangeStart = startOfDay(now);
    return {
      key,
      rangeStart,
      rangeEnd: endOfDay(now),
      ...rollingPrevious(rangeStart, 1),
      label: 'Today',
      comparisonLabel: 'vs yesterday',
    };
  }

  if (key === '7d' || key === '30d') {
    const days = key === '7d' ? 7 : 30;
    const rangeStart = startOfDay(addDays(now, -(days - 1)));
    return {
      key,
      rangeStart,
      rangeEnd: endOfDay(now),
      ...rollingPrevious(rangeStart, days),
      label: `Last ${days} days`,
      comparisonLabel: `vs previous ${days} days`,
    };
  }

  if (key === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const rangeStart = startOfDay(new Date(now.getFullYear(), q * 3, 1));
    const rangeEnd = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0));
    const prevStart = startOfDay(new Date(now.getFullYear(), q * 3 - 3, 1));
    const prevEnd = endOfDay(new Date(now.getFullYear(), q * 3, 0));
    return { key, rangeStart, rangeEnd, prevStart, prevEnd, label: 'This quarter', comparisonLabel: 'vs last quarter' };
  }

  if (key === 'year') {
    const y = now.getFullYear();
    return {
      key,
      rangeStart: startOfDay(new Date(y, 0, 1)),
      rangeEnd: endOfDay(new Date(y, 11, 31)),
      prevStart: startOfDay(new Date(y - 1, 0, 1)),
      prevEnd: endOfDay(new Date(y - 1, 11, 31)),
      label: 'This year',
      comparisonLabel: 'vs last year',
    };
  }

  // 'month' — the default, matching the dashboard's original windows.
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    key: 'month',
    rangeStart: startOfDay(new Date(y, m, 1)),
    rangeEnd: endOfDay(new Date(y, m + 1, 0)),
    prevStart: startOfDay(new Date(y, m - 1, 1)),
    prevEnd: endOfDay(new Date(y, m, 0)),
    label: 'This month',
    comparisonLabel: 'vs last month',
  };
}

module.exports = { resolvePeriod, PERIOD_KEYS, MAX_CUSTOM_DAYS };
