// app/shared/purchases/exchange-rates-helpers.ts
//
// Pure logic for the exchange-rates screen and the shared useExchangeRates
// hook. Kept free of React/next-auth so it can be unit-tested directly.
import { localDayKeyOf } from './purchases-analytics-helpers';

export interface RateRow {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}

/** Local-calendar `YYYY-MM-DD` — never `toISOString()`, which is a UTC day. */
export const localDateKey = localDayKeyOf;

/** FX rates need sub-unit precision (e.g. NGN→USD ≈ 0.0006) but no forced decimals. */
export function fmtRate(n: number): string {
  return n.toLocaleString('en-NG', { maximumFractionDigits: 4 });
}

/** Converted amounts render as money: exactly two decimals, thousands grouped. */
export function fmtMoney(n: number): string {
  return n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Resolves the conversion rate for a currency pair from the latest-rates feed.
 *
 * Lookup order matches the server's `ExchangeRate.convertCurrency`
 * (direct → inverse), then adds one client-side fallback the server lacks:
 * triangulation through the base currency. Without it, a missing EUR→USD row
 * made every consumer silently treat the foreign amount as if it were already
 * in base currency.
 */
export function resolveRate(
  rows: RateRow[],
  from: string,
  to: string,
  baseCurrency: string
): number | null {
  if (from === to) return 1;

  const direct = rows.find(
    (r) => r.fromCurrency === from && r.toCurrency === to
  );
  if (direct && direct.rate > 0) return direct.rate;

  const inverse = rows.find(
    (r) => r.fromCurrency === to && r.toCurrency === from
  );
  if (inverse && inverse.rate > 0) return 1 / inverse.rate;

  // Cross rate via the base: from→base ÷ to→base. Only meaningful when the
  // base is a third currency distinct from both legs.
  if (baseCurrency && baseCurrency !== from && baseCurrency !== to) {
    const fromLeg = rows.find(
      (r) => r.fromCurrency === from && r.toCurrency === baseCurrency
    );
    const toLeg = rows.find(
      (r) => r.fromCurrency === to && r.toCurrency === baseCurrency
    );
    if (
      fromLeg &&
      toLeg &&
      fromLeg.rate > 0 &&
      toLeg.rate > 0
    ) {
      return fromLeg.rate / toLeg.rate;
    }
  }

  return null;
}

/** Strictly positive finite number, or null. Rates of 0/negatives are junk. */
export function parsePositiveNumber(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Formats an effective date for display without timezone drift.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight and renders the previous day
 * in UTC-negative zones, so parse the calendar parts directly instead.
 */
export function formatRateDate(dateLike: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateLike ?? '');
  if (!m) return dateLike ?? '';
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d)).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  );
}

/**
 * True when saving `from→to` effective `date` would be shadowed by a newer,
 * still-active rate for the same pair. Latest-wins means the back-dated entry
 * would never be picked up — worth telling the admin before they save.
 * Accepts both full ledger rows and /latest rows (which omit `isActive`
 * because they only ever contain active rates).
 */
export function isBackDated(
  ledger: (RateRow & {
    effectiveDate: string;
    isActive?: boolean;
  })[],
  from: string,
  to: string,
  date: string
): boolean {
  return ledger.some(
    (r) =>
      r.isActive !== false &&
      r.fromCurrency === from &&
      r.toCurrency === to &&
      r.effectiveDate > date
  );
}
