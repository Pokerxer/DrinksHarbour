// giftCheckout.test.cjs — pure-node tests for src/lib/giftCheckout.ts.
// The module is pure TypeScript (no React, no DOM), so the gifting.test.cjs
// loader style is reduced to a typescript transpile + Module compile.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.join(sourceRoot, relative);
  const m = new Module(filename, module);
  m.paths = module.paths;
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
  return m.exports;
}

const lib = load('lib/giftCheckout.ts');
const {
  validateGiftDetails,
  buildGiftPayload,
  tomorrowISO,
  maxISO,
  giftDateBounds,
  lagosTodayISO,
  GIFT_DATE_MAX_DAYS,
  GIFT_MESSAGE_MAX,
} = lib;

const TODAY = '2026-10-27'; // a fixed Africa/Lagos "today" for deterministic tests

const validInput = () => ({
  from: '  Ada Obi  ',
  to: '  Emeka  ',
  message: 'Happy birthday!',
  requestedDeliveryDate: '2026-10-28',
  packagingRequested: true,
});

// ─── validateGiftDetails ─────────────────────────────────────────────────────

test('valid details pass and are trimmed', () => {
  const res = validateGiftDetails(validInput(), TODAY);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, {});
  assert.deepEqual(res.value, {
    from: 'Ada Obi',
    to: 'Emeka',
    message: 'Happy birthday!',
    requestedDeliveryDate: '2026-10-28',
    packagingRequested: true,
  });
});

test('from/to must be non-empty after trim', () => {
  assert.equal(validateGiftDetails({ ...validInput(), from: '   ' }, TODAY).ok, false);
  assert.ok(validateGiftDetails({ ...validInput(), from: '   ' }, TODAY).errors.from);
  assert.equal(validateGiftDetails({ ...validInput(), to: '' }, TODAY).ok, false);
  assert.ok(validateGiftDetails({ ...validInput(), to: '' }, TODAY).errors.to);
});

test('from/to enforce the 80-character ceiling', () => {
  const eighty = 'x'.repeat(80);
  const eightyOne = 'x'.repeat(81);
  assert.equal(validateGiftDetails({ ...validInput(), from: eighty }, TODAY).ok, true);
  assert.equal(validateGiftDetails({ ...validInput(), from: eightyOne }, TODAY).ok, false);
  assert.equal(validateGiftDetails({ ...validInput(), to: eighty }, TODAY).ok, true);
  assert.equal(validateGiftDetails({ ...validInput(), to: eightyOne }, TODAY).ok, false);
});

test('message accepts 500 chars and rejects 501', () => {
  assert.equal(validateGiftDetails({ ...validInput(), message: 'y'.repeat(GIFT_MESSAGE_MAX) }, TODAY).ok, true);
  const over = validateGiftDetails({ ...validInput(), message: 'y'.repeat(GIFT_MESSAGE_MAX + 1) }, TODAY);
  assert.equal(over.ok, false);
  assert.match(over.errors.message, /500/);
});

test('requested date must be tomorrow or later (Lagos) — past/today rejected', () => {
  for (const past of ['2026-01-01', TODAY]) {
    const res = validateGiftDetails({ ...validInput(), requestedDeliveryDate: past }, TODAY);
    assert.equal(res.ok, false, past);
    assert.match(res.errors.requestedDeliveryDate, /tomorrow|later/i);
  }
  assert.equal(validateGiftDetails({ ...validInput(), requestedDeliveryDate: tomorrowISO(TODAY) }, TODAY).ok, true);
});

test('requested date beyond +180 days is rejected; the boundary itself passes', () => {
  const max = maxISO(TODAY);
  assert.equal(GIFT_DATE_MAX_DAYS, 180);
  assert.equal(validateGiftDetails({ ...validInput(), requestedDeliveryDate: max }, TODAY).ok, true);
  const beyond = tomorrowISO(max); // one day past the window
  const res = validateGiftDetails({ ...validInput(), requestedDeliveryDate: beyond }, TODAY);
  assert.equal(res.ok, false);
  assert.match(res.errors.requestedDeliveryDate, /180/);
});

test('malformed dates are rejected', () => {
  for (const bad of ['', 'not-a-date', '2026-2-3', '2026-13-01', '2026-02-30']) {
    const res = validateGiftDetails({ ...validInput(), requestedDeliveryDate: bad }, TODAY);
    assert.equal(res.ok, false, bad);
  }
});

test('packagingRequested normalizes to a strict boolean', () => {
  assert.equal(validateGiftDetails({ ...validInput(), packagingRequested: true }, TODAY).value.packagingRequested, true);
  assert.equal(validateGiftDetails({ ...validInput(), packagingRequested: false }, TODAY).value.packagingRequested, false);
  assert.equal(validateGiftDetails({ ...validInput(), packagingRequested: undefined }, TODAY).value.packagingRequested, false);
});

test('failed validation returns a null value (never a half-built payload)', () => {
  assert.equal(validateGiftDetails({ ...validInput(), to: '' }, TODAY).value, null);
});

// ─── buildGiftPayload ────────────────────────────────────────────────────────

test('payload matches the shared order.gift contract exactly', () => {
  const res = validateGiftDetails(validInput(), TODAY);
  assert.equal(res.ok, true);
  const payload = buildGiftPayload(res.value);
  assert.deepEqual(payload, {
    isGift: true,
    from: 'Ada Obi',
    to: 'Emeka',
    message: 'Happy birthday!',
    requestedDeliveryDate: '2026-10-28',
    packagingRequested: true,
  });
  assert.equal(Object.keys(payload).length, 6);
});

// ─── Date helpers ────────────────────────────────────────────────────────────

test('tomorrowISO and maxISO roll over month/year boundaries', () => {
  assert.equal(tomorrowISO('2026-10-31'), '2026-11-01');
  assert.equal(tomorrowISO('2026-12-31'), '2027-01-01');
  assert.equal(tomorrowISO('2028-02-28'), '2028-02-29'); // leap year
  assert.equal(maxISO('2026-10-27'), '2027-04-25');      // +180 days
});

test('giftDateBounds feeds a date input with min=tomorrow, max=+180d', () => {
  assert.deepEqual(giftDateBounds(TODAY), { min: '2026-10-28', max: '2027-04-25' });
});

test('lagosTodayISO shifts at the UTC+1 boundary', () => {
  // 23:30 UTC is already tomorrow in Lagos (UTC+1).
  assert.equal(lagosTodayISO(new Date('2026-01-01T23:30:00Z')), '2026-01-02');
  assert.equal(lagosTodayISO(new Date('2026-01-01T22:59:00Z')), '2026-01-01');
  assert.equal(lagosTodayISO(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(lagosTodayISO(new Date('2026-06-15T00:00:00Z')), '2026-06-15');
});
