'use client';
// Platform-operations exception detail: read-only inspect view with the
// wired original-source discovery, audit history, and at most the two
// pre-existing reconcile controls (workspace primitives, no CTA styling).
// Returns expose no reconcile control at all — only the recorded
// unsupported-effects wording.
import { useEffect, useState } from 'react';
import { PiCheckCircleBold, PiLockSimpleBold, PiWarningBold } from 'react-icons/pi';
import {
  platformOpsRequest,
  type ExceptionDetail,
  type QueueKind,
} from '@/services/platform-ops.service';
import { buttonClass, fieldClass } from '@/app/shared/market-foundation/workspace';
import {
  chipIcon, fieldLabel, gateAlert, gateBlocked, gateReady, gateReview,
  inlineIcon, ledgerPanel, ledgerPending, ledgerProse, ledgerProseSoft,
  ledgerTitle, sourceTrace, stateTone, toneChip, toneReason,
} from '../merchant-orders/design-tokens';

function SourceList({ detail }: { detail: ExceptionDetail }) {
  if (!('sources' in detail)) return null;
  return (
    <div aria-label="Original payment source resolution">
      <p className={ledgerProse}>
        Original source resolution:{' '}
        <span className={toneChip[stateTone(detail.sources.status)]}>
          {stateTone(detail.sources.status) === 'ready' ? (
            <PiCheckCircleBold aria-hidden="true" className={chipIcon} />
          ) : (
            <PiLockSimpleBold aria-hidden="true" className={chipIcon} />
          )}
          {detail.sources.status}
        </span>
      </p>
      {detail.sources.sources.map((source, index) => (
        <div key={index} className="mt-1.5">
          <p className={sourceTrace}>
            {`${source.provider} — identity ${source.identity}, capability ${source.refundCapability}`}
          </p>
          <p className={toneReason[stateTone(source.refundCapability)]}>
            {source.reason}
          </p>
        </div>
      ))}
      {'storedValueFunding' in detail && detail.storedValueFunding && (
        <p className={`${ledgerProseSoft} mt-1.5`}>
          Stored-value funding resolution: {detail.storedValueFunding.status}
          {detail.storedValueFunding.kind
            ? ` (${detail.storedValueFunding.kind})`
            : ''}
          {detail.storedValueFunding.reason ? ` — ${detail.storedValueFunding.reason}` : ''}
        </p>
      )}
    </div>
  );
}

function AuditHistory({ detail }: { detail: ExceptionDetail }) {
  return (
    <div aria-label="Audit history">
      <h4 className={ledgerTitle}>Audit history</h4>
      {detail.audit.length === 0 ? (
        <p className={ledgerProseSoft}>
          No audit entries are recorded for this entity yet.
        </p>
      ) : (
        <ul className="mt-0.5 space-y-0.5">
          {detail.audit.map((row, index) => (
            <li key={index} className={sourceTrace}>
              {row.action} ({row.actorRole ?? 'system'}, {row.result ?? 'success'})
              {row.timestamp ? ` — ${row.timestamp}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OperationsExceptionDetail({
  token,
  role,
  kind,
  entryId,
}: {
  token: string;
  role?: string;
  kind: QueueKind;
  entryId: string;
}) {
  const platform = role === 'super_admin' || role === 'admin';
  const [state, setState] = useState<{
    entryId: string;
    value?: ExceptionDetail;
    error?: string;
    notice?: string;
  }>({ entryId });
  const [providerRefundId, setProviderRefundId] = useState('');
  useEffect(() => {
    if (!platform) return;
    const controller = new AbortController();
    let current = true;
    platformOpsRequest<ExceptionDetail>(
      token,
      `/exceptions/${kind}/${entryId}`,
      'GET',
      undefined,
      controller.signal
    )
      .then((value) => {
        if (current) setState({ entryId, value });
      })
      .catch(() => {
        if (current)
          setState({
            entryId,
            error:
              'This exception detail is unavailable. Reload to review the recorded state.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [token, kind, entryId, platform]);
  const reload = () => {
    platformOpsRequest<ExceptionDetail>(token, `/exceptions/${kind}/${entryId}`)
      .then((value) => setState({ entryId, value, notice: 'Reconciliation recorded.' }))
      .catch(() =>
        setState((previous) => ({
          ...previous,
          error: 'Reconciliation could not be completed. The recorded state stands.',
        }))
      );
  };
  const reconcile = (event: React.FormEvent) => {
    event.preventDefault();
    setState((previous) => ({ ...previous, error: undefined, notice: undefined }));
    platformOpsRequest(
      token,
      `/refund-exceptions/${entryId}/reconcile`,
      'POST',
      { providerRefundId }
    )
      .then(reload)
      .catch((error: Error) =>
        setState((previous) => ({
          ...previous,
          error: error.message || 'Reconciliation was rejected; the reservation stands.',
        }))
      );
  };
  const reconcileCarrier = () => {
    setState((previous) => ({ ...previous, error: undefined, notice: undefined }));
    platformOpsRequest(token, `/carrier-exceptions/${entryId}/reconcile`, 'POST', {})
      .then(reload)
      .catch((error: Error) =>
        setState((previous) => ({
          ...previous,
          error: error.message || 'Reconciliation was rejected; responsibility remains uncertain.',
        }))
      );
  };
  if (!platform)
    return <p role="note">Platform operations access required.</p>;
  if (state.entryId !== entryId)
    return (
      <p role="status" className={ledgerPending}>
        Loading the exception…
      </p>
    );
  if (state.error)
    return (
      <p role="alert" className={gateAlert}>
        <PiWarningBold aria-hidden="true" className={inlineIcon} />
        {state.error}
        {state.notice ? ` ${state.notice}` : ''}
      </p>
    );
  const detail = state.value;
  if (!detail)
    return (
      <p role="alert" className={gateReview}>
        <PiWarningBold aria-hidden="true" className={inlineIcon} />
        Exception detail requires review.
      </p>
    );
  return (
    <section
      className={`${ledgerPanel} mt-4 px-4 py-3 sm:px-5 space-y-2.5`}
      aria-label="Platform operations exception detail"
    >
      {state.notice && (
        <p role="status" className={gateReady}>
          <PiCheckCircleBold aria-hidden="true" className={inlineIcon} />
          {state.notice}
        </p>
      )}
      <p className={`${toneReason[stateTone(detail.state ?? detail.dispositionState ?? 'unknown')]} tabular-nums`}>
        {`State: ${detail.state ?? detail.dispositionState} · age ${detail.ageDays ?? 'unknown'} day(s)`}
      </p>
      <p className={ledgerProse}>{('issue' in detail && detail.issue) || detail.reason}</p>
      <SourceList detail={detail} />
      {'effects' in detail && (
        <div className={gateBlocked}>
          <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
          <p role="note" className="text-base leading-6">
            {detail.effects.reasons.join(' ')}
          </p>
        </div>
      )}
      <AuditHistory detail={detail} />
      {detail.reconcile.supported ? (
        detail.reconcile.kind === 'refund' ? (
          <form onSubmit={reconcile} className="space-y-2" aria-label="Refund reconciliation">
            <p className={ledgerProse}>{detail.reconcile.wording}</p>
            <p className={ledgerProseSoft}>{detail.reconcile.requirement}.</p>
            <label className={fieldLabel}>
              Original provider refund ID
              <input
                className={fieldClass}
                value={providerRefundId}
                onChange={(event) => setProviderRefundId(event.target.value)}
                required
              />
            </label>
            <button type="submit" className={buttonClass}>
              Reconcile refund
            </button>
          </form>
        ) : (
          <div aria-label="Carrier reconciliation" className="space-y-2">
            <p className={ledgerProseSoft}>{detail.reconcile.requirement}.</p>
            {!detail.reconcile.providerIdKnown && (
              <div className={gateBlocked}>
                <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
                <p role="note" className="text-base leading-6">
                  No known original provider shipment ID is recorded; reconciliation
                  will fail closed until one exists.
                </p>
              </div>
            )}
            <button type="button" className={buttonClass} onClick={reconcileCarrier}>
              Reconcile carrier booking
            </button>
          </div>
        )
      ) : (
        <div className={gateBlocked}>
          <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
          <p role="note" className="text-base leading-6">
            {detail.reconcile.reason}
          </p>
        </div>
      )}
    </section>
  );
}
