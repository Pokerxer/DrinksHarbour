'use client';
// Mechanisms queue panel (workstream UI-W): read-only review of the
// kora-refund and payout-transfer mechanisms' operator-facing recorded
// reservation states. Platform ops only (super_admin/admin). There are NO
// mutation controls: both mechanisms' commands are deliberately service-level
// and their only mutation surfaces are the four super-admin policy recording
// routes that already exist on their own routers.
import { useEffect, useState } from 'react';
import { PiLockSimpleBold, PiWarningBold } from 'react-icons/pi';
import {
  isPlatformRole,
  platformOpsRequest,
} from '@/services/platform-ops.service';
import {
  MECHANISM_EMPTY_STATE,
  MECHANISM_KINDS,
  MECHANISM_KIND_LABEL,
  type MechanismExceptionDetail,
  type MechanismQueueKind,
  type MechanismQueueList,
} from '@/services/platform-ops-mechanisms.types';
import { gateAlert, gateBlocked, inlineIcon, ledgerBody, ledgerHeader, ledgerPanel, ledgerPending, ledgerProse, ledgerProseSoft, ledgerTitle, sourceTrace, stateTone, toneReason } from '../merchant-orders/design-tokens';
import { entryLink, kindTab, kindTabActive } from './design-tokens';

function entryTitle(entry: MechanismQueueList['entries'][number]) {
  return entry.child ?? entry.order ?? entry._id;
}

export default function OperationsMechanismsQueue({
  token,
  role,
}: {
  token: string;
  role?: string;
}) {
  const platform = isPlatformRole(role);
  const [kind, setKind] = useState<MechanismQueueKind>('kora_refund');
  const [state, setState] = useState<{
    kind: MechanismQueueKind;
    value?: MechanismQueueList;
    error?: string;
    selected?: string;
  }>({ kind });
  useEffect(() => {
    if (!platform) return undefined;
    const controller = new AbortController();
    let current = true;
    platformOpsRequest<MechanismQueueList>(
      token,
      `/mechanism-exceptions?kind=${kind}`,
      'GET',
      undefined,
      controller.signal
    )
      .then((value) => {
        if (current) setState({ kind, value });
      })
      .catch(() => {
        if (current)
          setState({
            kind,
            error:
              'The mechanisms queue is unavailable. Reload to review the recorded reservations.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [token, kind, platform]);
  if (!platform)
    return <p role="note">Platform operations access required.</p>;
  const matched = state.kind === kind;
  return (
    <section aria-label="Platform mechanisms queue">
      <div className={ledgerPanel}>
        <div className={ledgerHeader}>
          <h3 className={ledgerTitle}>Mechanism reservations (read-only review)</h3>
          <p className={ledgerProseSoft}>
            Reserved states of the kora-refund and payout-transfer mechanisms.
            Reconciliation for these commands is service-level: platform
            operations exposes no mutation route for them.
          </p>
          <div
            role="tablist"
            aria-label="Mechanism queue kind"
            className="mt-2 flex flex-wrap gap-2"
          >
            {MECHANISM_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={option === kind}
                className={option === kind ? kindTabActive : kindTab}
                onClick={() => setKind(option)}
              >
                {MECHANISM_KIND_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
        <div className={ledgerBody}>
          {!matched ? (
            <p role="status" className={ledgerPending}>
              Loading the queue…
            </p>
          ) : state.error ? (
            <p role="alert" className={gateAlert}>
              <PiWarningBold aria-hidden="true" className={inlineIcon} />
              {state.error}
            </p>
          ) : !state.value || state.value.entries.length === 0 ? (
            <p role="status" className={ledgerProseSoft}>
              {MECHANISM_EMPTY_STATE[kind]}
            </p>
          ) : (
            <ul
              aria-label={`${MECHANISM_KIND_LABEL[kind]} entries`}
              className="divide-y divide-gray-100 dark:divide-gray-800/70"
            >
              {state.value.entries.map((entry) => (
                <li key={entry._id} className="py-2.5 first:pt-0">
                  <button
                    type="button"
                    className={entryLink}
                    onClick={() =>
                      setState({ kind, value: state.value, selected: entry._id })
                    }
                  >
                    {`Reservation ${entryTitle(entry)}`}
                  </button>
                  <p className={`${toneReason[stateTone(entry.state)]} mt-0.5 tabular-nums`}>
                    {`State ${entry.state} · tenant ${entry.tenant ?? '—'} · age ${entry.ageDays ?? 'unknown'} day(s)`}
                  </p>
                  <p className={ledgerProse}>{entry.issue ?? entry.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {state.selected && (
        <MechanismDetail token={token} kind={kind} entryId={state.selected} />
      )}
    </section>
  );
}

function MechanismDetail({
  token,
  kind,
  entryId,
}: {
  token: string;
  kind: MechanismQueueKind;
  entryId: string;
}) {
  const [state, setState] = useState<{
    value?: MechanismExceptionDetail;
    error?: string;
  }>({});
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    platformOpsRequest<MechanismExceptionDetail>(
      token,
      `/mechanism-exceptions/${kind}/${encodeURIComponent(entryId)}`,
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
              'The reservation detail is unavailable. Reload to review the recorded reservation.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [token, kind, entryId]);
  if (state.error)
    return (
      <p role="alert" className={gateAlert}>
        <PiWarningBold aria-hidden="true" className={inlineIcon} />
        {state.error}
      </p>
    );
  const detail = state.value;
  if (!detail)
    return (
      <p role="status" className={ledgerPending}>
        Loading the reservation detail…
      </p>
    );
  return (
    <section
      aria-label="Mechanism reservation detail"
      className={`${ledgerPanel} mt-4 px-4 py-3 sm:px-5`}
    >
      <h4 className={ledgerTitle}>Reservation detail</h4>
      <div className="mt-1.5 space-y-0.5">
        {'claim' in detail ? (
          <>
            <p className={sourceTrace}>{`Claim ${detail.claim}`}</p>
            <p className={sourceTrace}>{`Provider reference ${detail.providerReference}`}</p>
            <p className={sourceTrace}>
              {`Provider refund id ${detail.providerRefundId ?? 'not saved'}`}
            </p>
            <p className={ledgerProse}>
              {`Fallback identity accepted: ${detail.fallbackAccepted ? 'yes (recorded decision)' : 'no'}`}
            </p>
            <p className={sourceTrace}>{`Policy version ${detail.policyVersion}`}</p>
          </>
        ) : (
          <>
            <p className={sourceTrace}>{`Child ${detail.child}`}</p>
            <p className={sourceTrace}>
              {`Statement version ${detail.statementVersion ?? 'unknown'}`}
            </p>
            <p className={sourceTrace}>
              {`Submitted provider identity ${detail.submittedTransferId ?? 'not stamped'}`}
            </p>
          </>
        )}
        {detail.issue && (
          <p className={ledgerProse}>{`Recorded issue: ${detail.issue}`}</p>
        )}
      </div>
      {/* Reconcile disposition: deliberate fail-closed, never an error */}
      <div className={`${gateBlocked} mt-2.5`}>
        <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
        <p className="text-base leading-6">{`Reconcile: ${detail.reconcile.reason}`}</p>
      </div>
      <div aria-label="Reservation audit history" className="mt-2.5 space-y-0.5">
        {detail.audit.length === 0 ? (
          <p className={ledgerProseSoft}>
            No audit history rows are recorded for this reservation.
          </p>
        ) : (
          detail.audit.map((row, index) => (
            <p key={index} className={sourceTrace}>
              {[
                row.action,
                row.actorRole,
                row.result,
                row.justification,
                row.targetType,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
