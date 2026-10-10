import { expect, it } from 'vitest';
import { datePreset, historyCsv } from './history-tools';
it('builds inclusive UTC shortcuts even at a month boundary', () => {
  expect(datePreset('week', new Date('2026-10-03T23:59:59Z'))).toEqual({
    start: '2026-09-27',
    end: '2026-10-03',
  });
  expect(datePreset('month', new Date('2026-10-03T01:00:00Z'))).toEqual({
    start: '2026-10-01',
    end: '2026-10-03',
  });
  expect(datePreset('all')).toEqual({ start: '', end: '' });
});
it('exports only provided rows with signed stock changes and safe spreadsheet text', () => {
  const csv = historyCsv(
    [
      {
        id: '1',
        documentId: 'p',
        documentType: 'product',
        reference: '=SUM(1,2)',
        description: 'Wine "red"',
        date: '2026-10-03',
        status: 'transfer_out',
        quantity: 4,
        balanceAfter: 8,
        actor: 'Alice',
      },
    ],
    'movements',
  );
  expect(csv).toContain('"\'=SUM(1,2)"');
  expect(csv).toContain('"Wine ""red"""');
  expect(csv).toContain('"-4"');
  expect(csv).toContain('Balance after');
  expect(csv.split('\r\n')).toHaveLength(2);
});
