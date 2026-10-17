const test = require('node:test');
const assert = require('node:assert/strict');
const { scanTenantProducts } = require('../jobs/tenantProductInsights.job');
const { automaticMinimum } = require('../services/restock/minimum');
const { publicNotice } = require('../services/tenantNotifications.service');
const now = new Date('2026-10-12T12:00:00Z');
test('inbox stock alerts expose the active automatic minimum calculated from local demand', async () => {
  const policy = automaticMinimum({
    values: Array(28).fill(4),
    forecast: { daily: Array(90).fill(4), method: 'baseline' },
    now,
  });
  assert.equal(policy.units, 36);
  let pages = 0,
    drafts;
  await scanTenantProducts(
    't',
    { now, recipientId: 'u' },
    {
      recipients: async () => [{ _id: 'u' }],
      page: async () =>
        pages++
          ? []
          : [{ _id: 'p', product: { name: 'Fast wine' }, status: 'active' }],
      stock: async () =>
        new Map([
          [
            'p',
            {
              stock: [
                {
                  available: 20,
                  threshold: 36,
                  sizeId: 's',
                  warehouseId: 'w',
                  automaticMinimum: policy,
                },
              ],
            },
          ],
        ]),
      deliver: async (_t, rows) => {
        drafts = rows;
        return { delivered: rows.length };
      },
      resolve: async () => {},
    },
  );
  const alert = drafts.find((d) => d.type === 'low_stock_alert');
  assert.equal(alert.metadata.threshold, 36);
  assert.equal(alert.metadata.minimumSource, 'automatic');
  assert.match(alert.message, /automatic minimum 36/);
  const visible = publicNotice(
    { _id: 'n', ...alert },
    { role: 'tenant_staff', customPermissions: ['inventory:read'] },
  );
  assert.equal(visible.metadata.minimumSource, 'automatic');
  assert.equal(visible.metadata.minimumUpdatedAt, now.toISOString());
  assert.equal(visible.metadata.dailySales, undefined);
});
test('expired or unmatched policy is presented as a configured fallback', async () => {
  const { minimumNoticeFields } = require('../services/minimumNoticeFields');
  const policy = automaticMinimum({
    values: Array(28).fill(4),
    forecast: { daily: Array(90).fill(4) },
    now,
  });
  assert.equal(
    minimumNoticeFields({ threshold: 10, automaticMinimum: policy }, now)
      .minimumSource,
    'configured',
  );
  assert.equal(
    minimumNoticeFields(
      {
        threshold: 36,
        automaticMinimum: { ...policy, validUntil: '2026-10-01' },
      },
      now,
    ).minimumSource,
    'configured',
  );
});
test('an uncertain forecast policy cannot claim that a held automatic target is configured', () => {
  const { forecastDrafts } = require('../services/restock/notifications');
  const policy = automaticMinimum({
    values: Array(28).fill(4),
    forecast: { daily: Array(90).fill(4) },
    now,
  });
  const drafts = forecastDrafts(
    {
      generatedAt: now.toISOString(),
      lines: [
        {
          subProductId: 'p',
          sizeId: 's',
          warehouseId: 'w',
          productName: 'Wine',
          warehouseName: 'Main',
          available: 20,
          threshold: 36,
          urgency: 'high',
          suggestedUnits: 0,
          minimumPolicy: { ...policy, status: 'incomplete' },
          forecast: { method: 'insufficient_history' },
        },
      ],
    },
    now,
  );
  assert.equal(drafts[0].metadata.minimumSource, undefined);
});
