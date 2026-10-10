// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransferReturnPanel from './transfer-return-panel';
import { stockTransferService, type StockTransfer } from '@/services/stockTransfer.service';
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const transfer = {
  _id: 't1',
  status: 'completed',
  currency: 'NGN',
  total: 700,
  items: [
    { subProductName: 'Wine', quantity: 10, receivedQty: 10, transferredQty: 10, returnedQty: 3 },
  ],
} as StockTransfer;
it('shows remaining received goods and posts one return line', async () => {
  const save = vi
    .spyOn(stockTransferService, 'returnLine')
    .mockResolvedValue({ success: true, data: transfer });
  const refresh = vi.fn();
  render(<TransferReturnPanel transfer={transfer} token="token" canReturn onComplete={refresh} />);
  fireEvent.change(screen.getByLabelText('Return quantity for Wine'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Return Wine' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledWith(transfer));
  expect(save.mock.calls[0][1]).toMatchObject({
    itemIndex: 0,
    quantity: 7,
    requestId: expect.any(String),
  });
});
it('does not offer actions to users without destination authority', () => {
  render(
    <TransferReturnPanel
      transfer={transfer}
      token="token"
      canReturn={false}
      onComplete={() => {}}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Return Wine' })).toBeNull();
});
it('reviews all remaining products and submits one bulk return', async () => {
  const save = vi
    .spyOn(stockTransferService, 'returnAll')
    .mockResolvedValue({ success: true, data: transfer });
  const refresh = vi.fn();
  render(<TransferReturnPanel transfer={transfer} token="token" canReturn onComplete={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Return all products' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText('Wine: 7 units')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm return of all products' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledWith(transfer));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0]).toEqual(['t1', { note: '', requestId: expect.any(String) }, 'token']);
});
