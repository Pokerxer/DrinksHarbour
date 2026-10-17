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
import HeaderMetrics from '../header/HeaderMetrics';
import ProductOnHandModal from './ProductOnHandModal';
import { productService } from '@/services/product.service';
vi.mock('@/services/product.service', () => ({
  productService: { getProductStock: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('shows reserved and available totals and refreshes changed order holds', async () => {
  const snapshot = (reservedStock: number, availableStock: number) => ({
    success: true,
    data: {
      product: {
        subProducts: [
          {
            _id: 'listing',
            tenant: { name: 'Harbour' },
            status: 'active',
            sizes: [
              {
                _id: 'size',
                size: '70cl',
                stock: 10,
                reservedStock,
                availableStock,
              },
            ],
          },
        ],
      },
    },
  });
  vi.mocked(productService.getProductStock)
    .mockResolvedValueOnce(snapshot(3, 7))
    .mockResolvedValueOnce(snapshot(6, 4));
  render(
    <ProductOnHandModal
      productId="p"
      productName="Drink"
      token="token"
      onClose={vi.fn()}
    />
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Reserved').textContent).toBe('3')
  );
  expect(screen.getByLabelText('Available').textContent).toBe('7');
  const table = screen.getByRole('table');
  expect(
    within(table).getByRole('columnheader', { name: 'Reserved' })
  ).toBeTruthy();
  expect(within(table).getByRole('cell', { name: '3' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh stock' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Reserved').textContent).toBe('6')
  );
  expect(screen.getByLabelText('Available').textContent).toBe('4');
  expect(screen.getByLabelText('Total on hand').textContent).toBe('10');
});
const product = (name = 'Harbour Shop', stock = 4) => ({
  success: true,
  data: {
    product: {
      subProducts: [
        {
          _id: 'listing',
          sku: 'BOTTLE',
          tenant: { name },
          status: 'active',
          sizes: [
            { _id: 'size', size: '70cl', stock, availability: 'available' },
          ],
        },
      ],
    },
  },
});
it('loads fresh stock, displays full detail and filters without changing the underlying total', async () => {
  vi.mocked(productService.getProductStock).mockResolvedValue(product());
  const update = vi.fn(),
    close = vi.fn();
  render(
    <ProductOnHandModal
      productId="p"
      productName="Bottega"
      token="token"
      onClose={close}
      onTotalChange={update}
    />
  );
  const dialog = await screen.findByRole('dialog', { name: 'On-hand stock' });
  expect(await within(dialog).findByText('Harbour Shop')).toBeTruthy();
  expect(screen.getByText('70cl')).toBeTruthy();
  expect(screen.getByText('BOTTLE')).toBeTruthy();
  expect(update).toHaveBeenCalledWith(4);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'missing' },
  });
  expect(screen.getByText('No matching stock lines')).toBeTruthy();
  expect(screen.getByLabelText('Total on hand').textContent).toBe('4');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
  vi.mocked(productService.getProductStock).mockResolvedValue(
    product('Harbour Shop', 0)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh stock' }));
  await waitFor(() => expect(update).toHaveBeenLastCalledWith(0));
  fireEvent.click(screen.getByRole('button', { name: 'Close on-hand stock' }));
  expect(close).toHaveBeenCalledOnce();
});
it('failed reads offer Retry and do not present an empty catalogue or stale totals', async () => {
  vi.mocked(productService.getProductStock)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(product());
  render(
    <ProductOnHandModal
      productId="p"
      productName="Drink"
      token="token"
      onClose={vi.fn()}
    />
  );
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No tenant listings')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry stock lookup' }));
  expect(await screen.findByText('Harbour Shop')).toBeTruthy();
});
it('product changes discard late results from the previous product', async () => {
  let finish!: (value: ReturnType<typeof product>) => void;
  vi.mocked(productService.getProductStock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(product('New tenant', 7));
  const update = vi.fn(),
    props = {
      productName: 'Drink',
      token: 'token',
      onClose: vi.fn(),
      onTotalChange: update,
    };
  const { rerender } = render(
    <ProductOnHandModal {...props} productId="old" />
  );
  rerender(<ProductOnHandModal {...props} productId="new" />);
  expect(await screen.findByText('New tenant')).toBeTruthy();
  finish(product('Old tenant', 99));
  await waitFor(() => expect(screen.queryByText('Old tenant')).toBeNull());
  expect(update).not.toHaveBeenCalledWith(99);
});
it('the header metric opens the dialog and closing restores focus without changing the form', async () => {
  vi.mocked(productService.getProductStock).mockResolvedValue(product());
  function Editor() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <input
          aria-label="Unsaved product name"
          defaultValue="My edited name"
        />
        <HeaderMetrics
          metrics={{ onHand: 4, price: 39000, variants: 1, sold: 0 }}
          onVariants={() => {}}
          onOnHand={() => setOpen(true)}
          onSold={vi.fn()}
        />
        {open && (
          <ProductOnHandModal
            productId="p"
            productName="Drink"
            token="token"
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }
  render(<Editor />);
  const trigger = screen.getByRole('button', { name: 'View on-hand stock' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(
    await screen.findByRole('dialog', { name: 'On-hand stock' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close on-hand stock' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(
    (
      screen.getByRole('textbox', {
        name: 'Unsaved product name',
      }) as HTMLInputElement
    ).value
  ).toBe('My edited name');
});
it('genuine empty stock and missing authentication have distinct states', async () => {
  vi.mocked(productService.getProductStock).mockResolvedValue({
    success: true,
    data: { product: { subProducts: [] } },
  });
  const props = { productId: 'p', productName: 'Drink', onClose: vi.fn() };
  const { rerender } = render(<ProductOnHandModal {...props} token="token" />);
  expect(await screen.findByText('No tenant listings')).toBeTruthy();
  expect(screen.getByLabelText('Total on hand').textContent).toBe('0');
  rerender(<ProductOnHandModal {...props} token={undefined} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No tenant listings')).toBeNull();
  expect(productService.getProductStock).toHaveBeenCalledTimes(1);
});
