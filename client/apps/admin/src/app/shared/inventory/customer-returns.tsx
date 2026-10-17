'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import type {
  CustomerReturn,
  ReturnFilters,
} from '@/services/customerReturns.service';
import { requestDocumentExport } from '@/utils/print/document-export';
import { buildCustomerReturn } from '@/utils/print/customer-return';
import { useCustomerReturns } from './use-customer-returns';
import CustomerReturnFilters from './customer-return-filters';
import CustomerReturnList from './customer-return-list';
import CustomerReturnDetail from './customer-return-detail';
const button =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40';
export default function CustomerReturns({ invoiceId }: { invoiceId?: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string } | undefined)?.token || '';
  if (status === 'loading')
    return (
      <p role="status" className="p-6">
        Loading customer returns…
      </p>
    );
  if (!token)
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">
          Sign in to view customer returns
        </h1>
        <Link href={routes.signIn} className="text-brand">
          Sign in
        </Link>
      </div>
    );
  return (
    <ReturnWorkspace
      key={`${token}:${invoiceId || ''}`}
      token={token}
      invoiceId={invoiceId}
    />
  );
}
function ReturnWorkspace({
  token,
  invoiceId,
}: {
  token: string;
  invoiceId?: string;
}) {
  const [filters, setFilters] = useState<ReturnFilters>({
    page: 1,
    ...(invoiceId ? { invoice: invoiceId } : {}),
  });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerReturn | null>(null);
  const [printError, setPrintError] = useState('');
  const { data, loading, error, refresh } = useCustomerReturns(token, filters);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((previous) =>
          (previous.search || '') === search
            ? previous
            : { ...previous, search, page: 1 }
        ),
      300
    );
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setSelected(null);
    setPrintError('');
  }, [data, filters]);
  const change = (value: Partial<ReturnFilters>) =>
    setFilters((previous) => ({ ...previous, ...value, page: 1 }));
  const print = (rows: CustomerReturn[], scope: string) => {
    if (!data || loading || error) return;
    try {
      setPrintError('');
      requestDocumentExport(buildCustomerReturn(rows, data.issuer, scope));
    } catch (failure) {
      setPrintError(
        failure instanceof Error
          ? failure.message
          : 'Could not open the return note'
      );
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Customer Returns
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Returned Sales and POS goods, with their stock disposition.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={routes.eCommerce.createSalesReturn} className={button}>
            Return a Sales order
          </Link>
          <Link href={routes.pos.orders} className={button}>
            Return a POS order
          </Link>
          <button
            type="button"
            className={button}
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            className={button}
            disabled={!data?.rows.length || loading || !!error}
            onClick={() =>
              data &&
              print(
                data.rows,
                `Loaded page ${filters.page} of ${data.pages}; ${data.rows.length} of ${data.total} matched lines`
              )
            }
          >
            Print this page
          </button>
        </div>
      </header>
      {filters.invoice && (
        <p className="mx-4 mb-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
          Returns for {data?.invoiceContext?.number || 'the selected invoice'}{' '}
          <button
            type="button"
            onClick={() => change({ invoice: '' })}
            className="ml-3 font-semibold underline"
          >
            Show all customer returns
          </button>
        </p>
      )}
      <CustomerReturnFilters
        filters={filters}
        search={search}
        onSearch={setSearch}
        locations={data?.locations || []}
        onChange={change}
      />
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-200 sm:grid-cols-4">
        {[
          ['Returned units', data?.summary.returned],
          ['Restocked units', data?.summary.restocked],
          ['Not-restocked units', data?.summary.notRestocked],
          ['Evidence to review', data?.summary.unverified],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-4 py-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {value === undefined ? '—' : Number(value).toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              All matched return lines
            </p>
          </div>
        ))}
      </div>
      {(error || printError) && (
        <div
          role="alert"
          className="m-4 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error || printError}
          <button
            type="button"
            onClick={() => (error ? void refresh() : setPrintError(''))}
            className="font-semibold underline"
          >
            {error ? 'Retry' : 'Dismiss'}
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="p-8 text-center text-sm text-gray-500">
          Loading return history…
        </p>
      ) : data?.rows.length ? (
        <CustomerReturnList rows={data.rows} onSelect={setSelected} />
      ) : (
        !error && (
          <div className="p-10 text-center">
            <p className="font-semibold text-gray-700">
              No customer returns match these filters
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Clear the filters or open an order to record a return.
            </p>
          </div>
        )
      )}
      {selected && data && !loading && (
        <CustomerReturnDetail
          row={selected}
          onClose={() => setSelected(null)}
          onPrint={() => print([selected], 'Selected return line')}
        />
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 text-xs text-gray-500">
        <span>
          {data
            ? `${data.total} matched return lines · Page ${filters.page} of ${data.pages}`
            : 'Return history'}{' '}
          · Unknown stock quantities are excluded from restocked totals.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={loading || filters.page <= 1}
            className={button}
            onClick={() =>
              setFilters((previous) => ({
                ...previous,
                page: previous.page - 1,
              }))
            }
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={loading || !data || filters.page >= data.pages}
            className={button}
            onClick={() =>
              setFilters((previous) => ({
                ...previous,
                page: previous.page + 1,
              }))
            }
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
