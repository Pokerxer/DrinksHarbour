'use client';

import { PiRobot } from 'react-icons/pi';
import type { VendorPricelist } from '@/services/vendorPricelist.service';
import { CURRENCIES } from './constants';

export const DATE_RANGE_HINT = 'End date must be on or after the start date';

/** True when both dates are set and end lands before start (day precision). */
export function dateRangeInvalid(start?: string, end?: string): boolean {
  const s = start?.slice(0, 10);
  const e = end?.slice(0, 10);
  return Boolean(s && e && e < s);
}

const inputCls =
  'w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Editable metadata grid for a vendor pricelist (part of the saved form). */
export default function DetailMetadata({
  pl,
  onPatch,
}: {
  pl: VendorPricelist;
  onPatch: (p: Partial<VendorPricelist>) => void;
}) {
  const autoManaged = Boolean(pl.autoManaged || pl.source === 'auto');

  return (
    <div className="rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Pricelist Name">
          <input
            value={pl.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Vendor">
          <input
            value={pl.vendorName ?? ''}
            onChange={(e) => onPatch({ vendorName: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Currency">
          <select
            value={pl.currency}
            onChange={(e) => onPatch({ currency: e.target.value })}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Global Discount %">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={pl.discountPercent ?? 0}
            onChange={(e) =>
              onPatch({ discountPercent: Number(e.target.value) })
            }
            className={inputCls}
          />
        </Field>
        <Field label="Auto-managed">
          <button
            type="button"
            onClick={() => {
              const turningOn = !autoManaged;
              onPatch({
                autoManaged: turningOn,
                source: turningOn ? 'auto' : 'manual',
              });
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              autoManaged
                ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
                : 'border-[#ece4d6] text-gray-500 hover:bg-[#FAF8F3]'
            }`}
          >
            {autoManaged ? 'Auto-syncs from POs' : 'Manual (locked)'}
          </button>
        </Field>
        <Field label="Start Date">
          <input
            type="date"
            value={pl.startDate ? pl.startDate.slice(0, 10) : ''}
            onChange={(e) => onPatch({ startDate: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="End Date">
          <input
            type="date"
            value={pl.endDate ? pl.endDate.slice(0, 10) : ''}
            onChange={(e) => onPatch({ endDate: e.target.value })}
            aria-invalid={
              dateRangeInvalid(pl.startDate, pl.endDate) ? true : undefined
            }
            className={`${inputCls} ${
              dateRangeInvalid(pl.startDate, pl.endDate)
                ? 'border-red-300 focus:border-red-400 focus:ring-red-200/40'
                : ''
            }`}
          />
          {dateRangeInvalid(pl.startDate, pl.endDate) && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {DATE_RANGE_HINT}
            </p>
          )}
        </Field>
        <Field label="Notes">
          <input
            value={pl.notes ?? ''}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Optional notes…"
            className={inputCls}
          />
        </Field>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
        <PiRobot className="h-3 w-3" /> Auto-managed applies when you save — it
        is not toggled instantly.
      </p>
    </div>
  );
}
