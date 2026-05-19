// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  PiX, PiMapPin, PiSpinner, PiCheckCircle,
} from 'react-icons/pi';
import type { Warehouse } from '@/services/warehouse.service';
import { warehouseService } from '@/services/warehouse.service';

const LOCATION_TYPES = [
  { value: 'warehouse',           label: 'Warehouse' },
  { value: 'store',               label: 'Store / Retail' },
  { value: 'distribution_center', label: 'Distribution Centre' },
  { value: 'supplier',            label: 'Supplier' },
  { value: 'transit',             label: 'Transit' },
  { value: 'custom',              label: 'Custom' },
];

const STORAGE_CONDITIONS = [
  { value: 'ambient',          label: 'Ambient' },
  { value: 'refrigerated',     label: 'Refrigerated' },
  { value: 'frozen',           label: 'Frozen' },
  { value: 'climate_controlled', label: 'Climate Controlled' },
  { value: 'dark_storage',     label: 'Dark Storage' },
  { value: 'ventilated',       label: 'Ventilated' },
];

interface LocationFormModalProps {
  subProductId: string;
  token: string;
  warehouse?: Warehouse | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function LocationFormModal({
  subProductId,
  token,
  warehouse,
  onClose,
  onSuccess,
}: LocationFormModalProps) {
  const isEdit = !!warehouse;

  const [form, setForm] = useState({
    location:     warehouse?.location     || '',
    locationType: warehouse?.locationType || 'warehouse',
    capacity:     warehouse?.capacity     ?? 1000,
    zone:         warehouse?.zone         || '',
    aisle:        warehouse?.aisle        || '',
    shelf:        warehouse?.shelf        || '',
    bin:          warehouse?.bin          || '',
    condition:    warehouse?.condition    || 'ambient',
    minStockLevel: warehouse?.minStockLevel ?? 0,
    maxStockLevel: warehouse?.maxStockLevel ?? 0,
    notes:        warehouse?.notes        || '',
    isActive:     warehouse?.isActive     ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const set = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.location.trim()) { setError('Location name is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        await warehouseService.updateWarehouse(warehouse!._id, form, token);
      } else {
        await warehouseService.createWarehouse({ ...form, subProductId }, token);
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <PiMapPin className="h-4 w-4 text-gray-600" />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Location' : 'Add Location'}</p>
              <p className="text-[11px] text-gray-400">{isEdit ? `Editing ${warehouse!.location}` : 'Create a new stock location'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <PiX className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-4">

            {/* Name + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Main Warehouse, Store A"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Type</label>
                <select
                  value={form.locationType}
                  onChange={e => set('locationType', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none bg-white"
                >
                  {LOCATION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Capacity (units)</label>
              <input
                type="number" min="0" step="1"
                value={form.capacity}
                onChange={e => set('capacity', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            {/* Bin Address */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                Bin Address <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['zone', 'aisle', 'shelf', 'bin'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-[10px] text-gray-400 mb-1 capitalize">{field}</label>
                    <input
                      type="text"
                      value={form[field]}
                      onChange={e => set(field, e.target.value)}
                      placeholder={field[0].toUpperCase()}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm uppercase focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Storage Condition */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Storage Condition</label>
              <div className="flex flex-wrap gap-2">
                {STORAGE_CONDITIONS.map(c => (
                  <button
                    key={c.value} type="button"
                    onClick={() => set('condition', c.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      form.condition === c.value
                        ? 'border-gray-800 bg-gray-800 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Thresholds */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Min Stock Level</label>
                <input
                  type="number" min="0" step="1"
                  value={form.minStockLevel}
                  onChange={e => set('minStockLevel', Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Max Stock Level</label>
                <input
                  type="number" min="0" step="1"
                  value={form.maxStockLevel}
                  onChange={e => set('maxStockLevel', Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Optional notes about this location…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none resize-none"
              />
            </div>

            {/* Active toggle */}
            {isEdit && (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Active</p>
                  <p className="text-[11px] text-gray-400">Inactive locations are hidden from stock tracking</p>
                </div>
                <button
                  type="button"
                  onClick={() => set('isActive', !form.isActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    form.isActive ? 'bg-gray-800' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                    form.isActive ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {loading
                ? <><PiSpinner className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : <><PiCheckCircle className="h-3.5 w-3.5" /> {isEdit ? 'Save Changes' : 'Add Location'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
