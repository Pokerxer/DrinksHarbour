'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import {
  PiMagnifyingGlassBold,
  PiArrowClockwiseBold,
  PiShoppingCartBold,
  PiUserPlusBold,
  PiWarningBold,
  PiInfoBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  adminCartService,
  type AdminCartListParams,
  type AdminCartListResult,
  type CartBucket,
  type RegistrationWindow,
} from '@/services/adminCart.service';
import CartStatsCards from './cart-stats-cards';
import CartTableRow from './cart-table-row';
import SignupTableRow from './signup-table-row';
import TablePagination from '../order/order-list/table-pagination';

const PAGE_SIZE = 20;

function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-muted">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

/**
 * The /ecommerce/carts page. Two views over the same endpoint:
 *
 *  - **Live carts** (default): marketplace carts that have not become orders
 *    yet, with the lines this tenant can actually sell.
 *  - **New customers**: shoppers who registered inside a window, shown whether
 *    or not they have a cart. A shopper with no cart produces no Cart document
 *    at all, so the live-carts view is structurally blind to them — which is
 *    exactly the segment worth chasing.
 *
 * Mirrors the orders table's data discipline — debounced search, one request
 * per settled param set, abort on unmount — because this is the sibling of
 * /ecommerce/orders in the sidebar and any difference in behaviour reads as a
 * bug.
 */
export default function CartTable({ className }: { className?: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [result, setResult] = useState<AdminCartListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [bucket, setBucket] = useState<'' | CartBucket>('');
  const [mode, setMode] = useState<'carts' | 'newCustomers'>('carts');
  const [regWindow, setRegWindow] = useState<RegistrationWindow>('30');
  const [sortField, setSortField] =
    useState<NonNullable<AdminCartListParams['sort']>>('updatedAt');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const token = (session?.user as { token?: string } | undefined)?.token ?? '';

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params: AdminCartListParams = useMemo(() => {
    if (mode === 'newCustomers') {
      return {
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        newCustomers: 1,
        registeredWithin: regWindow,
      };
    }
    return {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      bucket: bucket || undefined,
      sort: sortField,
      order: 'desc',
    };
  }, [page, debouncedSearch, bucket, sortField, mode, regWindow]);

  // Filter changes reset to page 1, kept out of the fetch effect so they can't
  // fire a second request for the page being abandoned.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, bucket, sortField, mode, regWindow]);

  useEffect(() => {
    if (
      sessionStatus === 'unauthenticated' ||
      (sessionStatus === 'authenticated' && !token)
    ) {
      setLoading(false);
      setRefreshing(false);
      setError('You are not signed in.');
      return;
    }
    if (sessionStatus !== 'authenticated') return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setError('');
      try {
        const res = await adminCartService.getCarts(
          token,
          params,
          controller.signal
        );
        if (cancelled) return;
        setResult(res);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        setError(e.message || 'Failed to load carts');
        toast.error('Failed to load carts');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionStatus, token, params, reloadToken]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken((t) => t + 1);
  }, []);

  /**
   * Hand the shopper off to the quotation builder. The sales create page finds
   * the matching POSCustomer itself and offers "Import from marketplace cart",
   * which is the path that reprices these lines — so this deep-links by email
   * rather than trying to rebuild the cart from here.
   *
   * Widened to any row carrying a `user`, so a signup (which has no cart to
   * import, only a contact to quote) uses the identical handoff.
   */
  const handleCreateQuotation = useCallback(
    (row: { user: { email?: string; phone?: string } }) => {
      const q = row.user.email || row.user.phone;
      router.push(
        q
          ? `${routes.eCommerce.createSale}?customer=${encodeURIComponent(q)}`
          : routes.eCommerce.createSale
      );
    },
    [router]
  );

  const rows = result?.rows ?? [];
  const busy = loading || sessionStatus === 'loading';
  const isNewCustomers = mode === 'newCustomers';
  const hasFilters = Boolean(search || bucket || isNewCustomers);

  return (
    <div className={className}>
      <CartStatsCards
        summary={result?.summary ?? null}
        mode={mode}
        active={bucket}
        headlineShoppers={result?.headline?.shoppers ?? null}
        loading={busy}
        onFilter={setBucket}
        onToggleNew={() => {
          setMode((m) => (m === 'newCustomers' ? 'carts' : 'newCustomers'));
          setBucket('');
        }}
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-muted bg-gray-0 p-3">
        <div className="relative min-w-[220px] flex-1">
          <PiMagnifyingGlassBold className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isNewCustomers
                ? 'Search new customers by name, email or phone…'
                : 'Search shopper by name, email or phone…'
            }
            aria-label={
              isNewCustomers
                ? 'Search new customers'
                : 'Search carts by shopper'
            }
            className="w-full rounded-xl border border-muted bg-gray-0 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {isNewCustomers ? (
          <select
            value={regWindow}
            onChange={(e) =>
              setRegWindow(e.target.value as RegistrationWindow)
            }
            aria-label="Registration window"
            className="rounded-xl border border-muted bg-gray-0 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        ) : (
          <select
            value={sortField}
            onChange={(e) =>
              setSortField(e.target.value as AdminCartListParams['sort'] as any)
            }
            aria-label="Sort carts"
            className="rounded-xl border border-muted bg-gray-0 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="updatedAt">Most recent</option>
            <option value="value">Highest value</option>
            <option value="items">Most items</option>
          </select>
        )}

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-muted px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary disabled:opacity-50"
        >
          <PiArrowClockwiseBold
            className={cn('h-4 w-4', refreshing && 'animate-spin')}
          />
          Refresh
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setBucket('');
              setMode('carts');
              setRegWindow('30');
            }}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {busy
            ? '—'
            : `${result?.pagination.total ?? 0} ${
                isNewCustomers ? 'shoppers' : 'carts'
              }`}
        </span>
      </div>

      {/* Caveats the server flagged — never silently swallowed. Suppressed in
          new-customer mode, which offers no page-local sort. */}
      {!busy &&
        result &&
        !isNewCustomers &&
        (result.sortScope === 'page' || result.searchTruncated) && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <PiInfoBold className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {result.sortScope === 'page' && (
                <>
                  Value and item-count sorts order the current page only — they
                  are derived per-store, so the database cannot sort by them.{' '}
                </>
              )}
              {result.searchTruncated && (
                <>That search matched too many shoppers to include them all.</>
              )}
            </span>
          </div>
        )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-gray-0 p-12 text-center">
          <PiWarningBold className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="mb-2 text-lg font-bold text-red-600">
            Failed to load carts
          </p>
          <p className="mb-6 text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-muted bg-gray-0 shadow-sm">
          {busy ? (
            <RowSkeleton />
          ) : rows.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-16 text-center"
            >
              {isNewCustomers ? (
                <PiUserPlusBold className="mx-auto mb-4 h-16 w-16 text-gray-200" />
              ) : (
                <PiShoppingCartBold className="mx-auto mb-4 h-16 w-16 text-gray-200" />
              )}
              <p className="mb-1 text-xl font-bold text-gray-700">
                {isNewCustomers
                  ? 'No new customers in this window'
                  : 'No live carts'}
              </p>
              <p className="text-sm text-gray-400">
                {hasFilters && !isNewCustomers
                  ? 'Try adjusting your filters.'
                  : isNewCustomers
                    ? 'Widen the window to see customers who registered earlier.'
                    : 'Carts appear here as shoppers add your products on the marketplace.'}
              </p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 font-semibold">Shopper</th>
                    <th className="px-5 py-3 font-semibold">Contents</th>
                    <th className="px-5 py-3 font-semibold">Value</th>
                    <th className="px-5 py-3 font-semibold">
                      {isNewCustomers ? 'Joined' : 'Last activity'}
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) =>
                    row.kind === 'cart' ? (
                      <CartTableRow
                        key={row._id}
                        cart={row}
                        index={i}
                        onCreateQuotation={handleCreateQuotation}
                      />
                    ) : (
                      <SignupTableRow
                        key={row._id}
                        signup={row}
                        index={i}
                        onCreateQuotation={handleCreateQuotation}
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!busy && !error && (result?.pagination.pages ?? 1) > 1 && (
            <TablePagination
              page={result!.pagination.page}
              pages={result!.pagination.pages}
              total={result!.pagination.total}
              onPageChange={setPage}
              label={isNewCustomers ? 'shoppers' : 'carts'}
            />
          )}
        </div>
      )}
    </div>
  );
}