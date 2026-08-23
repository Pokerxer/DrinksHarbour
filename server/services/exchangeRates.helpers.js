// services/exchangeRates.helpers.js
//
// Pure logic for the exchange-rate module — no mongoose/express imports so it
// can be unit-tested directly (see __tests__/exchangeRates.helpers.test.js).
//
// The conversion resolver here must stay behaviour-identical to the client's
// resolveRate() in client/apps/admin/src/app/shared/purchases/
// exchange-rates-helpers.ts, so a PO converted server-side never disagrees
// with what the analysis screens showed the tenant.

// Keep in sync with models/ExchangeRate.js and
// client/apps/admin/src/app/shared/purchases/types.ts.
const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];
const BASE_CURRENCY = 'NGN';
const NOTES_MAX_LENGTH = 500;

/**
 * UTC midnight of `now`'s *calendar day as seen in the server's local zone*.
 * Rate rows are keyed by calendar day; building the key from local parts and
 * then normalising to UTC makes "today" deterministic regardless of the hour
 * the sync runs at, and lets a user-entered `YYYY-MM-DD` (which mongoose
 * casts to UTC midnight) match the row the daily live sync wrote.
 */
function utcMidnightToday(now = new Date()) {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
}

/**
 * Normalises any date-ish input to UTC midnight of its calendar day, so
 * effectiveDate comparisons and upsert matching are time-of-day independent.
 * Returns null when unparseable.
 */
function normalizeEffectiveDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

const isPositiveFiniteNumber = (v) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Whitelists and validates a PATCH body for an exchange rate. Everything not
 * in the allow-list (tenant, createdBy, source tampering aside) is dropped —
 * the previous implementation copied every body key onto the document.
 *
 * @returns {{updates: object, error?: undefined}} on success, or
 *          `{updates: {}, error: string}` with a caller-safe message.
 */
function sanitizeRateUpdate(body = {}) {
  const updates = {};
  const b = body && typeof body === 'object' ? body : {};

  if (b.rate !== undefined) {
    // Accept numeric strings from lenient clients, but store a number.
    const n = typeof b.rate === 'string' ? Number(b.rate) : b.rate;
    if (!isPositiveFiniteNumber(n)) {
      return { updates: {}, error: 'Rate must be a number greater than zero.' };
    }
    updates.rate = n;
  }

  for (const key of ['fromCurrency', 'toCurrency']) {
    if (b[key] !== undefined) {
      const code = String(b[key]).toUpperCase();
      if (!SUPPORTED_CURRENCIES.includes(code)) {
        return {
          updates: {},
          error: `Unsupported currency: ${code}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}.`,
        };
      }
      updates[key] = code;
    }
  }
  if (
    updates.fromCurrency &&
    updates.toCurrency &&
    updates.fromCurrency === updates.toCurrency
  ) {
    return { updates: {}, error: 'From and To currencies must be different.' };
  }

  if (b.isActive !== undefined) updates.isActive = Boolean(b.isActive);

  if (b.source !== undefined) {
    if (!['manual', 'live'].includes(b.source)) {
      return { updates: {}, error: 'Source must be "manual" or "live".' };
    }
    updates.source = b.source;
  }

  if (b.effectiveDate !== undefined) {
    const d = normalizeEffectiveDate(b.effectiveDate);
    if (!d) return { updates: {}, error: 'Invalid effective date.' };
    updates.effectiveDate = d;
  }

  if (b.notes !== undefined) {
    const notes = String(b.notes).trim();
    if (notes.length > NOTES_MAX_LENGTH) {
      return {
        updates: {},
        error: `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.`,
      };
    }
    updates.notes = notes;
  }

  return { updates };
}

/**
 * Resolves the rate for a currency pair from a list of rate rows:
 * direct pair → inverse pair → triangulated through the base currency.
 * Mirrors ExchangeRate.convertCurrency's first two steps and adds the same
 * cross-rate fallback the admin client uses. Returns null when unreachable.
 */
function resolveConversion(rows, fromCurrency, toCurrency, baseCurrency = BASE_CURRENCY) {
  if (fromCurrency === toCurrency) return 1;

  const direct = rows.find(
    (r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
  );
  if (direct && direct.rate > 0) return direct.rate;

  const inverse = rows.find(
    (r) => r.fromCurrency === toCurrency && r.toCurrency === fromCurrency
  );
  if (inverse && inverse.rate > 0) return 1 / inverse.rate;

  if (baseCurrency !== fromCurrency && baseCurrency !== toCurrency) {
    const fromLeg = rows.find(
      (r) => r.fromCurrency === fromCurrency && r.toCurrency === baseCurrency
    );
    const toLeg = rows.find(
      (r) => r.fromCurrency === toCurrency && r.toCurrency === baseCurrency
    );
    if (fromLeg && toLeg && fromLeg.rate > 0 && toLeg.rate > 0) {
      return fromLeg.rate / toLeg.rate;
    }
  }

  return null;
}

module.exports = {
  SUPPORTED_CURRENCIES,
  BASE_CURRENCY,
  NOTES_MAX_LENGTH,
  utcMidnightToday,
  normalizeEffectiveDate,
  sanitizeRateUpdate,
  resolveConversion,
};
