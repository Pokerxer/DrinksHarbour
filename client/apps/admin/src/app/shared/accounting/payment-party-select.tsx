'use client';
import { useEffect, useState } from 'react';
import { arApService, type PaymentSide } from '@/services/arAp.service';
interface Party {
  id: string;
  name: string;
}
export default function PaymentPartySelect({
  token,
  side,
  value,
  name,
  busy,
  change,
  purpose = 'record',
}: {
  token: string;
  side: PaymentSide;
  value: string;
  name: string;
  busy: boolean;
  change: (id: string, name: string) => void;
  purpose?: 'record' | 'filter';
}) {
  const [parties, setParties] = useState<Party[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const response =
          side === 'customer'
            ? await arApService.customers(token, { page, limit: 100 })
            : await arApService.vendors(token, { page, limit: 100 });
        const rows =
          side === 'customer'
            ? (
                response.data as Awaited<
                  ReturnType<typeof arApService.customers>
                >['data']
              ).map((p) => ({
                id: p._id,
                name:
                  [p.firstName, p.lastName].filter(Boolean).join(' ') ||
                  p.email ||
                  p._id,
              }))
            : (
                response.data as Awaited<
                  ReturnType<typeof arApService.vendors>
                >['data']
              ).map((p) => ({ id: p._id, name: p.name }));
        if (!active) return;
        setParties((old) =>
          page === 1
            ? rows
            : [
                ...old,
                ...rows.filter((p) => !old.some((item) => item.id === p.id)),
              ]
        );
        setPages(response.pagination?.pages || 1);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'Accounts could not load');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token, side, page, attempt]);
  const label =
    purpose === 'filter'
      ? 'Vendor filter'
      : side === 'customer'
        ? 'Customer account'
        : 'Vendor account';
  return (
    <div className="sm:col-span-2">
      <label className="block text-xs font-medium text-gray-600">
        {label}
        <select
          aria-label={label}
          value={value}
          disabled={busy || loading || !!error}
          onChange={(e) =>
            change(
              e.target.value,
              parties.find((p) => p.id === e.target.value)?.name || ''
            )
          }
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">
            {purpose === 'filter'
              ? 'All vendors'
              : 'Name only / no account selected'}
          </option>
          {value && !parties.some((p) => p.id === value) && (
            <option value={value}>{name || 'Linked account'}</option>
          )}
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {loading && (
        <p role="status" className="mt-1 text-xs text-gray-500">
          Loading accounts…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}{' '}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="underline"
          >
            Retry accounts
          </button>
        </p>
      )}
      {!loading && !error && page < pages && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="mt-1 text-xs underline"
        >
          Load more accounts
        </button>
      )}
      {purpose === 'record' && (
        <p className="mt-1 text-xs text-gray-500">
          Select an account to link the record and show its open documents.
          Otherwise, allocations determine the account.
        </p>
      )}
    </div>
  );
}
