// @vitest-environment jsdom
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import VendorOrderGroups from './vendor-order-groups';
import { selectedGroups, draftKey } from './order-draft';
import type { InsightLine } from '@/services/notificationInsights.service';
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u', tenantId: 't' } } }),
}));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});
const lines = ['Wine', 'Beer'].map((name, i) => ({
  key: `p${i}:s:w`,
  subProductId: `p${i}`,
  sizeId: 's',
  warehouseId: 'w',
  warehouseName: 'Main',
  productName: name,
  sku: `SKU${i}`,
  sizeName: '75cl',
  selected: {
    offerId: `o${i}`,
    vendorId: 'v',
    vendorName: 'Supplier',
    currency: 'NGN',
    unitPrice: 100,
    packagingQty: 6,
    packaging: 'Carton',
    minQuantity: 1,
    maxQuantity: null,
    quantity: 12,
    packs: 2,
    leadTimeDays: 7,
    urgency: 'urgent',
  },
})) as InsightLine[];
it('searching an order by included SKU keeps every product in the prepared purchase', () => {
  render(
    <VendorOrderGroups
      groups={selectedGroups(lines, {})}
      coverDays={14}
      disabled={false}
    />
  );
  fireEvent.change(screen.getByLabelText('Search vendor orders'), {
    target: { value: 'SKU1' },
  });
  const group = screen.getByRole('article', {
    name: 'Supplier order to Main in NGN',
  });
  expect(within(group).getByText(/Wine/)).toBeTruthy();
  fireEvent.click(
    within(group).getByRole('button', { name: 'Prepare purchase' })
  );
  const draft = JSON.parse(sessionStorage.getItem(draftKey('u:t'))!);
  expect(draft.items.map((i: { quantity: number }) => i.quantity)).toEqual([
    12, 12,
  ]);
  expect(push).toHaveBeenCalledWith('/purchases/create?restock=1');
});
it('refresh or invalid selection disables preparation and currency filters do not combine totals', () => {
  const other = {
    ...lines[0],
    key: 'other',
    selected: { ...lines[0].selected!, currency: 'USD' },
  };
  render(
    <VendorOrderGroups
      groups={selectedGroups([...lines, other], {})}
      coverDays={14}
      disabled
    />
  );
  expect(
    (
      screen.getAllByRole('button', {
        name: 'Prepare purchase',
      })[0] as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Order currency'), {
    target: { value: 'USD' },
  });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('article').getAttribute('aria-label')).toContain(
    'USD'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prepare purchase' }));
  expect(sessionStorage.length).toBe(0);
});
it('locks preparation while opening so another supplier cannot overwrite the handoff', () => {
  const other = {
    ...lines[0],
    key: 'other',
    selected: {
      ...lines[0].selected!,
      vendorId: 'v2',
      vendorName: 'Second supplier',
    },
  };
  render(
    <VendorOrderGroups
      groups={selectedGroups([...lines, other], {})}
      coverDays={14}
      disabled={false}
    />
  );
  const buttons = screen.getAllByRole('button', { name: 'Prepare purchase' });
  fireEvent.click(buttons[0]);
  expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(buttons[1]);
  expect(push).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('button', { name: 'Opening purchase…' })
  ).toBeTruthy();
});
it('blocked browser storage leaves preparation available and never navigates', () => {
  const failure = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('Storage is full');
    });
  render(
    <VendorOrderGroups
      groups={selectedGroups(lines, {})}
      coverDays={14}
      disabled={false}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prepare purchase' }));
  expect(screen.getByRole('alert').textContent).toContain('Storage is full');
  expect(
    (
      screen.getByRole('button', {
        name: 'Prepare purchase',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
  expect(push).not.toHaveBeenCalled();
  failure.mockRestore();
});
