'use client';
// Platform-operations readiness panel: aggregates the existing fail-closed
// gates and default-off flag states. Readiness evidence is NOT activation
// permission — nothing here enables, flips or executes anything, and no
// provider credentials or private identifiers are displayed.
import { useEffect, useState } from 'react';
import { PiLockSimpleBold, PiWarningBold } from 'react-icons/pi';
import {
  isPlatformRole,
  platformOpsRequest,
  type Readiness,
} from '@/services/platform-ops.service';
import { gateAlert, gateBlocked, inlineIcon, ledgerHeader, ledgerPanel, ledgerPending, ledgerProseSoft, ledgerTitle, sourceTrace, stateTone, toneReason } from '../merchant-orders/design-tokens';
import { flagTone } from './design-tokens';

const FLAG_LABEL: Record<keyof Readiness['flags'], string> = {
  merchantRefundsEnabled: 'Merchant refund execution',
  merchantPaystackRefundsEnabled: 'Paystack refund execution',
  merchantExternalCarrierEnabled: 'External carrier booking',
  merchantKoraRefundsEnabled: 'Kora refund execution',
  merchantPayoutTransfersEnabled: 'Payout transfer execution',
};

/** Ledger row line: tone carries the registered state; text stays verbatim. */
const RegisterLine = ({ tone, children }: { tone: ReturnType<typeof stateTone>; children: React.ReactNode }) => (
  <p className={`${toneReason[tone]} tabular-nums`}>{children}</p>
);

export default function ReadinessPanel({ token, role }: { token: string; role?: string }) {
  const platform = isPlatformRole(role);
  const [state, setState] = useState<{ value?: Readiness; error?: string }>({});
  useEffect(() => {
    if (!platform) return;
    const controller = new AbortController();
    let current = true;
    platformOpsRequest<Readiness>(
      token,
      '/readiness',
      'GET',
      undefined,
      controller.signal
    )
      .then((value) => {
        if (current) setState({ value });
      })
      .catch(() => {
        if (current)
          setState({
            error:
              'The readiness snapshot is unavailable. Reload to review the recorded gates.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [token, platform]);
  if (!platform)
    return <p role="note">Platform operations access required.</p>;
  if (state.error)
    return (
      <p role="alert" className={gateAlert}>
        <PiWarningBold aria-hidden="true" className={inlineIcon} />
        {state.error}
      </p>
    );
  const value = state.value;
  if (!value)
    return (
      <p role="status" className={ledgerPending}>
        Projecting the readiness snapshot…
      </p>
    );
  return (
    <section className={ledgerPanel} aria-label="Platform operations readiness">
      {/* Receipt header: title + the evidence-not-permission stamp */}
      <div className={ledgerHeader}>
        <h3 className={ledgerTitle}>
          Reviewed provider &amp; policy readiness{' '}
          <span className={sourceTrace}>(v{value.readinessVersion})</span>
        </h3>
        <p role="note" className={`${gateBlocked} mt-2`}>
          <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
          {value.notice}
        </p>
      </div>
      {/* Registers: state left-rule register lines, tabular figures */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/70">
        <div aria-label="Feature flags (state only; default off)" className="space-y-1.5">
          {(Object.keys(FLAG_LABEL) as (keyof Readiness['flags'])[]).map((flag) => (
            <RegisterLine key={flag} tone={flagTone(value.flags[flag])}>
              {FLAG_LABEL[flag]}: {value.flags[flag] ? 'enabled' : 'off'}
            </RegisterLine>
          ))}
        </div>
        <div aria-label="Refund source gates" className="space-y-1.5">
          {value.refundSources.map((source) => (
            <RegisterLine key={source.provider} tone={stateTone(source.state)}>
              {source.provider}: {source.state} — {source.reason}
            </RegisterLine>
          ))}
        </div>
        <div aria-label="Policy gates" className="space-y-1.5">
          {(
            [
              ['Shipping', value.shipping],
              ['Tax', value.tax],
              ['Payout', value.payout],
              ['Goods', value.goods],
              ['Zero-value cancellation', value.zeroValueCancellation],
            ] as const
          ).map(([label, gate]) => (
            <RegisterLine key={label} tone={stateTone(gate.state)}>
              {label}: {gate.reason}
            </RegisterLine>
          ))}
          <div className={gateBlocked}>
            <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
            <p role="note" className="text-base leading-6">
              Return stock/cost effects: {value.returns.reason}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <RegisterLine tone={flagTone(value.carrier.enabled)}>
            Carrier integration: {value.carrier.enabled ? 'enabled' : 'off'} ·
            reviewed contracts {value.carrier.reviewedContracts} · unresolved
            bookings {value.carrier.unresolvedBookings} —{' '}
            {value.carrier.reconcileRequirement}.
          </RegisterLine>
          <p
            className={`${ledgerProseSoft} tabular-nums`}
          >
            Queue counts — refund exceptions {value.queueCounts.refund}, carrier
            exceptions {value.queueCounts.carrier}, quarantined returns{' '}
            {value.queueCounts.return}.
          </p>
        </div>
        {/* v2 additive (workstream UI-W): the kora/payout/fee-treatment
            mechanism states. Every wording comes from the server's readiness
            projection verbatim (the mechanisms' own fail-closed/sealed wordings);
            it stays evidence-only and nothing is executable here. */}
        {value.mechanisms && (
          <div
            aria-label="Mechanism readiness (evidence only)"
            className="space-y-1.5"
          >
            <RegisterLine tone={stateTone(value.mechanisms.koraRefund.state)}>
              {`Kora refund reservations: ${value.mechanisms.koraRefund.reason} (flag ${value.mechanisms.koraRefund.flag.enabled ? 'enabled' : 'off'} · recorded versions ${value.mechanisms.koraRefund.policy.recordedVersions} · active version ${value.mechanisms.koraRefund.policy.activeVersion ?? 'none'} · unresolved reservations ${value.mechanisms.koraRefund.unresolvedReservations})`}
            </RegisterLine>
            <RegisterLine tone={stateTone(value.mechanisms.payoutTransfer.state)}>
              {`Payout transfers: ${value.mechanisms.payoutTransfer.reason} (flag ${value.mechanisms.payoutTransfer.flag.enabled ? 'enabled' : 'off'} · recorded versions ${value.mechanisms.payoutTransfer.policy.recordedVersions} · active version ${value.mechanisms.payoutTransfer.policy.activeVersion ?? 'none'} · unresolved transfers ${value.mechanisms.payoutTransfer.unresolvedTransfers})`}
            </RegisterLine>
            <p className={ledgerProseSoft}>
              Provider fee treatment: {value.mechanisms.feeTreatment.note}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
