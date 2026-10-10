'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { draftKey, prepareDraft, type OrderGroup } from './order-draft';
import {
  selectOrderGroups,
  currencyTotals,
  type OrderSort,
} from './vendor-order-rules';
import VendorOrderCard from './vendor-order-card';
import { money } from '../insights/presentation';
export default function VendorOrderGroups({
  groups,
  coverDays,
  disabled,
}: {
  groups: OrderGroup[];
  coverDays: number;
  disabled: boolean;
}) {
  const router = useRouter(),
    { data: session } = useSession();
  const [error, setError] = useState(''),
    [preparing, setPreparing] = useState<string | null>(null),
    [query, setQuery] = useState(''),
    [currency, setCurrency] = useState('all'),
    [sort, setSort] = useState<OrderSort>('priority'),
    [page, setPage] = useState(1);
  const currencies = currencyTotals(groups);
  const activeCurrency = currencies.some((c) => c.currency === currency)
    ? currency
    : 'all';
  const visible = selectOrderGroups(groups, query, activeCurrency, sort),
    pages = Math.max(1, Math.ceil(visible.length / 20)),
    active = Math.min(page, pages);
  const prepare = (group: OrderGroup) => {
    if (disabled || preparing) return;
    setPreparing(group.key);
    setError('');
    try {
      if (!session?.user?.tenantId || !session.user.id)
        throw new Error('Sign in to your tenant before preparing a purchase.');
      const scope = `${session.user.id}:${session.user.tenantId}`;
      sessionStorage.setItem(
        draftKey(scope),
        JSON.stringify(prepareDraft(group, scope, Date.now(), coverDays))
      );
      router.push('/purchases/create?restock=1');
    } catch (e) {
      setPreparing(null);
      setError(e instanceof Error ? e.message : 'Unable to prepare purchase.');
    }
  };
  if (!groups.length) return null;
  const field =
    'mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20';
  return (
    <section aria-label="Supplier order plans" className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Supplier orders</h2>
            <p className="mt-1 text-xs text-gray-500">
              {visible.length} of {groups.length} orders · {coverDays} days
              target stock cover
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {currencies.map((c) => (
              <span key={c.currency}>
                {money(c.total, c.currency)}{' '}
                <span className="text-xs font-normal text-gray-500">
                  {c.currency} subtotal
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_160px_220px]">
          <label className="text-xs font-semibold text-gray-700">
            Find an order
            <div className="mt-2 rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary/20">
              <input
                aria-label="Search vendor orders"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Supplier, warehouse, product or SKU…"
                className="h-11 w-full rounded-lg bg-transparent px-3 text-sm font-normal outline-none"
              />
            </div>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Currency
            <select
              aria-label="Order currency"
              value={activeCurrency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setPage(1);
              }}
              className={field}
            >
              <option value="all">All currencies</option>
              {currencies.map((c) => (
                <option key={c.currency}>{c.currency}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Sort orders
            <select
              aria-label="Sort vendor orders"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as OrderSort);
                setPage(1);
              }}
              className={field}
            >
              <option value="priority">Most urgent first</option>
              <option value="supplier">Supplier name</option>
              <option value="units">Most order units</option>
              <option value="cost">Highest subtotal per currency</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Order filters only change which groups are shown. Preparing a group
          includes all its products. Currency subtotals above include all
          reviewed orders.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {visible.slice((active - 1) * 20, active * 20).map((g) => (
        <VendorOrderCard
          key={g.key}
          group={g}
          disabled={disabled || !!preparing}
          preparing={preparing === g.key}
          onPrepare={() => prepare(g)}
        />
      ))}
      {!visible.length && (
        <p className="rounded-xl border p-5 text-sm text-gray-500">
          No matching supplier orders. Change the order search or currency
          filter.
        </p>
      )}
      {pages > 1 && (
        <div className="flex justify-end gap-4 text-sm">
          <button
            type="button"
            disabled={active === 1}
            onClick={() => setPage(active - 1)}
          >
            Previous orders
          </button>
          <span>
            {active} / {pages}
          </span>
          <button
            type="button"
            disabled={active === pages}
            onClick={() => setPage(active + 1)}
          >
            Next orders
          </button>
        </div>
      )}
    </section>
  );
}
