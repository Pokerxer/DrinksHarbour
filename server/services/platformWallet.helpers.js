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
