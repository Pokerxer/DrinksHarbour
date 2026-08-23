// The numbers the /sales Overview page shows.
//
// The page used to be a redirect stub, so its "stats" did not exist. The risk
// in building them is subtler than a crash: every figure here could silently
// lie. A revenue card that sums draft orders books money nobody agreed to. An
// unpaid card that adds partially-paid orders' FULL totals invents receivables
// the till already collected (paymentStatus 'partial' means amountPaid holds
// real cash — see sales-list-status.ts). These tests pin each definition so a
// refactor cannot quietly redefine what the business reads as truth.

import { describe, expect, test } from 'vitest';
import type { SalesOrder, SalesOrderGroup } from '@/services/salesOrder.service';
import {
  tallyGroups,
  monthToDateRange,
  bookedThisMonth,
  toDeliver,
  openQuotations,
  unpaidBalance,
  mergeRecentDocs,
  relTime,
} from './sales-overview-helpers';

function group(id: string, count: number, total: number): SalesOrderGroup {
  return { _id: id, count, total, currency: 'NGN', docs: [] };
}

function doc(over: Partial<SalesOrder> = {}): SalesOrder {
  return {
    _id: 'so1',
    soNumber: 'SO2026082300001',
    docType: 'order',
    currency: 'NGN',
    items: [],
    subtotal: 0,
    discountTotal: 0,
    total: 1000,
    fulfillments: [],
    createdAt: '2026-08-20T10:00:00Z',
    ...over,
  } as SalesOrder;
}

describe('tallyGroups', () => {
  test('keys server groups by status id', () => {
    const tallies = tallyGroups([
      group('confirmed', 3, 3000),
      group('draft', 1, 500),
    ]);

    expect(tallies.confirmed).toEqual({ count: 3, total: 3000 });
    expect(tallies.draft).toEqual({ count: 1, total: 500 });
  });

  test('absent input yields an empty tally, not a crash', () => {
    expect(tallyGroups(undefined)).toEqual({});
  });
});

describe('monthToDateRange', () => {
  test('spans from the first instant of the month until now', () => {
    const range = monthToDateRange(new Date(2026, 7, 23, 14, 30));

    expect(range.dateFrom).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).toISOString());
    expect(range.dateTo).toBe(
      new Date(2026, 7, 23, 14, 30).toISOString()
    );
  });
});

describe('bookedThisMonth', () => {
  test('counts confirmed, partially fulfilled and fulfilled — not drafts', () => {
    const result = bookedThisMonth(
      tallyGroups([
        group('draft', 2, 1000),
        group('confirmed', 3, 3000),
        group('partially_fulfilled', 1, 1500),
        group('fulfilled', 4, 4000),
      ])
    );

    expect(result.revenue).toBe(8500);
    expect(result.count).toBe(8);
  });

  test('a cancelled order books nothing', () => {
    const result = bookedThisMonth(
      tallyGroups([group('cancelled', 5, 99999)])
    );

    expect(result.revenue).toBe(0);
    expect(result.count).toBe(0);
  });

  test('an empty month reads as zero, not NaN', () => {
    expect(bookedThisMonth({})).toEqual({ revenue: 0, count: 0 });
  });
});

describe('toDeliver', () => {
  test('is confirmed plus partially fulfilled work', () => {
    const result = toDeliver(
      tallyGroups([
        group('confirmed', 3, 3000),
        group('partially_fulfilled', 2, 2000),
        group('fulfilled', 9, 9000),
        group('cancelled', 1, 100),
      ])
    );

    expect(result).toEqual({ count: 5, value: 5000 });
  });
});

describe('openQuotations', () => {
  test('drafts and sent quotes are open; expired ones are surfaced apart', () => {
    const result = openQuotations(
      tallyGroups([
        group('draft', 2, 1000),
        group('sent', 3, 2500),
        group('accepted', 1, 800),
        group('expired', 2, 700),
      ])
    );

    // Accepted quotes have been won — they are no longer waiting on anyone.
    expect(result.count).toBe(5);
    expect(result.value).toBe(3500);
    expect(result.expired).toBe(2);
  });
});

describe('unpaidBalance', () => {
  test('only fully-unpaid money counts as outstanding', () => {
    const result = unpaidBalance(
      tallyGroups([
        group('unpaid', 2, 5000),
        group('partial', 3, 6000),
        group('paid', 9, 12000),
      ])
    );

    // The partial group's total holds FULL order values; part of that is
    // already in the till. Reporting it as outstanding would overstate debt.
    expect(result.unpaidTotal).toBe(5000);
    expect(result.unpaidCount).toBe(2);
    expect(result.partialCount).toBe(3);
  });
});

describe('mergeRecentDocs', () => {
  test('interleaves quotations and orders newest-first', () => {
    const older = doc({
      _id: 'a',
      docType: 'quotation',
      createdAt: '2026-08-18T09:00:00Z',
    });
    const newer = doc({
      _id: 'b',
      docType: 'order',
      createdAt: '2026-08-22T09:00:00Z',
    });
    const newest = doc({
      _id: 'c',
      docType: 'order',
      createdAt: '2026-08-23T09:00:00Z',
    });

    const merged = mergeRecentDocs([older], [newer, newest], 10);
    expect(merged.map((d) => d._id)).toEqual(['c', 'b', 'a']);
  });

  test('documents without a timestamp sink below dated ones', () => {
    const undated = doc({ _id: 'x', createdAt: undefined });
    const dated = doc({ _id: 'y', createdAt: '2026-01-01T00:00:00Z' });

    const merged = mergeRecentDocs([undated], [dated], 10);
    expect(merged.map((d) => d._id)).toEqual(['y', 'x']);
  });

  test('the feed is capped at the requested length', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      doc({ _id: `d${i}`, createdAt: `2026-08-${10 + i}T00:00:00Z` })
    );
    expect(mergeRecentDocs(many, [], 5)).toHaveLength(5);
  });
});

describe('relTime', () => {
  const now = new Date('2026-08-23T12:00:00Z');

  test('under a minute reads as just now', () => {
    expect(relTime('2026-08-23T11:59:40Z', now)).toBe('Just now');
  });

  test('minutes and hours stay relative', () => {
    expect(relTime('2026-08-23T11:30:00Z', now)).toBe('30m ago');
    expect(relTime('2026-08-23T09:00:00Z', now)).toBe('3h ago');
  });

  test('up to a week reads in days', () => {
    expect(relTime('2026-08-21T12:00:00Z', now)).toBe('2d ago');
  });

  test('older documents fall back to a fixed date', () => {
    expect(relTime('2025-03-04T12:00:00Z', now)).toMatch(/Mar 2025|04\/03\/2025|3\/4\/2025/);
  });

  test('a missing timestamp renders an em dash', () => {
    expect(relTime(undefined, now)).toBe('—');
  });
});
