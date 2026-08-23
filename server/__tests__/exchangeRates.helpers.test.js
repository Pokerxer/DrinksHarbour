// server/__tests__/exchangeRates.helpers.test.js
//
// Pure logic for the exchange-rate module. The conversion resolver must match
// the client's resolveRate() in client/apps/admin/src/app/shared/purchases/
// exchange-rates-helpers.ts — direct, then inverse, then triangulated through
// the base currency — so a PO converted server-side never disagrees with what
// the analysis screens showed the tenant.
const test = require('node:test');
const assert = require('node:assert');
const {
  utcMidnightToday,
  normalizeEffectiveDate,
  sanitizeRateUpdate,
  resolveConversion,
  SUPPORTED_CURRENCIES,
} = require('../services/exchangeRates.helpers');

// ── utcMidnightToday ──────────────────────────────────────────────────────────

test('utcMidnightToday returns UTC midnight of the local calendar day', () => {
  // Local 2026-08-23 00:30 → UTC-midnight key 2026-08-23T00:00Z.
  const localEarly = new Date(2026, 7, 23, 0, 30);
  assert.strictEqual(utcMidnightToday(localEarly).toISOString(), '2026-08-23T00:00:00.000Z');
  // Late-night locals stay on their own calendar day.
  const localLate = new Date(2026, 11, 31, 23, 59);
  assert.strictEqual(utcMidnightToday(localLate).toISOString(), '2026-12-31T00:00:00.000Z');
});

test('utcMidnightToday is stable regardless of the time of day it runs', () => {
  const morning = new Date(2026, 3, 5, 6, 0);
  const night = new Date(2026, 3, 5, 22, 0);
  assert.deepStrictEqual(utcMidnightToday(morning), utcMidnightToday(night));
});

// ── normalizeEffectiveDate ────────────────────────────────────────────────────

test('normalizeEffectiveDate parses YYYY-MM-DD as that UTC day', () => {
  assert.strictEqual(
    normalizeEffectiveDate('2026-08-23').toISOString(),
    '2026-08-23T00:00:00.000Z'
  );
});

test('normalizeEffectiveDate truncates timestamps to their calendar day', () => {
  assert.strictEqual(
    normalizeEffectiveDate('2026-08-23T15:45:00.000Z').toISOString(),
    '2026-08-23T00:00:00.000Z'
  );
  assert.strictEqual(
    normalizeEffectiveDate(new Date('2026-01-02T10:00:00Z')).toISOString(),
    '2026-01-02T00:00:00.000Z'
  );
});

test('normalizeEffectiveDate rejects junk', () => {
  assert.strictEqual(normalizeEffectiveDate('not-a-date'), null);
  assert.strictEqual(normalizeEffectiveDate(''), null);
  assert.strictEqual(normalizeEffectiveDate(undefined), null);
});

// ── sanitizeRateUpdate ────────────────────────────────────────────────────────

test('sanitizeRateUpdate keeps only whitelisted fields', () => {
  const { updates } = sanitizeRateUpdate({
    rate: 1550,
    isActive: false,
    notes: 'cbn',
    source: 'manual',
    tenant: 'evil',
    createdBy: 'evil',
    __proto__: { hacked: true },
    somethingElse: 'x',
  });
  assert.deepStrictEqual(updates, {
    rate: 1550,
    isActive: false,
    notes: 'cbn',
    source: 'manual',
  });
});

test('sanitizeRateUpdate rejects non-positive rates', () => {
  assert.match(sanitizeRateUpdate({ rate: 0 }).error, /greater than zero/);
  assert.match(sanitizeRateUpdate({ rate: -5 }).error, /greater than zero/);
  assert.match(sanitizeRateUpdate({ rate: 'abc' }).error, /greater than zero/);
});

test('sanitizeRateUpdate validates currency pairs', () => {
  assert.match(sanitizeRateUpdate({ fromCurrency: 'NGN', toCurrency: 'NGN' }).error, /different/);
  assert.match(sanitizeRateUpdate({ fromCurrency: 'JPY' }).error, /Unsupported currency/);
  // A lone fromCurrency is fine when it differs from the stored pair check
  // done by the caller; uppercase normalisation happens here.
  const { updates } = sanitizeRateUpdate({ fromCurrency: 'usd' });
  assert.strictEqual(updates.fromCurrency, 'USD');
});

test('sanitizeRateUpdate trims and bounds notes', () => {
  const { error } = sanitizeRateUpdate({ notes: 'x'.repeat(501) });
  assert.match(error, /500 characters or fewer/);
  const { updates: ok } = sanitizeRateUpdate({ notes: '  cbn official  ' });
  assert.strictEqual(ok.notes, 'cbn official');
});

test('sanitizeRateUpdate accepts an empty body as "nothing to change"', () => {
  const res = sanitizeRateUpdate({});
  assert.strictEqual(res.error, undefined);
  assert.deepStrictEqual(res.updates, {});
});

// ── resolveConversion ─────────────────────────────────────────────────────────

const ROWS = [
  { fromCurrency: 'USD', toCurrency: 'NGN', rate: 1550 },
  { fromCurrency: 'EUR', toCurrency: 'NGN', rate: 1700 },
];

test('resolveConversion matches the client resolver: direct, inverse, triangulated', () => {
  assert.strictEqual(resolveConversion(ROWS, 'USD', 'NGN'), 1550);
  assert.strictEqual(resolveConversion(ROWS, 'NGN', 'USD'), 1 / 1550);
  assert.strictEqual(resolveConversion(ROWS, 'EUR', 'USD'), 1700 / 1550);
});

test('resolveConversion returns 1 for identical currencies', () => {
  assert.strictEqual(resolveConversion(ROWS, 'NGN', 'NGN'), 1);
});

test('resolveConversion returns null for unreachable pairs', () => {
  assert.strictEqual(
    resolveConversion([{ fromCurrency: 'GBP', toCurrency: 'NGN', rate: 2000 }], 'USD', 'GBP'),
    null
  );
});

test('SUPPORTED_CURRENCIES matches the model enum and client list', () => {
  assert.deepStrictEqual(SUPPORTED_CURRENCIES, ['NGN', 'USD', 'EUR', 'GBP']);
});
