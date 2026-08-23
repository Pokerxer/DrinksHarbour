const test = require('node:test');
const assert = require('node:assert');
const { activeWindowFilter } = require('../utils/pricelistWindow');

test('includes docs with no date fields at all', () => {
  const f = activeWindowFilter(new Date('2026-08-23'));
  const ors = f.$and.map((c) => c.$or);
  assert.ok(ors[0].some((o) => o.startDate === null));
  assert.ok(ors[0].some((o) => o.startDate && '$exists' in o.startDate));
  assert.ok(ors[0].some((o) => o.startDate && '$lte' in o.startDate));
  assert.ok(ors[1].some((o) => o.endDate === null));
  assert.ok(ors[1].some((o) => o.endDate && '$exists' in o.endDate));
  assert.ok(ors[1].some((o) => o.endDate && '$gte' in o.endDate));
});

test('start-only window (startDate past, no endDate) is NOT excluded', () => {
  const now = new Date('2026-08-23');
  const f = activeWindowFilter(now);
  // A doc { startDate: 2026-01-01 } satisfies: startDate <= now AND endDate clause passes on null/missing.
  const startClause = f.$and[0].$or.find((o) => o.startDate && '$lte' in o.startDate);
  assert.ok(startClause.startDate.$lte <= now);
  const endPasses = f.$and[1].$or.some(
    (o) => o.endDate === null || ('$exists' in o.endDate) || o.endDate.$gte >= now
  );
  assert.ok(endPasses);
});

test('end-only window (endDate future, no startDate) is NOT excluded', () => {
  const now = new Date('2026-08-23');
  const f = activeWindowFilter(now);
  const endClause = f.$and[1].$or.find((o) => o.endDate && '$gte' in o.endDate);
  assert.ok(endClause.endDate.$gte >= now);
  const startPasses = f.$and[0].$or.some(
    (o) => o.startDate === null || ('$exists' in o.startDate) || o.startDate.$lte <= now
  );
  assert.ok(startPasses);
});

test('defaults to now when called without arguments', () => {
  const f = activeWindowFilter();
  const clause = f.$and[0].$or.find((o) => o.startDate && '$lte' in o.startDate);
  assert.ok(clause.startDate.$lte instanceof Date);
});
