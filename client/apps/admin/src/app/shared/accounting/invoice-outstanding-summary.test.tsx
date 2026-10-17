// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Summary from './accounting-document-summary';
afterEach(cleanup);
it('flags incomplete outstanding and separates unverified draft balances from posted aging', () => {
  render(
    <Summary
      side="customer"
      loading={false}
      error=""
      onRetry={vi.fn()}
      summary={{
        count: 0,
        totalOutstanding: 0,
        onAccount: 0,
        buckets: { current: 0 },
        reviewCount: 6,
        reviewBalanceCount: 3,
        reviewOutstanding: 3927715.68,
      }}
    />
  );
  expect(screen.getByText('₦ 3,927,715.68')).toBeTruthy();
  expect(
    screen.getByText('Open invoices').parentElement?.textContent
  ).toContain('3');
  const alert = screen.getByRole('alert');
  expect(
    within(alert).getByText(/6 invoices need reconciliation/)
  ).toBeTruthy();
  expect(within(alert).getByText(/3,927,715.68/)).toBeTruthy();
  expect(within(alert).getByText(/not confirmed customer debt/i)).toBeTruthy();
  expect(screen.getByText(/Posted invoice balances only/)).toBeTruthy();
});
