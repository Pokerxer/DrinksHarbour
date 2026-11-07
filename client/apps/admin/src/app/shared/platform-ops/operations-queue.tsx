'use client';
// Platform-operations exceptions queue: filtered read-only lists of uncertain
// refund allocations, uncertain carrier operations and quarantined returns.
// Platform-ops only (super_admin/admin); separate from merchant action screens.
import { useEffect, useState } from 'react';
import { PiWarningBold } from 'react-icons/pi';
import {
  EMPTY_STATE,
  KIND_LABEL,
  QUEUE_KINDS,
  isPlatformRole,
  platformOpsRequest,
  type QueueKind,
  type QueueList,
} from '@/services/platform-ops.service';
import OperationsExceptionDetail from './operations-exception-detail';
import { stateTone, toneReason, gateAlert, ledgerPanel, ledgerPending, ledgerHeader, ledgerBody, ledgerTitle, ledgerProse, ledgerProseSoft, inlineIcon } from '../merchant-orders/design-tokens';
import { entryLink, kindTab, kindTabActive } from './design-tokens';

function entryTitle(kind: QueueKind, entry: QueueList['entries'][number]) {
  if (kind === 'return') return entry.booking ?? entry._id;
  if (kind === 'carrier') return entry._id;
  return entry.merchantOrder ?? entry._id;
}

/** Queue-entry register rule: state tone, never hand-picked. */
const entryTone = (kind: QueueKind, entry: QueueList['entries'][number]) =>
  stateTone((kind === 'return' ? entry.dispositionState : entry.state) ?? 'unknown');

export default function OperationsQueue({ token, role }: { token: string; role?: string }) {
  const platform = isPlatformRole(role);
  const [kind, setKind] = useState<QueueKind>('refund');
  const [state, setState] = useState<{
    kind: QueueKind;
    value?: QueueList;
    error?: string;
    selected?: string;
  }>({ kind });
  useEffect(() => {
    if (!platform) return;
    const controller = new AbortController();
    let current = true;
    platformOpsRequest<QueueList>(
      token,
      `/exceptions?kind=${kind}`,
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
              'The operations queue is unavailable. Reload to review the recorded exceptions.',
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
    <section aria-label="Platform operations exceptions queue">
      <div className={ledgerPanel}>
        <div className={ledgerHeader}>
          <h3 className={ledgerTitle}>Operational exceptions (read-only review)</h3>
          {/* Non-submitting navigation: tabs stay tabs, never CTAs */}
          <div role="tablist" aria-label="Queue kind" className="mt-2.5 flex flex-wrap gap-2">
            {QUEUE_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={option === kind}
                className={option === kind ? kindTabActive : kindTab}
                onClick={() => setKind(option)}
              >
                {KIND_LABEL[option]}
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
              {EMPTY_STATE[kind]}
            </p>
          ) : (
            <ul
              aria-label={`${KIND_LABEL[kind]} entries`}
              className="divide-y divide-gray-100 dark:divide-gray-800/70"
            >
              {state.value.entries.map((entry) => (
                <li key={entry._id} className="py-2.5 first:pt-0">
                  <button
                    type="button"
                    className={entryLink}
                    onClick={() => setState({ kind, value: state.value, selected: entry._id })}
                  >
                    {entryTitle(kind, entry)}
                  </button>
                  <p className={`${toneReason[entryTone(kind, entry)]} mt-0.5 tabular-nums`}>
                    {kind === 'return'
                      ? `Disposition ${entry.dispositionState}`
                      : `State ${entry.state ?? 'unknown'}`}{' '}
                    · tenant {entry.tenant} · age {entry.ageDays ?? 'unknown'} day(s)
                  </p>
                  <p className={ledgerProse}>
                    {('issue' in entry && entry.issue) || entry.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {state.selected && (
        <OperationsExceptionDetail
          token={token}
          role={role}
          kind={state.kind}
          entryId={state.selected}
        />
      )}
    </section>
  );
}
