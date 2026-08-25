'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiCaretLeft, PiCaretRight, PiMagnifyingGlass } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  arApService,
  type AccountingCustomer,
  type AccountingProduct,
  type AccountingVendor,
} from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

function useDirectory<T>(fetcher: (token: string, params: Record<string, unknown>) => Promise<{ data: T[]; pagination?: { pages: number } }>, deps: unknown[]) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetcher(token, { page, limit: 50, search: search || undefined });
      setRows(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, search, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, page, pages, search, setSearch, setPage };
}

function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (f: (p: number) => number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage((p) => p - 1)}
        className="rounded border border-gray-300 p-1.5 disabled:opacity-40"
        aria-label="Previous page"
      >
        <PiCaretLeft size={14} />
      </button>
      <span className="text-gray-600">Page {page} of {pages}</span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => setPage((p) => p + 1)}
        className="rounded border border-gray-300 p-1.5 disabled:opacity-40"
        aria-label="Next page"
      >
        <PiCaretRight size={14} />
      </button>
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative ml-auto">
      <PiMagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        placeholder="Search…"
        className={`${SELECT_CLS} w-56 pl-8`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** /accounting/customers — directory with outstanding balances. */
export function CustomersView() {
  const { rows, loading, page, pages, search, setSearch, setPage } = useDirectory<AccountingCustomer>(
    (t, p) => arApService.customers(t, p as never),
    []
  );
  return (
    <div>
      <div className="mb-3 flex items-center">
        <SearchBox value={search} onChange={setSearch} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 text-right">Wallet</th>
              <th className="px-4 py-3 text-right">Lifetime</th>
              <th className="px-4 py-3 text-right">Open Invoices</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No customers found.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{`${c.firstName} ${c.lastName}`.trim()}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || c.email || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(c.walletBalance)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(c.totalSpent)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.openInvoices}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${c.outstanding > 0 ? 'text-[#b20202]' : 'text-gray-400'}`}>
                  {fmtMoney(c.outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} setPage={setPage} />
    </div>
  );
}

/** /accounting/vendors — directory with outstanding balances. */
export function VendorsView() {
  const { rows, loading, page, pages, search, setSearch, setPage } = useDirectory<AccountingVendor>(
    (t, p) => arApService.vendors(t, p as never),
    []
  );
  return (
    <div>
      <div className="mb-3 flex items-center">
        <SearchBox value={search} onChange={setSearch} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Terms</th>
              <th className="px-4 py-3 text-right">Open Bills</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No vendors found.</td></tr>
            )}
            {rows.map((v) => (
              <tr key={v._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3 text-gray-500">{v.phone || v.email || '—'}</td>
                <td className="px-4 py-3 uppercase">{(v.paymentTerms || '—').replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-right tabular-nums">{v.openBills}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${v.outstanding > 0 ? 'text-[#b20202]' : 'text-gray-400'}`}>
                  {fmtMoney(v.outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} setPage={setPage} />
    </div>
  );
}

/** /accounting/products — light sellable-product browser. */
export function ProductsView() {
  const { rows, loading, page, pages, search, setSearch, setPage } = useDirectory<AccountingProduct>(
    (t, p) => arApService.products(t, p as never),
    []
  );
  return (
    <div>
      <div className="mb-3 flex items-center">
        <SearchBox value={search} onChange={setSearch} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Availability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No products found.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 tabular-nums text-gray-500">{p.sku || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(p.sellingPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.stockQuantity}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.availability ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.availability ? 'Available' : 'Unavailable'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} setPage={setPage} />
    </div>
  );
}
