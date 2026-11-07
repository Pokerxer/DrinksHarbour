// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/platform-ops.service', async () => ({
  ...(await vi.importActual('@/services/platform-ops.service')),
  platformOpsRequest: request,
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});

const refundList = {
  queueVersion: 1,
  kind: 'refund',
  total: 1,
  page: 1,
  pages: 1,
  limit: 25,
  entries: [
    {
      _id: '655f00000000000000000001',
      merchantOrder: 'child-1',
      order: 'order-1',
      tenant: 'tenant-1',
      currency: 'NGN',
      amountMinor: 500,
      state: 'uncertain',
      issue: 'Provider or ledger outcome requires reconciliation; do not resubmit',
      ageDays: 2,
    },
  ],
};

const refundDetail = {
  ...refundList.entries[0],
  sources: {
    status: 'resolved',
    sources: [
      {
        provider: 'paystack',
        identity: 'resolved',
        refundCapability: 'supported',
        reason: 'Original allocated receipt identity is supported for merchandise refunds.',
        claim: { reference: 'dhm-ref', transactionId: '918273' },
      },
    ],
  },
  storedValueFunding: null,
  audit: [
    {
      action: 'MERCHANT_REFUND_SUBMIT',
      actorRole: 'super_admin',
      result: 'success',
      targetType: 'Order',
      targetId: 'order-1',
    },
  ],
  reconcile: {
    supported: true,
    requirement: 'Known original provider refund evidence required',
    wording: 'Reconcile only with the known original provider refund ID.',
  },
};

test('merchant roles cannot open the platform-operations queue', async () => {
  const { default: View } = await import('./operations-queue');
  render(<View token="session" role="tenant_owner" />);
  expect(screen.getByText('Platform operations access required.')).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});

test('the queue lists uncertain refunds with honest states and opens the inspected detail', async () => {
  request.mockImplementation((_token: string, path: string) =>
    Promise.resolve(
      path.startsWith('/exceptions/refund/')
        ? refundDetail
        : refundList
    )
  );
  const { default: View } = await import('./operations-queue');
  render(<View token="session" role="super_admin" />);
  expect(await screen.findByText('child-1')).toBeTruthy();
  expect(screen.getByText(/State uncertain/)).toBeTruthy();
  expect(
    screen.getByText('Provider or ledger outcome requires reconciliation; do not resubmit')
  ).toBeTruthy();
  fireEvent.click(screen.getByText('child-1'));
  expect(await screen.findByText('Audit history')).toBeTruthy();
  expect(screen.getByText(/MERCHANT_REFUND_SUBMIT/)).toBeTruthy();
  expect(
    screen.getByText(/Original allocated receipt identity is supported/)
  ).toBeTruthy();
});

test('the queue shows an honest empty state and switches kinds', async () => {
  request.mockResolvedValue({ ...refundList, entries: [], total: 0 });
  const { default: View } = await import('./operations-queue');
  render(<View token="session" role="admin" />);
  expect(await screen.findByText('No uncertain refund allocations require platform review.')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Carrier exceptions' }));
  await screen.findByText('No unresolved carrier operations require platform review.');
  expect(request).toHaveBeenCalledWith(
    'session',
    '/exceptions?kind=carrier',
    'GET',
    undefined,
    expect.any(AbortSignal)
  );
});
