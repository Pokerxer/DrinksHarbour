'use client';

import {
  PiStar,
  PiStarFill,
  PiTrash,
  PiWarningCircle,
} from 'react-icons/pi';
import { lineDelta, netPrice, type EditorLine } from './helpers';
import { fmtCur } from '../purchases-analytics-helpers';
import { fraunces } from '../purchases-fonts';
import DeltaBadge from './delta-badge';

const inputCls = (invalid: boolean) =>
  `w-full rounded border px-2 py-1 text-right text-xs tabular-nums focus:outline-none ${
    invalid
      ? 'border-red-300 bg-red-50/60 focus:border-red-400'
      : 'border-[#ece4d6] focus:border-[#b20202]'
  }`;

export function LineItemsRow({
  line,
  index,
  invalid,
  isDupe,
  historyOpen,
  currency,
  onToggleHistory,
  onUpdate,
  onRemove,
  onTogglePreferred,
}: {
  line: EditorLine;
  index: number;
  invalid: boolean;
  isDupe: boolean;
  historyOpen: boolean;
  currency: string;
  onToggleHistory: () => void;
  onUpdate: (patch: Partial<EditorLine>) => void;
  onRemove: () => void;
  onTogglePreferred: () => void;
}) {
  return (
    <tr
      className={
        invalid ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-[#FAF8F3]/60'
      }
    >
      <td className="px-4 py-2">
        {line.subProductId ? (
          <>
            <p className="font-medium text-[#2a2420]">
              {line.subProductName || line.productName}
            </p>
            <p className="text-[11px] text-gray-400">
              {[line.sizeName, line.sku].filter(Boolean).join(' · ') || '—'}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <DeltaBadge delta={lineDelta(line)} />
              {isDupe && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                  title="This product+size appears in more than one line"
                >
                  <PiWarningCircle className="h-2.5 w-2.5" /> Duplicate
                </span>
              )}
              {line.priceHistory && line.priceHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onToggleHistory}
                  className="text-[10px] font-medium text-gray-400 underline-offset-2 hover:text-[#b20202] hover:underline"
                >
                  {historyOpen
                    ? 'Hide history'
                    : `History (${line.priceHistory.length})`}
                </button>
              )}
            </div>
          </>
        ) : (
          <input
            value={line.productName}
            onChange={(e) => onUpdate({ productName: e.target.value })}
            placeholder="Product name"
            aria-label={`Line ${index + 1} product name`}
            className={`w-44 rounded border px-2 py-1 text-xs focus:outline-none ${
              invalid && !(line.productName ?? '').trim()
                ? 'border-red-300 bg-red-50/60 focus:border-red-400'
                : 'border-[#ece4d6] focus:border-[#b20202]'
            }`}
          />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="0.01"
          value={line.unitPrice}
          onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) })}
          aria-label={`Line ${index + 1} unit price`}
          className={inputCls(invalid && !(Number(line.unitPrice) > 0))}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={line.discountPercent}
          onChange={(e) => onUpdate({ discountPercent: Number(e.target.value) })}
          aria-label={`Line ${index + 1} discount percent`}
          className={inputCls(false)}
        />
      </td>
      <td
        className={`${fraunces.className} px-3 py-2 text-right font-semibold tabular-nums text-[#2a2420]`}
      >
        {fmtCur(netPrice(line), currency)}
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="1"
          value={line.minQuantity ?? 1}
          onChange={(e) => onUpdate({ minQuantity: Number(e.target.value) })}
          aria-label={`Line ${index + 1} minimum quantity`}
          className={inputCls(false)}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          value={line.maxQuantity ?? ''}
          onChange={(e) =>
            onUpdate({
              maxQuantity: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          placeholder="∞"
          aria-label={`Line ${index + 1} maximum quantity`}
          className={inputCls(false)}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          value={line.leadTimeDays ?? 0}
          onChange={(e) => onUpdate({ leadTimeDays: Number(e.target.value) })}
          aria-label={`Line ${index + 1} lead time days`}
          className={inputCls(false)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={line.packaging ?? ''}
          onChange={(e) => onUpdate({ packaging: e.target.value })}
          placeholder="carton…"
          aria-label={`Line ${index + 1} packaging`}
          className="w-full rounded border border-[#ece4d6] px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={onTogglePreferred}
          title={line.isPreferred ? 'Preferred vendor line' : 'Mark preferred'}
          aria-label={line.isPreferred ? 'Unmark preferred' : 'Mark preferred'}
          className="text-gray-300 transition-colors hover:text-[#c8932c]"
        >
          {line.isPreferred ? (
            <PiStarFill className="h-4 w-4 text-[#c8932c]" />
          ) : (
            <PiStar className="h-4 w-4" />
          )}
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <PiTrash className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
