// app/shared/accounting/journal-entries-summary.test.ts
import { describe, expect, it } from 'vitest';
import { exportPageRequests, summarizePage } from './accounting-helpers';
import type { JournalEntry } from '@/services/accounting.service';

const entry = (over: Partial<JournalEntry>): JournalEntry =>
  ({
    _id: Math.random().toString(36).slice(2),
    date: '2026-08-01T00:00:00.000Z',
    entryType: 'manual',
    refDocType: 'Manual',
    status: 'posted',
    lines: [
      { account: '1000', debit: 100, credit: 0 },
      { account: '4000', debit: 0, credit: 100 },
    ],
    ...over,
  }) as JournalEntry;

describe('summarizePage', () => {
  it('totals posted entries only and counts drafts separately', () => {
    // Drafts never reach the ledger, so folding them into "page totals" showed
    // a number that corresponded to no real period movement.
    const s = summarizePage([
      entry({}),
      entry({}),
      entry({ status: 'draft' }),
    ]);
    expect(s.postedCount).toBe(2);
    expect(s.draftCount).toBe(1);
    expect(s.debit).toBe(200);
    expect(s.credit).toBe(200);
    expect(s.draftDebit).toBe(100);
  });

  it('reports an out-of-balance page instead of showing two numbers that disagree', () => {
    const s = summarizePage([
      entry({ lines: [{ account: '1000', debit: 100, credit: 0 }] }),
      entry({ lines: [{ account: '4000', debit: 0, credit: 98.5 }] }),
    ]);
    expect(s.outOfBalance).toBe(true);
    expect(s.outOfBalanceBy).toBe(1.5);
    expect(s.unbalancedCount).toBe(2);
  });

  it('matches the server: a missing kobo is balanced, a naira is not', () => {
    // isBalanced() on the server accepts |dr - cr| <= 0.01, so the page must not
    // cry out of balance over the same rounding the posting path tolerates.
    const kobo = summarizePage([
      entry({ lines: [{ account: '1000', debit: 100, credit: 0 }] }),
      entry({ lines: [{ account: '4000', debit: 0, credit: 99.99 }] }),
    ]);
    expect(kobo.outOfBalance).toBe(false);
    expect(kobo.outOfBalanceBy).toBe(0.01);
  });

  it('treats a kobo rounding difference as balanced', () => {
    const s = summarizePage([
      entry({ lines: [{ account: '1000', debit: 100, credit: 0 }] }),
      entry({ lines: [{ account: '4000', debit: 0, credit: 99.999 }] }),
    ]);
    expect(s.outOfBalance).toBe(false);
    expect(s.outOfBalanceBy).toBe(0);
  });

  it('does not let an unbalanced draft condemn the posted page', () => {
    const s = summarizePage([
      entry({}),
      entry({
        status: 'draft',
        lines: [{ account: '1000', debit: 500, credit: 0 }],
      }),
    ]);
    expect(s.outOfBalance).toBe(false);
    expect(s.draftCount).toBe(1);
  });

  it('is empty-safe', () => {
    expect(summarizePage([])).toMatchObject({
      postedCount: 0,
      draftCount: 0,
      debit: 0,
      credit: 0,
      outOfBalance: false,
      outOfBalanceBy: 0,
      unbalancedCount: 0,
    });
  });
});

describe('exportPageRequests', () => {
  it('asks for nothing when nothing matches', () => {
    expect(exportPageRequests(0)).toEqual([]);
    expect(exportPageRequests(NaN)).toEqual([]);
    expect(exportPageRequests(-5)).toEqual([]);
  });

  it('walks the pages needed to cover the whole filtered set', () => {
    // "Export CSV" wrote only the 25 rows on screen; a bookkeeper filtering a
    // quarter got 25 rows and called it the ledger.
    expect(exportPageRequests(25, 25)).toEqual([1]);
    expect(exportPageRequests(26, 25)).toEqual([1, 2]);
    expect(exportPageRequests(60, 25)).toEqual([1, 2, 3]);
    expect(exportPageRequests(137, 25)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('never requests more than the 500 rows the API will serve', () => {
    // GET /journal-entries clamps limit to 500.
    expect(exportPageRequests(500, 500)).toEqual([1]);
    expect(exportPageRequests(1200, 500)).toEqual([1, 2, 3]);
    expect(exportPageRequests(1200, 5000)).toEqual([1, 2, 3]);
  });
});
