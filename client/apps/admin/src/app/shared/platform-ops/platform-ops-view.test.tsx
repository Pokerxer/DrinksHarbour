// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ role: 'super_admin', token: 'signed' }));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({
    role: state.role,
    user: state.token ? { token: state.token } : null,
  }),
}));
vi.mock('@/services/platform-ops.service', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('@/services/platform-ops.service')
  >();
  const readiness = {
    readinessVersion: 2,
    notice: 'Readiness evidence is not activation permission.',
    flags: {
      merchantRefundsEnabled: false,
      merchantPaystackRefundsEnabled: false,
      merchantExternalCarrierEnabled: false,
      merchantKoraRefundsEnabled: false,
      merchantPayoutTransfersEnabled: false,
    },
    refundSources: [
      {
        provider: 'paystack',
        state: 'supported',
        reason:
          'Original allocated receipt identity is supported for merchandise refunds.',
      },
    ],
    shipping: {
      state: 'review_required',
      reason: 'Shipping refund policy requires review.',
    },
    tax: {
      state: 'review_required',
      reason: 'Tax refund policy requires review.',
    },
    payout: {
      state: 'review_required',
      reason: 'Payout approval remains separate.',
    },
    goods: { state: 'independent', reason: 'Physical receipt is independent.' },
    zeroValueCancellation: {
      state: 'review_required',
      reason: 'Zero-only cancellation has no approved no-money policy.',
    },
    carrier: {
      enabled: false,
      reviewedContracts: 0,
      unresolvedBookings: 0,
      reconcileRequirement:
        'Known original provider shipment ID required; responsibility remains uncertain',
    },
    returns: {
      effectsSupported: false as const,
      reason: 'Return stock/cost treatment policy is not recorded.',
      effectsFlagEnabled: false,
    },
    queueCounts: { refund: 0, carrier: 0, return: 0 },
    mechanisms: {
      koraRefund: {
        state: 'none_recorded',
        flag: { name: 'MERCHANT_KORA_REFUNDS_ENABLED', enabled: false },
        policy: {
          state: 'none_recorded',
          recordedVersions: 0,
          activeVersion: null,
        },
        unresolvedReservations: 0,
        reason: 'Original tender refund capability requires review.',
      },
      payoutTransfer: {
        state: 'none_recorded',
        flag: { name: 'MERCHANT_PAYOUT_TRANSFERS_ENABLED', enabled: false },
        policy: {
          state: 'none_recorded',
          recordedVersions: 0,
          activeVersion: null,
        },
        unresolvedTransfers: 0,
        reason: 'No payout execution exists; payout policy requires review.',
      },
      feeTreatment: {
        projectionVersion: 1,
        readOnly: true,
        note:
          'No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.',
        accounting: { feeAccountExists: false, note: 'no fee account' },
        flows: [],
      },
    },
  };
  const registry = {
    registryVersion: 1,
    notice: 'Readiness evidence is not activation permission.',
    readOnly: true,
    mechanisms: [
      {
        mechanism: 'kora_refund',
        readOnly: true,
        flag: { name: 'MERCHANT_KORA_REFUNDS_ENABLED', enabled: false },
        policy: {
          state: 'none_recorded',
          recordedVersions: 0,
          versions: [],
          activeVersion: null,
        },
        reason: 'Original tender refund capability requires review.',
        failureState: 'none_recorded_all_surfaces_fail_closed',
      },
    ],
  };
  return {
    ...original,
    platformOpsRequest: vi
      .fn()
      .mockImplementation(async (_token: string, path: string) =>
        path.startsWith('/readiness')
          ? readiness
          : path.startsWith('/policy-registry')
            ? registry
            : { entries: [], total: 0 }
      ),
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = 'super_admin';
  state.token = 'signed';
});
async function view() {
  const imported = await import('./platform-ops-view').catch(() => ({
    default: undefined,
  }));
  expect(imported.default).toBeTypeOf('function');
  const View = imported.default!;
  return render(<View />);
}
test('platform roles see the exceptions queue and readiness snapshot', async () => {
  await view();
  expect(screen.getByRole('tablist', { name: 'Queue kind' })).toBeTruthy();
  await screen.findByText(
    'No uncertain refund allocations require platform review.'
  );
  expect(
    screen.getAllByText(/Readiness evidence is not activation permission\./)
      .length
  ).toBeGreaterThan(1);
  expect(screen.getByText(/paystack: supported/)).toBeTruthy();
  // UI-W additive surfaces: the mechanisms-queue tabs and the policy registry.
  expect(screen.getByRole('tablist', { name: 'Mechanism queue kind' })).toBeTruthy();
  expect(
    screen.getAllByText('Original tender refund capability requires review.').length
  ).toBeGreaterThan(0);
});
test('non-platform roles are denied without any platform-ops request', async () => {
  const { platformOpsRequest } = await import('@/services/platform-ops.service');
  state.role = 'tenant_owner';
  await view();
  expect(screen.getByRole('note').textContent).toMatch(
    /Platform operations access required/i
  );
  expect(platformOpsRequest).not.toHaveBeenCalled();
});
