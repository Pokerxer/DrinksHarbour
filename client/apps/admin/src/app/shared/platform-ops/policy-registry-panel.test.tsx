// @vitest-environment jsdom
// Policy-registry panel (workstream UI-W): super-admin-only read-only
// projection of every mechanism's policy recording state — verbatim
// fail-closed empty states, flag states, whitelisted version rows and no
// policy content/credential rendering. No buttons: the registry never
// executes anything.
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/platform-ops.service', async () => ({
  ...(await vi.importActual('@/services/platform-ops.service')),
  platformOpsRequest: request,
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});

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
    {
      mechanism: 'payout_transfer',
      readOnly: true,
      flag: { name: 'MERCHANT_PAYOUT_TRANSFERS_ENABLED', enabled: true },
      policy: {
        state: 'recorded',
        recordedVersions: 1,
        versions: [
          {
            version: 1,
            state: 'recorded',
            decisionReference: 'board-decision-2026-11',
            effectiveFrom: null,
            effectiveUntil: null,
          },
        ],
        activeVersion: 1,
      },
      reason:
        'Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate).',
      failureState: null,
    },
    {
      mechanism: 'fee_treatment',
      readOnly: true,
      flag: { name: null, enabled: false },
      flagNote:
        'No execution flag exists; the fee-treatment authority is a pure record authority by documented mechanism choice (feeTreatment/policy.js header).',
      policy: {
        state: 'none_recorded',
        recordedVersions: 0,
        versions: [],
        activeVersion: null,
      },
      feeFlows: [
        {
          flow: 'merchandise_refund',
          state: 'not_recorded',
          bearer: null,
          policyVersion: null,
          reason:
            'Provider fee bearer, future-fee treatment and historical-fee rule for this flow are not recorded; fee treatment authority fails closed until a super admin records a version.',
        },
      ],
      reason:
        'No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.',
      failureState: 'none_recorded_all_surfaces_fail_closed',
    },
  ],
};

test('super admins see per-mechanism recorded state with verbatim empty states and no policy content', async () => {
  request.mockResolvedValue(registry);
  const { default: Panel } = await import('./policy-registry-panel');
  render(<Panel token="session" role="super_admin" />);
  expect(
    await screen.findByText('Readiness evidence is not activation permission.')
  ).toBeTruthy();
  expect(screen.getByText(/Kora refund reservations/)).toBeTruthy();
  expect(
    screen.getByText(
      'Original tender refund capability requires review.'
    )
  ).toBeTruthy();
  expect(screen.getAllByText(/Recorded versions 0/).length).toBeGreaterThan(0);
  expect(screen.getByText(/MERCHANT_PAYOUT_TRANSFERS_ENABLED: enabled/)).toBeTruthy();
  expect(
    screen.getByText(
      /Payout transfer transport is sealed; no reviewed provider money-rails contract exists/
    )
  ).toBeTruthy();
  expect(screen.getByText(/active version 1/)).toBeTruthy();
  expect(
    screen.getByText(
      'No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.'
    )
  ).toBeTruthy();
  expect(
    screen.getByText(/merchandise_refund: not_recorded/)
  ).toBeTruthy();
  expect(screen.getAllByText('no recorded policy; all surfaces fail-closed').length).toBeGreaterThan(0);
  // Version rows surface only whitelisted metadata — never contract content.
  expect(screen.queryByText(/scheduleRule|contentHash|destinationAccount/)).toBeNull();
  // Read-only: no buttons anywhere in the registry panel.
  expect(screen.queryByRole('button')).toBeNull();
});

test('non-super-admin roles cannot open the policy registry', async () => {
  const { default: Panel } = await import('./policy-registry-panel');
  render(<Panel token="session" role="admin" />);
  expect(
    screen.getByText('The policy registry requires a platform super admin.')
  ).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});

test('an unavailable registry snapshot surfaces an honest error without retry actions', async () => {
  request.mockRejectedValue(new Error('offline'));
  const { default: Panel } = await import('./policy-registry-panel');
  render(<Panel token="session" role="super_admin" />);
  expect(
    await screen.findByText(
      'The policy registry is unavailable. Reload to review the recorded policy states.'
    )
  ).toBeTruthy();
});
