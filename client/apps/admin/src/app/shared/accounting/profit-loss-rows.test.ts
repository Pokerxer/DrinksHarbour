import { expect, test } from 'vitest';
import { profitLossRows } from './profit-loss-rows';

test('screen and exports disclose refunds, VAT and other income without treating VAT as profit', () => {
  const rows = profitLossRows({
    revenueTotal: 802,
    sales: { gross: 1000, reversals: 200, net: 800, documentCount: 1 },
    otherIncome: 2,
    cogs: { total: 320, source: 'journal' },
    expenseTotal: 50,
    grossProfit: 480,
    netProfit: 432,
    tax: { collected: 60, paid: 0 },
  });
  const amounts = Object.fromEntries(
    rows.map((row) => [row.label, row.amount])
  );
  expect(amounts['Sales before reversals (excl. VAT)']).toBe(1000);
  expect(amounts['Refunds & sales reversals']).toBe(-200);
  expect(amounts['Net sales (excl. VAT)']).toBe(800);
  expect(amounts['Other income / rounding']).toBe(2);
  expect(amounts['Net profit']).toBe(432);
});

test('losses and zero values remain numeric in the report', () => {
  const rows = profitLossRows({
    revenueTotal: 0,
    cogs: { total: 50, source: 'journal' },
    expenseTotal: 10,
    grossProfit: -50,
    netProfit: -60,
    tax: { collected: 0, paid: 0 },
  });
  expect(rows.find((row) => row.label === 'Net profit')?.amount).toBe(-60);
  expect(
    rows.find((row) => row.label === 'Net sales (excl. VAT)')?.amount
  ).toBe(0);
});
