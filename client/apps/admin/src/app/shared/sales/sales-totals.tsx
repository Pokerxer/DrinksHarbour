'use client';
import type { SalesTotalsProps } from './sales-totals-types';
import SalesTotalActions from './sales-total-actions';
import SalesTotalsSummary from './sales-totals-summary';
export type { SalesTotalsProps, SalesTotalsCoupon } from './sales-totals-types';
export default function SalesTotals(props: SalesTotalsProps) {
  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-xs text-gray-500">
          {props.onOpenTerms && (
            <button
              type="button"
              onClick={props.onOpenTerms}
              className="font-medium text-brand underline"
            >
              Edit terms and conditions
            </button>
          )}
        </div>
        <div className="w-full max-w-md space-y-3">
          <SalesTotalActions {...props} />
          <SalesTotalsSummary {...props} />
        </div>
      </div>
    </div>
  );
}
