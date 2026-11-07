// @vitest-environment jsdom
// Mechanisms queue panel (workstream UI-W): read-only kora-refund and
// payout-transfer reservation states with verbatim recorded reasons, honest
// empty states, tenant-role denial and NO mutation controls (the mechanism
// commands are deliberately service-level).
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/platform-ops.service', async () => ({
  ...(await vi.importActual('@/services/platform-ops.service')),
  platformOpsRequest: request,
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});

const koraList = {
  mechanismQueueVersion: 1,
  kind: 'kora_refund',
  entries: [
    {
      _id: 'anchor-uncertain',
      order: '65f000000000000000000001',
      tenant: null,
      currency: 'NGN',
      amountMinor: 500,
      state: 'uncertain',
      issue:
        'Synthetic kora transport unknown outcome; reconcile once by provider refund id',
      reason:
        'Synthetic kora transport unknown outcome; reconcile once by provider refund id',
      createdAt: null,
      ageDays: 0,
    },
  ],
  total: 1,
  page: 1,
  pages: 1,
  limit: 25,
};
const payoutList = {
  mechanismQueueVersion: 1,
  kind: 'payout_transfer',
  entries: [],
  total: 0,
  page: 1,
  pages: 1,
  limit: 25,
};
const koraDetail = {
  ...koraList.entries[0],
  claim: 'korapay:platform:synth-uncertain',
  providerReference: 'synth-uncertain',
  receiptTransactionId: null,
  fallbackAccepted: true,
  providerRefundId: null,
  policyVersion: 1,
  remainderMinorAfter: 1500,
  reconcile: {
    supported: false,
    reason:
      'Kora refund reconciliation is a service-level mechanism command; platform operations exposes no mutation route for it.',
  },
  audit: [],
};

test('super admin/admin see kora reservations and payout transfers with verbatim reasons and no mutation controls', async () => {
  request.mockImplementation(async (_token: string, path: string) =>
    path === '/mechanism-exceptions?kind=kora_refund'
      ? koraList
      : path === '/mechanism-exceptions?kind=payout_transfer'
        ? payoutList
        : path.startsWith('/mechanism-exceptions/kora_refund/')
          ? koraDetail
          : undefined
  );
  const { default: Queue } = await import('./operations-mechanisms-queue');
  render(<Queue token="session" role="admin" />);
  expect(
    await screen.findByText(
      'Kora refund reservations'
    )
  ).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Kora refund reservations' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Payout transfers' })).toBeTruthy();
  expect(
    screen.getByText(
      'Synthetic kora transport unknown outcome; reconcile once by provider refund id'
    )
  ).toBeTruthy();
  const detailButton = screen.getByRole('button', {
    name: /Reservation 65f000000000000000000001/,
  });
  fireEvent.click(detailButton);
  expect(await screen.findByText(/korapay:platform:synth-uncertain/)).toBeTruthy();
  expect(
    await screen.findByText(/service-level mechanism command/)
  ).toBeTruthy();
  // No reconcile button exists: service-level commands own their execution.
  expect(screen.queryByRole('button', { name: /reconcile/i })).toBeNull();
});

test('an empty mechanism queue displays the honest empty state', async () => {
  request.mockResolvedValue(payoutList);
  const { default: Queue } = await import('./operations-mechanisms-queue');
  render(<Queue token="session" role="super_admin" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Payout transfers' }));
  expect(
    await screen.findByText('No payout transfers await platform reconciliation review.')
  ).toBeTruthy();
});

test('merchant roles are denied without any platform-ops request', async () => {
  const { default: Queue } = await import('./operations-mechanisms-queue');
  render(<Queue token="session" role="tenant_owner" />);
  expect(screen.getByText('Platform operations access required.')).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
