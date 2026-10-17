// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Toolbar, { type PaymentFilters } from './payments-workspace-toolbar';
afterEach(cleanup);
const empty: PaymentFilters = {
  search: '',
  status: '',
  method: '',
  from: '',
  to: '',
};
function setup(
  filters = empty,
  unavailable = false,
  side: 'customer' | 'vendor' = 'customer'
) {
  const filter = vi.fn();
  render(
    <Toolbar
      side={side}
      filters={filters}
      filter={filter}
      summary={{
        activeAmount: 100,
        sourceAmount: 80,
        refundedAmount: 20,
        allocated: 10,
        unallocated: 10,
        cancelledAmount: 5,
      }}
      loading={false}
      unavailable={unavailable}
      refresh={vi.fn()}
      create={vi.fn()}
    />
  );
  return filter;
}
it('puts verified refunds in a visible total and identifies accounting-only balances', () => {
  setup();
  const refunds = screen.getByText('Verified refunds').parentElement!;
  expect(within(refunds).getByText(/20\.00/)).toBeTruthy();
  expect(screen.getByText('Accounting allocated')).toBeTruthy();
  expect(screen.getByText('Accounting unallocated')).toBeTruthy();
  expect(screen.getByText('Received')).toBeTruthy();
});
it('does not show stale money when totals are unavailable', () => {
  setup(empty, true);
  expect(screen.queryByText(/100\.00/)).toBeNull();
  expect(screen.queryByText(/80\.00/)).toBeNull();
  expect(screen.queryByText(/20\.00/)).toBeNull();
});
it('invalid dates stay local until corrected and applied together', () => {
  const filter = setup();
  fireEvent.change(screen.getByLabelText('From'), {
    target: { value: '2026-10-20' },
  });
  fireEvent.change(screen.getByLabelText('To'), {
    target: { value: '2026-10-10' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(filter).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toMatch(/end date/i);
  fireEvent.change(screen.getByLabelText('To'), {
    target: { value: '2026-10-21' },
  });
  fireEvent.change(screen.getByLabelText('Search payments'), {
    target: { value: ' Ada ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(filter).toHaveBeenCalledWith({
    ...empty,
    search: 'Ada',
    from: '2026-10-20',
    to: '2026-10-21',
  });
});
it('clears an unapplied search as well as every applied filter', () => {
  const filter = setup();
  fireEvent.change(screen.getByLabelText('Search payments'), {
    target: { value: 'Ada' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(filter).toHaveBeenCalledWith(empty);
  expect(
    (screen.getByLabelText('Search payments') as HTMLInputElement).value
  ).toBe('');
});
it('vendor totals and action use payout wording without source refunds', () => {
  setup(empty, false, 'vendor');
  expect(screen.getByText('Paid to vendors')).toBeTruthy();
  expect(screen.queryByText('Verified refunds')).toBeNull();
  expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
});
it('applies status and method together instead of sending intermediate requests', () => {
  const filter = setup();
  fireEvent.change(screen.getByLabelText('Payment status'), {
    target: { value: 'cancelled' },
  });
  fireEvent.change(screen.getByLabelText('Payment method'), {
    target: { value: 'cash' },
  });
  expect(filter).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(filter).toHaveBeenCalledWith({
    ...empty,
    status: 'cancelled',
    method: 'cash',
  });
});
