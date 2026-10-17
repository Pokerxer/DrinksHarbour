'use client';
import NumberInput from '@/components/ui/number-input';
import {
  convertDiscount,
  lineAmounts,
} from '../../../../../../../packages/sales-money';
import type { DraftLine, PricedLine } from './sales-line-types';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
const field =
  'w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-right text-sm focus:border-brand focus:outline-none';
export default function SalesLineInputs({
  line,
  onUpdate,
}: {
  line: PricedLine;
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
}) {
  const amount = lineAmounts(line);
  return (
    <>
      <td data-label="Discount" className="px-2 py-2 align-top">
        <div className="flex min-w-0 items-center justify-end gap-1">
          <NumberInput
            key={line.discountType}
            title={`Line discount for ${line.name}`}
            value={line.discount}
            min={0}
            max={line.discountType === 'percentage' ? 100 : amount.gross}
            step="any"
            onCommit={(value) => onUpdate(line.key, { discount: value })}
            className={`${field} min-w-0 flex-1`}
          />
          <button
            type="button"
            aria-label={`Discount type for ${line.name}`}
            title={`Switch to ${line.discountType === 'fixed' ? 'percentage' : 'fixed amount'} discount`}
            onClick={() =>
              onUpdate(
                line.key,
                convertDiscount(
                  line,
                  line.discountType === 'fixed' ? 'percentage' : 'fixed',
                ),
              )
            }
            className="shrink-0 rounded border border-gray-200 px-1 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {line.discountType === 'percentage' ? '%' : '₦'}
          </button>
        </div>
        {line.discount > 0 && line.discountType === 'percentage' && (
          <p className="mt-0.5 text-right text-[10px] text-gray-400">
            −
            {fmtCur(
              Math.max(0, line.unitPrice * line.quantity - line.lineTotal),
              'NGN',
            )}
          </p>
        )}
      </td>
      <td data-label="Tax %" className="px-2 py-2 align-top">
        <NumberInput
          title={`Tax rate for ${line.name}`}
          value={line.taxRate}
          min={0}
          max={100}
          step="0.01"
          onCommit={(value) => onUpdate(line.key, { taxRate: value })}
          className={field}
        />
        <p className="mt-1 text-right text-[10px] text-gray-500">
          {fmtCur(line.taxAmount, 'NGN')} tax
        </p>
      </td>
    </>
  );
}
