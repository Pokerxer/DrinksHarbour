// app/shared/accounting/journal-entries-csv.test.ts
import { describe, expect, it } from 'vitest';
import { journalEntriesCsv } from './journal-entry-detail';
import type { JournalEntry } from '@/services/accounting.service';

const entry = (over: Partial<JournalEntry> = {}) =>
  ({
    _id: 'je1',
    date: '2026-08-14T09:30:00.000Z',
    entryType: 'sales_revenue',
    refDocType: 'Order',
    refDoc: '68f0a1b2c3d4e5f6a7b8c9d0',
    memo: 'POS receipt R-00042',
    status: 'posted',
    lines: [
      { account: '1100', debit: 1150, credit: 0 },
      { account: '4000', debit: 0, credit: 1000 },
      { account: '2100', debit: 0, credit: 150 },
    ],
    ...over,
  }) as JournalEntry;

describe('journalEntriesCsv', () => {
  it('does not present a Mongo id as a reference number', () => {
    const { headers, rows } = journalEntriesCsv([entry()]);
    expect(headers).toContain('Source ID');
    expect(headers).not.toContain('Ref Number');
    // The business number a bookkeeper wants is carried in the memo.
    expect(headers).toContain('Memo');
    expect(rows[0]).toContain('POS receipt R-00042');
  });

  it('writes the two sides and the status, aligned to the headers', () => {
    const { headers, rows } = journalEntriesCsv([entry(), entry({ _id: 'je2', status: 'draft' })]);
    for (const row of rows) expect(row).toHaveLength(headers.length);
    // Debit side 1150; credit side is 1000 sales + 150 VAT.
    expect(rows[0].slice(-3)).toEqual(['1150.00', '1150.00', 'posted']);
    expect(rows[1].slice(-1)).toEqual(['draft']);
  });

  it('tolerates a manual entry with no source document', () => {
    const { rows } = journalEntriesCsv([
      entry({ refDoc: undefined, refDocType: 'Manual', memo: null, entryType: 'manual' }),
    ]);
    expect(rows[0][2]).toBe('');
    expect(rows[0][4]).toBe('');
  });
});
