// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Summary from './accounting-document-summary';
afterEach(cleanup);
const data = {
  count: 4,
  totalOutstanding: 120,
  onAccount: 20,
  buckets: { current: 40, '16-30': 80 },
};
it('hides cached money, invoice count and aging during balance refresh', () => {
  render(
    <Summary
      side="customer"
      summary={data}
      loading
      error=""
      onRetry={vi.fn()}
    />
  );
  expect(screen.queryByText('₦ 100.00')).toBeNull();
  expect(screen.queryByText('₦ 20.00')).toBeNull();
  expect(screen.queryByText('₦ 80.00')).toBeNull();
  expect(screen.queryByText('4')).toBeNull();
  expect(screen.getByRole('status').textContent).toMatch(/Updating balances/);
});
it('failed refresh never presents a cached zero as the current balance', () => {
  render(
    <Summary
      side="customer"
      summary={{
        ...data,
        count: 0,
        totalOutstanding: 0,
        onAccount: 0,
        buckets: {},
      }}
      loading={false}
      error="Connection closed"
      onRetry={vi.fn()}
    />
  );
  expect(screen.queryByText('₦ 0.00')).toBeNull();
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getByRole('button', { name: 'Retry balances' })).toBeTruthy();
  expect(screen.queryByText(/Previous balances are shown/)).toBeNull();
});
it('a successful read still shows confirmed zero and complete aging', () => {
  render(
    <Summary
      side="customer"
      summary={{
        ...data,
        count: 0,
        totalOutstanding: 0,
        onAccount: 0,
        buckets: {},
      }}
      loading={false}
      error=""
      onRetry={vi.fn()}
    />
  );
  expect(screen.getAllByText('₦ 0.00')).toHaveLength(6);
  expect(screen.getByText('0')).toBeTruthy();
});
