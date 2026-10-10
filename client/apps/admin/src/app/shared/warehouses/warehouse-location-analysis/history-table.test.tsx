// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import HistoryTable from './history-table';
import { historyCsv } from './history-tools';
afterEach(cleanup);
const row = {
  id: 'r',
  documentId: 'tr',
  documentType: 'transfer' as const,
  reference: 'TR1',
  description: 'Incoming',
  date: '2026-10-03',
  status: 'completed',
  quantity: 6,
  returned: 2,
  transferInQuantity: 4,
  transferOutQuantity: 0,
};
it('shows received less returned units and exports both net direction columns', () => {
  render(<HistoryTable rows={[row]} kind="transfers" />);
  expect(screen.getByRole('columnheader', { name: 'Transferred in' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Transferred out' })).toBeTruthy();
  const cells = screen.getAllByRole('cell');
  expect(cells[4].textContent).toBe('4');
  expect(cells[5].textContent).toBe('0');
  const csv = historyCsv([row], 'transfers');
  expect(csv).toContain('"Transferred in","Transferred out"');
  expect(csv).toContain('"6","4","0","2"');
});
it('shows a return as a negative correction to the original outgoing transfer', () => {
  render(
    <HistoryTable
      rows={[
        {
          ...row,
          documentType: 'product',
          status: 'returned',
          quantity: 3,
          transferInQuantity: 0,
          transferOutQuantity: -3,
          balanceAfter: 10,
        },
      ]}
      kind="transfer_movements"
    />,
  );
  const cells = screen.getAllByRole('cell');
  expect(cells[3].textContent).toBe('+3');
  expect(cells[4].textContent).toBe('0');
  expect(cells[5].textContent).toBe('-3');
});
it('shows purchase returns and net purchased units in history and CSV', () => {
  const purchase = {
    ...row,
    documentType: 'purchase' as const,
    purchasedQuantity: 4,
    receivedAmount: 600,
    returnedAmount: 200,
    netPurchaseAmount: 400,
    currency: 'NGN',
  };
  render(<HistoryTable rows={[purchase]} kind="purchases" />);
  expect(screen.getByRole('columnheader', { name: 'Purchased after returns' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Returned' })).toBeTruthy();
  expect(screen.getByText('NGN 400.00')).toBeTruthy();
  const csv = historyCsv([purchase], 'purchases');
  expect(csv).toContain('"Returned","Purchased after returns"');
  expect(csv).toContain('"6","2","4"');
});
it('shows recount targets without inventing a stock increase and exports before/after balances', () => {
  const adjustment = {
    ...row,
    documentType: 'product' as const,
    status: 'adjusted',
    quantity: 7,
    stockChange: null,
    balanceBefore: null,
    balanceAfter: 7,
  };
  render(<HistoryTable rows={[adjustment]} kind="movements" />);
  expect(screen.getByRole('columnheader', { name: 'Balance before' })).toBeTruthy();
  expect(screen.getByText('Recount: 7')).toBeTruthy();
  expect(screen.queryByText('+7')).toBeNull();
  const csv = historyCsv([adjustment], 'movements');
  expect(csv).toContain('Recorded quantity');
  expect(csv).toContain('Balance before');
});
