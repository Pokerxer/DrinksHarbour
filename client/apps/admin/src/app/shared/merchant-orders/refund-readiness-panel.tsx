'use client';
import { useEffect, useState } from 'react';
import {
  merchantRequest,
  formatMerchantMoney,
} from '@/services/merchant-order.service';
import {
  PiLockSimpleBold,
  PiWarningBold,
} from 'react-icons/pi';
import {
  figure,
  gateAlert,
  gateBlocked,
  gateReview,
  inlineIcon,
  ledgerHeader,
  ledgerPanel,
  ledgerPending,
  ledgerRow,
  ledgerRowLabel,
  ledgerTitle,
  stateTone,
  toneReason,
} from './design-tokens';
type Reason = { state: string; reason: string };
type Readiness = {
  currency: string;
  merchandise: Reason & {
    availableMinor: number;
    reservable: boolean;
    executionEnabled: boolean;
  };
  shipping: Reason & { acceptedMinor: number };
  tax: Reason & { acceptedMinor: number };
  payout: Reason;
  goods: Reason;
  fullCancellationReady: boolean;
};
export default function RefundReadinessPanel({
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
    value?: Readiness;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    merchantRequest<{ readiness: Readiness | null }>(
      token,
      `/${childId}/refund-readiness`,
      'GET',
      undefined,
      controller.signal
    )
      .then(({ readiness }) => {
        if (current)
          setState({ token, childId, version, value: readiness || undefined });
      })
      .catch(() => {
        if (current)
          setState({
            token,
            childId,
            version,
            error:
              'Financial readiness is unavailable. Reload before requesting a refund.',
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
        Checking original financial authority…
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
        Financial readiness requires review.
      </p>
    );
  return (
    <section className={ledgerPanel} aria-label="Financial readiness">
      <div className={ledgerHeader}>
        <h4 className={ledgerTitle}>
          Original payment and financial readiness
        </h4>
      </div>
      {/* Accepted figures in the money column; each figure is answered
          immediately by its reason line in the tone of its state */}
      <div className="divide-y divide-gray-100 px-4 sm:px-5 dark:divide-gray-800/70">
        <div className="py-2.5">
          <div className={ledgerRow}>
            <p className={ledgerRowLabel}>Merchandise available:</p>
            <span className={figure}>
              {formatMerchantMoney(
                value.merchandise.availableMinor,
                value.currency
              )}
            </span>
          </div>
          <p
            className={toneReason[stateTone(value.merchandise.state ?? 'blocked')]}
          >
            {value.merchandise.reason}
          </p>
        </div>
        {value.shipping && (
          <div className="py-2.5">
            <div className={ledgerRow}>
              <p className={ledgerRowLabel}>Accepted shipping:</p>
              <span className={figure}>
                {formatMerchantMoney(
                  value.shipping.acceptedMinor,
                  value.currency
                )}
              </span>
            </div>
            <p
              className={toneReason[stateTone(value.shipping.state ?? 'blocked')]}
            >
              {value.shipping.reason}
            </p>
          </div>
        )}
        {value.tax && (
          <div className="py-2.5">
            <div className={ledgerRow}>
              <p className={ledgerRowLabel}>Accepted tax:</p>
              <span className={figure}>
                {formatMerchantMoney(value.tax.acceptedMinor, value.currency)}
              </span>
            </div>
            <p
              className={toneReason[stateTone(value.tax.state ?? 'blocked')]}
            >
              {value.tax.reason}
            </p>
          </div>
        )}
      </div>
      {!value.merchandise.executionEnabled && (
        <div className="px-4 pb-1 sm:px-5">
          <div className={gateBlocked}>
            <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
            <p className="text-base leading-6">Refund execution is disabled.</p>
          </div>
        </div>
      )}
      {/* Independent policy registers (payout / goods): reasoned, quiet */}
      <div className="space-y-2.5 px-4 pb-3 pt-3 sm:px-5">
        <p className={`${toneReason[stateTone(value.payout.state ?? 'blocked')]}`}>
          {value.payout.reason}
        </p>
        <p className={`${toneReason[stateTone(value.goods.state ?? 'blocked')]}`}>
          {value.goods.reason}
        </p>
      </div>
      {!value.fullCancellationReady && (
        <div className="px-4 pb-4 sm:px-5">
          <div className={gateReview}>
            <PiWarningBold aria-hidden="true" className={inlineIcon} />
            <p className="text-base leading-6">
              Full financial cancellation requires review of outstanding components.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
