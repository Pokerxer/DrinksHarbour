import { expect, it } from 'vitest';
import { salesReportFromResponse, filterSalesRows } from './sales-report';
const row = {
  key: '1',
  reference: 'POS-1',
  source: 'POS',
  buyer: 'Ada Obi',
  buyerId: 'u',
  tenant: 'Shop A',
  size: '70cl',
  gross: 3,
  returned: 1,
  net: 2,
  soldAt: '2026-10-16T23:30:00Z',
  dateBasis: 'Paid',
  status: 'paid',
  transaction: 'r',
};
it('requires a valid report, never turns malformed data into zero sales', () => {
  expect(() => salesReportFromResponse({ data: {} })).toThrow();
  expect(() =>
    salesReportFromResponse({
      data: {
        report: {
          rows: [row],
          totals: { gross: 3, returned: 1, net: 999, transactions: 1 },
          complete: true,
        },
      },
    })
  ).toThrow();
});
it('searches buyers and references and filters by Lagos civil dates', () => {
  expect(filterSalesRows([row], 'ada', '2026-10-17', '2026-10-17')).toHaveLength(1);
  expect(filterSalesRows([row], '', '', '2026-10-16')).toHaveLength(0);
  expect(filterSalesRows([row], 'other', '', '')).toHaveLength(0);
});
