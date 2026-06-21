const test = require('node:test');
const assert = require('node:assert');
const {
  GIFT_CARD_STATUSES,
  GIFT_CARD_TX_TYPES,
  generateGiftCardCode,
  formatGiftCardCode,
  normalizeGiftCardCode,
  validateGiftCardPurchase,
  isExpired,
  validateGiftCardRedeem,
  applyGiftCardDelta,
  computeStatusAfterRedeem,
  summarizeGiftCard,
  signGiftCardToken,
  verifyGiftCardToken,
} = require('../services/giftCard.helpers');

test('enums', () => {
  assert.deepStrictEqual(GIFT_CARD_STATUSES, ['pending_payment', 'active', 'redeemed', 'expired', 'disabled']);
  assert.deepStrictEqual(GIFT_CARD_TX_TYPES, ['issue', 'redeem', 'refund', 'adjustment']);
});

test('generateGiftCardCode is normalized and deterministic under injected rng', () => {
  const code = generateGiftCardCode({ randomInt: () => 0 });
  assert.strictEqual(code, 'DHGC222222222222'); // alphabet[0] === '2', 12 chars
  assert.match(code, /^DHGC[2-9A-HJ-NP-Z]{12}$/);
});

test('formatGiftCardCode produces the dashed display form', () => {
  assert.strictEqual(formatGiftCardCode('DHGCAB23CD45EF67'), 'DHGC-AB23-CD45-EF67');
  assert.strictEqual(formatGiftCardCode('dhgc-ab23-cd45-ef67'), 'DHGC-AB23-CD45-EF67');
});

test('normalizeGiftCardCode uppercases and strips separators', () => {
  assert.strictEqual(normalizeGiftCardCode('dhgc-ab23 cd45-ef67'), 'DHGCAB23CD45EF67');
  assert.strictEqual(normalizeGiftCardCode(null), '');
});

test('validateGiftCardPurchase accepts amount + recipient + design', () => {
  const r = validateGiftCardPurchase({
    amount: 5000,
    recipient: { email: 'GIFT@X.com ', name: ' Ada ', message: ' enjoy ', sendAt: '2026-12-25' },
    design: { templateId: 'classic', theme: 'gold' },
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.initialAmount, 5000);
  assert.strictEqual(r.value.recipient.email, 'gift@x.com');
  assert.strictEqual(r.value.recipient.name, 'Ada');
  assert.ok(r.value.recipient.sendAt instanceof Date);
  assert.deepStrictEqual(r.value.design, { templateId: 'classic', theme: 'gold' });
});

test('validateGiftCardPurchase rejects bad amount/email/sendAt and unknown design when restricted', () => {
  assert.strictEqual(validateGiftCardPurchase({ amount: 0 }).ok, false);
  assert.strictEqual(validateGiftCardPurchase({ amount: 10, recipient: { email: 'nope' } }).ok, false);
  assert.strictEqual(validateGiftCardPurchase({ amount: 10, recipient: { sendAt: 'not-a-date' } }).ok, false);
  assert.strictEqual(
    validateGiftCardPurchase({ amount: 10, design: { theme: 'neon' } }, { themes: ['gold', 'silver'] }).ok,
    false,
  );
});

test('isExpired', () => {
  const now = new Date('2026-06-21T00:00:00Z');
  assert.strictEqual(isExpired(null, now), false);
  assert.strictEqual(isExpired('2026-06-20T00:00:00Z', now), true);
  assert.strictEqual(isExpired('2026-06-22T00:00:00Z', now), false);
});

test('validateGiftCardRedeem checks status/expiry/balance/amount', () => {
  const now = new Date('2026-06-21T00:00:00Z');
  const card = { status: 'active', balance: 1000, expiresAt: '2026-12-31T00:00:00Z' };
  assert.strictEqual(validateGiftCardRedeem(card, 400, now).ok, true);
  assert.strictEqual(validateGiftCardRedeem(card, 0, now).ok, false);
  assert.strictEqual(validateGiftCardRedeem(card, 2000, now).ok, false);
  assert.strictEqual(validateGiftCardRedeem({ ...card, status: 'disabled' }, 400, now).ok, false);
  assert.strictEqual(validateGiftCardRedeem({ ...card, expiresAt: '2026-01-01T00:00:00Z' }, 400, now).ok, false);
});

test('applyGiftCardDelta + computeStatusAfterRedeem', () => {
  assert.deepStrictEqual(applyGiftCardDelta(1000, 'redeem', 400), { ok: true, balanceAfter: 600 });
  assert.deepStrictEqual(applyGiftCardDelta(1000, 'refund', 400), { ok: true, balanceAfter: 1400 });
  assert.strictEqual(applyGiftCardDelta(100, 'redeem', 200).ok, false);
  assert.strictEqual(computeStatusAfterRedeem(0), 'redeemed');
  assert.strictEqual(computeStatusAfterRedeem(50), 'active');
});

test('summarizeGiftCard rolls up redeem/refund/count/lastActivityAt', () => {
  const s = summarizeGiftCard([
    { type: 'issue', amount: 1000, createdAt: '2026-01-01T00:00:00Z' },
    { type: 'redeem', amount: 400, createdAt: '2026-02-01T00:00:00Z' },
    { type: 'refund', amount: 100, createdAt: '2026-01-20T00:00:00Z' },
  ]);
  assert.strictEqual(s.redeemed, 400);
  assert.strictEqual(s.refunded, 100);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.lastActivityAt, '2026-02-01T00:00:00.000Z');
});

test('QR sign/verify roundtrip, tamper and wrong-secret rejection', () => {
  const secret = 'test-secret';
  const token = signGiftCardToken({ gid: 'g1', code: 'DHGCAB23CD45EF67', nonce: 'n1' }, secret);
  const ok = verifyGiftCardToken(token, secret);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.payload.gid, 'g1');
  assert.strictEqual(ok.payload.code, 'DHGCAB23CD45EF67');

  assert.strictEqual(verifyGiftCardToken(token, 'other-secret').ok, false);
  assert.strictEqual(verifyGiftCardToken('garbage', secret).ok, false);

  const [body] = token.split('.');
  const tampered = `${body}xx.${token.split('.')[1]}`;
  assert.strictEqual(verifyGiftCardToken(tampered, secret).ok, false);
});
