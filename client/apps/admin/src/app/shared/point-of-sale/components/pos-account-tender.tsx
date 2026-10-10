'use client';

// A single "Charge to account" tender button for the POS payment modal.
//
// The split between stored value and a new tab charge, and whether the sale fits
// inside the customer's credit limit, are BOTH asked of the server
// (`previewAccountCharge`). They are deliberately not computed here. The client
// has no trustworthy tab balance — it is not in the customer search payload, it
// moves on every payment and every other on-account sale, and offline it is
// stale — while the limit applies to TOTAL owed. A local calculation therefore
// waves through sales the live balance rejects, which is the one error a till
// must never make: it hands over goods against credit the customer does not have.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiWallet } from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import type { AccountChargePreview } from '@/app/shared/point-of-sale/types';
import cn from '@core/utils/class-names';
import { formatCurrency } from '../utils';

export interface AccountTenderSelection {
  method: 'account';
  amount: number;
  /**
   * Manager's reason for selling past the credit limit. Required by the server
   * whenever the limit is exceeded — it is recorded on the statement row, so it
   * is an audit fact and not a UI nicety.
   */
  creditOverrideReason?: string;
}

interface Props {
  customerId?: string | null;
  /** The sale total after discount and rounding — the same figure the server splits. */
  payableTotal: number;
  selected: boolean;
  onSelect: (selection: AccountTenderSelection) => void;
}

export function AccountTenderButton({
  customerId,
  payableTotal,
  selected,
  onSelect,
}: Props) {
  const { token } = usePOSAuth();
  const [preview, setPreview] = useState<AccountChargePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!token || !customerId || payableTotal <= 0) {
      setPreview(null);
      return;
    }
    setLoading(true);
    try {
      setPreview(await posApi.previewAccountCharge(token, customerId, payableTotal));
      setUnavailable(null);
    } catch (err) {
      // The server declines to guess from a cached balance while offline. Saying
      // so plainly beats offering a button whose limit check cannot be trusted.
      setUnavailable(
        err instanceof Error ? err.message : 'Could not check their credit limit'
      );
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [token, customerId, payableTotal]);

  useEffect(() => {
    void load();
  }, [load]);

  const overLimit = !!preview && !preview.split.withinLimit;

  function choose() {
    if (!preview) return;
    if (overLimit) {
      // The manager authorised it in this session; record why. A sale inside the
      // limit carries no reason, and must not send an empty one.
      if (preview.canOverride) {
        const trimmed = reason.trim();
        if (!trimmed) {
          toast.error('Add a reason for going over the credit limit.');
          return;
        }
        onSelect({ method: 'account', amount: payableTotal, creditOverrideReason: trimmed });
      }
      return;
    }
    onSelect({ method: 'account', amount: payableTotal });
  }

  if (!customerId || payableTotal <= 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={choose}
        disabled={loading || !preview || (overLimit && !preview.canOverride)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-semibold shadow-sm transition-all active:scale-[0.98]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          selected
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-gray-200 bg-white text-gray-800 hover:border-[#b20202] hover:shadow-md'
        )}
      >
        <span className={selected ? 'text-green-600' : 'text-gray-400'}>
          <PiWallet className="h-5 w-5" />
        </span>
        <span className="flex-1">
          Charge to account
          <p className="mt-0.5 text-[11px] font-normal text-gray-500">
            {loading
              ? 'Checking their credit limit…'
              : unavailable
                ? unavailable
                : preview
                  ? preview.split.charged
                    ? `${formatCurrency(preview.split.spend)} store credit · ${formatCurrency(preview.split.shortfall)} to their tab`
                    : `Paid in full from ${formatCurrency(preview.walletBalance)} store credit`
                  : ' '}
          </p>
        </span>
      </button>

      {preview && (
        <AccountTenderDetail
          preview={preview}
          overLimit={overLimit}
          reason={reason}
          onReasonChange={setReason}
          onConfirm={choose}
        />
      )}
    </div>
  );
}

function AccountTenderDetail({
  preview,
  overLimit,
  reason,
  onReasonChange,
  onConfirm,
}: {
  preview: AccountChargePreview;
  overLimit: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
}) {
  const { split } = preview;
  const owedNow = Math.max(0, split.requiredLimit - split.shortfall);

  if (!overLimit) {
    return (
      <p className="px-1 text-[11px] text-gray-500">
        After this sale they will owe{' '}
        <span className="font-semibold text-gray-700">
          {formatCurrency(split.requiredLimit)}
        </span>{' '}
        of {formatCurrency(preview.creditLimit)}.{' '}
        {owedNow > 0 && (
          <>They owe {formatCurrency(owedNow)} today.</>
        )}
      </p>
    );
  }

  if (!preview.canOverride) {
    // Refused by capability, not by arithmetic — so the message asks for a
    // person rather than suggesting a retry might work.
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        This sale takes them to {formatCurrency(preview.owedAfter)}, over their{' '}
        {formatCurrency(preview.creditLimit)} limit. A manager has to authorise it.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2.5">
      <p className="text-[11px] text-amber-900">
        This sale takes them to{' '}
        <span className="font-semibold">{formatCurrency(preview.owedAfter)}</span>, over their{' '}
        {formatCurrency(preview.creditLimit)} limit. Record why you are approving it.
      </p>
      <textarea
        value={reason}
        onChange={e => onReasonChange(e.target.value)}
        rows={2}
        placeholder="Reason for the override"
        className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-[12px] text-gray-800 outline-none focus:border-amber-500"
      />
      <button
        type="button"
        onClick={onConfirm}
        disabled={!reason.trim()}
        className="w-full rounded-md bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Approve this sale
      </button>
    </div>
  );
}