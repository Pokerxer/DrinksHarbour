// server/__tests__/adminCarts.service.test.js
//
// buildCartRow is the tenant-isolation boundary for the admin "Live Carts"
// tab: a tenant admin must see their own lines and only a COUNT of everyone
// else's. These are pure-function tests — no DB — because the rule must hold
// regardless of how the controller happened to query.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const {
  bucketFor,
  buildCartRow,
  buildSignupRow,
  registrationWindowSince,
  summarize,
  summarizeNewCustomers,
} = require('../services/adminCarts.service');

const oid = () => new mongoose.Types.ObjectId();
const NOW = new Date('2026-09-01T12:00:00.000Z');
const hoursBefore = (h) => new Date(NOW.getTime() - h * 3_600_000);

function fixture() {
  const tenantId = oid();
  const otherTenantId = oid();
  const mySub = {
    _id: oid(),
    tenant: tenantId,
    sku: 'HEN-VS',
    product: { _id: oid(), name: 'Hennessy VS' },
  };
  const otherSub = {
    _id: oid(),
    tenant: otherTenantId,
    sku: 'MOET-ICE',
    product: { _id: oid(), name: 'Moet Ice' },
  };
  const sizeA = oid();
  const sizeB = oid();
  const userId = oid();

  const cart = {
    _id: oid(),
    user: userId,
    updatedAt: hoursBefore(2),
    createdAt: hoursBefore(50),
    items: [
      {
        subproduct: mySub._id,
        product: mySub.product._id,
        size: sizeA,
        tenant: tenantId,
        quantity: 3,
        priceAtAddition: 45000,
      },
      {
        subproduct: otherSub._id,
        product: otherSub.product._id,
        size: sizeB,
        tenant: otherTenantId,
        quantity: 2,
        priceAtAddition: 32000,
      },
    ],
  };

  return {
    tenantId,
    otherTenantId,
    mySub,
    otherSub,
    sizeA,
    sizeB,
    userId,
    cart,
    subById: new Map([
      [String(mySub._id), mySub],
      [String(otherSub._id), otherSub],
    ]),
    sizeNameById: new Map([
      [String(sizeA), '75cl'],
      [String(sizeB), '20cl'],
    ]),
    userById: new Map([
      [
        String(userId),
        {
          _id: userId,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '+2348012345678',
        },
      ],
    ]),
  };
}

test('a tenant admin sees only their own lines; the rest are a bare count', () => {
  const f = fixture();
  const row = buildCartRow({
    cart: f.cart,
    subById: f.subById,
    sizeNameById: f.sizeNameById,
    userById: f.userById,
    tenantId: f.tenantId,
    isPlatformAdmin: false,
    now: NOW,
  });

  assert.strictEqual(row.itemCount, 1);
  assert.strictEqual(row.kind, 'cart');
  assert.strictEqual(row.skippedCount, 1);
  assert.strictEqual(row.items[0].name, 'Hennessy VS');
  assert.strictEqual(row.items[0].sizeName, '75cl');
  // Value is the visible lines only — never the whole cart.
  assert.strictEqual(row.value, 135000);
  assert.strictEqual(row.totalQuantity, 3);

  // The competitor's product must not be recoverable from the payload at all.
  const blob = JSON.stringify(row);
  assert.ok(!blob.includes('Moet Ice'), 'other tenant product name leaked');
  assert.ok(!blob.includes('MOET-ICE'), 'other tenant SKU leaked');
  assert.ok(
    !blob.includes(String(f.otherSub._id)),
    'other tenant subproduct id leaked'
  );
});

test('a platform admin sees every line', () => {
  const f = fixture();
  const row = buildCartRow({
    cart: f.cart,
    subById: f.subById,
    sizeNameById: f.sizeNameById,
    userById: f.userById,
    tenantId: null,
    isPlatformAdmin: true,
    now: NOW,
  });
  assert.strictEqual(row.itemCount, 2);
  assert.strictEqual(row.skippedCount, 0);
  assert.strictEqual(row.value, 135000 + 64000);
});

test('a line whose subproduct no longer resolves is hidden from a tenant, kept for the platform', () => {
  const f = fixture();
  // Simulate the subproduct having been deleted since the cart was filled.
  const subById = new Map([[String(f.mySub._id), f.mySub]]);

  const tenantRow = buildCartRow({
    cart: f.cart,
    subById,
    sizeNameById: f.sizeNameById,
    userById: f.userById,
    tenantId: f.tenantId,
    isPlatformAdmin: false,
    now: NOW,
  });
  assert.strictEqual(tenantRow.itemCount, 1);
  assert.strictEqual(tenantRow.skippedCount, 1);

  const platformRow = buildCartRow({
    cart: f.cart,
    subById,
    sizeNameById: f.sizeNameById,
    userById: f.userById,
    tenantId: null,
    isPlatformAdmin: true,
    now: NOW,
  });
  assert.strictEqual(platformRow.itemCount, 2);
  assert.strictEqual(
    platformRow.items[1].name,
    'Unknown product',
    'an unresolvable line is labelled, not dropped, for a platform admin'
  );
});

test('a cart whose owner was deleted still renders instead of throwing', () => {
  const f = fixture();
  const row = buildCartRow({
    cart: f.cart,
    subById: f.subById,
    sizeNameById: f.sizeNameById,
    userById: new Map(), // owner gone
    tenantId: f.tenantId,
    isPlatformAdmin: false,
    now: NOW,
  });
  assert.strictEqual(row.user.name, 'Deleted account');
  assert.strictEqual(row.itemCount, 1);
});

test('age buckets: <24h active, 24h-7d at risk, >7d abandoned', () => {
  assert.strictEqual(bucketFor(hoursBefore(1), NOW), 'active');
  assert.strictEqual(bucketFor(hoursBefore(23.9), NOW), 'active');
  // Exactly 24h has already left "active" — the boundary is inclusive at the
  // bottom of the next bucket, so no cart can fall between two buckets.
  assert.strictEqual(bucketFor(hoursBefore(24), NOW), 'at_risk');
  assert.strictEqual(bucketFor(hoursBefore(24 * 7 - 1), NOW), 'at_risk');
  assert.strictEqual(bucketFor(hoursBefore(24 * 7), NOW), 'abandoned');
  assert.strictEqual(bucketFor(hoursBefore(24 * 90), NOW), 'abandoned');
});

test('ageHours is reported from updatedAt, not createdAt', () => {
  const f = fixture(); // updatedAt 2h ago, createdAt 50h ago
  const row = buildCartRow({
    cart: f.cart,
    subById: f.subById,
    sizeNameById: f.sizeNameById,
    userById: f.userById,
    tenantId: f.tenantId,
    isPlatformAdmin: false,
    now: NOW,
  });
  assert.strictEqual(row.ageHours, 2);
  assert.strictEqual(row.bucket, 'active');
});

test('summarize totals only the rows it was given', () => {
  const rows = [
    { bucket: 'active', value: 1000, totalQuantity: 2 },
    { bucket: 'active', value: 3000, totalQuantity: 1 },
    { bucket: 'abandoned', value: 2000, totalQuantity: 5 },
  ];
  const s = summarize(rows);
  assert.strictEqual(s.counts.all, 3);
  assert.strictEqual(s.counts.active, 2);
  assert.strictEqual(s.counts.at_risk, 0);
  assert.strictEqual(s.counts.abandoned, 1);
  assert.strictEqual(s.totalValue, 6000);
  assert.strictEqual(s.totalUnits, 8);
  assert.strictEqual(s.averageValue, 2000);
});

test('summarize of an empty page does not divide by zero', () => {
  const s = summarize([]);
  assert.strictEqual(s.counts.all, 0);
  assert.strictEqual(s.averageValue, 0);
  assert.strictEqual(s.totalValue, 0);
});

test('registrationWindowSince: 30/90 days back, month start, all = null', () => {
  const NOW = new Date('2026-09-01T12:00:00.000Z');
  assert.strictEqual(
    registrationWindowSince('30', NOW).toISOString(),
    '2026-08-02T12:00:00.000Z'
  );
  assert.strictEqual(
    registrationWindowSince('90', NOW).toISOString(),
    '2026-06-03T12:00:00.000Z'
  );
  // 'month' is the start of the current UTC month — a customer registered at
  // midnight on the 1st is included (inclusive lower bound).
  assert.strictEqual(
    registrationWindowSince('month', NOW).toISOString(),
    '2026-09-01T00:00:00.000Z'
  );
  assert.strictEqual(registrationWindowSince('all', NOW), null);
});

test('buildSignupRow shapes a new customer with no cart', () => {
  const userId = oid();
  const user = {
    _id: userId,
    firstName: 'Kelly',
    lastName: 'Oruma',
    email: 'kellyoruma10@gmail.com',
    phone: '',
    createdAt: new Date('2026-08-14T17:25:47.573Z'),
  };
  const row = buildSignupRow(user, NOW, '30');
  assert.strictEqual(row.kind, 'signup');
  assert.strictEqual(row._id, userId);
  assert.strictEqual(row.user.name, 'Kelly Oruma');
  assert.strictEqual(row.user.email, 'kellyoruma10@gmail.com');
  assert.strictEqual(
    row.joinedAt.toISOString(),
    '2026-08-14T17:25:47.573Z'
  );
  assert.strictEqual(row.registrationWindow, '30');
});

test('buildSignupRow falls back when the name is missing', () => {
  const userId = oid();
  const row = buildSignupRow(
    {
      _id: userId,
      firstName: '',
      lastName: '',
      email: 'only@email.ng',
      phone: '',
      createdAt: NOW,
    },
    NOW,
    '30'
  );
  assert.strictEqual(row.user.name, 'only@email.ng');
  assert.strictEqual(row.user.phone, '');
});

test('summarizeNewCustomers counts shoppers, withCart, noCart and value from rows', () => {
  const s = summarizeNewCustomers([
    { kind: 'cart', value: 135000 },
    { kind: 'cart', value: 0 },
    { kind: 'signup' },
  ]);
  assert.strictEqual(s.shoppers, 3);
  assert.strictEqual(s.withCart, 2);
  assert.strictEqual(s.noCart, 1);
  assert.strictEqual(s.totalValue, 135000);
});

test('summarizeNewCustomers of an empty page is all zeros', () => {
  const s = summarizeNewCustomers([]);
  assert.deepStrictEqual(s, {
    shoppers: 0,
    withCart: 0,
    noCart: 0,
    totalValue: 0,
  });
});
