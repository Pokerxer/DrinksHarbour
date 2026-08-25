// client/apps/admin/src/app/shared/sales/sales-stage-pill.tsx
import { PiCheck } from 'react-icons/pi';
import type {
  OrderStatus,
  QuoteStatus,
} from '@/services/salesOrder.service';

export type CreateTab = 'lines' | 'other';

/** Non-interactive lifecycle-stage indicator — visual parity only, no click behavior. */
export function StagePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {label}
    </span>
  );
}

/** The document lifecycle steps, in order. */
export const SALES_STEPS = ['Quotation', 'Quotation Sent', 'Sales Order'] as const;

/**
 * Index into SALES_STEPS for a loaded document. A quotation sits on step 0
 * until it is sent (1); any sales-order doc has reached the final step (2).
 */
export function salesStepIndex(
  docType?: 'quotation' | 'order',
  quoteStatus?: QuoteStatus,
  _orderStatus?: OrderStatus
): number {
  if (docType === 'order') return 2;
  if (quoteStatus === 'converted') return 2;
  if (
    quoteStatus === 'sent' ||
    quoteStatus === 'accepted' ||
    quoteStatus === 'expired' ||
    quoteStatus === 'rejected'
  )
    return 1;
  return 0;
}

/**
 * Connected step indicator for the quotation → sales-order lifecycle:
 * numbered circles joined by lines — completed steps show a check, the current
 * step is highlighted, upcoming ones stay muted. Replaces the old flat pill
 * row so operators can read progress at a glance.
 */
export function SalesSteps({
  steps = SALES_STEPS,
  current,
}: {
  steps?: readonly string[];
  /** Index of the step the document is currently sitting on. */
  current: number;
}) {
  return (
    <ol className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const activeStep = i === current;
        const last = i === steps.length - 1;
        return (
          <li key={label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  done
                    ? 'bg-brand text-white'
                    : activeStep
                      ? 'bg-brand/10 text-brand ring-2 ring-brand/40'
                      : 'bg-gray-100 text-gray-400'
                }`}
                title={label}
              >
                {done ? <PiCheck className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={`hidden whitespace-nowrap text-xs font-medium sm:inline ${
                  done || activeStep ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {!last && (
              <span
                aria-hidden
                className={`mx-2 h-px w-6 ${done ? 'bg-brand/50' : 'bg-gray-200'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
