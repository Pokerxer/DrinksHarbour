'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiArrowsLeftRight,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiCheck,
  PiCloudArrowDown,
  PiCurrencyCircleDollar,
  PiPencilSimple,
  PiPlus,
  PiTrash,
  PiTrendUp,
  PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { exchangeRateService } from '@/services/exchangeRate.service';
import {
  invalidateExchangeRates,
  useExchangeRates,
} from '@/hooks/use-exchange-rates';
import { BASE_CURRENCY, CURRENCIES, CURRENCY_SYMBOLS } from './types';
import type { ExchangeRate } from './types';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none';
const SELECT_CLS = `appearance-none pr-8 ${INPUT_CLS}`;

function fmtRate(n: number) {
  return n.toLocaleString('en-NG', { maximumFractionDigits: 4 });
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CurrencySelect({
  value,
  onChange,
  allowAll = false,
  allLabel = 'All',
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
  allLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLS}
      >
        {allowAll && <option value="">{allLabel}</option>}
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

// ─── Latest rates summary ─────────────────────────────────────────────────────

function LatestRatesCards() {
  const { latestRates, loading } = useExchangeRates();

  if (loading || latestRates.length === 0) return null;

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {latestRates.map((r) => (
        <div
          key={`${r.fromCurrency}-${r.toCurrency}`}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <PiTrendUp className="h-3.5 w-3.5 text-[#b20202]" />
            {r.fromCurrency} → {r.toCurrency}
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-gray-900">
            {fmtRate(r.rate)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            1 {r.fromCurrency} = {fmtRate(r.rate)} {r.toCurrency} ·{' '}
            {new Date(r.effectiveDate).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Converter widget ─────────────────────────────────────────────────────────

function ConverterCard() {
  const { getRate, loading } = useExchangeRates();
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState<string>(BASE_CURRENCY);

  const parsed = parseFloat(amount);
  const rate = getRate(from, to);
  const result = !Number.isNaN(parsed) && rate !== null ? parsed * rate : null;

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <PiCurrencyCircleDollar className="h-4 w-4 text-[#b20202]" />
        Quick Converter
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Amount
          </label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <CurrencySelect value={from} onChange={setFrom} />
        </div>
        <button
          type="button"
          title="Swap currencies"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
        >
          <PiArrowsLeftRight className="h-4 w-4" />
        </button>
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <CurrencySelect value={to} onChange={setTo} />
        </div>
        <div className="min-w-[180px] flex-1">
          {loading ? (
            <p className="text-sm text-gray-400">Loading rates…</p>
          ) : Number.isNaN(parsed) || amount === '' ? (
            <p className="text-sm text-gray-400">Enter an amount</p>
          ) : result === null ? (
            <p className="text-sm font-medium text-amber-600">
              No active rate for {from} → {to}
            </p>
          ) : (
            <p className="text-base font-bold text-gray-900">
              {CURRENCY_SYMBOLS[to] ?? to}
              {fmtMoney(result)}
              <span className="ml-2 text-xs font-normal text-gray-400">
                @ {fmtRate(rate!)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PurchasesExchangeRates() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // create form
  const [showForm, setShowForm] = useState(false);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState<string>(BASE_CURRENCY);
  const [rate, setRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await exchangeRateService.getRates(token, {
        fromCurrency: filterFrom || undefined,
        toCurrency: filterTo || undefined,
        isActive: filterStatus === '' ? undefined : filterStatus === 'active',
        page,
        limit: 25,
      });
      setRates(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
      setTotal(res.pagination?.total ?? res.data?.length ?? 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  }, [token, filterFrom, filterTo, filterStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = useCallback(async () => {
    invalidateExchangeRates();
    await load();
  }, [load]);

  const parsedRate = parseFloat(rate);
  const inversePreview =
    !Number.isNaN(parsedRate) && parsedRate > 0 ? 1 / parsedRate : null;

  async function handleCreate() {
    if (fromCurrency === toCurrency) {
      toast.error('From and To currencies must be different');
      return;
    }
    if (Number.isNaN(parsedRate) || parsedRate <= 0) {
      toast.error('Enter a valid rate greater than zero');
      return;
    }
    if (!effectiveDate) {
      toast.error('Pick an effective date');
      return;
    }
    setSaving(true);
    try {
      const res = await exchangeRateService.createRate(
        {
          fromCurrency,
          toCurrency,
          rate: parsedRate,
          effectiveDate,
          notes: notes.trim() || undefined,
          isActive: true,
        },
        token
      );
      if (!res.success) throw new Error(res.message || 'Failed to create');
      toast.success('Exchange rate saved');
      setShowForm(false);
      setRate('');
      setNotes('');
      await refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(r: ExchangeRate) {
    try {
      const res = await exchangeRateService.updateRate(
        r._id,
        { isActive: !r.isActive },
        token
      );
      if (!res.success) throw new Error(res.message || 'Failed to update');
      setRates((p) =>
        p.map((x) => (x._id === r._id ? { ...x, isActive: !r.isActive } : x))
      );
      invalidateExchangeRates();
      toast.success(r.isActive ? 'Rate deactivated' : 'Rate activated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function startEdit(r: ExchangeRate) {
    setEditingId(r._id);
    setEditRate(String(r.rate));
  }

  async function handleEditSave(r: ExchangeRate) {
    const value = parseFloat(editRate);
    if (Number.isNaN(value) || value <= 0) {
      toast.error('Enter a valid rate greater than zero');
      return;
    }
    setEditSaving(true);
    try {
      // A hand-edited rate becomes manual so the live sync won't overwrite it.
      const res = await exchangeRateService.updateRate(
        r._id,
        { rate: value, source: 'manual' },
        token
      );
      if (!res.success) throw new Error(res.message || 'Failed to update');
      setRates((p) =>
        p.map((x) =>
          x._id === r._id ? { ...x, rate: value, source: 'manual' } : x
        )
      );
      setEditingId(null);
      invalidateExchangeRates();
      toast.success('Rate updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(r: ExchangeRate) {
    if (
      !confirm(
        `Delete ${r.fromCurrency} → ${r.toCurrency} rate of ${fmtRate(r.rate)}?`
      )
    )
      return;
    try {
      const res = await exchangeRateService.deleteRate(r._id, token);
      if (!res.success) throw new Error(res.message || 'Failed to delete');
      toast.success('Exchange rate deleted');
      invalidateExchangeRates();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await exchangeRateService.syncLiveRates(token);
      if (!res.success) throw new Error(res.message || 'Sync failed');
      toast.success(res.message || 'Live rates updated');
      await refreshAll();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Could not fetch live rates'
      );
    } finally {
      setSyncing(false);
    }
  }

  const hasFilters =
    filterFrom !== '' || filterTo !== '' || filterStatus !== '';

  const filterControls = useMemo(
    () => (
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <CurrencySelect
            value={filterFrom}
            onChange={(v) => {
              setFilterFrom(v);
              setPage(1);
            }}
            allowAll
            allLabel="All currencies"
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <CurrencySelect
            value={filterTo}
            onChange={(v) => {
              setFilterTo(v);
              setPage(1);
            }}
            allowAll
            allLabel="All currencies"
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Status
          </label>
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className={SELECT_CLS}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilterFrom('');
              setFilterTo('');
              setFilterStatus('');
              setPage(1);
            }}
            className="mb-0.5 text-xs font-medium text-gray-500 underline-offset-2 hover:text-[#b20202] hover:underline"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto self-center text-xs text-gray-400">
          {total} rate{total === 1 ? '' : 's'}
        </div>
      </div>
    ),
    [filterFrom, filterTo, filterStatus, hasFilters, total]
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Exchange Rates
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Rates used to convert foreign-currency purchase orders and bills to{' '}
            {BASE_CURRENCY} — refreshed automatically from live market rates;
            manual rates you enter always take priority
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh"
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiCloudArrowDown className="h-4 w-4" />
            {syncing ? 'Updating…' : 'Update Live Rates'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Rate
          </button>
        </div>
      </div>

      <LatestRatesCards />
      <ConverterCard />

      {/* Create form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                From
              </label>
              <CurrencySelect value={fromCurrency} onChange={setFromCurrency} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                To
              </label>
              <CurrencySelect value={toCurrency} onChange={setToCurrency} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Rate (1 {fromCurrency} = ? {toCurrency})
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 1550"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Notes{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="e.g. CBN official rate"
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {fromCurrency === toCurrency ? (
                <span className="font-medium text-amber-600">
                  From and To must be different
                </span>
              ) : inversePreview !== null ? (
                <>
                  Inverse: 1 {toCurrency} = {fmtRate(inversePreview)}{' '}
                  {fromCurrency} · saving the same pair and date updates the
                  existing rate
                </>
              ) : (
                'Saving the same pair and date again updates the existing rate'
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {filterControls}

      {/* Rates table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading…
          </div>
        ) : rates.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">
              {hasFilters
                ? 'No rates match the current filters'
                : 'No exchange rates defined yet'}
            </p>
            {!hasFilters && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm font-medium text-[#b20202] underline-offset-2 hover:underline"
              >
                Add your first rate
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Pair
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Rate
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Inverse
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Effective Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Notes
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.fromCurrency} <span className="text-gray-400">→</span>{' '}
                    {r.toCurrency}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                    {editingId === r._id ? (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(r);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm focus:border-[#b20202] focus:outline-none"
                      />
                    ) : (
                      fmtRate(r.rate)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                    {r.rate > 0 ? fmtRate(1 / r.rate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.effectiveDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.source === 'live'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {r.source === 'live' ? 'Live' : 'Manual'}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500">
                    {r.notes || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(r)}
                      title={
                        r.isActive ? 'Click to deactivate' : 'Click to activate'
                      }
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        r.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === r._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditSave(r)}
                            disabled={editSaving}
                            title="Save"
                            className="inline-flex rounded p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                          >
                            <PiCheck className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                            className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100"
                          >
                            <PiX className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            title="Edit rate"
                            className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            title="Delete"
                            className="inline-flex rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Page {page} of {pages}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
