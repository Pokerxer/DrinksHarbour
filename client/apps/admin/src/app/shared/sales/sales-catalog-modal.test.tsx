// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import SalesCatalogModal from './sales-catalog-modal';
import { product, response, props } from './sales-catalog-test-fixtures';
vi.mock('next/image', () => ({
  default: ({
    fill: _fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Lightweight test replacement for next/image.
    <img {...props} alt={props.alt ?? ''} />
  ),
}));
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('empty warehouse explains that products must be assigned to that location', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([], 1, 0)));
  render(<SalesCatalogModal {...props()} />);
  expect(await screen.findByText('No products in this warehouse')).toBeTruthy();
  expect(
    screen.getByText(
      'Assign products to the selected warehouse to see them here.',
    ),
  ).toBeTruthy();
});

test('opens with one compact warehouse request and paginates beyond the old 60-product cap', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response([product('Later bottle')], 2));
  vi.stubGlobal('fetch', fetcher);
  render(<SalesCatalogModal {...props()} />);
  await screen.findByRole('article', { name: 'Cabernet' });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(fetcher).toHaveBeenCalledTimes(1);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get('limit')).toBe('24');
  expect(url.searchParams.get('view')).toBe('catalogue');
  expect(url.searchParams.get('warehouseId')).toBe('warehouse');
  expect(screen.getByRole('dialog').textContent).toContain('Main shop');
  fireEvent.click(screen.getByRole('button', { name: 'Next catalogue page' }));
  await screen.findByRole('article', { name: 'Later bottle' });
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('page')).toBe('2');
});

test('debounces search, sends full-catalogue filters and keeps pack metadata on add', async () => {
  const fetcher = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetcher);
  const callbacks = props();
  render(<SalesCatalogModal {...callbacks} />);
  await screen.findByRole('article', { name: 'Cabernet' });
  const search = screen.getByRole('textbox', { name: 'Search catalogue' });
  fireEvent.change(search, { target: { value: 'Cab' } });
  fireEvent.change(search, { target: { value: 'Cabernet' } });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('search')).toBe(
    'Cabernet',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Rare brand' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(new URL(fetcher.mock.calls[2][0]).searchParams.get('brands')).toBe(
    'rare',
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole('region', { name: 'Catalogue results' })
        .getAttribute('aria-busy'),
    ).toBe('false'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Choose size · 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Cabernet 75cl' }));
  expect(callbacks.onAdd).toHaveBeenCalledWith(
    expect.objectContaining({
      subProductId: 'sp',
      productId: 'central',
      sizeId: 'size-sp',
      unitsPerPack: 12,
      sellingPrice: 1000,
      taxRate: 7.5,
    }),
  );
});

test('request failure is distinct from an empty catalogue and supports retry', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValueOnce(response());
  vi.stubGlobal('fetch', fetcher);
  render(<SalesCatalogModal {...props()} />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Connection interrupted',
  );
  expect(screen.queryByText('Your catalogue is empty')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry catalogue' }));
  await screen.findByRole('article', { name: 'Cabernet' });
});

test('token/warehouse changes and late responses cannot expose stale stock or products', async () => {
  let complete: (value: ReturnType<typeof response>) => void = () => {};
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    )
    .mockResolvedValueOnce(response([product('New tenant wine')]));
  vi.stubGlobal('fetch', fetcher);
  const callbacks = props();
  const { rerender } = render(<SalesCatalogModal {...callbacks} />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  rerender(
    <SalesCatalogModal
      {...callbacks}
      token="new-token"
      warehouseId="new-warehouse"
    />,
  );
  await screen.findByRole('article', { name: 'New tenant wine' });
  complete(response([product('Old tenant wine')]));
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(screen.queryByRole('article', { name: 'Old tenant wine' })).toBeNull();
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});

test('multiple product search terms remain removable and are sent together', async () => {
  const fetcher = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetcher);
  render(<SalesCatalogModal {...props()} />);
  await screen.findByRole('article', { name: 'Cabernet' });
  const search = screen.getByRole('textbox', { name: 'Search catalogue' });
  fireEvent.change(search, { target: { value: 'Cabernet' } });
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(
    screen.getByRole('button', { name: 'Remove search Cabernet' }),
  ).toBeTruthy();
  fireEvent.change(search, { target: { value: 'Whisky' } });
  fireEvent.keyDown(search, { key: 'Enter' });
  await waitFor(() =>
    expect(
      new URL(fetcher.mock.calls.at(-1)![0]).searchParams.get('search'),
    ).toBe('Cabernet, Whisky,'),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove search Cabernet' }),
  );
  await waitFor(() =>
    expect(
      new URL(fetcher.mock.calls.at(-1)![0]).searchParams.get('search'),
    ).toBe('Whisky,'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await waitFor(() =>
    expect(
      new URL(fetcher.mock.calls.at(-1)![0]).searchParams.get('search'),
    ).toBe(''),
  );
});

test('out-of-stock products without variants remain addable', async () => {
  const row = {
    ...product('Sold out wine'),
    availableStock: 0,
    sellWithoutSizeVariants: true,
    sizes: [],
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([row])));
  const callbacks = props();
  render(<SalesCatalogModal {...callbacks} />);
  await screen.findByRole('article', { name: 'Sold out wine' });
  expect(screen.getByText('Out of stock')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add to order' }));
  expect(callbacks.onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Sold out wine', availableStock: 0 }),
  );
});

test('live order summary and quantity controls follow the order, including removal', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  const callbacks = { ...props(), qtyMap: { 'sp|size-sp': 4 } };
  render(<SalesCatalogModal {...callbacks} />);
  const article = await screen.findByRole('article', { name: 'Cabernet' });
  expect(screen.getByRole('dialog').textContent).toContain('1 line in order');
  fireEvent.click(
    within(article).getByRole('button', { name: 'Choose size · 1' }),
  );
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Quantity for Cabernet 75cl' }),
    { target: { value: '9' } },
  );
  expect(callbacks.onSetQty).toHaveBeenCalledWith(
    expect.objectContaining({ sizeId: 'size-sp' }),
    9,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Cabernet 75cl from order' }),
  );
  expect(callbacks.onRemove).toHaveBeenCalledWith(
    expect.objectContaining({ sizeId: 'size-sp' }),
  );
});

test('reopening reuses the page while refreshing stock, and stale controls stay disabled', async () => {
  let finish: (value: ReturnType<typeof response>) => void = () => {};
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response())
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  const callbacks = props();
  const { rerender } = render(<SalesCatalogModal {...callbacks} />);
  await screen.findByRole('article', { name: 'Cabernet' });
  rerender(<SalesCatalogModal {...callbacks} open={false} />);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  rerender(<SalesCatalogModal {...callbacks} open />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('article', { name: 'Cabernet' })).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Choose size · 1' })
      .matches(':disabled'),
  ).toBe(true);
  const refreshed = product();
  refreshed.availableStock = 0;
  refreshed.sizes[0].availableStock = 0;
  finish(response([refreshed]));
  await waitFor(() =>
    expect(
      screen
        .getByRole('region', { name: 'Catalogue results' })
        .getAttribute('aria-busy'),
    ).toBe('false'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Choose size · 1' }));
  expect(
    screen
      .getByRole('button', { name: 'Add Cabernet 75cl' })
      .matches(':disabled'),
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Add Cabernet 75cl' }));
  expect(callbacks.onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ availableStock: 0, sizeId: 'size-sp' }),
  );
});
