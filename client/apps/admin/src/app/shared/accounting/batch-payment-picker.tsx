import Link from 'next/link';
import { useState } from 'react';
import type { BatchMember } from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
export default function BatchPaymentPicker({
  rows,
  selected,
  toggle,
  search,
  changeSearch,
  loading,
  disabled,
}: {
  rows: BatchMember[];
  selected: Map<string, BatchMember>;
  toggle: (member: BatchMember) => void;
  search: string;
  changeSearch: (value: string) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(search);
  return (
    <div className="mt-4 space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          changeSearch(draft.trim());
        }}
      >
        <input
          aria-label="Search eligible payments"
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Receipt, payment or name"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Search
        </button>
      </form>
      {loading && (
        <p role="status" className="text-xs text-gray-500">
          Loading eligible payments…
        </p>
      )}
      <div className="max-h-72 divide-y overflow-y-auto rounded-xl border">
        {rows.map((row) => (
          <div key={row.key} className="p-3">
            <label className="flex items-start justify-between gap-3">
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  disabled={disabled || loading}
                  checked={selected.has(row.key)}
                  onChange={() => toggle(row)}
                  className="mt-1 h-4 w-4 rounded"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    {row.number}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {row.name} ·{' '}
                    {row.origin === 'pos'
                      ? 'POS'
                      : row.origin === 'sales'
                        ? 'Sales'
                        : 'Accounting'}{' '}
                    · {fmtDate(row.date)}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Captured {fmtMoney(row.capturedAmount)} · Refunds{' '}
                    {fmtMoney(row.refundedAmount)}
                  </span>
                </span>
              </span>
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                {fmtMoney(row.amount)}
              </span>
            </label>
            {row.invoice && (
              <Link
                href={row.invoice.href}
                className="ml-7 mt-1 block text-xs underline"
              >
                {row.invoice.label}
              </Link>
            )}
            {row.allocations?.map(
              (allocation, index) =>
                allocation.document && (
                  <Link
                    key={index}
                    href={allocation.document.href}
                    className="ml-7 mt-1 block text-xs underline"
                  >
                    {allocation.document.label}
                  </Link>
                )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
