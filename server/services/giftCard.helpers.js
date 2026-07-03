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

// Amount-driven gift-card tiers (single source of truth; mirrored client-side in
// gift-cards/_giftCardTiers.ts). The card art + label are derived from the purchase
// amount — higher amounts get more premium styling. Bands are inclusive lower bounds.
const GIFT_CARD_TIERS = [
  { id: 'classic',  name: 'Classic',  minAmount: 1000,    gradient: 'from-stone-800 to-red-900',     textClass: 'text-white',      accentClass: 'text-red-200' },
  { id: 'silver',   name: 'Silver',   minAmount: 50000,   gradient: 'from-slate-400 to-slate-600',   textClass: 'text-white',      accentClass: 'text-slate-100' },
  { id: 'gold',     name: 'Gold',     minAmount: 200000,  gradient: 'from-amber-500 to-yellow-600',  textClass: 'text-stone-900',  accentClass: 'text-amber-900' },
  { id: 'platinum', name: 'Platinum', minAmount: 500000,  gradient: 'from-zinc-300 to-zinc-500',     textClass: 'text-stone-900',  accentClass: 'text-zinc-700' },
  { id: 'premium',  name: 'Premium',  minAmount: 1000000, gradient: 'from-indigo-700 to-purple-800', textClass: 'text-white',      accentClass: 'text-indigo-200' },
  { id: 'black',    name: 'Black',    minAmount: 5000000, gradient: 'from-neutral-900 to-black',      textClass: 'text-white',      accentClass: 'text-amber-300' },
];

/**
 * Resolve the tier for a purchase amount: the highest tier whose minAmount <= amount.
 * Amounts below the first band clamp to the first (classic) tier.
 * @returns {object} a GIFT_CARD_TIERS entry.
 */
function giftCardTierForAmount(amount) {
  const n = Number(amount) || 0;
  let tier = GIFT_CARD_TIERS[0];
  for (const t of GIFT_CARD_TIERS) {
    if (n >= t.minAmount) tier = t;
  }
  return tier;
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
  GIFT_CARD_TIERS,
  giftCardTierForAmount,
};
