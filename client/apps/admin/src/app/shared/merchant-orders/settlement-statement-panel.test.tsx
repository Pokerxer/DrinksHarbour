// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/merchant-order.service', async () => ({
  ...(await vi.importActual('@/services/merchant-order.service')),
  merchantRequest: request,
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});
const statement = {
  statementVersion: 1,
  readOnly: true,
  currency: 'NGN',
  scope: {
    childId: 'own',
    orderId: 'parent',
    tenantId: 'tenant',
    fulfillmentVersion: 1,
  },
  totals: {
    grossMinor: 2000,
    discountMinor: 0,
    merchandiseMinor: 2000,
    tenantShareMinor: 1600,
    commissionMinor: 400,
    shippingMinor: 0,
    taxMinor: 0,
    totalMinor: 2000,
  },
  sources: { totals: 'MerchantOrder:own' },
  refunds: {
    reservedMinor: 500,
    settledMinor: 500,
    settledCommissionMinor: 100,
    settledTenantShareMinor: 400,
    allocations: [
      {
        id: 'allocation-1',
        amountMinor: 500,
        commissionMinor: 100,
        tenantShareMinor: 400,
        state: 'succeeded',
        source: 'MerchantRefundAllocation:allocation-1',
      },
      {
        id: 'allocation-2',
        amountMinor: 200,
        commissionMinor: 40,
        tenantShareMinor: 160,
        state: 'uncertain',
        source: 'MerchantRefundAllocation:allocation-2',
      },
    ],
  },
  commissionReversal: {
    settledMinor: 100,
    sourceIds: ['JournalEntry:journal-1'],
  },
  goodsCost: {
    sourceId: 'goods-basis-1',
    originalCostMinor: 800,
    cancelledCostMinor: 500,
    netCostMinor: 300,
    sourceNote: 'Frozen goods cost basis.',
  },
  carrierCost: {
    sourceId: 'own',
    committedMinor: 250,
    reservedMinor: 300,
    journalExempt: true,
    sourceNote: 'Committed carrier spend; no journal exists.',
  },
  netReceivable: {
    settledMinor: 1200,
    reservedMinor: 500,
    projectedMinor: 700,
  },
  journals: {
    sales: {
      sourceId: 'JournalEntry:sale-1',
      merchandiseMinor: 2000,
      tenantShareMinor: 1600,
      commissionMinor: 400,
    },
    refunds: [],
    goodsCancellations: [],
  },
  reconciliation: {
    state: 'needs_review',
    identities: [],
    items: [
      {
        scope: 'refundSettlement',
        state: 'needs_review',
        reason: 'Partial refund settlement requires review.',
      },
    ],
    uncertain: [
      {
        scope: 'MerchantRefundAllocation',
        id: 'allocation-2',
        state: 'uncertain',
        reason: 'Refund outcome requires reconciliation; do not resubmit.',
      },
    ],
  },
  payout: {
    state: 'review_required',
    reason: 'No payout execution exists; payout policy requires review.',
  },
  set: {
    orderId: 'parent',
    childIds: ['own'],
    totals: {
      merchandiseMinor: 2000,
      tenantShareMinor: 1600,
      commissionMinor: 400,
      settledMinor: 500,
      reservedMinor: 500,
      netReceivableMinor: 1200,
    },
  },
};
test('settlement statement shows source-traced figures, uncertain states and the payout notice without actions', async () => {
  request.mockResolvedValue({ statement });
  const { default: View } = await import('./settlement-statement-panel');
  render(<View token="session" childId="own" version={1} />);
  expect((await screen.findAllByText('₦20.00')).length).toBeGreaterThan(0);
  expect(screen.getByText('MerchantOrder:own')).toBeTruthy();
  expect(screen.getByText(/MerchantRefundAllocation:allocation-1/)).toBeTruthy();
  expect(screen.getAllByText(/₦12.00/).length).toBeGreaterThan(0);
  expect(
    screen.getByText(/Partial refund settlement requires review\./)
  ).toBeTruthy();
  expect(
    screen.getByText(/Refund outcome requires reconciliation; do not resubmit\./)
  ).toBeTruthy();
  expect(screen.getAllByText(/allocation-2/).length).toBeGreaterThan(0);
  expect(
    screen.getByText('No payout execution exists; payout policy requires review.')
  ).toBeTruthy();
  expect(
    screen.getByText('Committed carrier spend; no journal exists.')
  ).toBeTruthy();
  expect(screen.getByText(/^Needs review/)).toBeTruthy();
  expect(request).toHaveBeenCalledWith(
    'session',
    '/own/settlement-statement',
    'GET',
    undefined,
    expect.any(AbortSignal)
  );
  expect(screen.queryByRole('button')).toBeNull();
  const dump = document.body.textContent || '';
  expect(dump).not.toMatch(/pi_synthetic|re_synthetic/);
});
test('changing session or order hides a stale settlement statement response', async () => {
  let resolve: (v: unknown) => void = () => {};
  request
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValue({ statement: null });
  const { default: View } = await import('./settlement-statement-panel');
  const rendered = render(<View token="first" childId="first" version={1} />);
  rendered.rerender(<View token="second" childId="second" version={1} />);
  resolve({ statement });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('₦20.00')).toBeNull();
});
test('a failed statement read surfaces an explicit review message', async () => {
  request.mockRejectedValue(new Error('unavailable'));
  const { default: View } = await import('./settlement-statement-panel');
  render(<View token="session" childId="own" version={1} />);
  expect(
    await screen.findByText(
      'Settlement statement is unavailable. Reload to review the recorded figures.'
    )
  ).toBeTruthy();
});
