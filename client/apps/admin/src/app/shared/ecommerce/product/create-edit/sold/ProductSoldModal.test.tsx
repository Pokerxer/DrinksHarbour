// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { productService } from '@/services/product.service';
import ProductSoldModal from './ProductSoldModal';
import { useProductSales } from './useProductSales';
import HeaderMetrics from '../header/HeaderMetrics';
vi.mock('@/services/product.service', () => ({
  productService: { getProductSalesHistory: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const response = (count = 1) => ({
  data: {
    report: {
      rows: Array.from({ length: count }, (_, n) => ({
        key: String(n),
        reference: `POS-${n}`,
        source: 'POS',
        buyer: n ? 'Chika' : 'Ada Obi',
        buyerId: `u${n}`,
        tenant: 'Shop A',
        size: '70cl',
        gross: 3,
        returned: 1,
        net: 2,
        soldAt: '2026-10-16T10:00:00Z',
        dateBasis: 'Paid',
        status: 'paid',
        transaction: String(n),
      })),
      totals: {
        gross: count * 3,
        returned: count,
        net: count * 2,
        transactions: count,
      },
      complete: true,
    },
  },
});
function Harness({ id = 'p', token = 'token' }: { id?: string; token?: string }) {
  const [open, setOpen] = useState(false);
  const sales = useProductSales(id, token);
  return (
    <>
      <input aria-label="Unsaved title" defaultValue="Draft" />
      <HeaderMetrics
        metrics={{
          sold: sales.report?.complete ? sales.report.totals.net : null,
          onHand: 4,
          price: 100,
          variants: 1,
        }}
        onOnHand={vi.fn()}
        onVariants={vi.fn()}
        onSold={() => setOpen(true)}
      />
      {open && (
        <ProductSoldModal
          key={id}
          productName="Bottega"
          sales={sales}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
it('opens from Sold, displays buyer, dates and returns, searches, closes without losing draft', async () => {
  vi.mocked(productService.getProductSalesHistory).mockResolvedValue(response());
  render(<Harness />);
  const button = screen.getByRole('button', { name: 'View sold history' });
  button.focus();
  fireEvent.click(button);
  const dialog = screen.getByRole('dialog', { name: 'Sold history' });
  await within(dialog).findByText('Ada Obi');
  expect(within(dialog).getByText('16 Oct 2026')).toBeTruthy();
  expect(within(dialog).getByText('11:00')).toBeTruthy();
  expect(within(dialog).getByText('Returned units')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search sales'), {
    target: { value: 'missing' },
  });
  expect(screen.getByText('No sales match these filters.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText('Ada Obi')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close sold history' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect((screen.getByLabelText('Unsaved title') as HTMLInputElement).value).toBe(
    'Draft'
  );
  await waitFor(() => expect(document.activeElement).toBe(button));
});
it('paginates all history, filters dates and refreshes totals', async () => {
  vi.mocked(productService.getProductSalesHistory).mockResolvedValue(response(26));
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'View sold history' }));
  await screen.findByText('POS-0');
  expect(screen.queryByText('POS-25')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next sales page' }));
  expect(screen.getByText('POS-25')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('From date'), {
    target: { value: '2026-10-17' },
  });
  expect(screen.getByText('No sales match these filters.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  vi.mocked(productService.getProductSalesHistory).mockResolvedValue(response(0));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh sales history' }));
  await screen.findByText('No completed sales recorded for this product.');
  expect(
    screen.getByRole('button', { name: 'View sold history' }).textContent
  ).toContain('0');
});
it('retries failures, distinguishes signed out from zero and discards late product responses', async () => {
  vi.mocked(productService.getProductSalesHistory).mockRejectedValueOnce(
    new Error('offline')
  );
  const { rerender } = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'View sold history' }));
  await screen.findByRole('alert');
  vi.mocked(productService.getProductSalesHistory).mockResolvedValueOnce(response());
  fireEvent.click(screen.getByRole('button', { name: 'Retry sales lookup' }));
  await screen.findByText('Ada Obi');
  rerender(<Harness id="other" token="" />);
  await screen.findByText('Sign in again to load sales history.');
  expect(screen.queryByText('Ada Obi')).toBeNull();
});
it('hides prior buyers immediately when product changes and ignores late responses', async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  vi.mocked(productService.getProductSalesHistory)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(response(0));
  const { rerender } = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'View sold history' }));
  const signal = vi.mocked(productService.getProductSalesHistory).mock.calls[0][2];
  rerender(<Harness id="other" />);
  await screen.findByText('No completed sales recorded for this product.');
  expect(signal?.aborted).toBe(true);
  finish(response());
  await waitFor(() => expect(screen.queryByText('Ada Obi')).toBeNull());
});
it('discloses incomplete evidence and cannot present malformed data as zero sales', async () => {
  const incomplete = response();
  incomplete.data.report.complete = false;
  vi.mocked(productService.getProductSalesHistory)
    .mockResolvedValueOnce(incomplete)
    .mockResolvedValueOnce({ data: {} });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'View sold history' }));
  await screen.findByText(/complete sold count cannot be confirmed/);
  expect(screen.getByRole('button', { name: 'View sold history' }).textContent).toContain('—');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh sales history' }));
  await screen.findByText('Sales history could not be loaded. Please try again.');
  expect(
    screen.queryByText('No completed sales recorded for this product.')
  ).toBeNull();
});
