# Platform Stored Value — Phase 1 (Domain + Models) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure money/QR domain, the platform-scoped Mongoose models, and the thin atomic services for a platform e-wallet + gift cards — without any routes, controllers, or client work.

**Architecture:** Mirror the existing tenant-wallet split exactly: pure DB-less helpers carry the money rules (validate / applyDelta / summarize) and are fully unit-tested; thin atomic services pair those rules with a guarded `$inc` + append-only ledger row (mirroring `server/services/wallet.service.js`). Platform-scoped models carry no required `tenant`; `redeemedAtTenant` only records where value was spent.

**Tech Stack:** Node.js, Express, Mongoose; `node:test` (pure, DB-less); `crypto` for HMAC-SHA256 QR tokens.

## Global Constraints

- Money is **positive integer NGN** (no sub-units). Every amount: `Number.isInteger(n) && n > 0`.
- Balances **never go negative**; debits are refused when they would overdraw.
- Do **not** modify or rename the existing tenant `WalletTransaction` / `mutateWallet` / POS `'wallet'` tender.
- Platform-scoped models have **no required `tenant`** field.
- Test command (run from repo root): `NODE_PATH=server/node_modules node --test server/__tests__/<file>`.
- Full suite must stay green: `NODE_PATH=server/node_modules node --test server/__tests__/`.
- New models use the `mongoose.models.X || mongoose.model('X', schema)` guard (safe for repeated `require` in tests).
- Branch: `feat/platform-stored-value` (already created off `main`; the spec is already committed there).

## File Structure

| File | Responsibility |
|---|---|
| `server/services/platformWallet.helpers.js` (new) | Pure money rules for the platform wallet |
| `server/services/giftCard.helpers.js` (new) | Pure gift-card domain + signed-QR helpers |
| `server/models/PlatformWalletTransaction.js` (new) | Append-only platform wallet ledger |
| `server/models/User.js` (modify) | Add `platformWalletBalance` |
| `server/models/GiftCard.js` (new) | Gift card record (balance, code, qrToken, status) |
| `server/models/GiftCardTransaction.js` (new) | Append-only gift-card ledger |
| `server/models/PlatformSettlement.js` (new) | Platform→tenant payable (schema only) |
| `server/services/platformWallet.service.js` (new) | Atomic `mutatePlatformWallet` |
| `server/services/giftCard.service.js` (new) | Atomic `issue/redeem/refund` |
| `server/__tests__/platformWallet.helpers.test.js` (new) | Unit tests (pure) |
| `server/__tests__/giftCard.helpers.test.js` (new) | Unit tests (pure) |
| `server/__tests__/platformModels.test.js` (new) | Schema smoke tests (DB-less `validateSync`) |
| `server/__tests__/platformServices.test.js` (new) | Service export/guard smoke tests (DB-less) |

> **Spec refinement note:** the gift-card `code` is stored **normalized** (uppercase, no separators, e.g. `DHGCAB23CD45EF67`) so scan/typed lookups match exactly; a pure `formatGiftCardCode()` derives the dashed display form `DHGC-XXXX-XXXX-XXXX`. This satisfies the spec's "unique code + scannable" intent with a single stored field.

---

### Task 1: Platform wallet pure helpers

**Files:**
- Create: `server/services/platformWallet.helpers.js`
- Test: `server/__tests__/platformWallet.helpers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PLATFORM_WALLET_TX_TYPES = ['credit','debit','refund','adjustment']`
  - `PLATFORM_WALLET_SOURCES = ['purchase','pos','online_checkout','refund','adjustment']`
  - `validatePlatformWalletTx(body) -> { ok:true, value:{ type, amount, source, reason } } | { ok:false, message }`
  - `applyPlatformWalletDelta(currentBalance, type, amount) -> { ok:true, balanceAfter } | { ok:false, message }`
  - `summarizePlatformWallet(transactions) -> { credited, debited, net, count, lastActivityAt }`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/platformWallet.helpers.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  PLATFORM_WALLET_TX_TYPES,
  PLATFORM_WALLET_SOURCES,
  validatePlatformWalletTx,
  applyPlatformWalletDelta,
  summarizePlatformWallet,
} = require('../services/platformWallet.helpers');

test('enums expose the platform wallet types and sources', () => {
  assert.deepStrictEqual(PLATFORM_WALLET_TX_TYPES, ['credit', 'debit', 'refund', 'adjustment']);
  assert.deepStrictEqual(PLATFORM_WALLET_SOURCES, ['purchase', 'pos', 'online_checkout', 'refund', 'adjustment']);
});

test('validatePlatformWalletTx accepts a valid credit', () => {
  const r = validatePlatformWalletTx({ type: 'credit', amount: 500, source: 'purchase', reason: '  top up ' });
  assert.deepStrictEqual(r, { ok: true, value: { type: 'credit', amount: 500, source: 'purchase', reason: 'top up' } });
});

test('validatePlatformWalletTx rejects bad type/source/amount', () => {
  assert.strictEqual(validatePlatformWalletTx({ type: 'x', amount: 1, source: 'purchase' }).ok, false);
  assert.strictEqual(validatePlatformWalletTx({ type: 'credit', amount: 1, source: 'x' }).ok, false);
  assert.strictEqual(validatePlatformWalletTx({ type: 'credit', amount: 0, source: 'purchase' }).ok, false);
  assert.strictEqual(validatePlatformWalletTx({ type: 'credit', amount: 1.5, source: 'purchase' }).ok, false);
});

test('validatePlatformWalletTx caps reason length', () => {
  const r = validatePlatformWalletTx({ type: 'credit', amount: 1, source: 'purchase', reason: 'a'.repeat(281) });
  assert.strictEqual(r.ok, false);
});

test('applyPlatformWalletDelta adds and subtracts with overdraw guard', () => {
  assert.deepStrictEqual(applyPlatformWalletDelta(100, 'credit', 50), { ok: true, balanceAfter: 150 });
  assert.deepStrictEqual(applyPlatformWalletDelta(100, 'refund', 50), { ok: true, balanceAfter: 150 });
  assert.deepStrictEqual(applyPlatformWalletDelta(100, 'debit', 40), { ok: true, balanceAfter: 60 });
  assert.strictEqual(applyPlatformWalletDelta(30, 'debit', 40).ok, false);
  assert.strictEqual(applyPlatformWalletDelta(100, 'debit', 0).ok, false);
});

test('summarizePlatformWallet rolls up credited/debited/net/count/lastActivityAt', () => {
  const s = summarizePlatformWallet([
    { type: 'credit', amount: 100, createdAt: '2026-01-01T00:00:00Z' },
    { type: 'debit', amount: 30, createdAt: '2026-02-01T00:00:00Z' },
    { type: 'refund', amount: 10, createdAt: '2026-01-15T00:00:00Z' },
  ]);
  assert.strictEqual(s.credited, 110);
  assert.strictEqual(s.debited, 30);
  assert.strictEqual(s.net, 80);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.lastActivityAt, '2026-02-01T00:00:00.000Z');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformWallet.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/platformWallet.helpers'`.

- [ ] **Step 3: Write the implementation**

Create `server/services/platformWallet.helpers.js`:

```js
// server/services/platformWallet.helpers.js
//
// Pure, DB-less money rules for the PLATFORM-WIDE customer wallet (platformWallet)
// — a tenant-agnostic stored-value balance held on User.platformWalletBalance plus
// an append-only PlatformWalletTransaction ledger. Mirrors the wallet section of
// contact.helpers.js so the rules are unit-testable without Mongo; the atomic DB
// layer (platformWallet.service.js) pairs these with a guarded $inc.
//
// This is DISTINCT from the tenant store-credit wallet (contact.helpers.js +
// wallet.service.js) and must not be conflated with it.

const PLATFORM_WALLET_TX_TYPES = ['credit', 'debit', 'refund', 'adjustment'];
const PLATFORM_WALLET_SOURCES = ['purchase', 'pos', 'online_checkout', 'refund', 'adjustment'];
const PLATFORM_WALLET_REASON_MAX = 280;

/**
 * Validate + normalise a platform-wallet transaction request. Amount must be a
 * positive integer (NGN has no sub-units); type and source must be allowed; reason
 * is optional, trimmed and length-capped.
 * @returns {{ ok: true, value: { type, amount, source, reason } } | { ok: false, message: string }}
 */
function validatePlatformWalletTx(body = {}) {
  const { type, amount, source, reason } = body;

  if (!PLATFORM_WALLET_TX_TYPES.includes(type)) {
    return { ok: false, message: `Type must be one of: ${PLATFORM_WALLET_TX_TYPES.join(', ')}` };
  }
  if (!PLATFORM_WALLET_SOURCES.includes(source)) {
    return { ok: false, message: `Source must be one of: ${PLATFORM_WALLET_SOURCES.join(', ')}` };
  }

  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'Amount must be a positive integer' };
  }

  const r = reason === undefined || reason === null ? '' : String(reason).trim();
  if (r.length > PLATFORM_WALLET_REASON_MAX) {
    return { ok: false, message: `Reason must be ${PLATFORM_WALLET_REASON_MAX} characters or fewer` };
  }

  return { ok: true, value: { type, amount: n, source, reason: r } };
}

/**
 * Apply a transaction to a balance, returning the new balance. 'debit' subtracts
 * (refused when it would overdraw — the wallet never goes negative); every other
 * type adds. Amount is re-validated so a balance is never mutated by a bad value.
 * @returns {{ ok: true, balanceAfter: number } | { ok: false, message: string }}
 */
function applyPlatformWalletDelta(currentBalance, type, amount) {
  const bal = Number(currentBalance) || 0;
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'Amount must be a positive integer' };
  }
  const balanceAfter = type === 'debit' ? bal - n : bal + n;
  if (balanceAfter < 0) {
    return { ok: false, message: 'Insufficient platform wallet balance' };
  }
  return { ok: true, balanceAfter };
}

/**
 * Roll a ledger up into headline figures: lifetime credited vs debited, the net
 * (== current balance for a consistent ledger), the count and last activity.
 * Pure (no DB / no Date.now). Debits sum under `debited`; all other types under
 * `credited`, mirroring applyPlatformWalletDelta's direction rule.
 */
function summarizePlatformWallet(transactions = []) {
  let credited = 0;
  let debited = 0;
  let lastActivityAt = null;

  for (const t of transactions) {
    const amt = t.amount || 0;
    if (t.type === 'debit') debited += amt;
    else credited += amt;

    const when = t.createdAt;
    const ts = when ? new Date(when).getTime() : NaN;
    if (!Number.isNaN(ts) && (lastActivityAt === null || ts > lastActivityAt)) {
      lastActivityAt = ts;
    }
  }

  return {
    credited,
    debited,
    net: credited - debited,
    count: transactions.length,
    lastActivityAt: lastActivityAt === null ? null : new Date(lastActivityAt).toISOString(),
  };
}

module.exports = {
  PLATFORM_WALLET_TX_TYPES,
  PLATFORM_WALLET_SOURCES,
  PLATFORM_WALLET_REASON_MAX,
  validatePlatformWalletTx,
  applyPlatformWalletDelta,
  summarizePlatformWallet,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformWallet.helpers.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/platformWallet.helpers.js server/__tests__/platformWallet.helpers.test.js
git commit -m "feat(platform-wallet): pure money helpers (validate/applyDelta/summarize)"
```

---

### Task 2: Gift-card pure helpers (domain + signed QR)

**Files:**
- Create: `server/services/giftCard.helpers.js`
- Test: `server/__tests__/giftCard.helpers.test.js`

**Interfaces:**
- Consumes: nothing (uses Node `crypto`).
- Produces:
  - `GIFT_CARD_STATUSES = ['pending_payment','active','redeemed','expired','disabled']`
  - `GIFT_CARD_TX_TYPES = ['issue','redeem','refund','adjustment']`
  - `CODE_PREFIX = 'DHGC'`
  - `generateGiftCardCode(rng = crypto) -> string` (normalized, e.g. `DHGCAB23CD45EF67`)
  - `formatGiftCardCode(code) -> string` (dashed display form)
  - `normalizeGiftCardCode(code) -> string`
  - `validateGiftCardPurchase(body, opts?) -> { ok:true, value:{ initialAmount, recipient?, design? } } | { ok:false, message }`
  - `isExpired(expiresAt, now?) -> boolean`
  - `validateGiftCardRedeem(card, amount, now?) -> { ok:true } | { ok:false, message }`
  - `applyGiftCardDelta(balance, type, amount) -> { ok:true, balanceAfter } | { ok:false, message }`
  - `computeStatusAfterRedeem(balanceAfter) -> 'redeemed' | 'active'`
  - `summarizeGiftCard(transactions) -> { redeemed, refunded, count, lastActivityAt }`
  - `signGiftCardToken({ gid, code, nonce }, secret) -> string`
  - `verifyGiftCardToken(token, secret) -> { ok:true, payload } | { ok:false, message }`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/giftCard.helpers.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/giftCard.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/giftCard.helpers'`.

- [ ] **Step 3: Write the implementation**

Create `server/services/giftCard.helpers.js`:

```js
// server/services/giftCard.helpers.js
//
// Pure, DB-less domain rules for PLATFORM gift cards (giftCard) — a standalone
// stored-value instrument with its own code, balance and scannable QR, usable at
// any tenant. Kept Mongo-free so the money rules, status transitions, code
// formatting and signed-QR token can be unit-tested in isolation; the atomic DB
// layer (giftCard.service.js) pairs these with a guarded $inc.
//
// The stored `code` is the NORMALIZED form (uppercase, no separators); the dashed
// display form is derived with formatGiftCardCode. QR tokens are signed with
// HMAC-SHA256 over { gid, code, nonce }; the DB is always the source of truth for
// balance/status, so no value or expiry is encoded in the token.

const crypto = require('crypto');

const GIFT_CARD_STATUSES = ['pending_payment', 'active', 'redeemed', 'expired', 'disabled'];
const GIFT_CARD_TX_TYPES = ['issue', 'redeem', 'refund', 'adjustment'];
const GIFT_CARD_MESSAGE_MAX = 280;

const CODE_PREFIX = 'DHGC';
const CODE_BODY_LEN = 12;
// Ambiguity-free alphabet (no 0/O, 1/I/L).
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Generate a normalized gift-card code: CODE_PREFIX + CODE_BODY_LEN chars drawn
 * from CODE_ALPHABET. `rng` (default Node crypto) must expose randomInt(max); inject
 * a stub for deterministic tests.
 */
function generateGiftCardCode(rng = crypto) {
  let body = '';
  for (let i = 0; i < CODE_BODY_LEN; i++) {
    body += CODE_ALPHABET[rng.randomInt(CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + body;
}

/** Uppercase + strip spaces/dashes; the lookup key matching the stored `code`. */
function normalizeGiftCardCode(code) {
  return typeof code === 'string' ? code.toUpperCase().replace(/[\s-]/g, '') : '';
}

/** Dashed display form, e.g. DHGC-AB23-CD45-EF67, derived from any code spelling. */
function formatGiftCardCode(code) {
  const norm = normalizeGiftCardCode(code);
  const body = norm.startsWith(CODE_PREFIX) ? norm.slice(CODE_PREFIX.length) : norm;
  const groups = body.match(/.{1,4}/g) || [];
  return [CODE_PREFIX, ...groups].join('-');
}

/**
 * Validate + normalise a gift-card purchase request. `amount` (initialAmount) must
 * be a positive integer. Optional recipient { email, name, message, sendAt } and
 * design { templateId, theme } are validated/normalised. `opts.templates` /
 * `opts.themes`, when supplied, restrict the allowed design values.
 * @returns {{ ok:true, value:{ initialAmount, recipient?, design? } } | { ok:false, message }}
 */
function validateGiftCardPurchase(body = {}, opts = {}) {
  const { amount, recipient, design } = body;

  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'Amount must be a positive integer' };
  }
  const value = { initialAmount: n };

  if (recipient && typeof recipient === 'object') {
    const r = {};
    if (recipient.email !== undefined && recipient.email !== null && String(recipient.email).trim() !== '') {
      if (!isValidEmail(recipient.email)) return { ok: false, message: 'Recipient email is not valid' };
      r.email = String(recipient.email).toLowerCase().trim();
    }
    if (recipient.name !== undefined && recipient.name !== null) r.name = String(recipient.name).trim();
    if (recipient.message !== undefined && recipient.message !== null) {
      const m = String(recipient.message).trim();
      if (m.length > GIFT_CARD_MESSAGE_MAX) {
        return { ok: false, message: `Message must be ${GIFT_CARD_MESSAGE_MAX} characters or fewer` };
      }
      r.message = m;
    }
    if (recipient.sendAt !== undefined && recipient.sendAt !== null && recipient.sendAt !== '') {
      const d = new Date(recipient.sendAt);
      if (Number.isNaN(d.getTime())) return { ok: false, message: 'Send date is not valid' };
      r.sendAt = d;
    }
    value.recipient = r;
  }

  if (design && typeof design === 'object') {
    const d = {};
    if (design.templateId !== undefined && design.templateId !== null) {
      const t = String(design.templateId).trim();
      if (t) {
        if (Array.isArray(opts.templates) && !opts.templates.includes(t)) {
          return { ok: false, message: 'Unknown design template' };
        }
        d.templateId = t;
      }
    }
    if (design.theme !== undefined && design.theme !== null) {
      const th = String(design.theme).trim();
      if (th) {
        if (Array.isArray(opts.themes) && !opts.themes.includes(th)) {
          return { ok: false, message: 'Unknown design theme' };
        }
        d.theme = th;
      }
    }
    value.design = d;
  }

  return { ok: true, value };
}

/** True when `expiresAt` is set and at/before `now`. */
function isExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return exp <= new Date(now).getTime();
}

/**
 * Validate a redemption against a card snapshot: positive-integer amount, card
 * active, not expired, sufficient balance.
 * @returns {{ ok:true } | { ok:false, message }}
 */
function validateGiftCardRedeem(card = {}, amount, now = new Date()) {
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) return { ok: false, message: 'Amount must be a positive integer' };
  if (card.status !== 'active') return { ok: false, message: 'Gift card is not active' };
  if (isExpired(card.expiresAt, now)) return { ok: false, message: 'Gift card has expired' };
  if ((Number(card.balance) || 0) < n) return { ok: false, message: 'Insufficient gift card balance' };
  return { ok: true };
}

/**
 * Apply a transaction to a balance: 'redeem' subtracts (guarded), every other type
 * adds. Amount is re-validated. @returns {{ ok:true, balanceAfter } | { ok:false, message }}
 */
function applyGiftCardDelta(balance, type, amount) {
  const bal = Number(balance) || 0;
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) return { ok: false, message: 'Amount must be a positive integer' };
  const balanceAfter = type === 'redeem' ? bal - n : bal + n;
  if (balanceAfter < 0) return { ok: false, message: 'Insufficient gift card balance' };
  return { ok: true, balanceAfter };
}

/** The status a card should hold after a redeem leaves it at `balanceAfter`. */
function computeStatusAfterRedeem(balanceAfter) {
  return (Number(balanceAfter) || 0) <= 0 ? 'redeemed' : 'active';
}

/** Roll a card's ledger into headline figures (redeemed/refunded/count/lastActivityAt). */
function summarizeGiftCard(transactions = []) {
  let redeemed = 0;
  let refunded = 0;
  let lastActivityAt = null;

  for (const t of transactions) {
    const amt = t.amount || 0;
    if (t.type === 'redeem') redeemed += amt;
    else if (t.type === 'refund') refunded += amt;

    const when = t.createdAt;
    const ts = when ? new Date(when).getTime() : NaN;
    if (!Number.isNaN(ts) && (lastActivityAt === null || ts > lastActivityAt)) {
      lastActivityAt = ts;
    }
  }

  return {
    redeemed,
    refunded,
    count: transactions.length,
    lastActivityAt: lastActivityAt === null ? null : new Date(lastActivityAt).toISOString(),
  };
}

// ── Signed QR token (HMAC-SHA256) ────────────────────────────────────────────

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * Sign a `{ gid, code, nonce }` payload into a `<body>.<sig>` token. `secret` is
 * required (callers source it from process.env.GIFTCARD_QR_SECRET).
 */
function signGiftCardToken(payload = {}, secret) {
  if (!secret) throw new Error('signGiftCardToken: secret is required');
  const body = b64url(JSON.stringify({ gid: payload.gid, code: payload.code, nonce: payload.nonce }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Verify a token's signature (constant-time) and decode its payload.
 * @returns {{ ok:true, payload } | { ok:false, message }}
 */
function verifyGiftCardToken(token, secret) {
  if (!secret) throw new Error('verifyGiftCardToken: secret is required');
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, message: 'Malformed token' };
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, message: 'Malformed token' };

  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, message: 'Invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, message: 'Malformed payload' };
  }
  return { ok: true, payload };
}

module.exports = {
  GIFT_CARD_STATUSES,
  GIFT_CARD_TX_TYPES,
  GIFT_CARD_MESSAGE_MAX,
  CODE_PREFIX,
  CODE_ALPHABET,
  generateGiftCardCode,
  normalizeGiftCardCode,
  formatGiftCardCode,
  validateGiftCardPurchase,
  isExpired,
  validateGiftCardRedeem,
  applyGiftCardDelta,
  computeStatusAfterRedeem,
  summarizeGiftCard,
  signGiftCardToken,
  verifyGiftCardToken,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/giftCard.helpers.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/giftCard.helpers.js server/__tests__/giftCard.helpers.test.js
git commit -m "feat(gift-card): pure domain + signed-QR helpers"
```

---

### Task 3: Platform-scoped models + User field

**Files:**
- Create: `server/models/PlatformWalletTransaction.js`
- Create: `server/models/GiftCard.js`
- Create: `server/models/GiftCardTransaction.js`
- Create: `server/models/PlatformSettlement.js`
- Modify: `server/models/User.js` (add `platformWalletBalance` after the existing `walletBalance`, ~line 173)
- Test: `server/__tests__/platformModels.test.js`

**Interfaces:**
- Consumes: nothing (schemas inline their own enums, matching `WalletTransaction.js`).
- Produces: Mongoose models `PlatformWalletTransaction`, `GiftCard`, `GiftCardTransaction`, `PlatformSettlement`; `User.platformWalletBalance` (Number, default 0, min 0). Field shapes per the spec §1.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/platformModels.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const PlatformWalletTransaction = require('../models/PlatformWalletTransaction');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const PlatformSettlement = require('../models/PlatformSettlement');
const User = require('../models/User');

const oid = () => new mongoose.Types.ObjectId();

test('PlatformWalletTransaction: valid doc passes, no required tenant', () => {
  const doc = new PlatformWalletTransaction({
    userId: oid(), type: 'credit', amount: 100, balanceAfter: 100, source: 'purchase',
  });
  assert.strictEqual(doc.validateSync(), undefined);
  assert.strictEqual(doc.schema.path('tenant'), undefined); // platform-scoped: no tenant field
  assert.strictEqual(doc.redeemedAtTenant, null);
});

test('PlatformWalletTransaction: enforces enums and positive amount', () => {
  const bad = new PlatformWalletTransaction({ userId: oid(), type: 'nope', amount: 0, balanceAfter: 0, source: 'bad' });
  const err = bad.validateSync();
  assert.ok(err.errors.type);
  assert.ok(err.errors.amount);
  assert.ok(err.errors.source);
});

test('GiftCard: valid pending card passes; status/currency enums enforced', () => {
  const card = new GiftCard({ initialAmount: 5000 });
  const err = card.validateSync();
  assert.strictEqual(err, undefined);
  assert.strictEqual(card.status, 'pending_payment');
  assert.strictEqual(card.currency, 'NGN');
  assert.strictEqual(card.balance, 0);

  const bad = new GiftCard({ initialAmount: 0, status: 'weird' });
  const e2 = bad.validateSync();
  assert.ok(e2.errors.initialAmount);
  assert.ok(e2.errors.status);
});

test('GiftCardTransaction: valid doc passes, redeemedAtTenant defaults null', () => {
  const tx = new GiftCardTransaction({ giftCardId: oid(), type: 'issue', amount: 5000, balanceAfter: 5000 });
  assert.strictEqual(tx.validateSync(), undefined);
  assert.strictEqual(tx.redeemedAtTenant, null);
  const bad = new GiftCardTransaction({ giftCardId: oid(), type: 'x', amount: 0, balanceAfter: 0 });
  assert.ok(bad.validateSync().errors.type);
});

test('PlatformSettlement: refPath + enums + default status', () => {
  const s = new PlatformSettlement({
    tenant: oid(), instrument: 'gift_card', sourceModel: 'GiftCardTransaction',
    sourceTxId: oid(), amount: 400,
  });
  assert.strictEqual(s.validateSync(), undefined);
  assert.strictEqual(s.status, 'pending');
  const bad = new PlatformSettlement({ tenant: oid(), instrument: 'x', sourceModel: 'Y', sourceTxId: oid(), amount: 0 });
  const err = bad.validateSync();
  assert.ok(err.errors.instrument);
  assert.ok(err.errors.sourceModel);
  assert.ok(err.errors.amount);
});

test('User.platformWalletBalance: default 0, min 0, distinct from walletBalance', () => {
  const u = new User({ email: 'a@b.com', firstName: 'A', role: 'customer' });
  assert.strictEqual(u.platformWalletBalance, 0);
  assert.ok(u.schema.path('walletBalance')); // existing tenant wallet untouched

  const bad = new User({ email: 'a@b.com', firstName: 'A', role: 'customer', platformWalletBalance: -5 });
  assert.ok(bad.validateSync().errors.platformWalletBalance);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformModels.test.js`
Expected: FAIL — `Cannot find module '../models/PlatformWalletTransaction'`.

- [ ] **Step 3a: Create `server/models/PlatformWalletTransaction.js`**

```js
const mongoose = require('mongoose');

// Append-only ledger for the PLATFORM-WIDE customer wallet (platformWallet) — a
// tenant-agnostic stored-value balance. One row per balance change; never edited
// or deleted. The authoritative balance lives on User.platformWalletBalance and is
// mutated atomically alongside appending a row here; `balanceAfter` snapshots it.
// DISTINCT from the tenant store-credit WalletTransaction (which requires `tenant`).
const PlatformWalletTransactionSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:         { type: String, enum: ['credit', 'debit', 'refund', 'adjustment'], required: true },
    amount:       { type: Number, required: true, min: 1 }, // positive integer NGN
    balanceAfter: { type: Number, required: true },
    // Set on debits spent at a tenant — drives platform→tenant settlement. Null otherwise.
    redeemedAtTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    source:       { type: String, enum: ['purchase', 'pos', 'online_checkout', 'refund', 'adjustment'], required: true },
    reason:       { type: String, default: '', trim: true, maxlength: 280 },
    reference:    { type: String, trim: true, sparse: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    paymentRef:   { type: String, trim: true, sparse: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PlatformWalletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.PlatformWalletTransaction
  || mongoose.model('PlatformWalletTransaction', PlatformWalletTransactionSchema);
```

- [ ] **Step 3b: Create `server/models/GiftCard.js`**

```js
const mongoose = require('mongoose');

// A PLATFORM gift card: standalone stored value with its own code, balance and
// scannable QR, usable at any tenant. `code` is stored normalized (uppercase, no
// separators); the dashed display form is derived in giftCard.helpers. `code` and
// `qrToken` are generated on issue (Phase 2), so both are sparse-unique (absent
// while pending_payment). Platform-scoped: no `tenant` field.
const GiftCardSchema = new mongoose.Schema(
  {
    code:          { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    qrToken:       { type: String, unique: true, sparse: true },
    initialAmount: { type: Number, required: true, min: 1 },
    balance:       { type: Number, required: true, default: 0, min: 0 },
    currency:      { type: String, enum: ['NGN'], default: 'NGN' },
    status:        {
      type: String,
      enum: ['pending_payment', 'active', 'redeemed', 'expired', 'disabled'],
      default: 'pending_payment',
      index: true,
    },
    purchasedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    recipient: {
      email:   { type: String, trim: true, lowercase: true },
      name:    { type: String, trim: true },
      message: { type: String, trim: true, maxlength: 280 },
      sendAt:  { type: Date },
    },
    design: {
      templateId: { type: String, trim: true },
      theme:      { type: String, trim: true },
    },
    expiresAt:  { type: Date },
    paymentRef: { type: String, trim: true, sparse: true },
  },
  { timestamps: true }
);

GiftCardSchema.index({ 'recipient.email': 1 });

module.exports = mongoose.models.GiftCard || mongoose.model('GiftCard', GiftCardSchema);
```

- [ ] **Step 3c: Create `server/models/GiftCardTransaction.js`**

```js
const mongoose = require('mongoose');

// Append-only ledger for a GiftCard's balance changes; one row per change, never
// edited or deleted. The authoritative balance lives on GiftCard.balance, mutated
// atomically alongside appending a row here; `balanceAfter` snapshots it.
const GiftCardTransactionSchema = new mongoose.Schema(
  {
    giftCardId:   { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCard', required: true, index: true },
    type:         { type: String, enum: ['issue', 'redeem', 'refund', 'adjustment'], required: true },
    amount:       { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true },
    // Set on redeems spent at a tenant — drives platform→tenant settlement. Null otherwise.
    redeemedAtTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    reference:    { type: String, trim: true, sparse: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GiftCardTransactionSchema.index({ giftCardId: 1, createdAt: -1 });

module.exports = mongoose.models.GiftCardTransaction
  || mongoose.model('GiftCardTransaction', GiftCardTransactionSchema);
```

- [ ] **Step 3d: Create `server/models/PlatformSettlement.js`**

```js
const mongoose = require('mongoose');

// A platform→tenant payable: when platform stored value (wallet or gift card) is
// consumed at a tenant, one entry records what the platform owes that tenant.
// SCHEMA ONLY in Phase 1 — no writer exists until the redemption phases. The
// source ledger row is referenced polymorphically via sourceModel + sourceTxId.
const PlatformSettlementSchema = new mongoose.Schema(
  {
    tenant:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    instrument:  { type: String, enum: ['platform_wallet', 'gift_card'], required: true },
    sourceModel: { type: String, enum: ['PlatformWalletTransaction', 'GiftCardTransaction'], required: true },
    sourceTxId:  { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sourceModel' },
    amount:      { type: Number, required: true, min: 1 },
    relatedOrder:{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status:      { type: String, enum: ['pending', 'settled'], default: 'pending', index: true },
    settledAt:   { type: Date },
  },
  { timestamps: true }
);

PlatformSettlementSchema.index({ tenant: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.PlatformSettlement
  || mongoose.model('PlatformSettlement', PlatformSettlementSchema);
```

- [ ] **Step 3e: Modify `server/models/User.js`**

Find the existing `walletBalance` block (~lines 166–173):

```js
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
```

Insert immediately after it:

```js

    // Authoritative PLATFORM-WIDE stored-value balance (NGN), tenant-agnostic and
    // DISTINCT from the tenant-scoped `walletBalance` above. Mutated only alongside
    // an appended PlatformWalletTransaction (platformWallet.service); never negative.
    platformWalletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformModels.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add server/models/PlatformWalletTransaction.js server/models/GiftCard.js \
        server/models/GiftCardTransaction.js server/models/PlatformSettlement.js \
        server/models/User.js server/__tests__/platformModels.test.js
git commit -m "feat(platform-stored-value): models + User.platformWalletBalance"
```

---

### Task 4: Platform wallet atomic service

**Files:**
- Create: `server/services/platformWallet.service.js`
- Test: `server/__tests__/platformServices.test.js` (created here; extended in Task 5)

**Interfaces:**
- Consumes: `models/User`, `models/PlatformWalletTransaction`.
- Produces: `mutatePlatformWallet({ owner:{ userId }, value:{ type, amount, source, reason }, redeemedAtTenant?, reference?, relatedOrder?, paymentRef?, createdBy? }) -> Promise<{ ok:true, balance, tx } | { ok:false, status, message }>`.

> Full debit/credit behaviour is verified by the ephemeral-mongod e2e in a redemption phase (the repo has no `mongodb-memory-server`). Phase 1's check is a DB-less smoke test that the module loads and exports the expected function — mirroring how `wallet.service.js` is exercised via controllers, not unit tests.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/platformServices.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');

const platformWalletService = require('../services/platformWallet.service');

test('platformWallet.service exports mutatePlatformWallet', () => {
  assert.strictEqual(typeof platformWalletService.mutatePlatformWallet, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformServices.test.js`
Expected: FAIL — `Cannot find module '../services/platformWallet.service'`.

- [ ] **Step 3: Write the implementation**

Create `server/services/platformWallet.service.js`:

```js
// server/services/platformWallet.service.js
//
// The atomic DB layer for the platform-wide wallet. Mirrors wallet.service.js
// (mutateWallet) exactly: a guarded, atomic $inc on User.platformWalletBalance —
// for a debit the filter requires `platformWalletBalance >= amount`, so concurrent
// debits can never drive it negative — paired with an append-only
// PlatformWalletTransaction row whose `balanceAfter` is read straight back from the
// DB. If the ledger write fails, the balance move is undone.

const User = require('../models/User');
const PlatformWalletTransaction = require('../models/PlatformWalletTransaction');

/**
 * Atomically move the platform wallet balance and append the matching ledger row.
 * @returns {Promise<{ ok:true, balance:number, tx:object } | { ok:false, status:number, message:string }>}
 */
async function mutatePlatformWallet({
  owner, value, redeemedAtTenant, reference, relatedOrder, paymentRef, createdBy,
}) {
  const { userId } = owner;
  const { type, amount, source, reason } = value;
  const inc = type === 'debit' ? -amount : amount;

  const query = { _id: userId };
  if (type === 'debit') query.platformWalletBalance = { $gte: amount }; // atomic overdraw guard

  const updated = await User.findOneAndUpdate(
    query,
    { $inc: { platformWalletBalance: inc } },
    { new: true }
  ).select('platformWalletBalance');

  if (!updated) {
    return {
      ok: false,
      status: type === 'debit' ? 400 : 404,
      message: type === 'debit' ? 'Insufficient platform wallet balance' : 'Wallet owner not found',
    };
  }

  try {
    const tx = await PlatformWalletTransaction.create({
      userId,
      type,
      amount,
      balanceAfter: updated.platformWalletBalance,
      redeemedAtTenant: redeemedAtTenant || null,
      source,
      reason: reason || '',
      reference,
      relatedOrder,
      paymentRef,
      createdBy,
    });
    return { ok: true, balance: updated.platformWalletBalance, tx };
  } catch (err) {
    // Ledger write failed — undo the balance move to keep the two consistent.
    await User.updateOne({ _id: updated._id }, { $inc: { platformWalletBalance: -inc } });
    throw err;
  }
}

module.exports = { mutatePlatformWallet };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformServices.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/platformWallet.service.js server/__tests__/platformServices.test.js
git commit -m "feat(platform-wallet): atomic mutatePlatformWallet service"
```

---

### Task 5: Gift-card atomic service

**Files:**
- Create: `server/services/giftCard.service.js`
- Modify: `server/__tests__/platformServices.test.js` (add gift-card smoke tests)

**Interfaces:**
- Consumes: `models/GiftCard`, `models/GiftCardTransaction`, `services/giftCard.helpers`.
- Produces:
  - `issueGiftCard({ giftCardId, paymentRef?, createdBy? }) -> Promise<{ ok:true, card, alreadyIssued? } | { ok:false, status, message }>`
  - `redeemGiftCard({ giftCardId?, code?, amount, redeemedAtTenant?, relatedOrder?, createdBy?, now? }) -> Promise<{ ok:true, balance, tx, card } | { ok:false, status, message }>`
  - `refundGiftCard({ giftCardId, amount, relatedOrder?, createdBy? }) -> Promise<{ ok:true, balance, tx, card } | { ok:false, status, message }>`

> As with Task 4, full DB behaviour (issue idempotency, double-redeem race, status flips) is covered by the redemption-phase e2e. Phase 1 verifies the module loads, exports the three functions, and that the **pure pre-DB amount guards** in `redeemGiftCard`/`refundGiftCard` reject non-positive amounts before any query runs.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/platformServices.test.js`:

```js
const giftCardService = require('../services/giftCard.service');

test('giftCard.service exports issue/redeem/refund', () => {
  assert.strictEqual(typeof giftCardService.issueGiftCard, 'function');
  assert.strictEqual(typeof giftCardService.redeemGiftCard, 'function');
  assert.strictEqual(typeof giftCardService.refundGiftCard, 'function');
});

test('redeemGiftCard rejects a non-positive amount before any DB call', async () => {
  const r = await giftCardService.redeemGiftCard({ code: 'DHGCAB23CD45EF67', amount: 0 });
  assert.deepStrictEqual(r, { ok: false, status: 400, message: 'Amount must be a positive integer' });
});

test('refundGiftCard rejects a non-positive amount before any DB call', async () => {
  const r = await giftCardService.refundGiftCard({ giftCardId: 'x', amount: -5 });
  assert.deepStrictEqual(r, { ok: false, status: 400, message: 'Amount must be a positive integer' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformServices.test.js`
Expected: FAIL — `Cannot find module '../services/giftCard.service'`.

- [ ] **Step 3: Write the implementation**

Create `server/services/giftCard.service.js`:

```js
// server/services/giftCard.service.js
//
// The atomic DB layer for platform gift cards. Like wallet.service.js, every
// balance move is a guarded, atomic $inc paired with an append-only
// GiftCardTransaction row; the redeem guard (status active, unexpired, balance >=
// amount) lives in the Mongo filter so concurrent redemptions across channels
// (POS scan + online) can never overdraw or double-spend. The pure rules live in
// giftCard.helpers.js. The QR signing secret comes from GIFTCARD_QR_SECRET.

const crypto = require('crypto');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const {
  generateGiftCardCode,
  normalizeGiftCardCode,
  signGiftCardToken,
  validateGiftCardRedeem,
  computeStatusAfterRedeem,
} = require('./giftCard.helpers');

const QR_SECRET = process.env.GIFTCARD_QR_SECRET || '';

/**
 * Activate a paid-for card: assign a unique code + signed QR, set balance to
 * initialAmount, flip pending_payment → active, append an 'issue' row. Idempotent:
 * a card already past pending_payment is returned unchanged (alreadyIssued:true).
 */
async function issueGiftCard({ giftCardId, paymentRef, createdBy }) {
  const card = await GiftCard.findById(giftCardId);
  if (!card) return { ok: false, status: 404, message: 'Gift card not found' };
  if (card.status !== 'pending_payment') {
    return { ok: true, card, alreadyIssued: true };
  }

  // Generate a code unique against existing cards (retry on the rare collision).
  let code = null;
  for (let i = 0; i < 5; i++) {
    const candidate = generateGiftCardCode();
    const clash = await GiftCard.findOne({ code: candidate }).select('_id');
    if (!clash) { code = candidate; break; }
  }
  if (!code) return { ok: false, status: 500, message: 'Could not generate a unique gift-card code' };

  const nonce = crypto.randomBytes(8).toString('hex');
  const qrToken = signGiftCardToken({ gid: String(card._id), code, nonce }, QR_SECRET);

  card.code = code;
  card.qrToken = qrToken;
  card.balance = card.initialAmount;
  card.status = 'active';
  if (paymentRef) card.paymentRef = paymentRef;
  await card.save();

  await GiftCardTransaction.create({
    giftCardId: card._id,
    type: 'issue',
    amount: card.initialAmount,
    balanceAfter: card.balance,
    createdBy,
  });

  return { ok: true, card };
}

/**
 * Redeem `amount` off a card resolved by id or normalized code. The debit is an
 * atomic, guarded $inc (active + unexpired + sufficient balance enforced in the
 * filter), so concurrent redemptions can never overdraw. Flips status to
 * 'redeemed' when drained; undoes the debit if the ledger write fails.
 */
async function redeemGiftCard({
  giftCardId, code, amount, redeemedAtTenant, relatedOrder, createdBy, now = new Date(),
}) {
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, status: 400, message: 'Amount must be a positive integer' };
  }

  const base = giftCardId ? { _id: giftCardId } : { code: normalizeGiftCardCode(code) };
  const filter = {
    ...base,
    status: 'active',
    balance: { $gte: n },
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  };

  const updated = await GiftCard.findOneAndUpdate(filter, { $inc: { balance: -n } }, { new: true });
  if (!updated) {
    // Surface the specific reason (best-effort, non-atomic read after the miss).
    const snapshot = await GiftCard.findOne(base).select('status balance expiresAt');
    if (!snapshot) return { ok: false, status: 404, message: 'Gift card not found' };
    const check = validateGiftCardRedeem(snapshot, n, now);
    return { ok: false, status: 400, message: check.message || 'Gift card cannot be redeemed' };
  }

  const newStatus = computeStatusAfterRedeem(updated.balance);
  if (newStatus !== updated.status) {
    await GiftCard.updateOne({ _id: updated._id }, { $set: { status: newStatus } });
  }

  try {
    const tx = await GiftCardTransaction.create({
      giftCardId: updated._id,
      type: 'redeem',
      amount: n,
      balanceAfter: updated.balance,
      redeemedAtTenant: redeemedAtTenant || null,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.balance, tx, card: updated };
  } catch (err) {
    // Ledger write failed — restore balance and active status.
    await GiftCard.updateOne({ _id: updated._id }, { $inc: { balance: n }, $set: { status: 'active' } });
    throw err;
  }
}

/**
 * Credit `amount` back onto a card (sale reversal). Reactivates a 'redeemed' card.
 * Undoes the credit if the ledger write fails.
 */
async function refundGiftCard({ giftCardId, amount, relatedOrder, createdBy }) {
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, status: 400, message: 'Amount must be a positive integer' };
  }

  const updated = await GiftCard.findOneAndUpdate(
    { _id: giftCardId, status: { $in: ['active', 'redeemed'] } },
    { $inc: { balance: n }, $set: { status: 'active' } },
    { new: true }
  );
  if (!updated) return { ok: false, status: 404, message: 'Gift card not found' };

  try {
    const tx = await GiftCardTransaction.create({
      giftCardId: updated._id,
      type: 'refund',
      amount: n,
      balanceAfter: updated.balance,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.balance, tx, card: updated };
  } catch (err) {
    await GiftCard.updateOne({ _id: updated._id }, { $inc: { balance: -n } });
    throw err;
  }
}

module.exports = { issueGiftCard, redeemGiftCard, refundGiftCard };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/platformServices.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/giftCard.service.js server/__tests__/platformServices.test.js
git commit -m "feat(gift-card): atomic issue/redeem/refund service"
```

---

### Task 6: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the entire server test suite**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/`
Expected: PASS — all existing suites plus the four new ones
(`platformWallet.helpers`, `giftCard.helpers`, `platformModels`, `platformServices`).
Confirm no existing suite regressed.

- [ ] **Step 2: Confirm the existing tenant wallet is untouched**

Run: `git diff --name-only main -- server/services/wallet.service.js server/models/WalletTransaction.js server/controllers/pos.controller.js`
Expected: empty output (none of these files changed).

- [ ] **Step 3: Commit (if any non-code artifacts changed)**

No commit expected unless the prior step surfaced an accidental change to fix.

---

## Self-Review

**Spec coverage:**
- §1.1 PlatformWalletTransaction → Task 3 ✓
- §1.2 User.platformWalletBalance → Task 3 ✓
- §1.3 GiftCard → Task 3 ✓ (with `code` stored normalized — see refinement note)
- §1.4 GiftCardTransaction → Task 3 ✓
- §1.5 PlatformSettlement (schema only) → Task 3 ✓
- §2.1 platformWallet.helpers → Task 1 ✓
- §2.2 giftCard.helpers incl. signed QR → Task 2 ✓
- §3.1 mutatePlatformWallet → Task 4 ✓
- §3.2 issue/redeem/refund → Task 5 ✓
- §4 pure tests + acceptance (full suite green, tenant wallet untouched) → Tasks 1,2 + Task 6 ✓

**Placeholder scan:** none — every step has complete code/commands.

**Type consistency:** `generateGiftCardCode(rng)`, `normalizeGiftCardCode`, `formatGiftCardCode`, `signGiftCardToken`/`verifyGiftCardToken`, `validateGiftCardRedeem`, `computeStatusAfterRedeem` are defined in Task 2 and consumed with identical signatures in Task 5. `mutatePlatformWallet` arg shape in Task 4 matches the spec §3.1. Stored `code` is normalized in both the model (Task 3) and the redeem lookup (Task 5).

**Note on `unique` indexes in tests:** `validateSync()` (Task 3) does not touch the DB, so `unique`/`sparse` indexes are not exercised there — uniqueness is enforced by the e2e in a later phase. This is intentional and consistent with the chosen DB-less test strategy.
</content>
