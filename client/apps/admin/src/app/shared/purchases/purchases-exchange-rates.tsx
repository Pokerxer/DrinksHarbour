'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiCheck,
  PiCloudArrowDown,
  PiPencilSimple,
  PiPlus,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { exchangeRateService } from '@/services/exchangeRate.service';
import { invalidateExchangeRates, useExchangeRates } from '@/hooks/use-exchange-rates';
import { BASE_CURRENCY, type ExchangeRate } from './types';
import {
  fmtRate,
  formatRateDate,
  isBackDated,
  localDateKey,
  parsePositiveNumber,
} from './exchange-rates-helpers';
import { CurrencySelect, SELECT_CLS, ExchangeRatesWidgets } from './exchange-rates-widgets';
import { ExchangeRatesCreateForm } from './exchange-rates-create-form';

// ─── Main component ───────────────────────────────────────────────────────────

export default function PurchasesExchangeRates() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const { latestRates } = useExchangeRates();

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
  // Local calendar day — the server upsert-matches exact dates and its live
  // sync writes server-local midnights; a UTC-derived default misses by a day
  // for part of every night.
  const [effectiveDate, setEffectiveDate] = useState(() =>
    localDateKey(new Date())
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
      setRates([]);
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

  async function handleCreate() {
    if (fromCurrency === toCurrency) {
      toast.error('From and To currencies must be different');
      return;
    }
    const parsedRate = parsePositiveNumber(rate);
    if (parsedRate === null) {
      toast.error('Enter a valid rate greater than zero');
      return;
    }
    if (!effectiveDate) {
      toast.error('Pick an effective date');
      return;
    }
    setSaving(true);
    try {
      await exchangeRateService.createRate(
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
      await exchangeRateService.updateRate(
        r._id,
        { isActive: !r.isActive },
        token
      );
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
    const value = parsePositiveNumber(editRate);
    if (value === null) {
      toast.error('Enter a valid rate greater than zero');
      return;
    }
    setEditSaving(true);
    try {
      // A hand-edited rate becomes manual so the live sync won't overwrite it.
      await exchangeRateService.updateRate(
        r._id,
        { rate: value, source: 'manual' },
        token
      );
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
      await exchangeRateService.deleteRate(r._id, token);
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

  const backDated = useMemo(
    () => showForm && isBackDated(latestRates, fromCurrency, toCurrency, effectiveDate),
    [showForm, latestRates, fromCurrency, toCurrency, effectiveDate]
  );

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

      <ExchangeRatesWidgets />

      {/* Create form */}
      {showForm && (
        <ExchangeRatesCreateForm
          fromCurrency={fromCurrency}
          toCurrency={toCurrency}
          rate={rate}
          effectiveDate={effectiveDate}
          notes={notes}
          saving={saving}
          backDated={backDated}
          onChange={(patch) => {
            if (patch.fromCurrency !== undefined) setFromCurrency(patch.fromCurrency);
            if (patch.toCurrency !== undefined) setToCurrency(patch.toCurrency);
            if (patch.rate !== undefined) setRate(patch.rate);
            if (patch.effectiveDate !== undefined)
              setEffectiveDate(patch.effectiveDate);
            if (patch.notes !== undefined) setNotes(patch.notes);
          }}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
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
                    {formatRateDate(r.effectiveDate)}
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
