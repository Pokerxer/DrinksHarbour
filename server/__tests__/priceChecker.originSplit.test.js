const test = require('node:test');
const assert = require('node:assert/strict');
const Scan = require('../models/KioskScan');
const Kiosk = require('../models/PriceCheckerKiosk');
const { originSplit, getAnalytics } = require('../services/priceChecker/analytics');

// currentPrice enrichment needs a kiosk context; nulls keep the flow shallow.
const mockKiosk = (t) => t.mock.method(Kiosk, 'findOne', () => ({ lean: async () => null }));

test('originSplit counts by origin with legacy values defaulting to kiosk', () => {
  const rows = [
    { _id: 'phone', scans: 3 },
    { _id: 'kiosk', scans: 4 },
  ];
  assert.deepEqual(originSplit(rows), { kiosk: 4, phone: 3 });
  assert.deepEqual(originSplit([]), { kiosk: 0, phone: 0 });
  assert.deepEqual(originSplit([{ _id: null, scans: 2 }]), { kiosk: 2, phone: 0 });
});

test('getAnalytics reports the origin split from a grouped aggregate', async (t) => {
  t.mock.method(Scan, 'aggregate', async () => [
    { _id: 'phone', scans: 5 },
  ]);
  mockKiosk(t);
  const result = await getAnalytics('a'.repeat(24), {
    from: '2026-11-01',
    to: '2026-11-02',
  });
  assert.deepEqual(result.overview.byOrigin, { kiosk: 0, phone: 5 });
});
