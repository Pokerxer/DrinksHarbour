'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  merchantRequest,
  formatMerchantMoney,
} from '@/services/merchant-order.service';
import { PiCheckCircleBold, PiWarningBold } from 'react-icons/pi';
import {
  figure,
  figureFlow,
  figureInline,
  figureStrong,
  gateAlert,
  gateReview,
  inlineIcon,
  ledgerHeader,
  ledgerPanel,
  ledgerPending,
  ledgerProse,
  ledgerProseSoft,
  ledgerRow,
  ledgerRowLabel,
  ledgerTitle,
  sourceTrace,
  stateTone,
  toneChip,
  toneGate,
  toneReason,
  chipIcon,
} from './design-tokens';
import type { SettlementStatement } from './settlement-statement.types';
const money = (minor: number, currency: string) =>
  formatMerchantMoney(minor, currency);
/** Ledger row: label left (wraps), tabular money right (never breaks). */
const Row = ({
  label,
  amount,
  strong,
}: {
  label: ReactNode;
  amount: string;
  strong?: boolean;
}) => (
  <div className={`${ledgerRow} py-2`}>
    <dt className={ledgerRowLabel}>{label}</dt>
    <dd className={strong ? figureStrong : figure}>{amount}</dd>
  </div>
);
/** Compound proof row: label on its own line, wrap-between-components proof. */
const ProofRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="py-2">
    <dt className={ledgerRowLabel}>{label}</dt>
    <dd
      className={`${figureFlow} mt-1 flex flex-wrap items-baseline justify-end gap-x-1.5`}
    >
      {children}
    </dd>
  </div>
);
const Trace = ({ id }: { id: string | null }) =>
  id ? <span className={sourceTrace}>({id})</span> : null;
export default function SettlementStatementPanel({
  token,
  childId,
  version,
}: {
  token: string;
  childId: string;
  version: number;
}) {
  const [state, setState] = useState<{
    token: string;
    childId: string;
    version: number;
    value?: SettlementStatement;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    merchantRequest<{ statement: SettlementStatement | null }>(
      token,
      `/${childId}/settlement-statement`,
      'GET',
      undefined,
      controller.signal
    )
      .then(({ statement }) => {
        if (current)
          setState({ token, childId, version, value: statement || undefined });
      })
      .catch(() => {
        if (current)
          setState({
            token,
            childId,
            version,
            error:
              'Settlement statement is unavailable. Reload to review the recorded figures.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [token, childId, version]);
  const matched =
    state?.token === token &&
    state.childId === childId &&
    state.version === version;
  if (!matched)
    return (
      <p role="status" className={ledgerPending}>
        Projecting the settlement statement…
      </p>
    );
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
      <p role="alert" className={gateReview}>
        <PiWarningBold aria-hidden="true" className={inlineIcon} />
        Settlement statement requires review.
      </p>
    );
  const { totals, currency } = value;
  const review = value.reconciliation.state === 'needs_review';
  return (
    <section className={ledgerPanel} aria-label="Merchant settlement statement">
      {/* Title + verdict: the document header stamp */}
      <div className={ledgerHeader}>
        <h3 className={ledgerTitle}>
          Merchant settlement statement{' '}
          <span className={sourceTrace}>
            (v{value.statementVersion}, read-only)
          </span>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={toneChip[review ? 'review' : 'ready']}>
            {review ? (
              <PiWarningBold aria-hidden="true" className={chipIcon} />
            ) : (
              <PiCheckCircleBold aria-hidden="true" className={chipIcon} />
            )}
            {review ? 'Needs review' : 'Reconciled'}
          </span>
          — source: <span className={sourceTrace}>{value.sources.totals}</span>
        </p>
      </div>
      {/* Ledger: label left, tabular money right, hairline between rows */}
      <dl className="divide-y divide-gray-100 px-4 sm:px-5 dark:divide-gray-800/70">
        <Row label="Gross merchandise" amount={money(totals.grossMinor, currency)} />
        <Row label="Discounts (already netted)" amount={money(totals.discountMinor, currency)} />
        <Row
          label={
            <>
              Merchandise (tenant share{' '}
              <span className={figureInline}>{money(totals.tenantShareMinor, currency)}</span>{' '}
              + commission{' '}
              <span className={figureInline}>{money(totals.commissionMinor, currency)}</span>)
            </>
          }
          amount={money(totals.merchandiseMinor, currency)}
        />
        <Row label="Refunds settled" amount={money(value.refunds.settledMinor, currency)} />
        <Row
          label="Refunds reserved (outstanding liability)"
          amount={money(value.refunds.reservedMinor, currency)}
        />
        <Row
          label="Commission reversal from settled refunds"
          amount={money(value.commissionReversal.settledMinor, currency)}
        />
        <Row
          label="Net receivable after settled refunds"
          amount={money(value.netReceivable.settledMinor, currency)}
          strong
        />
        <Row
          label="Projected net receivable if reserved refunds settle"
          amount={money(value.netReceivable.projectedMinor, currency)}
          strong
        />
        <ProofRow label="Goods cost (original − cancelled)">
          <span className={figure}>
            {money(value.goodsCost.originalCostMinor, currency)}
          </span>
          −
          <span className={figure}>{money(value.goodsCost.cancelledCostMinor, currency)}</span>
          =<span className={figure}>{money(value.goodsCost.netCostMinor, currency)}</span>{' '}
          <Trace id={value.goodsCost.sourceId} />
        </ProofRow>
        <ProofRow label="Committed carrier cost (journal-exempt record)">
          <span className={figure}>
            {money(value.carrierCost.committedMinor, currency)}
          </span>{' '}
          <Trace id={value.carrierCost.sourceId} />
        </ProofRow>
      </dl>
      {/* Source-trace notes: quiet evidence, not body copy */}
      <div className="space-y-1 px-4 pb-3 pt-1 sm:px-5">
        <p className={ledgerProseSoft}>{value.carrierCost.sourceNote}</p>
        <p className={ledgerProseSoft}>{value.goodsCost.sourceNote}</p>
        {value.journals.sales && (
          <p className={ledgerProseSoft}>
            Original sales journal{' '}
            <span className={sourceTrace}>{value.journals.sales.sourceId}</span>
            : revenue{' '}
            <span className={figureInline}>{money(value.journals.sales.merchandiseMinor, currency)}</span>
            , tenant share{' '}
            <span className={figureInline}>{money(value.journals.sales.tenantShareMinor, currency)}</span>
            , commission{' '}
            <span className={figureInline}>{money(value.journals.sales.commissionMinor, currency)}</span>
          </p>
        )}
      </div>
      {/* Refund allocation register */}
      <ul
        aria-label="Refund allocations"
        className="divide-y divide-gray-100 border-y border-gray-100 px-4 sm:px-5 dark:divide-gray-800/70 dark:border-gray-800/70"
      >
        {value.refunds.allocations.map((row) => (
          <li key={row.id} className="py-2">
            <p className={ledgerProseSoft}>
              {row.source} —{' '}
              <span className={figureInline}>{money(row.amountMinor, currency)}</span>{' '}
              ({row.state}); commission{' '}
              <span className={figureInline}>{money(row.commissionMinor, currency)}</span>, tenant
              share{' '}
              <span className={figureInline}>{money(row.tenantShareMinor, currency)}</span>
            </p>
          </li>
        ))}
      </ul>
      {/* Reconciliation register: notes neutral, uncertain rows amber-gated */}
      <div className="space-y-2 px-4 pb-3 pt-3 sm:px-5">
        {value.reconciliation.items?.map((item, index) => (
          <p key={index} role="note" className={toneReason[stateTone(item.state)]}>
            {item.scope}: {item.reason}
          </p>
        ))}
        {value.reconciliation.uncertain?.map((row) => (
          <p key={row.id} role="alert" className={gateReview}>
            <PiWarningBold aria-hidden="true" className={inlineIcon} />
            <span>
              {row.id} ({row.state}): {row.reason}
            </span>
          </p>
        ))}
      </div>
      {/* Order-set summary: ledger footer line */}
      <div className="border-t border-gray-200 px-4 py-2.5 sm:px-5 dark:border-gray-800">
        <p className={ledgerProseSoft}>
          Order set <span className={sourceTrace}>{value.set.orderId}</span>:
          merchandise{' '}
          <span className={figureInline}>{money(value.set.totals.merchandiseMinor, currency)}</span>
          , settled refunds{' '}
          <span className={figureInline}>{money(value.set.totals.settledMinor, currency)}</span>
          , net receivable{' '}
          <span className={figureInline}>{money(value.set.totals.netReceivableMinor, currency)}</span>
        </p>
      </div>
      {/* Payout policy notice: footer stamp, tone follows payout state */}
      <div className="border-t border-gray-200 px-4 py-3 sm:px-5 dark:border-gray-800">
        <div className={toneGate[stateTone(value.payout.state ?? 'blocked')]}>
          {stateTone(value.payout.state ?? 'blocked') === 'ready' ? (
            <PiCheckCircleBold aria-hidden="true" className={inlineIcon} />
          ) : (
            <PiWarningBold aria-hidden="true" className={inlineIcon} />
          )}
          <p className={ledgerProse}>{value.payout.reason}</p>
        </div>
      </div>
    </section>
  );
}
