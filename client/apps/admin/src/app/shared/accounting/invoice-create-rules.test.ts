import { expect, it } from 'vitest';
import { invoiceReadiness } from './invoice-create-rules';
const product = {
  lineType: 'product',
  subProductId: 'sub',
  quantity: 2,
  unitPrice: 100,
  name: 'Wine',
};
it('requires actual products rather than note/section rows', () => {
  expect(
    invoiceReadiness(
      [{ ...product, lineType: 'note', subProductId: '' }],
      100,
      ''
    ).issueError
  ).toMatch(/product/);
});
it('rejects non-finite quantities and nonpositive totals before issuance', () => {
  expect(
    invoiceReadiness([{ ...product, quantity: Infinity }], 100, '').issueError
  ).toMatch(/quantity/i);
  expect(invoiceReadiness([product], 0, '').issueError).toMatch(/positive/i);
  expect(invoiceReadiness([product], 0, '').saveError).toBe('');
});
it('accepts optional dates and valid leap days but rejects rolled-over dates', () => {
  expect(invoiceReadiness([product], 200, '').issueError).toBe('');
  expect(invoiceReadiness([product], 200, '2028-02-29').issueError).toBe('');
  expect(invoiceReadiness([product], 200, '2026-02-30').issueError).toMatch(
    /date/i
  );
});
it('does not issue a foreign-currency source as a naira invoice', () => {
  expect(invoiceReadiness([product], 200, '', 'USD').issueError).toMatch(/NGN/);
});
