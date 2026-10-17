'use client';
import { useEffect, useState } from 'react';
import { arApService, type AccountingCustomer } from '@/services/arAp.service';
export default function CreditCustomerSelect({
  token,
  value,
  onChange,
}: {
  token: string;
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const [customers, setCustomers] = useState<AccountingCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoading(true);
    setError('');
    arApService
      .customers(token, { limit: 100, page })
      .then((res) => {
        if (!active) return;
        setCustomers((old) =>
          page === 1
            ? res.data || []
            : [
                ...old,
                ...(res.data || []).filter(
                  (c) => !old.some((item) => item._id === c._id)
                ),
              ]
        );
        setPages(res.pagination?.pages || 1);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Customers could not load');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, page, attempt]);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">
        Customer account
        <select
          aria-label="Customer account"
          disabled={loading || !!error}
          value={value}
          onChange={(e) => {
            const c = customers.find((item) => item._id === e.target.value);
            onChange(
              e.target.value,
              c
                ? [c.firstName, c.lastName].filter(Boolean).join(' ') ||
                    c.email ||
                    c._id
                : ''
            );
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {[c.firstName, c.lastName].filter(Boolean).join(' ') ||
                c.email ||
                c._id}
            </option>
          ))}
        </select>
      </label>
      {loading && (
        <p role="status" className="mt-1 text-xs text-gray-500">
          Loading customers…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}{' '}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="font-medium underline"
          >
            Retry customers
          </button>
        </p>
      )}
      {!loading && !error && page < pages && (
        <button
          type="button"
          onClick={() => setPage((n) => n + 1)}
          className="mt-1 text-xs underline"
        >
          Load more customers
        </button>
      )}
      {!loading && !error && !customers.length && (
        <p className="mt-1 text-xs text-gray-500">
          No customer accounts available.
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Standalone credit stays on the selected customer account.
      </p>
    </div>
  );
}
