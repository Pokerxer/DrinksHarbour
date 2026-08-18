import { describe, expect, test } from 'vitest';

const { timeLeftUntil, earliestSaleEnd, FALLBACK_SALE_WINDOW_MS } = await import('./countdown.ts');

const NOW = Date.parse('2026-08-18T12:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('timeLeftUntil', () => {
  test('splits a span into days, hours, minutes and seconds', () => {
    const result = timeLeftUntil(NOW + 2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND, NOW);

    expect(result).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, expired: false });
  });

  test('under a day reports zero days rather than rolling into hours', () => {
    const result = timeLeftUntil(NOW + 5 * HOUR, NOW);

    expect(result).toMatchObject({ days: 0, hours: 5 });
  });

  test('the exact moment of expiry is expired', () => {
    expect(timeLeftUntil(NOW, NOW).expired).toBe(true);
  });

  // A sale that ended before the screen opened must not render a negative clock.
  test('an end time already in the past is a zeroed, expired clock', () => {
    const result = timeLeftUntil(NOW - 3 * HOUR, NOW);

    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  });

  test('a non-finite end time is expired rather than NaN', () => {
    expect(timeLeftUntil(Number.NaN, NOW)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    });
  });

  test('sub-second remainders floor rather than round up', () => {
    const result = timeLeftUntil(NOW + 1500, NOW);

    expect(result.seconds).toBe(1);
  });
});

describe('earliestSaleEnd', () => {
  const withSale = (endsAt, isOnSale = true) => ({
    _id: 'p1',
    availableAt: [{ isOnSale, saleEndDate: endsAt }],
  });

  test('picks the soonest end date across products', () => {
    const later = new Date(NOW + 5 * DAY).toISOString();
    const sooner = new Date(NOW + 2 * HOUR).toISOString();

    expect(earliestSaleEnd([withSale(later), withSale(sooner)], NOW)).toBe(NOW + 2 * HOUR);
  });

  test('ignores entries that are not on sale', () => {
    const soonerButNotOnSale = new Date(NOW + 1 * HOUR).toISOString();
    const real = new Date(NOW + 6 * HOUR).toISOString();

    expect(earliestSaleEnd([withSale(soonerButNotOnSale, false), withSale(real)], NOW)).toBe(
      NOW + 6 * HOUR
    );
  });

  test('ignores end dates already in the past', () => {
    const past = new Date(NOW - DAY).toISOString();
    const future = new Date(NOW + 3 * HOUR).toISOString();

    expect(earliestSaleEnd([withSale(past), withSale(future)], NOW)).toBe(NOW + 3 * HOUR);
  });

  // The web block does the same (FlashSale.tsx:463) — the section still renders
  // a running clock when the data carries no end date at all.
  test('no usable end date falls back to a fixed window from now', () => {
    expect(earliestSaleEnd([{ _id: 'p1', availableAt: [] }], NOW)).toBe(
      NOW + FALLBACK_SALE_WINDOW_MS
    );
  });

  test('an empty product list falls back rather than returning Infinity', () => {
    expect(earliestSaleEnd([], NOW)).toBe(NOW + FALLBACK_SALE_WINDOW_MS);
  });

  test('an unparseable date string is ignored, not treated as NaN', () => {
    const good = new Date(NOW + 4 * HOUR).toISOString();

    expect(earliestSaleEnd([withSale('not a date'), withSale(good)], NOW)).toBe(NOW + 4 * HOUR);
  });
});
