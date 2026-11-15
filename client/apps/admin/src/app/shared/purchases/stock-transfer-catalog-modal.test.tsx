// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import TransferCatalogModal from './stock-transfer-catalog-modal';
import type { TransferCatalogRow } from './stock-transfer-catalog-data';

afterEach(cleanup);

test('adds the exact stocked size and updates the transfer controls for that size', async () => {
  const base = {
    subProductId: 'wine',
    name: 'Test Wine',
    sizeName: '75cl',
    quantity: 4,
    unitsPerPack: 6,
    costPrice: 500,
    wholesalePrice: 600,
  };
  const first = { ...base, sizeId: 'first', sku: 'FIRST' };
  const second = { ...base, sizeId: 'second', sku: 'SECOND' };
  const rows: TransferCatalogRow[] = [
    first,
    second,
    { ...base, sizeId: 'empty', sku: 'EMPTY', quantity: 0 },
  ];
  const props = {
    open: true,
    sourceName: 'Main warehouse',
    currency: 'NGN',
    priceMode: 'cost' as const,
    rows,
    loading: false,
    error: false,
    onClose: vi.fn(),
    onRefresh: vi.fn(),
    onAdd: vi.fn(),
    onSetQty: vi.fn(),
    onRemove: vi.fn(),
  };
  const { rerender } = render(<TransferCatalogModal {...props} qtyMap={{}} />);
  const card = await screen.findByRole('article', { name: 'Test Wine' });
  fireEvent.click(
    within(card).getByRole('button', { name: 'Choose size · 2' })
  );
  expect(within(card).queryByText('EMPTY')).toBeNull();
  fireEvent.click(
    within(card).getByRole('button', { name: 'Add Test Wine 75cl · SECOND' })
  );
  expect(props.onAdd).toHaveBeenCalledWith(second);

  rerender(<TransferCatalogModal {...props} qtyMap={{ 'wine::second': 4 }} />);
  fireEvent.click(
    within(card).getByRole('button', {
      name: 'Increase Test Wine 75cl · SECOND',
    })
  );
  expect(props.onSetQty).toHaveBeenCalledWith(second, 5);
  fireEvent.click(
    within(card).getByRole('button', {
      name: 'Remove Test Wine 75cl · SECOND from transfer',
    })
  );
  expect(props.onRemove).toHaveBeenCalledWith(second);
  expect(screen.getByText(/1 line in transfer/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Create product' })).toBeNull();
});
