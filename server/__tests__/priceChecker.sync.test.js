const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Stock = require('../models/WarehouseStock');
const Unknown = require('../models/UnknownBarcodeScan');
const KioskScan = require('../models/KioskScan');
const { buildSync } = require('../services/priceChecker/book');

const ids = {
  size: 'a'.repeat(24),
  sub: 'b'.repeat(24),
  product: 'c'.repeat(24),
  tenant: 'd'.repeat(24),
  loc: 'e'.repeat(24),
};
const context = {
  kiosk: {
    _id: ids.size,
    tenant: ids.tenant,
    location: ids.loc,
    shopId: 'retail',
    name: 'Counter',
    currency: 'NGN',
    settings: {},
  },
  tenant: { posSettings: {} },
  pricelist: null,
};
const sizeRow = {
  _id: ids.size,
  subproduct: ids.sub,
  size: 700,
  displayName: '70cl',
  barcode: '4901877007131',
  sellingPrice: 8000,
  wholesalePrice: 7200,
  currency: 'NGN',
  status: 'active',
};
const q = (value) => ({
  select() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean: async () => value,
});

function setup(t) {
  t.mock.method(Size, 'find', () => q([sizeRow]));
  t.mock.method(SubProduct, 'findOne', () => q({
    _id: ids.sub,
    product: ids.product,
    baseSellingPrice: 7000,
    currency: 'NGN',
  }));
  t.mock.method(Product, 'findOne', () => q({ _id: ids.product, name: 'Glen Grant 12', images: [], isAlcoholic: true }));
  t.mock.method(Stock, 'findOne', () => q({ currentQuantity: 5, reservedQuantity: 1 }));
  const created = [];
  t.mock.method(KioskScan, 'create', async (rows) => {
    for (const row of rows) created.push(row.toObject?.() ?? row);
    return rows;
  });
  t.mock.method(KioskScan, 'findOne', () => ({ session: () => ({ lean: async () => null }) }));
  t.mock.method(Unknown, 'updateOne', () => ({ session: async () => ({}) }));
  t.mock.method(mongoose.connection, 'transaction', (fn) => fn({}));
  return created;
}

const iso = (ms) => new Date(Date.now() - ms).toISOString();

test('buildSync validates each entry and rejects >50 batches', async (t) => {
  setup(t);
  await assert.rejects(
    buildSync(
      context,
      { scans: new Array(51).fill({ barcode: '4901877007131', requestId: 'aaaaaaaaaaaaaaaa' }) }
    ),
    /at most 50/u
  );
  const result = await buildSync(context, {
    scans: [
      { barcode: '4901877007131', requestId: 'aaaaaaaaaaaaaaaa' },
      { barcode: '4901877007131', requestId: 'short' },
      { barcode: 'x'.repeat(140), requestId: 'bbbbbbbbbbbbbbbb' },
      { barcode: '4901877007131', requestId: 'cccccccccccccccc', scannedAt: 'nope' },
    ],
  });
  assert.equal(result.synced.length, 1);
  assert.equal(result.rejected.length, 3);
  assert.ok(result.rejected.every((row) => row.requestId && row.error));
});

test('a valid batch logs scans with the client timestamps clamped to 7 days', async (t) => {
  const created = setup(t);
  const result = await buildSync(context, {
    scans: [
      { barcode: '4901877007131', requestId: 'aaaaaaaaaaaaaaaa', scannedAt: iso(3600_000) },
      { barcode: '4901877007131', requestId: 'bbbbbbbbbbbbbbbb', scannedAt: iso(8 * 86400_000) },
      { barcode: '4901877007131', requestId: 'cccccccccccccccc', scannedAt: iso(-3600_000) },
    ],
  });
  assert.equal(result.synced.length, 3);
  assert.equal(result.rejected.length, 0);
  const first = created.find((row) => row.requestId === 'aaaaaaaaaaaaaaaa');
  assert.equal(first.origin, 'kiosk');
  assert.ok(Math.abs(new Date(first.scannedAt).getTime() - (Date.now() - 3600_000)) < 5000);
  // Too-old and future timestamps are clamped, not rejected.
  const clamped = created.find((row) => row.requestId === 'bbbbbbbbbbbbbbbb');
  assert.ok(clamped.scannedAt <= new Date(Date.now() - 6.9 * 86400_000));
  const future = created.find((row) => row.requestId === 'cccccccccccccccc');
  assert.ok(future.scannedAt <= Date.now());
});

test('duplicate requestIds in the batch are logged once, the rest rejected', async (t) => {
  setup(t);
  const result = await buildSync(context, {
    scans: ['dddddddddddddddd', 'dddddddddddddddd'].map((requestId) => ({
      barcode: '4901877007131',
      requestId,
      scannedAt: iso(60_000),
    })),
  });
  assert.equal(result.synced.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].error, /already/u);
});
