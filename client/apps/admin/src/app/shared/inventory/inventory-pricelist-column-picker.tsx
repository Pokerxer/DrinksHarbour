'use client';
import Link from 'next/link';
import { routes } from '@/config/routes';
import {
  pricelistRuleCount,
  type PricelistLite,
} from './inventory-pricelist-print';
import {
  togglePriceColumn,
  movePriceColumn,
  type ColumnSelection,
} from './inventory-pricelist-settings';

interface Props {
  pricelists: PricelistLite[];
  loading: boolean;
  columns: ColumnSelection[];
  onChange: (columns: ColumnSelection[]) => void;
}
export default function PricelistColumnPicker({
  pricelists,
  loading,
  columns,
  onChange,
}: Props) {
  const sources = [
    { _id: '', name: 'Recommended Sales Price', rules: [] },
    ...pricelists,
  ];
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700">Price columns</h3>
        <Link href={routes.pos.pricelists} className="text-xs text-[#b20202]">
          Manage pricelists →
        </Link>
      </div>
      <p className="text-xs text-gray-500">
        Select up to four columns. Each uses its own pricelist rules.
        Recommended Sales Price uses catalogue selling prices.
      </p>
      {loading ? (
        <p className="text-xs text-gray-500">Loading pricelists…</p>
      ) : (
        <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {sources.map((p) => {
            const active = columns.some((c) => c.plId === p._id);
            return (
              <button
                key={p._id || 'retail'}
                type="button"
                aria-pressed={active}
                disabled={!active && columns.length === 4}
                onClick={() =>
                  onChange(
                    togglePriceColumn(columns, {
                      plId: p._id,
                      label: p.name,
                      mode: p._id ? 'auto' : 'unit',
                    })
                  )
                }
                className={`rounded-lg border px-3 py-2 text-left text-xs disabled:opacity-40 ${active ? 'border-[#b20202] bg-red-50' : 'border-gray-200'}`}
              >
                <span className="block font-semibold">
                  {active ? '✓ ' : ''}
                  {p.name}
                </span>
                <span className="text-gray-500">
                  {p._id
                    ? `${pricelistRuleCount(p)} rules · ${p.currency || 'NGN'}`
                    : 'Per unit · NGN'}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {columns.length === 0 && (
        <p className="text-xs text-amber-700">
          Select at least one price column.
        </p>
      )}
      {columns.map((column, index) => (
        <div
          key={column.plId || 'retail'}
          className="space-y-2 rounded-lg border border-gray-200 p-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">
              {index + 1}.
            </span>
            <input
              aria-label={`Column ${index + 1} heading`}
              value={column.label}
              placeholder={
                sources.find((p) => p._id === column.plId)?.name ??
                'Column heading'
              }
              onChange={(e) =>
                onChange(
                  columns.map((c, i) =>
                    i === index ? { ...c, label: e.target.value } : c
                  )
                )
              }
              className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
            />
            <button
              type="button"
              aria-label={`Move column ${index + 1} up`}
              disabled={index === 0}
              onClick={() => onChange(movePriceColumn(columns, index, -1))}
              className="px-1 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move column ${index + 1} down`}
              disabled={index === columns.length - 1}
              onClick={() => onChange(movePriceColumn(columns, index, 1))}
              className="px-1 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Remove column ${index + 1}`}
              onClick={() => onChange(columns.filter((_, i) => i !== index))}
              className="px-1"
            >
              ×
            </button>
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-gray-500">
            {sources.find((p) => p._id === column.plId)?.name ??
              'Unavailable pricelist'}
            <select
              aria-label={`Column ${index + 1} pricing`}
              value={column.mode}
              onChange={(e) =>
                onChange(
                  columns.map((c, i) =>
                    i === index
                      ? {
                          ...c,
                          mode: e.target.value as ColumnSelection['mode'],
                        }
                      : c
                  )
                )
              }
              className="rounded border border-gray-200 px-2 py-1 text-xs"
            >
              <option value="auto">Bundle total when available</option>
              <option value="unit">Unit price</option>
              <option value="bundle">Pack / bundle total</option>
            </select>
          </label>
        </div>
      ))}
      <p className="text-[11px] text-gray-500">
        Pack totals use the size’s units per pack, or an eligible bundle’s
        quantity. If no rule covers a product, its saved wholesale price is used
        and labelled in the preview and exported document.
      </p>
    </section>
  );
}
