// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { StockTransfer } from '@/services/stockTransfer.service';
import StockTransferValueCell from './stock-transfer-value-cell';
afterEach(cleanup);
function transfer(values: Partial<StockTransfer> = {}): StockTransfer {
  return {
    _id: 't',
    transferNumber: 'TR1',
    sourceWarehouse: 'A',
    destinationWarehouse: 'B',
    status: 'completed',
    currency: 'NGN',
    items: [
      {
        subProductId: 's',
        subProductName: 'Wine',
        sku: 'W',
        quantity: 10,
        transferredQty: 10,
        costPrice: 100,
        taxRate: 7.5,
      },
    ],
    ...values,
  };
}
it('shows saved tax-inclusive value without adding tax twice', () => {
  render(<StockTransferValueCell transfer={transfer({ total: 1075, taxAmount: 75 })} />);
  expect(screen.getByText('NGN 1,075.00')).toBeTruthy();
  expect(screen.getByText('Includes NGN 75.00 tax')).toBeTruthy();
});
it('shows an untaxed transfer without a tax note', () => {
  render(<StockTransferValueCell transfer={transfer({ total: 1000, taxAmount: 0 })} />);
  expect(screen.getByText('NGN 1,000.00')).toBeTruthy();
  expect(screen.queryByText(/Includes/)).toBeNull();
});
it('preserves a zero total and tax after a full return', () => {
  render(
    <StockTransferValueCell transfer={transfer({ total: 0, totalValue: 1075, taxAmount: 0 })} />,
  );
  expect(screen.getByText('NGN 0.00')).toBeTruthy();
  expect(screen.queryByText(/Includes/)).toBeNull();
});
it('legacy line fallback applies discounts and tax to quantities remaining after returns', () => {
  const t = transfer();
  t.items[0].discountRate = 10;
  t.items[0].returnedQty = 2;
  render(<StockTransferValueCell transfer={t} />);
  expect(screen.getByText('NGN 774.00')).toBeTruthy();
  expect(screen.getByText('Includes NGN 54.00 tax')).toBeTruthy();
});
it('uses the legacy snapshot and transfer currency', () => {
  render(
    <StockTransferValueCell
      transfer={transfer({ totalValue: 215, taxAmount: 15, currency: 'USD' })}
    />,
  );
  expect(screen.getByText('USD 215.00')).toBeTruthy();
  expect(screen.getByText('Includes USD 15.00 tax')).toBeTruthy();
});
