const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { scanOrigin, pairingSession } = require('../services/priceChecker/validation');
const KioskScan = require('../models/KioskScan');
const Unknown = require('../models/UnknownBarcodeScan');
const { logScan, scanRequestId } = require('../services/priceChecker/scans');

const ids = ['a', 'b'].map((c) => c.repeat(24));

test('scanOrigin defaults to kiosk and rejects unknown values', () => {
  assert.equal(scanOrigin(undefined), 'kiosk');
  assert.equal(scanOrigin('phone'), 'phone');
  assert.equal(scanOrigin('kiosk'), 'kiosk');
  assert.throws(() => scanOrigin('pos'), /origin/u);
});

test('pairingSession accepts 10-64 word chars/hyphens and rejects the rest', () => {
  assert.throws(() => pairingSession('abc'), /pairing/u);
  assert.throws(() => pairingSession('x'.repeat(65)), /pairing/u);
  assert.throws(() => pairingSession(42), /pairing/u);
  assert.equal(pairingSession('abc-def-123456789'), 'abc-def-123456789');
  assert.equal(pairingSession(undefined), '');
});

test('scanRequestId keeps its documented request-id shape', () => {
  assert.equal(typeof scanRequestId('aaaa-aaaa-aaaa-aa1'), 'string');
  assert.throws(() => scanRequestId('short'));
});

test('logScan records the scan origin on the kiosk scan document', async (t) => {
  let captured;
  t.mock.method(KioskScan, 'create', async (rows) => {
    captured = rows.at(-1);
    return rows;
  });
  t.mock.method(KioskScan, 'findOne', () => ({
    session: () => ({ lean: async () => null }),
  }));
  // `Unknown.updateOne(...).session(session)` must resolve without a database.
  const noopUpsert = { session: async () => ({}) };
  t.mock.method(Unknown, 'updateOne', () => noopUpsert);
  t.mock.method(mongoose.connection, 'transaction', (fn) => fn({}));

  const context = {
    kiosk: {
      _id: ids[0],
      tenant: ids[1],
      location: ids[0],
      shopId: 'retail',
      name: 'Kiosk',
    },
  };
  await logScan(context, '000123', 'aaaaaaaaaaaaaaaa-REQ-1', { outcome: 'UNKNOWN' }, 'phone');
  assert.equal(captured.origin, 'phone');
  await logScan(context, '000123', 'bbbbbbbbbbbbbbbb-REQ-2', { outcome: 'UNKNOWN' });
  assert.equal(captured.origin, 'kiosk');
});
