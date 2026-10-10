const { test } = require('node:test');
const assert = require('node:assert/strict');
const { forecastDrafts } = require('../services/restock/notifications');
const { safeNotificationAction } = require('../utils/notificationAction');
const { publicNotice } = require('../services/tenantNotifications.service');
const p = 'a'.repeat(24),
  w = 'b'.repeat(24),
  s = 'c'.repeat(24);
test('forecast and threshold stock risk use one episode with no cost fields', () => {
  const drafts = forecastDrafts(
    {
      generatedAt: '2026-10-09',
      lines: [
        {
          subProductId: p,
          sizeId: s,
          warehouseId: w,
          productName: 'Fast drink',
          warehouseName: 'Main',
          available: 25,
          threshold: 10,
          urgency: 'high',
          daysOfCover: 10,
          units30: 75,
          suggestedUnits: 30,
          forecast: { method: 'trained_forecast', model: 'dh-demand-ridge-v1' },
        },
      ],
    },
    new Date('2026-10-09'),
  );
  assert.equal(drafts[0].identity, `stock:${p}:${s}:${w}`);
  assert.equal(drafts[0].metadata.rule, 'forecast_stock');
  assert.equal(drafts[0].metadata.unitPrice, undefined);
});
test('exact notification child routes and identity filters are allowed, pivots rejected', () => {
  assert.ok(
    safeNotificationAction(
      `/notifications/warehouses?warehouseId=${w}&subProductId=${p}`,
    ),
  );
  for (const url of [
    '/notifications/unknown',
    '/notifications/forecasts?tenantId=x',
    '//evil.test',
    '/notifications/stock?warehouseId=bad',
  ])
    assert.equal(safeNotificationAction(url), false);
});
test('inbox metadata strips demand for inventory-only viewers', () => {
  const n = {
    _id: p,
    metadata: {
      available: 3,
      threshold: 10,
      units30: 20,
      model: 'ridge',
      daysOfCover: 5,
    },
    message: 'Stock risk',
    actionUrl: '/notifications/stock',
  };
  const row = publicNotice(n, {
    role: 'tenant_staff',
    tenant: 't',
    customPermissions: ['inventory:read'],
  });
  assert.equal(row.metadata.units30, undefined);
  assert.equal(row.metadata.daysOfCover, undefined);
  assert.equal(row.metadata.available, 3);
});
