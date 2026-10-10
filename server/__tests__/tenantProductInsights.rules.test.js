const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildProductInsights,
  reportingWindows,
} = require('../services/tenantProductInsights.rules');
const w = reportingWindows(new Date('2026-10-08T08:00:00Z'));
const base = {
  subProductId: 'p',
  name: 'Wine',
  stock: [{ available: 5, threshold: 5, sizeId: 's', warehouseId: 'w' }],
  currentUnits: 0,
  previousUnits: 0,
  units30: 0,
  observedSince: '2026-08-01',
  reorderQuantity: 0,
};
test('windows use complete Lagos days and Monday reporting week', () => {
  assert.equal(w.end, '2026-10-07T23:00:00.000Z');
  assert.equal(w.start, '2026-09-30T23:00:00.000Z');
  assert.equal(w.weekKey, '2026-10-05');
});
test('threshold inclusive; zero urgent; unknown stock suppressed', () => {
  assert.equal(
    buildProductInsights(base, w).find((n) => n.type === 'low_stock_alert')
      .priority,
    'high',
  );
  assert.equal(
    buildProductInsights(
      { ...base, stock: [{ available: 0, threshold: 0 }] },
      w,
    )[0].priority,
    'urgent',
  );
  assert.equal(
    buildProductInsights(
      { ...base, stock: [{ available: null, threshold: 5 }] },
      w,
    ).length,
    0,
  );
  assert.equal(
    buildProductInsights(
      { ...base, stock: [{ available: 6, threshold: 5 }], observedSince: null },
      w,
    ).length,
    0,
  );
});
test('strong sellers require evidence and minimum sample; zero baseline has no percentage', () => {
  const notice = buildProductInsights(
    { ...base, currentUnits: 10, previousUnits: 8 },
    w,
  ).find((n) => n.type === 'product_performance');
  assert.match(notice.message, /10.*8/);
  assert.match(notice.message, /25%/);
  assert.equal(
    buildProductInsights(
      { ...base, currentUnits: 4, previousUnits: 1 },
      w,
    ).some((n) => n.type === 'product_performance'),
    false,
  );
  const fresh = buildProductInsights(
    { ...base, currentUnits: 5, previousUnits: 0 },
    w,
  ).find((n) => n.type === 'product_performance');
  assert.ok(fresh);
  assert.doesNotMatch(fresh.message, /%/);
});
test('restock cover uses configured minimum and slow movers require a full observed month', () => {
  const n = buildProductInsights(
    { ...base, currentUnits: 7, previousUnits: 7, reorderQuantity: 12 },
    w,
  ).find((n) => n.metadata.rule === 'restock');
  assert.equal(n.metadata.suggestedUnits, 12);
  assert.ok(
    buildProductInsights(base, w).some((n) => n.metadata.rule === 'slow_mover'),
  );
  assert.equal(
    buildProductInsights({ ...base, observedSince: '2026-10-01' }, w).some(
      (n) => n.metadata.rule === 'slow_mover',
    ),
    false,
  );
});
test('stock snapshots have no sales-period claim and slow-mover evidence spans 30 days', () => {
  const n = buildProductInsights(base, w);
  assert.equal(
    n.find((r) => r.type === 'low_stock_alert').metadata.periodStart,
    undefined,
  );
  assert.equal(
    n.find((r) => r.metadata.rule === 'slow_mover').metadata.periodStart,
    w.monthStart,
  );
});
