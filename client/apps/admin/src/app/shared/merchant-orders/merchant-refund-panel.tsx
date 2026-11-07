'use client';
import { useState } from 'react';
import RefundReadinessPanel from './refund-readiness-panel';
import SettlementStatementPanel from './settlement-statement-panel';
import {
  merchantRequest,
  amountToMinor,
  formatMerchantMoney,
  type MerchantOrder,
  type MerchantRefund,
} from '@/services/merchant-order.service';
import {
  buttonClass,
  fieldClass,
  fieldErrorClass,
  helperClass,
} from '../market-foundation/workspace';
import {
  PiCheckCircleBold,
  PiLockSimpleBold,
  PiWarningBold,
} from 'react-icons/pi';
import {
  chipIcon,
  figureStrong,
  ledgerProse,
  ledgerProseSoft,
  stateTone,
  toneChip,
} from './design-tokens';
type Save = (
  path: string,
  payload: Record<string, unknown>,
  identity: string
) => Promise<boolean>;
export default function MerchantRefundPanel({
  token,
  row,
  platform,
  busy,
  save,
}: {
  token: string;
  row: MerchantOrder;
  platform: boolean;
  busy: boolean;
  save: Save;
}) {
  const [open, setOpen] = useState(false),
    [refunds, setRefunds] = useState<MerchantRefund[]>([]),
    [amount, setAmount] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  const amountPreview = (() => {
    try {
      return amount.trim() === ''
        ? null
        : formatMerchantMoney(amountToMinor(amount), row.currency);
    } catch {
      return null;
    }
  })();
  async function load() {
    setOpen(true);
    try {
      setRefunds(
        (
          await merchantRequest<{ refunds: MerchantRefund[] }>(
            token,
            `/${row._id}/refunds`
          )
        ).refunds
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to load refund allocations'
      );
    }
  }
  return (
    <section className="space-y-3 border-t border-muted pt-3">
      <p
        className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${ledgerProseSoft} tabular-nums`}
      >
        Refunded{' '}
        <span className={figureStrong}>
          {formatMerchantMoney(row.refundedMinor, row.currency)}
        </span>{' '}
        · Reserved{' '}
        <span className={figureStrong}>
          {formatMerchantMoney(row.refundReservedMinor, row.currency)}
        </span>
      </p>
      <button
        className={buttonClass}
        aria-expanded={open}
        disabled={busy}
        onClick={() => void load()}
      >
        Review merchandise refunds
      </button>
      {open && (
        <>
          <RefundReadinessPanel
            token={token}
            childId={row._id}
            version={row.version}
          />
          <SettlementStatementPanel
            token={token}
            childId={row._id}
            version={row.version}
          />
          <p className={ledgerProseSoft}>
            Requests reserve merchandise only. Platform staff verify execution.
            Shipping and tax refunds require review. Money refunds do not return
            goods to stock.
          </p>
          {error && (
            <p role="alert" className={fieldErrorClass}>
              {error}
            </p>
          )}
          {row.fulfillmentVersion !== 2 && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                setError('');
                try {
                  const minor = amountToMinor(amount);
                  void save(
                    `/${row._id}/refunds`,
                    { amountMinor: minor, reason },
                    `${row._id}:refund:${minor}:${reason}`
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Invalid amount');
                }
              }}
            >
              <label className="block">
                <span className="block text-base font-medium text-gray-700 dark:text-gray-300">
                  Merchandise refund amount ({row.currency})
                </span>
                <input
                  className={fieldClass}
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {amountPreview && (
                  <span
                    className={helperClass}
                    data-testid="refund-amount-preview"
                  >
                    This will request {amountPreview} in merchandise refunds —
                    check the amount before submitting.
                  </span>
                )}
              </label>
              <label className="block">
                <span className="block text-base font-medium text-gray-700 dark:text-gray-300">
                  Refund reason
                </span>
                <input
                  className={fieldClass}
                  required
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className={`${buttonClass} justify-self-start sm:col-span-2`}
                disabled={busy}
              >
                Request merchandise refund
              </button>
            </form>
          )}
          <ul className="space-y-3">
      {refunds.map((refund) => {
        const tone = stateTone(refund.state);
        return (
          <li
            key={refund._id}
            className="space-y-1 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={toneChip[tone]}>
                {tone === 'ready' ? (
                  <PiCheckCircleBold aria-hidden="true" className={chipIcon} />
                ) : tone === 'review' ? (
                  <PiWarningBold aria-hidden="true" className={chipIcon} />
                ) : (
                  <PiLockSimpleBold aria-hidden="true" className={chipIcon} />
                )}
                {refund.state}
              </span>
              <span className={figureStrong}>
                {formatMerchantMoney(refund.amountMinor, refund.currency)}
              </span>
            </div>
            <p className={ledgerProse}>
              {refund.reason}
            </p>
            {refund.unitRanges?.map((selected) => (
              <p
                key={selected.line}
                className="font-mono text-xs leading-5 text-gray-500 dark:text-gray-400"
              >{`Units ${selected.ranges.map((range) => (range.quantity === 1 ? String(range.start + 1) : `${range.start + 1}–${range.start + range.quantity}`)).join(', ')} · ${row.lines.find((line) => line.line === selected.line)?.productName || 'Purchased item'}`}</p>
            ))}
            {refund.issue && (
              <p role="alert" className={fieldErrorClass}>
                {refund.issue}
              </p>
            )}
            {platform && (
              <RefundControls
                child={row._id}
                refund={refund}
                busy={busy}
                save={save}
              />
            )}
            </li>
          );
        })}
        </ul>
        </>
      )}
    </section>
  );
}
function RefundControls({
  child,
  refund,
  busy,
  save,
}: {
  child: string;
  refund: MerchantRefund;
  busy: boolean;
  save: Save;
}) {
  const [evidence, setEvidence] = useState('');
  if (refund.state === 'reserved')
    return (
      <button
        className={buttonClass}
        disabled={busy}
        onClick={() =>
          void save(
            `/${child}/refunds/${refund._id}/execute`,
            {},
            `execute:${refund._id}`
          )
        }
      >
        Execute reviewed refund
      </button>
    );
  if (['submitting', 'uncertain'].includes(refund.state))
    return (
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save(
            `/${child}/refunds/${refund._id}/reconcile`,
            { providerRefundId: evidence },
            `reconcile:${refund._id}:${evidence}`
          );
        }}
      >
        <label>
          Existing provider refund ID
          <input
            className={fieldClass}
            value={evidence}
            required
            pattern="(re_[A-Za-z0-9_]+|[1-9][0-9]{0,15})"
            onChange={(e) => setEvidence(e.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={busy}>
          Verify original refund evidence
        </button>
      </form>
    );
  return null;
}
