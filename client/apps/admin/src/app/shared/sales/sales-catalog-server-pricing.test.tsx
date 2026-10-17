// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import SalesCatalogModal from './sales-catalog-modal';
import { props, product, response } from './sales-catalog-test-fixtures';
vi.mock('next/image', () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function priced(unitPrice: number, quantity = 1) {
  const raw = product();
  return response([
    {
      ...raw,
      sizes: [{ ...raw.sizes[0], salesPricing: { unitPrice, quantity } }],
    },
  ]);
}

test('catalogue requests the selected list and displays the sales server price instead of a retail estimate', async () => {
  const fetcher = vi.fn().mockResolvedValue(priced(25600));
  vi.stubGlobal('fetch', fetcher);
  const callbacks = props();
  render(
    <SalesCatalogModal
      {...callbacks}
      pricelistId="distribution"
      pricelist={{ rules: [{ priceType: 'discount', discountPercentage: 10 }] }}
    />
  );
  const card = await screen.findByRole('article', { name: 'Cabernet' });
  expect(card.textContent).toContain('25,600');
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get('pricelistId')).toBe('distribution');
  expect(url.searchParams.get('pricing')).toBe('true');
  fireEvent.click(within(card).getByRole('button', { name: /Choose size/ }));
  fireEvent.click(
    within(card).getByRole('button', { name: 'Add Cabernet 75cl' })
  );
  expect(callbacks.onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ sellingPrice: 25600, enginePriced: true })
  );
});

test('changing list or quantity fetches a fresh server quote while the catalogue stays open', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(priced(26000))
    .mockResolvedValueOnce(priced(24000))
    .mockResolvedValueOnce(priced(22000, 6));
  vi.stubGlobal('fetch', fetcher);
  const callbacks = props();
  const { rerender } = render(
    <SalesCatalogModal {...callbacks} pricelistId="retail" />
  );
  await screen.findByText(/26,000/);
  rerender(<SalesCatalogModal {...callbacks} pricelistId="wholesale" />);
  await screen.findByText(/24,000/);
  rerender(
    <SalesCatalogModal
      {...callbacks}
      pricelistId="wholesale"
      qtyMap={{ 'sp|size-sp': 6 }}
    />
  );
  await screen.findByText(/22,000/);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const url = new URL(fetcher.mock.calls[2][0]);
  expect(url.searchParams.get('pricelistId')).toBe('wholesale');
  expect(JSON.parse(url.searchParams.get('quantities')!)).toEqual({
    'sp|size-sp': 6,
  });
});

test('an older pricelist response cannot replace the current quote', async () => {
  let release!: (value: ReturnType<typeof priced>) => void;
  const old = new Promise<ReturnType<typeof priced>>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(priced(22000))
  );
  const callbacks = props();
  const { rerender } = render(
    <SalesCatalogModal {...callbacks} pricelistId="old" />
  );
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  rerender(<SalesCatalogModal {...callbacks} pricelistId="new" />);
  await screen.findByText(/22,000/);
  release(priced(26000));
  await waitFor(() => expect(screen.queryByText(/26,000/)).toBeNull());
});

test('changing an expanded variant quantity keeps its controls open while the server reprices', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(priced(24000, 1))
      .mockResolvedValueOnce(priced(22000, 6))
  );
  const callbacks = props();
  const { rerender } = render(
    <SalesCatalogModal
      {...callbacks}
      pricelistId="wholesale"
      qtyMap={{ 'sp|size-sp': 1 }}
    />
  );
  const card = await screen.findByRole('article', { name: 'Cabernet' });
  fireEvent.click(within(card).getByRole('button', { name: /Choose size/ }));
  expect(
    screen.getByRole('spinbutton', { name: 'Quantity for Cabernet 75cl' })
  ).toBeTruthy();
  rerender(
    <SalesCatalogModal
      {...callbacks}
      pricelistId="wholesale"
      qtyMap={{ 'sp|size-sp': 6 }}
    />
  );
  await screen.findAllByText(/22,000/);
  expect(
    screen.getByRole('spinbutton', { name: 'Quantity for Cabernet 75cl' })
  ).toHaveProperty('value', '6');
});

test('missing authoritative prices show a retry error instead of a different retail price', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          subProducts: [product()],
          pagination: { page: 1, total: 1, pages: 1 },
        },
      }),
    })
  );
  render(<SalesCatalogModal {...props()} />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'prices could not be calculated'
  );
  expect(screen.queryByRole('article')).toBeNull();
});

test('size add and rapid quantity changes stay interactive and batch the latest quote', async () => {
  let finish!: (value: ReturnType<typeof priced>) => void;
  const pending = new Promise<ReturnType<typeof priced>>((resolve) => {
    finish = resolve;
  });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(priced(24000))
    .mockReturnValueOnce(pending)
    .mockResolvedValueOnce(priced(21000, 5));
  vi.stubGlobal('fetch', fetcher);
  const callbacks = props();
  function Catalogue() {
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    return (
      <SalesCatalogModal
        {...callbacks}
        pricelistId="wholesale"
        qtyMap={quantities}
        onAdd={() => setQuantities({ 'sp|size-sp': 1 })}
        onSetQty={(_, quantity) => setQuantities({ 'sp|size-sp': quantity })}
      />
    );
  }
  render(<Catalogue />);
  const card = await screen.findByRole('article', { name: 'Cabernet' });
  fireEvent.click(within(card).getByRole('button', { name: /Choose size/ }));
  fireEvent.click(
    within(card).getByRole('button', { name: 'Add Cabernet 75cl' })
  );
  const input = screen.getByRole('spinbutton', {
    name: 'Quantity for Cabernet 75cl',
  });
  expect(input.matches(':disabled')).toBe(false);
  const increase = screen.getByRole('button', {
    name: 'Increase Cabernet 75cl',
  });
  fireEvent.click(increase);
  fireEvent.click(increase);
  fireEvent.click(increase);
  expect(input).toHaveProperty('value', '4');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(input.matches(':disabled')).toBe(false);
  const url = new URL(fetcher.mock.calls[1][0]);
  expect(JSON.parse(url.searchParams.get('quantities')!)).toEqual({
    'sp|size-sp': 4,
  });
  expect(screen.getByText('Updating prices…')).toBeTruthy();
  fireEvent.click(increase);
  expect(input).toHaveProperty('value', '5');
  await screen.findAllByText(/21,000/);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  finish(priced(22000, 4));
  await waitFor(() => expect(screen.queryByText(/22,000/)).toBeNull());
  expect(input).toHaveProperty('value', '5');
  fireEvent.change(input, { target: { value: '4' } });
  fireEvent.change(input, { target: { value: '5' } });
  expect(input.matches(':disabled')).toBe(false);
});
