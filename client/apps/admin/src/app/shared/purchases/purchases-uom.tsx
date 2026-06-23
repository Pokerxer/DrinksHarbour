'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiArrowsLeftRight,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiCheck,
  PiPackage,
  PiPencilSimple,
  PiPlus,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { uomConversionService } from '@/services/uomConversion.service';
import type { UOMConversion } from '@/services/uomConversion.service';
import {
  invalidateUomConversions,
  useUomConversions,
} from '@/hooks/use-uom-conversions';
import { UOMS } from './types';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none';
const SELECT_CLS = `appearance-none pr-8 ${INPUT_CLS}`;

function fmtFactor(n: number) {
  return n.toLocaleString('en-NG', { maximumFractionDigits: 4 });
}

function UomSelect({
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
        {UOMS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

// ─── Converter widget ─────────────────────────────────────────────────────────

function ConverterCard() {
  const { getFactor, loading } = useUomConversions();
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState('Cases');
  const [to, setTo] = useState('Units');

  const parsed = parseFloat(value);
  const factor = getFactor(from, to);
  const result =
    !Number.isNaN(parsed) && factor !== null ? parsed * factor : null;

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <PiPackage className="h-4 w-4 text-[#b20202]" />
        Quick Converter
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Quantity
          </label>
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <UomSelect value={from} onChange={setFrom} />
        </div>
        <button
          type="button"
          title="Swap units"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
        >
          <PiArrowsLeftRight className="h-4 w-4" />
        </button>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <UomSelect value={to} onChange={setTo} />
        </div>
        <div className="min-w-[180px] flex-1">
          {loading ? (
            <p className="text-sm text-gray-400">Loading conversions…</p>
          ) : Number.isNaN(parsed) || value === '' ? (
            <p className="text-sm text-gray-400">Enter a quantity</p>
          ) : result === null ? (
            <p className="text-sm font-medium text-amber-600">
              No active conversion for {from} → {to}
            </p>
          ) : (
            <p className="text-base font-bold text-gray-900">
              {fmtFactor(result)} {to}
              <span className="ml-2 text-xs font-normal text-gray-400">
                1 {from} = {fmtFactor(factor!)} {to}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PurchasesUom() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [conversions, setConversions] = useState<UOMConversion[]>([]);
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
  const [name, setName] = useState('');
  const [fromUOM, setFromUOM] = useState('Cases');
  const [toUOM, setToUOM] = useState('Units');
  const [factor, setFactor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFactor, setEditFactor] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await uomConversionService.getConversions(token, {
        fromUOM: filterFrom || undefined,
        toUOM: filterTo || undefined,
        isActive: filterStatus === '' ? undefined : filterStatus === 'active',
        page,
        limit: 25,
      });
      setConversions(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
      setTotal(res.pagination?.total ?? res.data?.length ?? 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, filterFrom, filterTo, filterStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = useCallback(async () => {
    invalidateUomConversions();
    await load();
  }, [load]);

  const parsedFactor = parseFloat(factor);

  async function handleCreate() {
    if (fromUOM === toUOM) {
      toast.error('From and To units must be different');
      return;
    }
    if (Number.isNaN(parsedFactor) || parsedFactor <= 0) {
      toast.error('Enter a valid factor greater than zero');
      return;
    }
    setSaving(true);
    try {
      const res = await uomConversionService.createConversion(
        {
          name: name.trim() || `${fromUOM} → ${toUOM}`,
          fromUOM,
          toUOM,
          conversionFactor: parsedFactor,
          notes: notes.trim() || undefined,
          isActive: true,
        },
        token
      );
      if (!res.success) throw new Error(res.message || 'Failed to create');
      toast.success('UOM conversion created');
      setShowForm(false);
      setName('');
      setFactor('');
      setNotes('');
      await refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(c: UOMConversion) {
    try {
      const res = await uomConversionService.updateConversion(
        c._id,
        { isActive: !c.isActive },
        token
      );
      if (!res.success) throw new Error(res.message || 'Failed to update');
      setConversions((p) =>
        p.map((x) => (x._id === c._id ? { ...x, isActive: !c.isActive } : x))
      );
      invalidateUomConversions();
      toast.success(
        c.isActive ? 'Conversion deactivated' : 'Conversion activated'
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function startEdit(c: UOMConversion) {
    setEditingId(c._id);
    setEditFactor(String(c.conversionFactor));
  }

  async function handleEditSave(c: UOMConversion) {
    const value = parseFloat(editFactor);
    if (Number.isNaN(value) || value <= 0) {
      toast.error('Enter a valid factor greater than zero');
      return;
    }
    setEditSaving(true);
    try {
      const res = await uomConversionService.updateConversion(
        c._id,
        { conversionFactor: value },
        token
      );
      if (!res.success) throw new Error(res.message || 'Failed to update');
      setConversions((p) =>
        p.map((x) => (x._id === c._id ? { ...x, conversionFactor: value } : x))
      );
      setEditingId(null);
      invalidateUomConversions();
      toast.success('Conversion updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(c: UOMConversion) {
    if (!confirm(`Delete the ${c.fromUOM} → ${c.toUOM} conversion?`)) return;
    try {
      const res = await uomConversionService.deleteConversion(c._id, token);
      if (!res.success) throw new Error(res.message || 'Failed to delete');
      toast.success('Conversion deleted');
      invalidateUomConversions();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const hasFilters =
    filterFrom !== '' || filterTo !== '' || filterStatus !== '';

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            UOM Conversions
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Define how packaging units convert (e.g. 1 Case = 24 Units) — used
            to fill pack sizes on purchase orders
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
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Conversion
          </button>
        </div>
      </div>

      <ConverterCard />

      {/* Create form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                From
              </label>
              <UomSelect value={fromUOM} onChange={setFromUOM} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                To
              </label>
              <UomSelect value={toUOM} onChange={setToUOM} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Factor (1 {fromUOM} = ? {toUOM})
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                placeholder="e.g. 24"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Name{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${fromUOM} → ${toUOM}`}
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
                placeholder="e.g. standard carton for 50cl bottles"
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {fromUOM === toUOM ? (
                <span className="font-medium text-amber-600">
                  From and To must be different
                </span>
              ) : !Number.isNaN(parsedFactor) && parsedFactor > 0 ? (
                <>
                  1 {fromUOM} = {fmtFactor(parsedFactor)} {toUOM} · 1 {toUOM} ={' '}
                  {fmtFactor(1 / parsedFactor)} {fromUOM}
                </>
              ) : (
                'Each unit pair can only have one conversion'
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
                {saving ? 'Saving…' : 'Save Conversion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <UomSelect
            value={filterFrom}
            onChange={(v) => {
              setFilterFrom(v);
              setPage(1);
            }}
            allowAll
            allLabel="All units"
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <UomSelect
            value={filterTo}
            onChange={(v) => {
              setFilterTo(v);
              setPage(1);
            }}
            allowAll
            allLabel="All units"
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
          {total} conversion{total === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading…
          </div>
        ) : conversions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">
              {hasFilters
                ? 'No conversions match the current filters'
                : 'No UOM conversions defined yet'}
            </p>
            {!hasFilters && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm font-medium text-[#b20202] underline-offset-2 hover:underline"
              >
                Add your first conversion
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Pair
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Factor
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Inverse
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
              {conversions.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.fromUOM} <span className="text-gray-400">→</span>{' '}
                    {c.toUOM}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                    {editingId === c._id ? (
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={editFactor}
                        onChange={(e) => setEditFactor(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(c);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm focus:border-[#b20202] focus:outline-none"
                      />
                    ) : (
                      fmtFactor(c.conversionFactor)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                    {c.conversionFactor > 0
                      ? fmtFactor(1 / c.conversionFactor)
                      : '—'}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500">
                    {c.notes || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(c)}
                      title={
                        c.isActive ? 'Click to deactivate' : 'Click to activate'
                      }
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        c.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === c._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditSave(c)}
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
                            onClick={() => startEdit(c)}
                            title="Edit factor"
                            className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
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
