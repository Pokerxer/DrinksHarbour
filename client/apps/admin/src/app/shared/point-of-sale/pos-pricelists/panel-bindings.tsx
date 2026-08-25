'use client';

import type { Pricelist } from './types';

interface Option {
  _id: string;
  name: string;
}

interface Props {
  shopOptions: Option[];
  whOptions: Option[];
  boundShops: string[];
  boundWarehouses: string[];
  customerTagsInput: string;
  selectable?: boolean;
  onToggleShop(id: string): void;
  onToggleWarehouse(id: string): void;
  onTagsChange(v: string): void;
}

export default function PanelBindings({
  shopOptions,
  whOptions,
  boundShops,
  boundWarehouses,
  customerTagsInput,
  selectable,
  onToggleShop,
  onToggleWarehouse,
  onTagsChange,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-start gap-x-6 gap-y-2 border-b border-gray-100 px-4 py-2.5 text-[11px]">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Applies to shops
        </span>
        <div className="flex flex-wrap gap-1.5">
          {shopOptions.length === 0 && (
            <span className="text-gray-300">No shops</span>
          )}
          {shopOptions.map((s) => {
            const on = boundShops.includes(s._id);
            return (
              <button
                key={s._id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleShop(s._id)}
                className={`rounded-full border px-2 py-0.5 font-semibold transition-colors ${
                  on
                    ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Applies to warehouses
        </span>
        <div className="flex flex-wrap gap-1.5">
          {whOptions.length === 0 && (
            <span className="text-gray-300">No warehouses</span>
          )}
          {whOptions.map((w) => {
            const on = boundWarehouses.includes(w._id);
            return (
              <button
                key={w._id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleWarehouse(w._id)}
                className={`rounded-full border px-2 py-0.5 font-semibold transition-colors ${
                  on
                    ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {w.name}
              </button>
            );
          })}
        </div>
      </div>

      {boundShops.length === 0 && boundWarehouses.length === 0 && selectable && (
        <span className="self-center text-[10px] italic text-gray-400">
          Unscoped — offered everywhere as a manual option.
        </span>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Customer tags
        </span>
        <input
          type="text"
          aria-label="Customer tags"
          value={customerTagsInput}
          onChange={(e) => onTagsChange(e.target.value)}
          placeholder="wholesale, vip, …"
          className="h-7 w-48 rounded-lg border border-gray-200 px-2 text-[11px] text-gray-700 outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/10"
        />
        <span className="text-[9px] text-gray-300">Blank = all customers</span>
      </div>
    </div>
  );
}
