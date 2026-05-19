// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  PiX, PiArrowsDownUp, PiSpinner, PiCheckCircle,
  PiPlus, PiMinus, PiWarningCircle, PiArrowCounterClockwise,
} from 'react-icons/pi';
import type { Warehouse } from '@/services/warehouse.service';
import { warehouseService } from '@/services/warehouse.service';

const ADJUST_TYPES = [
  { value: 'received',   label: 'Stock In',     desc: 'Receiving goods into this location', icon: PiPlus,                    cls: 'border-green-300 bg-green-50 text-green-700',   active: 'border-green-500 bg-green-600 text-white' },
  { value: 'shipped',    label: 'Stock Out',    desc: 'Moving goods out of this location',  icon: PiMinus,                   cls: 'border-red-200   bg-red-50   text-red-700',     active: 'border-red-500   bg-red-600   text-white' },
  { value: 'adjusted',   label: 'Correction',  desc: 'Manual count correction',            icon: PiArrowsDownUp,            cls: 'border-blue-200  bg-blue-50  text-blue-700',    active: 'border-blue-500  bg-blue-600  text-white' },
  { value: 'damaged',    label: 'Damaged',     desc: 'Write off damaged goods',            icon: PiWarningCircle,           cls: 'border-amber-200 bg-amber-50 text-amber-700',   active: 'border-amber-500 bg-amber-600 text-white' },
  { value: 'returned',   label: 'Return',      desc: 'Customer return to this location',   icon: PiArrowCounterClockwise,   cls: 'border-purple-200 bg-purple-50 text-purple-700', active: 'border-purple-500 bg-purple-600 text-white' },
];

interface LocationAdjustModalProps {
  warehouse: Warehouse;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LocationAdjustModal({
  warehouse,
  token,
  onClose,
  onSuccess,
}: LocationAdjustModalProps) {
  const [adjustType, setAdjustType] = useState('received');
  const [quantity, setQuantity]     = useState('');
  const [notes, setNotes]           = useState('');
  const [reference, setReference]   = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Use subProduct's authoritative stock numbers when populated; fall back to warehouse tracking
  const sp        = typeof warehouse.subProduct === 'object' && warehouse.subProduct ? warehouse.subProduct : null;
  const current   = sp?.totalStock    ?? warehouse.currentQuantity  ?? 0;
  const reserved  = sp?.reservedStock  ?? warehouse.reservedQuantity ?? 0;
  const available = sp?.availableStock ?? Math.max(0, current - reserved);

  const qty = parseInt(quantity || '0', 10);
  const isOut = adjustType === 'shipped' || adjustType === 'damaged';
  const preview = isNaN(qty) || qty <= 0 ? current
                : isOut      ? current - qty
                : current + qty;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty || qty <= 0) { setError('Enter a quantity greater than 0.'); return; }
    if (isOut && qty > available) { setError(`Cannot remove ${qty} — only ${available} available.`); return; }
    setLoading(true);
    setError(null);
    try {
      await warehouseService.adjustWarehouseStock(
        warehouse._id,
        qty,
        adjustType,
        token,
        [notes, reference].filter(Boolean).join(' · ') || undefined,
      );
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <PiArrowsDownUp className="h-4 w-4 text-gray-600" />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900">Adjust Stock</p>
              <p className="text-[11px] text-gray-400">{warehouse.location}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">

            {/* Current stock summary */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-200 bg-gray-50">
              {[
                { label: 'On Hand',   value: current,   cls: 'text-gray-800' },
                { label: 'Reserved',  value: reserved,  cls: 'text-amber-600' },
                { label: 'Available', value: available, cls: 'text-green-600' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="px-3 py-2.5 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                  <p className={`text-xl font-black tabular-nums ${cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Adjustment type */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Adjustment Type</p>
              <div className="grid grid-cols-5 gap-1.5">
                {ADJUST_TYPES.map(t => {
                  const Icon = t.icon;
                  const isSelected = adjustType === t.value;
                  return (
                    <button key={t.value} type="button"
                      onClick={() => setAdjustType(t.value)}
                      title={t.desc}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center transition-all ${
                        isSelected ? t.active : t.cls.replace('border-', 'border-') + ' hover:opacity-80'
                      } ${isSelected ? '' : 'opacity-70'}`}
                      style={isSelected ? {} : {}}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px] font-bold leading-none">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">
                {ADJUST_TYPES.find(t => t.value === adjustType)?.desc}
              </p>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-gray-200 focus-within:border-gray-400">
                  <button type="button"
                    onClick={() => setQuantity(v => String(Math.max(1, (parseInt(v || '1', 10) - 1))))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-gray-200 text-gray-400 hover:bg-gray-50">
                    <PiMinus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number" min="1" step="1"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 text-center text-sm font-semibold tabular-nums focus:outline-none"
                    autoFocus
                  />
                  <button type="button"
                    onClick={() => setQuantity(v => String((parseInt(v || '0', 10) + 1)))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border-l border-gray-200 text-gray-400 hover:bg-gray-50">
                    <PiPlus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Preview */}
                {qty > 0 && (
                  <div className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">After</p>
                    <p className={`text-sm font-black tabular-nums ${preview < 0 ? 'text-red-600' : 'text-gray-800'}`}>{preview}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. PO-001, INV-042"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Reason or additional notes…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none resize-none"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
            <p className="text-[11px] text-gray-400">
              {isOut
                ? `${available} available to remove`
                : `Adding to ${warehouse.location}`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={loading || !quantity}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {loading
                  ? <><PiSpinner className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : <><PiCheckCircle className="h-3.5 w-3.5" /> Apply</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
