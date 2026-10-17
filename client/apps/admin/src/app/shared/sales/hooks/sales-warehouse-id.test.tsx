// @vitest-environment jsdom
import {
  act,
  cleanup,
  renderHook,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useSalesCreateForm } from './useSalesCreateForm';
import type { SalesOrder } from '@/services/salesOrder.service';
import ProductLineSearch from '../product-line-search';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const warehouse = '699165839f3308b1baeca8fc';
const order = (warehouseId: SalesOrder['warehouseId']) =>
  ({
    _id: 'order',
    items: [],
    warehouseId,
  }) as unknown as SalesOrder;

test('edited sales form exposes the populated warehouse ID to all product pickers', () => {
  const initial = order({ _id: warehouse, name: 'Main warehouse' } as never);
  const { result } = renderHook(() =>
    useSalesCreateForm({ token: '', mode: 'edit', initial })
  );
  expect(result.current.warehouseId).toBe(warehouse);
  const query = new URLSearchParams({
    warehouseId: result.current.warehouseId as string,
  });
  expect(query.get('warehouseId')).toBe(warehouse);
  expect(result.current.buildPayload().warehouseId).toBe(warehouse);
  act(() => result.current.setWarehouseId('699165839f3308b1baeca8fd'));
  expect(result.current.warehouseId).toBe('699165839f3308b1baeca8fd');
  act(() => result.current.setWarehouseId(''));
  expect(result.current.warehouseId).toBe('');
  expect(result.current.buildPayload().warehouseId).toBeNull();
});

test('an asynchronously loaded populated warehouse is normalized too', () => {
  const { result, rerender } = renderHook(
    ({ initial }: { initial?: SalesOrder }) =>
      useSalesCreateForm({ token: '', mode: 'edit', initial }),
    { initialProps: { initial: undefined as SalesOrder | undefined } }
  );
  rerender({ initial: order({ _id: warehouse, name: 'Warehouse' } as never) });
  expect(result.current.warehouseId).toBe(warehouse);
});

test('focusing product search sends a valid warehouse ID through the real service', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { subProducts: [] } }),
    });
  vi.stubGlobal('fetch', fetcher);
  const initial = order({ _id: warehouse, name: 'Main warehouse' } as never);
  function Picker() {
    const form = useSalesCreateForm({ token: '', mode: 'edit', initial });
    return (
      <ProductLineSearch
        token="token"
        query=""
        warehouseId={form.warehouseId}
        onSelect={() => {}}
      />
    );
  }
  render(<Picker />);
  fireEvent.focus(screen.getByPlaceholderText('Search product…'));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get('warehouseId')).toBe(warehouse);
  expect(url.toString()).not.toContain('object');
});
