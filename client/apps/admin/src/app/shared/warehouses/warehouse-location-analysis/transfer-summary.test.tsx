// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import TransferSummary from './transfer-summary';
afterEach(cleanup);
it('shows value and quantity totals and links the counterpart warehouse', () => {
  const row = {
    currency: 'NGN',
    outgoingQuantity: 10,
    incomingQuantity: 0,
    returnedInQuantity: 3,
    returnedOutQuantity: 0,
    outgoingValue: 1000,
    incomingValue: 0,
    returnedInValue: 300,
    returnedOutValue: 0,
    netIncomingQuantity: 0,
    netOutgoingQuantity: 7,
    netOutgoingValue: 700,
    netIncomingValue: 0,
  };
  render(
    <TransferSummary
      summary={{
        kind: 'documents',
        currencies: [row],
        pairs: [{ ...row, warehouseId: 'other', warehouseName: 'Other depot' }],
      }}
    />,
  );
  expect(screen.getByRole('region', { name: 'Transfer and return totals' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Other depot' }).getAttribute('href')).toBe(
    '/warehouses/other/analysis',
  );
  expect(screen.getAllByText('NGN 1,000.00')).toHaveLength(2);
  expect(screen.getAllByText('NGN 300.00')).toHaveLength(2);
  expect(screen.getAllByText('NGN 700.00')).toHaveLength(2);
  expect(screen.getByText(/across every page/)).toBeTruthy();
});
it('does not present unknown movement values as zero money', () => {
  render(
    <TransferSummary
      summary={{
        kind: 'movements',
        outgoingQuantity: 10,
        incomingQuantity: 4,
        returnedInQuantity: 2,
        returnedOutQuantity: 1,
        netIncomingQuantity: 3,
        netOutgoingQuantity: 8,
        moneyAvailable: false,
      }}
    />,
  );
  expect(screen.getByText(/Monetary values were not reliably recorded/)).toBeTruthy();
  expect(screen.queryByText(/NGN/)).toBeNull();
});
it('shows explicit return-adjusted transfer in/out columns with quantities and values', () => {
  const row = {
    currency: 'NGN',
    outgoingQuantity: 10,
    incomingQuantity: 8,
    returnedInQuantity: 3,
    returnedOutQuantity: 2,
    outgoingValue: 1000,
    incomingValue: 800,
    returnedInValue: 300,
    returnedOutValue: 200,
    netOutgoingValue: 700,
    netIncomingValue: 600,
    netOutgoingQuantity: 7,
    netIncomingQuantity: 6,
  };
  render(
    <TransferSummary
      summary={{
        kind: 'documents',
        currencies: [row],
        pairs: [{ ...row, warehouseId: 'other', warehouseName: 'Other depot' }],
      }}
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'Total transferred in' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Total transferred out' })).toBeTruthy();
  const cells = screen.getAllByRole('cell');
  expect(
    cells.some(
      (cell) => cell.textContent?.includes('NGN 600.00') && cell.textContent?.includes('6 units'),
    ),
  ).toBe(true);
  expect(
    cells.some(
      (cell) => cell.textContent?.includes('NGN 700.00') && cell.textContent?.includes('7 units'),
    ),
  ).toBe(true);
});

it('presents combined totals in one row independently of the warehouse breakdown', () => {
  const base = {
    currency: 'NGN',
    incomingQuantity: 30,
    outgoingQuantity: 45,
    returnedOutQuantity: 4,
    returnedInQuantity: 5,
    incomingValue: 3000,
    outgoingValue: 4500,
    returnedOutValue: 400,
    returnedInValue: 500,
    netIncomingQuantity: 26,
    netOutgoingQuantity: 40,
    netIncomingValue: 2600,
    netOutgoingValue: 4000,
  };
  render(<TransferSummary summary={{ kind: 'documents', currencies: [base], pairs: [] }} />);
  const table = screen.getByRole('table', { name: 'All matching transfers' });
  expect(table.textContent).toContain('Total transferred in');
  expect(table.textContent).toContain('Total transferred out');
  expect(table.textContent).toContain('26 units');
  expect(table.textContent).toContain('40 units');
  expect(table.textContent).toContain('NGN 2,600.00');
  expect(table.textContent).toContain('NGN 4,000.00');
});
