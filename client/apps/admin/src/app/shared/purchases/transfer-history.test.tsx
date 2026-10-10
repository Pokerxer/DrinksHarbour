// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TransferHistory from './transfer-history';
import type { StockTransfer } from '@/services/stockTransfer.service';
afterEach(cleanup);
it('includes returns in date order with who, quantities and refunded value', () => {
  const transfer = { currency: 'NGN', items: [{ subProductName: 'Wine' }],
    createdAt: '2026-10-01T10:00:00Z', completedDate: '2026-10-01T12:00:00Z',
    returns: [{ _id: 'r', returnedAt: '2026-10-02T10:00:00Z', returnedBy: { _id: 'u', name: 'Ada' },
      refundedValue: 360, remainingValue: 840, lines: [{ itemIndex: 0, quantity: 3, note: 'Damaged' }] }] } as unknown as StockTransfer;
  render(<TransferHistory transfer={transfer} />);
  expect(screen.getByText(/Returned.*3.*Wine/)).toBeTruthy();
  expect(screen.getByText(/Ada/)).toBeTruthy();
  expect(screen.getByText(/360/)).toBeTruthy();
  const entries = screen.getAllByRole('listitem');
  expect(entries.at(-1)?.textContent).toContain('Returned');
});
