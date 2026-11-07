// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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
      reason: 'Original allocated receipt identity is supported for merchandise refunds.',
    },
    {
      provider: 'korapay',
      state: 'review_required',
      reason: 'Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.',
    },
  ],
  shipping: { state: 'review_required', reason: 'Shipping refund policy requires review.' },
  tax: { state: 'review_required', reason: 'Tax refund policy requires review.' },
  payout: { state: 'review_required', reason: 'Payout approval remains separate.' },
  goods: { state: 'independent', reason: 'Physical receipt is independent.' },
  zeroValueCancellation: {
    state: 'review_required',
    reason: 'Zero-only cancellation has no approved no-money policy.',
  },
  carrier: {
    enabled: false,
    reviewedContracts: 1,
    unresolvedBookings: 2,
    reconcileRequirement: 'Known original provider shipment ID required; responsibility remains uncertain',
  },
  returns: {
    effectsSupported: false as const,
    reason: 'Return stock/cost treatment policy is not recorded.',
    effectsFlagEnabled: false,
  },
  queueCounts: { refund: 4, carrier: 4, return: 2 },
  mechanisms: {
    koraRefund: {
      state: 'recorded_not_executed',
      flag: { name: 'MERCHANT_KORA_REFUNDS_ENABLED', enabled: false },
      policy: {
        state: 'recorded',
        recordedVersions: 1,
        activeVersion: 1,
      },
      unresolvedReservations: 2,
      reason: 'Original tender refund capability requires review.',
    },
    payoutTransfer: {
      state: 'none_recorded',
      flag: { name: 'MERCHANT_PAYOUT_TRANSFERS_ENABLED', enabled: false },
      policy: { state: 'none_recorded', recordedVersions: 0, activeVersion: null },
      unresolvedTransfers: 0,
      reason: 'No payout execution exists; payout policy requires review.',
    },
    feeTreatment: {
      projectionVersion: 1,
      readOnly: true,
      note:
        'No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.',
      accounting: { feeAccountExists: false, note: 'no fee account' },
      flows: [
        {
          flow: 'merchandise_refund',
          state: 'not_recorded',
          bearer: null,
          policyVersion: null,
          reason:
            'Provider fee bearer, future-fee treatment and historical-fee rule for this flow are not recorded; fee treatment authority fails closed until a super admin records a version.',
        },
      ],
    },
  },
};

test('readiness displays the non-activation notice, default-off flags and gate wording without credentials', async () => {
  request.mockResolvedValue(readiness);
  const { default: View } = await import('./readiness-panel');
  render(<View token="session" role="super_admin" />);
  expect(
    await screen.findByText('Readiness evidence is not activation permission.')
  ).toBeTruthy();
  expect(screen.getByText('Merchant refund execution: off')).toBeTruthy();
  expect(screen.getByText('Paystack refund execution: off')).toBeTruthy();
  expect(screen.getByText('External carrier booking: off')).toBeTruthy();
  expect(screen.getByText(/Shipping refund policy requires review\./)).toBeTruthy();
  expect(screen.getByText(/Payout approval remains separate\./)).toBeTruthy();
  expect(
    screen.getByText(/Korapay fallback transactionId identity is ambiguous\./)
  ).toBeTruthy();
  expect(screen.getByText(/unresolved bookings 2/)).toBeTruthy();
  expect(screen.getByText(/quarantined returns 2/)).toBeTruthy();
  // v2 additive mechanism states render the mechanisms' own verbatim
  // wordings with flag states and counts — evidence only.
  expect(screen.getByText('Kora refund execution: off')).toBeTruthy();
  expect(screen.getByText('Payout transfer execution: off')).toBeTruthy();
  expect(
    screen.getByText(/unresolved reservations 2/)
  ).toBeTruthy();
  expect(
    screen.getByText(/No payout execution exists; payout policy requires review\./)
  ).toBeTruthy();
  expect(
    screen.getByText(
      /No provider fee records exist; treatment is recorded-not-measured/
    )
  ).toBeTruthy();
  // No reconcile buttons: readiness is never an activation control.
  expect(screen.queryByRole('button')).toBeNull();
  // No private identifiers from the reviewed projections are rendered.
  expect(screen.queryByText(/dhm-|SB-|918273/)).toBeNull();
});

test('merchant roles cannot open the readiness snapshot', async () => {
  const { default: View } = await import('./readiness-panel');
  render(<View token="session" role="tenant_admin" />);
  expect(screen.getByText('Platform operations access required.')).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
