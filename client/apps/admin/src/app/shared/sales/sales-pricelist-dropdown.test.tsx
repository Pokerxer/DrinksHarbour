// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesCustomerBar from './sales-customer-bar';
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const props = {
  token: 'token',
  customer: null,
  onSelectCustomer: vi.fn(),
  onClearCustomer: vi.fn(),
  pricelistId: '',
  pricelists: [],
  onPricelistChange: vi.fn(),
  validUntil: '',
  onValidUntilChange: vi.fn(),
  warehouses: [],
  warehouseId: '',
  onWarehouseChange: vi.fn(),
};
it('options arriving while the dropdown is open appear without reopening it', async () => {
  const { rerender } = render(
    <SalesCustomerBar {...props} pricelistsLoading />
  );
  fireEvent.click(screen.getByRole('button', { name: /Pricelist/i }));
  expect(
    screen.getByRole('option', { name: 'Loading pricelists…' })
  ).toBeTruthy();
  rerender(
    <SalesCustomerBar
      {...props}
      pricelists={[{ _id: 'trade', name: 'Trade prices' }]}
    />
  );
  const option = await screen.findByRole('option', { name: 'Trade prices' });
  fireEvent.click(option);
  expect(props.onPricelistChange).toHaveBeenCalledWith('trade');
});
it('failed loading offers a retry instead of silently showing only base price', () => {
  const retry = vi.fn();
  render(
    <SalesCustomerBar
      {...props}
      pricelistsError="Could not load pricelists"
      onRetryPricelists={retry}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry pricelists' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('pricelist search filters choices and displays the automatic assignment badge', async () => {
  render(
    <SalesCustomerBar
      {...props}
      pricelistId="trade"
      resolvedPricelistId="trade"
      pricelists={[
        { _id: 'trade', name: 'Trade prices' },
        { _id: 'retail', name: 'Retail prices' },
      ]}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Pricelist/i }));
  fireEvent.change(screen.getByPlaceholderText('Search pricelists…'), {
    target: { value: 'Trade' },
  });
  expect(
    screen
      .getByRole('option', { name: /Trade prices/ })
      .getAttribute('aria-selected')
  ).toBe('true');
  expect(screen.queryByRole('option', { name: /Retail prices/ })).toBeNull();
  expect(screen.getAllByText('Auto-applied').length).toBeGreaterThan(0);
});

it('warehouse search retains default badges and changes the selected warehouse', async () => {
  const change = vi.fn();
  render(
    <SalesCustomerBar
      {...props}
      warehouses={[
        { _id: 'main', name: 'Main store', isDefault: true },
        { _id: 'other', name: 'Other store' },
      ]}
      onWarehouseChange={change}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Warehouse/i }));
  fireEvent.change(screen.getByPlaceholderText('Search warehouses…'), {
    target: { value: 'Main' },
  });
  expect(screen.queryByRole('option', { name: /Other store/ })).toBeNull();
  fireEvent.click(screen.getByRole('option', { name: /Main store/ }));
  expect(change).toHaveBeenCalledWith('main');
});
