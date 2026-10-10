import { expect, it } from 'vitest';
import type { InsightLine } from '@/services/notificationInsights.service';
import {
  statusOf,
  warehouseSummaries,
  selectRows,
  localCover,
} from './warehouse-rules';
const row = (key: string, changes: Partial<InsightLine> = {}): InsightLine => ({
  key,
  subProductId: key,
  sizeId: 's',
  sku: '',
  productName: key,
  warehouseId: 'w',
  warehouseName: 'Main',
  sizeName: 'Bottle',
  available: 10,
  threshold: 5,
  units30: 30,
  ...changes,
});
it('unknown and negative balances are distinct from healthy stock', () => {
  expect(statusOf(row('negative', { available: -2 }))).toBe('out');
  expect(statusOf(row('missing', { available: null }))).toBe('unknown');
  expect(statusOf(row('healthy'))).toBe('healthy');
  expect(statusOf(row('unsupported', { urgency: 'high' }))).toBe('healthy');
});
it('attention counts retain exact location rows and never treat missing balances as zero', () => {
  const list = [
    row('low', { available: 5 }),
    row('out', { available: 0 }),
    row('missing', { available: null }),
    row('elsewhere', { warehouseId: 'other', available: 0 }),
    row('unassigned', { warehouseId: '', available: null }),
  ];
  const cards = warehouseSummaries(list, [
    { _id: 'w', name: 'Main' },
    { _id: 'other', name: 'Other' },
    { _id: 'empty', name: 'Empty' },
  ]);
  expect(cards.find((c) => c.id === 'w')).toMatchObject({
    attention: 2,
    out: 1,
    unknown: 1,
    total: 3,
  });
  expect(cards.find((c) => c.id === 'other')?.attention).toBe(1);
  expect(cards.find((c) => c.id === 'empty')?.total).toBe(0);
  expect(cards.find((c) => c.id === '')?.unknown).toBe(1);
});
it('attention sorts by supported cover then sales speed and applies warehouse/search filters', () => {
  const forecast = {
    method: 'historical_baseline' as const,
    model: null,
    daily: Array(90).fill(1),
    startDate: 'now',
    historyDays: 40,
    errors: null,
    demand7: 7,
    demand14: 14,
    demand30: 30,
    limitations: [],
  };
  const list = [
    row('Slow', { available: 5, daysOfCover: 30, forecast }),
    row('Fast', { available: 10, threshold: 10, daysOfCover: 10, forecast }),
    row('Healthy'),
    row('Other', { warehouseId: 'other', available: 0 }),
  ];
  expect(
    selectRows(list, {
      warehouseId: 'w',
      status: 'attention',
      search: '',
      sort: 'priority',
    }).map((r) => r.key)
  ).toEqual(['Fast', 'Slow']);
  expect(
    selectRows(list, {
      warehouseId: 'w',
      status: 'all',
      search: 'healthy',
      sort: 'sales',
    }).map((r) => r.key)
  ).toEqual(['Healthy']);
});
it('unknown evidence cannot display beyond-horizon cover or a confident zero', () => {
  expect(
    localCover(row('missing', { available: null, daysOfCover: null }))
  ).toBe('Unknown');
  expect(localCover(row('nohistory', { daysOfCover: null }))).toBe('Unknown');
});
it('below-minimum filter also includes products with a supported stockout risk', () => {
  const f = {
    method: 'historical_baseline' as const,
    model: null,
    daily: [1],
    startDate: 'now',
    historyDays: 40,
    errors: null,
    demand7: 7,
    demand14: 14,
    demand30: 30,
    limitations: [],
  };
  expect(
    selectRows([row('risk', { available: 2, urgency: 'high', forecast: f })], {
      warehouseId: '',
      status: 'low',
      search: '',
      sort: 'priority',
    })
  ).toHaveLength(1);
});
it('outgoing commitments raise an attention alert without pretending physical stock is depleted', () => {
  const line = row('source', {
    available: 30,
    transferPlan: {
      basis: 'configured_minimum',
      nextStep: 'purchase_review',
      needUnits: 1,
      pendingUnits: 0,
      additionalUnits: 1,
      uncoveredUnits: 1,
      outboundUnits: 25,
      protectedUnits: 10,
      availableAfterCommitments: 5,
      sources: [],
      pending: [],
      usualSources: [],
    },
  });
  expect(statusOf(line)).toBe('risk');
  expect(
    selectRows([line], {
      warehouseId: 'w',
      status: 'attention',
      search: '',
      sort: 'priority',
    })
  ).toEqual([line]);
  expect(line.available).toBe(30);
});
it('pending transfers remain actionable for healthy and unknown stock', () => {
  const transferPlan = {
    basis: 'configured_minimum' as const,
    nextStep: 'monitor' as const,
    needUnits: 0,
    pendingUnits: 0,
    additionalUnits: 0,
    uncoveredUnits: 0,
    outboundUnits: 0,
    protectedUnits: 10,
    availableAfterCommitments: 100,
    sources: [],
    pending: [],
    usualSources: [],
    outgoing: [
      {
        transferId: 'tr',
        reference: 'TR1',
        status: 'pending_approval',
        sourceWarehouseId: 'w',
        sourceWarehouseName: 'Main',
        destinationWarehouseName: 'Shop',
        quantity: 10,
        arrival: null,
      },
    ],
  };
  const healthy = row('healthy', { available: 100, transferPlan });
  const unknown = row('unknown', { available: null, transferPlan });
  const rows = selectRows(
    [healthy, unknown, row('plain', { available: 100 })],
    { warehouseId: 'w', status: 'transfers', search: '', sort: 'priority' }
  );
  expect(rows).toHaveLength(2);
  expect(
    warehouseSummaries([healthy, unknown], [{ _id: 'w', name: 'Main' }])[0]
      .attention
  ).toBe(2);
});

it('ranks source warehouse demand from transfers together with customer sales', () => {
  const base = {
    key: 'slow',
    subProductId: 'p',
    sizeId: 's',
    warehouseId: 'w',
    productName: 'Slow',
    warehouseName: 'Main',
    sku: '',
    sizeName: '',
    available: 5,
    threshold: 10,
    units30: 5,
  };
  const result = selectRows(
    [
      base,
      {
        ...base,
        key: 'hub',
        productName: 'Hub',
        units30: 0,
        demandUnits30: 30,
      },
    ],
    { warehouseId: '', status: 'all', search: '', sort: 'sales' }
  );
  expect(result[0].key).toBe('hub');
});

it('does not rank incomplete transfer movement using a large customer-sales subtotal', () => {
  const incomplete = row('incomplete', {
    units30: 100,
    demandUnits30: null,
    transferDataStatus: 'incomplete',
  });
  const complete = row('complete', { units30: 0, demandUnits30: 30 });
  const result = selectRows([incomplete, complete], {
    warehouseId: 'w',
    status: 'all',
    search: '',
    sort: 'sales',
  });
  expect(result.map((line) => line.key)).toEqual(['complete', 'incomplete']);
});
