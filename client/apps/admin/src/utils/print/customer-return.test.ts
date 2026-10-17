import { expect, it } from 'vitest';
import { buildCustomerReturn } from './customer-return';
import { renderDocument } from './pdf-render';
it('prints exact returned quantities in the inventory template without inventing financial refunds', () => {
  const doc = buildCustomerReturn(
    [
      {
        id: 'line',
        source: 'sales',
        sourceId: 'so',
        sourceNumber: 'SO-1',
        reference: 'SO-1',
        product: 'Wine',
        size: '750ml',
        returned: 3,
        restocked: null,
        notRestocked: null,
        stockEvidence: 'unverified',
        warehouse: null,
        date: null,
        reason: 'Customer return',
      },
    ],
    { name: 'Wyn City' },
    'Selected return'
  );
  expect(doc.kind).toBe('return');
  expect(doc.companyName).toBe('Wyn City');
  expect(doc.head).toEqual({});
  expect(doc.docTitle).toBe('Customer Return Note');
  expect(doc.table.rows[0].map((cell) => cell.text)).toContain('3');
  expect(doc.table.rows[0].map((cell) => cell.text)).toContain('Unknown');
  expect(doc.totals.find((row) => row.label === 'Returned units')?.value).toBe(
    '3'
  );
  expect(
    doc.totals.some((row) => /refund|amount|cost|tax/i.test(row.label))
  ).toBe(false);
  expect(
    renderDocument({ ...doc, templateId: 'classic' }).output('arraybuffer')
      .byteLength
  ).toBeGreaterThan(1000);
});
