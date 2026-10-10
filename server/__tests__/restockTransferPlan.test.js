const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferEvidence } = require('../services/restock/transfer-evidence');
const { applyTransferPlans } = require('../services/restock/transfer-plan');
const now = new Date('2026-10-09T10:00:00Z');
const line = (w, available = 0) => ({
  key: `p:s:${w}`,
  subProductId: 'p',
  sizeId: 's',
  warehouseId: w,
  warehouseName: w,
  available,
  threshold: 10,
  buffer: 10,
  suggestedUnits: null,
  urgency: available === 0 ? 'urgent' : 'normal',
  forecast: { method: 'insufficient_history', daily: [] },
});
const doc = (n, source = 'hub', dest = 'shop') => ({
  _id: n,
  tenant: 't',
  status: 'completed',
  sourceWarehouse: source,
  destinationWarehouse: dest,
  dispatchedAt: '2026-10-01',
  completedDate: '2026-10-02',
  items: [
    {
      subProductId: 'p',
      sizeId: 's',
      quantity: 12,
      receivedQty: 12,
      returnedQty: 2,
    },
  ],
});
const e = (transfers = [], movements = []) => ({
  tenantId: 't',
  warehouses: ['hub', 'shop', 'other'].map((_id) => ({ _id, name: _id })),
  transfers,
  transferMovements: movements,
});
test('usual routes use completed net received units, rejecting other tenants and draft intent', () => {
  const evidence = transferEvidence(
    e([
      doc('a'),
      doc('b'),
      doc('c'),
      { ...doc('x'), tenant: 'other' },
      { ...doc('draft'), status: 'draft' },
    ]),
    now,
  );
  assert.equal(evidence.history.length, 3);
  assert.equal(
    evidence.history.reduce((n, r) => n + r.quantity, 0),
    30,
  );
  const lines = [line('shop'), line('hub', 50)];
  applyTransferPlans(lines, e([doc('a'), doc('b'), doc('c')]), {
    now,
    coverDays: 14,
  });
  assert.equal(lines[0].transferPlan.sources[0].usualSource, true);
  assert.equal(lines[0].transferPlan.sources[0].recommendedUnits, 11);
  assert.equal(lines[0].transferPlan.sources[0].typicalTransitDays, 1);
});
test('pending transfer covers an additional gap without becoming on-hand or guaranteeing an ETA', () => {
  const transfer = {
    ...doc('open'),
    status: 'in_transit',
    completedDate: null,
    items: [
      {
        subProductId: 'p',
        sizeId: 's',
        quantity: 20,
        receivedQty: 5,
        transferredQty: 5,
      },
    ],
  };
  const lines = [line('shop'), line('hub', 50)];
  applyTransferPlans(lines, e([transfer]), { now, coverDays: 14 });
  assert.equal(lines[0].available, 0);
  assert.equal(lines[0].transferPlan.pendingUnits, 15);
  assert.equal(lines[0].transferPlan.additionalUnits, 0);
  assert.equal(lines[0].transferPlan.nextStep, 'follow_up');
  assert.equal(lines[0].transferPlan.pending[0].arrival, null);
  assert.equal(lines[1].transferPlan.outboundUnits, 15);
});
test('donor commitments and minimum are protected and surplus allocated only once', () => {
  const pending = {
    ...doc('open', 'hub', 'other'),
    status: 'confirmed',
    items: [{ subProductId: 'p', sizeId: 's', quantity: 10 }],
  };
  const lines = [
    { ...line('shop'), units30: 30 },
    line('other'),
    line('hub', 35),
  ];
  applyTransferPlans(lines, e([pending]), { now, coverDays: 14 });
  const total = lines.reduce(
    (n, l) =>
      n + l.transferPlan.sources.reduce((m, s) => m + s.recommendedUnits, 0),
    0,
  );
  assert.equal(total, 12);
  assert.equal(lines[0].transferPlan.sources[0].safeSurplus, 15);
  assert.equal(lines[2].transferPlan.outboundUnits, 10);
});
test('unknown donors cannot be recommended, and returns do not reverse a normal route', () => {
  const moves = [
    {
      _id: 'out',
      tenant: 't',
      warehouse: 'hub',
      subProduct: 'p',
      size: 's',
      type: 'transfer_out',
      transferGroupId: 'g',
      quantity: 10,
      createdAt: '2026-10-02',
    },
    {
      _id: 'in',
      tenant: 't',
      warehouse: 'shop',
      subProduct: 'p',
      size: 's',
      type: 'transfer_in',
      transferGroupId: 'g',
      quantity: 10,
      createdAt: '2026-10-02',
    },
    {
      _id: 'return',
      tenant: 't',
      warehouse: 'shop',
      subProduct: 'p',
      size: 's',
      type: 'transfer_out',
      parentMovement: 'in',
      quantity: 3,
      createdAt: '2026-10-03',
    },
  ];
  const facts = transferEvidence(e([], moves), now);
  assert.equal(facts.history.length, 1);
  assert.equal(facts.history[0].quantity, 7);
  const lines = [line('shop'), line('hub', null)];
  applyTransferPlans(lines, e([], moves), { now, coverDays: 14 });
  assert.equal(lines[0].transferPlan.sources.length, 0);
  assert.equal(lines[0].transferPlan.nextStep, 'purchase_review');
});
test('approval intent is visible but neither supply nor a second transfer recommendation', () => {
  const lines = [line('shop'), line('hub', 50)];
  applyTransferPlans(
    lines,
    e([
      {
        ...doc('approval'),
        status: 'pending_approval',
        items: [
          { subProductId: 'p', sizeId: 's', quantity: 12, receivedQty: 0 },
        ],
      },
    ]),
    { now, coverDays: 14 },
  );
  assert.equal(lines[0].transferPlan.pendingUnits, 0);
  assert.equal(lines[0].transferPlan.nextStep, 'approval_review');
  assert.equal(lines[0].transferPlan.sources.length, 0);
});
test('usual source remains visible without a current stock record, and pending source shortfall is flagged', () => {
  const transfers = [
    doc('a'),
    doc('b'),
    doc('c'),
    {
      ...doc('open'),
      status: 'confirmed',
      items: [{ subProductId: 'p', sizeId: 's', quantity: 40, receivedQty: 0 }],
    },
  ];
  const lines = [line('shop'), line('hub', 20)];
  applyTransferPlans(lines, e(transfers), { now, coverDays: 14 });
  assert.equal(lines[0].transferPlan.pending[0].sourceShortfallUnits, 20);
  assert.match(lines[0].transferPlan.pending[0].followUpReason, /source/i);
  const missing = [line('shop')];
  applyTransferPlans(missing, e([doc('a'), doc('b'), doc('c')]), {
    now,
    coverDays: 14,
  });
  assert.equal(
    missing[0].transferPlan.usualSources[0].sourceWarehouseId,
    'hub',
  );
});
test('source reserve protects forecast demand as well as its safety buffer', () => {
  const donor = {
    ...line('hub', 30),
    forecast: { daily: Array(90).fill(1) },
    suggestedUnits: 1,
  };
  const lines = [line('shop'), donor];
  applyTransferPlans(lines, e(), { now, coverDays: 14 });
  assert.equal(donor.transferPlan.protectedUnits, 24);
  assert.equal(lines[0].transferPlan.sources[0].recommendedUnits, 6);
});
test('unknown destination retains follow-up reasons and source outgoing references', () => {
  const transfer = {
    ...doc('open'),
    status: 'confirmed',
    completedDate: null,
    items: [{ subProductId: 'p', sizeId: 's', quantity: 15, receivedQty: 0 }],
  };
  const lines = [line('shop', null), line('hub', 12)];
  applyTransferPlans(lines, e([transfer]), { now, coverDays: 14 });
  assert.match(
    lines[0].transferPlan.pending[0].followUpReason,
    /Source stock cannot cover/,
  );
  assert.equal(
    lines[1].transferPlan.outgoing[0].destinationWarehouseName,
    'shop',
  );
  assert.equal(lines[1].transferPlan.outgoing[0].transferId, 'open');
  assert.equal(lines[0].transferPlan.nextStep, 'verify_stock');
});
