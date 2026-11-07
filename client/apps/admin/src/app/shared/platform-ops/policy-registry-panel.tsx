'use client';
// Policy-registry panel (workstream UI-W): super-admin-only read-only
// projection of every mechanism's policy recording state — its default-off
// flag state, its recorded immutable versions (whitelisted metadata only),
// its active version, and the mechanism's own verbatim fail-closed wording
// when no policy is recorded. There are NO buttons: recording policies is
// done on the mechanisms' own super-admin recording routes, and nothing here
// enables, flips or executes anything.
import { useEffect, useState } from 'react';
import { PiLockSimpleBold, PiWarningBold } from 'react-icons/pi';
import { isPlatformRole, platformOpsRequest } from '@/services/platform-ops.service';
import type {
  PolicyRegistry,
  RegistryMechanism,
} from '@/services/platform-ops-mechanisms.types';
import { figureFlow, gateAlert, gateBlocked, inlineIcon, ledgerHeader, ledgerPanel, ledgerPending, ledgerProseSoft, ledgerRow, ledgerRowLabel, ledgerTitle, sourceTrace, stateTone, toneReason } from '../merchant-orders/design-tokens';

const MECHANISM_LABEL: Record<string, string> = {
  kora_refund: 'Kora refund reservations',
  payout_transfer: 'Payout transfer reviews',
  fee_treatment: 'Provider fee treatment',
  return_disposition: 'Return disposition policies',
  shipping_refund_allocation: 'Shipping refund allocations',
  tax_component_refund: 'Tax component refunds',
  discount_component_refund: 'Discount component refunds',
  zero_only_release: 'Zero-only no-money release',
  stored_value_wallet_refund: 'Wallet refund destinations',
  stored_value_gift_card_refund: 'Gift-card refund destinations',
};

function flagLine(entry: RegistryMechanism) {
  return entry.flag.name
    ? `${entry.flag.name}: ${entry.flag.enabled ? 'enabled' : 'off'}`
    : (entry.flagNote ?? 'No execution flag exists.');
}

/** One mechanism's recorded-state evidence card. */
function RegistryEntry({ entry }: { entry: RegistryMechanism }) {
  return (
    <li
      key={entry.mechanism}
      className="px-4 py-3 sm:px-5"
    >
      <h4 className={ledgerTitle}>
        {MECHANISM_LABEL[entry.mechanism] ?? entry.mechanism}
      </h4>
      {/* Execution flag / flag-note: metadata caption, mono */}
      <p className={`${sourceTrace} mt-0.5`}>{flagLine(entry)}</p>
      {/* Recorded state + version counts in the figure column */}
      <div className={`${ledgerRow} mt-1.5`}>
        <dt className={ledgerRowLabel}>
          {entry.policy.state === 'recorded' ? 'Policy recorded' : 'No recorded policy'}
        </dt>
        <dd className={figureFlow}>
          {`Recorded versions ${entry.policy.recordedVersions} · active version ${entry.policy.activeVersion ?? 'none'}`}
        </dd>
      </div>
      {/* Recorded immutable versions: whitelisted metadata rows only */}
      {entry.policy.versions.map((version) => (
        <p key={version.version} className={sourceTrace}>
          {`v${version.version} ${version.state ?? ''} · decision ${version.decisionReference ?? 'not recorded'} · ${version.effectiveFrom ?? 'no start'}–${version.effectiveUntil ?? 'no end'}`}
        </p>
      ))}
      {/* Fee-flow rows: flow identity mono, reason in the tone register */}
      {(entry.feeFlows ?? []).map((flow) => (
        <div key={flow.flow} className="mt-1.5">
          <p className={sourceTrace}>
            {`${flow.flow}: ${flow.state} · bearer ${flow.bearer ?? 'not recorded'}`}
          </p>
          <p className={toneReason[stateTone(flow.state)]}>{flow.reason}</p>
        </div>
      ))}
      {/* The mechanism's own verbatim fail-closed wording */}
      <p className={`${toneReason[stateTone(entry.policy.state)]} mt-1.5`}>
        {entry.reason}
      </p>
      {entry.failureState && (
        <div className={`${gateBlocked} mt-2`}>
          <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
          <p role="note" className="text-base leading-6">
            no recorded policy; all surfaces fail-closed
          </p>
        </div>
      )}
      {entry.resolutionNote && (
        <p className={`${ledgerProseSoft} mt-1.5`}>{entry.resolutionNote}</p>
      )}
    </li>
  );
}

export default function PolicyRegistryPanel({
  token,
  role,
}: {
  token: string;
  role?: string;
}) {
  const superAdmin = role === 'super_admin';
  const [state, setState] = useState<{ value?: PolicyRegistry; error?: string }>({});
  useEffect(() => {
    if (!superAdmin) return undefined;
    const controller = new AbortController();
    let current = true;
    platformOpsRequest<PolicyRegistry>(
      token,
      '/policy-registry',
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
              'The policy registry is unavailable. Reload to review the recorded policy states.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [token, superAdmin]);
  if (!superAdmin)
    return <p role="note">The policy registry requires a platform super admin.</p>;
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
        Projecting the policy registry…
      </p>
    );
  return (
    <section className={ledgerPanel} aria-label="Recorded policy registry">
      <div className={ledgerHeader}>
        <h3 className={ledgerTitle}>
          Recorded policy registry{' '}
          <span className={sourceTrace}>(v{value.registryVersion})</span>
        </h3>
        <p role="note" className={`${gateBlocked} mt-2`}>
          <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
          {value.notice}
        </p>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800/70">
        {value.mechanisms.map((entry) => (
          <RegistryEntry key={entry.mechanism} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
