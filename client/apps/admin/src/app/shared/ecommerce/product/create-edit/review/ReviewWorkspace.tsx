'use client';
import { useMemo } from 'react';
import {
  inspectRows,
  filterRows,
  applyUnchangedSuggestions,
  type RowFilter,
} from './workspace';
import type { PriceDraft, PriceLine, PriceTargets, ReviewListing } from './types';
import ReviewTargets from './ReviewTargets';
import PricingCard from './PricingCard';
import { isCommission, agreedCommission } from './agreement';
export default function ReviewWorkspace({
  lines,
  listing,
  drafts,
  targets,
  onTargets,
  onEdit,
  onBatch,
  onReset,
  disabled,
  query,
  onQuery,
  filter,
  onFilter,
}: {
  lines: PriceLine[];
  listing: ReviewListing;
  drafts: Record<string, PriceDraft>;
  targets: PriceTargets;
  onTargets: (targets: PriceTargets) => void;
  onEdit: (id: string, field: keyof PriceDraft, value: string) => void;
  onBatch: (
    update: (previous: Record<string, PriceDraft>) => Record<string, PriceDraft>
  ) => void;
  onReset: (id?: string) => void;
  disabled: boolean;
  query: string;
  onQuery: (value: string) => void;
  filter: RowFilter;
  onFilter: (value: RowFilter) => void;
}) {
  const rows = useMemo(
    () => inspectRows(lines, drafts, listing, targets),
    [lines, drafts, listing, targets]
  );
  const visible = useMemo(
    () => filterRows(rows, query, filter),
    [rows, query, filter]
  );
  const edited = rows.filter((row) => row.changed).length;
  const attention = rows.filter((row) => row.attention).length;
  const blocked = rows.filter((row) => row.error).length;
  const proposed = applyUnchangedSuggestions(lines, drafts, listing, targets);
  const eligible = rows.filter(
    (row) => !row.changed && proposed[row.line.id]?.normal !== row.draft.normal
  ).length;
  const button =
    'min-h-11 rounded-lg border px-3 text-xs font-semibold hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
  return (
    <div className="min-w-0 space-y-4">
      <section
        aria-label="Price review controls"
        className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Price review</h2>
            <p className="mt-1 text-xs text-gray-500">
              {lines.length} price {lines.length === 1 ? 'row' : 'rows'} · {edited}{' '}
              edited · {blocked} blocked
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${blocked ? 'bg-red-50 text-red-700' : attention ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {blocked
              ? 'Resolve price issues'
              : attention
                ? 'Review margin notes'
                : 'Prices ready for review'}
          </span>
        </div>
        <label className="mt-4 block text-xs font-medium text-gray-500">
          Search sizes
          <input
            aria-label="Search sizes"
            placeholder="Size name or SKU"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Price filters">
          {(
            [
              ['all', 'All prices', rows.length],
              ['changed', 'Edited', edited],
              ['attention', 'Needs attention', attention],
              ['blocked', 'Blocked', blocked],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilter(value)}
              className={`${button} ${filter === value ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}
            >
              {label} <span className="ml-1 tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            aria-label="Apply suggestions to unchanged prices"
            disabled={disabled || !eligible}
            onClick={() =>
              onBatch((previous) =>
                applyUnchangedSuggestions(lines, previous, listing, targets)
              )
            }
            className="min-h-11 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
          >
            Apply suggestions · {eligible}
          </button>
          <button
            type="button"
            aria-label="Reset price edits"
            disabled={disabled || !edited}
            onClick={() => onReset()}
            className={`${button} border-gray-200 bg-white text-gray-600`}
          >
            Reset edits
          </button>
          <p className="text-xs leading-5 text-gray-400">
            Across all sizes. Manual edits are kept; rows needing separate pack
            review are skipped.
          </p>
        </div>
      </section>
      <ReviewTargets
        targets={targets}
        onChange={onTargets}
        disabled={disabled}
        commission={!!lines[0] && isCommission(lines[0], listing)}
        rate={
          lines[0] ? (agreedCommission(lines[0], listing) ?? undefined) : undefined
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p role="status">
          Showing {visible.length} of {rows.length} price rows
        </p>
        {(query || filter !== 'all') && (
          <button
            type="button"
            className="min-h-11 rounded px-2 text-blue-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => {
              onQuery('');
              onFilter('all');
            }}
          >
            Clear price filters
          </button>
        )}
      </div>
      <p className="text-xs leading-5 text-gray-400">
        Per sellable unit. Gross estimates exclude taxes, payment fees, delivery and
        operating costs.
      </p>
      {visible.length ? (
        <div className="grid items-start gap-4 2xl:grid-cols-2">
          {visible.map((row) => (
            <PricingCard
              key={row.line.id}
              line={row.line}
              listing={listing}
              draft={row.draft}
              targets={targets}
              onEdit={(field, value) => onEdit(row.line.id, field, value)}
              disabled={disabled}
              changed={row.changed}
              onReset={() => onReset(row.line.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-500">
          No price rows match this view.
        </div>
      )}
    </div>
  );
}
