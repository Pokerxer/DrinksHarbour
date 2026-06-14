// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  PiX, PiArrowDown, PiArrowUp, PiPlus, PiMinus,
  PiArrowCounterClockwise, PiArrowsLeftRight, PiWarningCircle,
  PiSpinner, PiCheckCircle, PiClock,
} from 'react-icons/pi';
import type { Warehouse } from '@/services/warehouse.service';

export interface AdjustmentData {
  type: string;
  quantity: number;
  reason: string;
  notes: string;
  sizeId?: string;
  sizeName?: string;
  reference?: string;
  unitCost?: number;
  supplierName?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
}

interface MoveType {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  dir: 'in' | 'out' | 'both' | 'neutral';
  activeCls: string;
  idleCls: string;
}

const MOVE_TYPES: MoveType[] = [
  {
    id: 'received',
    label: 'Receive Stock',
    desc: 'Goods in from supplier',
    icon: <PiArrowDown className="h-4 w-4" />,
    dir: 'in',
    activeCls: 'border-green-400 bg-green-600 text-white',
    idleCls:   'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
  },
  {
    id: 'shipped',
    label: 'Ship / Deliver',
    desc: 'Goods out to customer',
    icon: <PiArrowUp className="h-4 w-4" />,
    dir: 'out',
    activeCls: 'border-red-400 bg-red-600 text-white',
    idleCls:   'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  },
  {
    id: 'adjustment_in',
    label: 'Adjust In',
    desc: 'Manual count correction +',
    icon: <PiPlus className="h-4 w-4" />,
    dir: 'in',
    activeCls: 'border-blue-400 bg-blue-600 text-white',
    idleCls:   'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  {
    id: 'adjustment_out',
    label: 'Adjust Out',
    desc: 'Manual count correction −',
    icon: <PiMinus className="h-4 w-4" />,
    dir: 'out',
    activeCls: 'border-orange-400 bg-orange-600 text-white',
    idleCls:   'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
  },
  {
    id: 'return',
    label: 'Customer Return',
    desc: 'Stock back from customer',
    icon: <PiArrowCounterClockwise className="h-4 w-4" />,
    dir: 'in',
    activeCls: 'border-purple-400 bg-purple-600 text-white',
    idleCls:   'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
  },
  {
    id: 'transfer',
    label: 'Transfer',
    desc: 'Move between locations',
    icon: <PiArrowsLeftRight className="h-4 w-4" />,
    dir: 'both',
    activeCls: 'border-sky-400 bg-sky-600 text-white',
    idleCls:   'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
  {
    id: 'damaged',
    label: 'Damaged',
    desc: 'Write off damaged goods',
    icon: <PiWarningCircle className="h-4 w-4" />,
    dir: 'out',
    activeCls: 'border-amber-400 bg-amber-600 text-white',
    idleCls:   'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  {
    id: 'expired',
    label: 'Expired',
    desc: 'Write off expired goods',
    icon: <PiClock className="h-4 w-4" />,
    dir: 'out',
    activeCls: 'border-rose-400 bg-rose-600 text-white',
    idleCls:   'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
];

const DIR_LABEL: Record<string, string> = {
  in:      '+ Stock increases',
  out:     '− Stock decreases',
  both:    '~ Stock moves location',
  neutral: '~ No stock change',
};

interface ServerAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdjustmentData) => void;
  isSubmitting: boolean;
  sizes?: Array<{ _id?: string; size: string; displayName?: string; stock?: number; stockQuantity?: number }>;
  hasSizes?: boolean;
  nextPONumber?: string;
  initialType?: string;
  warehouses?: Warehouse[];
}

const FIELD = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none';

export function ServerAdjustmentModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  sizes = [],
  hasSizes = false,
  nextPONumber,
  initialType,
  warehouses = [],
}: ServerAdjustmentModalProps) {
  const [type,         setType]         = useState(initialType || 'received');
  const [quantity,     setQuantity]     = useState('1');
  const [sizeId,       setSizeId]       = useState('');
  const [reason,       setReason]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [reference,    setReference]    = useState('');
  const [unitCost,     setUnitCost]     = useState('');
  const [supplier,     setSupplier]     = useState('');
  const [fromWh,       setFromWh]       = useState('');
  const [toWh,         setToWh]         = useState('');

  // Sync initial type when prop changes
  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  // Pre-fill PO number for receives
  useEffect(() => {
    if (type === 'received' && nextPONumber && !reference) {
      setReference(nextPONumber);
    }
  }, [type, nextPONumber]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setType(initialType || 'received');
      setQuantity('1');
      setSizeId('');
      setReason('');
      setNotes('');
      setReference('');
      setUnitCost('');
      setSupplier('');
      setFromWh('');
      setToWh('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const mt        = MOVE_TYPES.find(m => m.id === type) || MOVE_TYPES[0];
  const qty       = parseInt(quantity || '0', 10);
  const isTransfer = type === 'transfer';
  const isReceive  = type === 'received';

  const needsReason   = ['adjustment_in', 'adjustment_out', 'shipped', 'damaged', 'expired', 'return'].includes(type);
  const reasonOk      = !needsReason || reason.trim().length > 0;
  const transferOk    = !isTransfer || (fromWh && toWh && fromWh !== toWh);
  const canSubmit     = qty > 0 && reasonOk && transferOk && !isSubmitting;

  const selectedSize  = sizes.find(s => (s._id || s.size) === sizeId);

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      type,
      quantity:  qty,
      reason:    reason.trim() || mt.label,
      notes:     notes.trim(),
      sizeId:    sizeId || undefined,
      sizeName:  selectedSize?.displayName || selectedSize?.size || undefined,
      reference: reference.trim() || undefined,
      unitCost:  unitCost ? parseFloat(unitCost) : undefined,
      supplierName: supplier.trim() || undefined,
      sourceWarehouseId:      fromWh || undefined,
      destinationWarehouseId: toWh   || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-gray-900">New Stock Move</p>
            <p className="text-[11px] text-gray-400">Record an inventory movement</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Move type selector ── */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Move Type</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MOVE_TYPES.map(m => (
                <button key={m.id} type="button" onClick={() => setType(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center text-[9px] font-bold uppercase tracking-wide transition-all ${
                    type === m.id ? m.activeCls : m.idleCls
                  }`}>
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
            {/* Direction hint */}
            <p className={`mt-1.5 text-[10px] font-medium ${
              mt.dir === 'in'   ? 'text-green-600'  :
              mt.dir === 'out'  ? 'text-red-600'    :
              mt.dir === 'both' ? 'text-sky-600'    : 'text-gray-400'
            }`}>{DIR_LABEL[mt.dir]}</p>
          </div>

          {/* ── Quantity ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <div className="flex overflow-hidden rounded-lg border border-gray-200 focus-within:border-gray-400">
                <button type="button" onClick={() => setQuantity(v => String(Math.max(1, (parseInt(v || '1', 10) - 1))))}
                  className="flex w-8 shrink-0 items-center justify-center border-r border-gray-200 text-gray-400 hover:bg-gray-50">
                  <PiMinus className="h-3 w-3" />
                </button>
                <input type="number" min="1" value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="flex-1 py-2 text-center text-sm font-semibold tabular-nums focus:outline-none" />
                <button type="button" onClick={() => setQuantity(v => String((parseInt(v || '0', 10) + 1)))}
                  className="flex w-8 shrink-0 items-center justify-center border-l border-gray-200 text-gray-400 hover:bg-gray-50">
                  <PiPlus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Size */}
            {hasSizes && sizes.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Size</label>
                <select value={sizeId} onChange={e => setSizeId(e.target.value)}
                  className={`${FIELD} bg-white`}>
                  <option value="">All sizes</option>
                  {sizes.map(s => (
                    <option key={s._id || s.size} value={s._id || s.size}>
                      {s.displayName || s.size}
                      {(s.stockQuantity ?? s.stock) !== undefined ? ` (${s.stockQuantity ?? s.stock})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── Transfer: warehouse pickers ── */}
          {isTransfer && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">From Location <span className="text-red-500">*</span></label>
                <select value={fromWh} onChange={e => setFromWh(e.target.value)} className={`${FIELD} bg-white`}>
                  <option value="">Select…</option>
                  {warehouses.filter(w => w.isActive && w._id !== toWh).map(w => (
                    <option key={w._id} value={w._id}>{w.name}{w.code ? ` (${w.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">To Location <span className="text-red-500">*</span></label>
                <select value={toWh} onChange={e => setToWh(e.target.value)} className={`${FIELD} bg-white`}>
                  <option value="">Select…</option>
                  {warehouses.filter(w => w.isActive && w._id !== fromWh).map(w => (
                    <option key={w._id} value={w._id}>{w.name}{w.code ? ` (${w.code})` : ''}</option>
                  ))}
                </select>
              </div>
              {fromWh === toWh && fromWh && (
                <p className="col-span-2 text-[10px] text-red-500">Source and destination must be different locations.</p>
              )}
            </div>
          )}

          {/* ── Receive-specific fields ── */}
          {isReceive && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">PO / Reference</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder={nextPONumber || 'e.g. PO-001'}
                  className={FIELD} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Unit Cost (₦)</label>
                <input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className={FIELD} />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Supplier Name</label>
                <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                  placeholder="e.g. ABC Distributors"
                  className={FIELD} />
              </div>
            </div>
          )}

          {/* ── Reference (non-receive, non-transfer types) ── */}
          {!isReceive && !isTransfer && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Reference</label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="Order #, invoice, or any reference"
                className={FIELD} />
            </div>
          )}

          {/* ── Reason ── */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Reason {needsReason && <span className="text-red-500">*</span>}
              {!needsReason && <span className="normal-case font-normal text-gray-400">(optional)</span>}
            </label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder={
                type === 'received'       ? 'e.g. Monthly restock'           :
                type === 'shipped'        ? 'e.g. Delivered to customer'     :
                type === 'adjustment_in'  ? 'e.g. Physical count correction' :
                type === 'adjustment_out' ? 'e.g. Shrinkage, counting error' :
                type === 'return'         ? 'e.g. Customer changed mind'     :
                type === 'transfer'       ? 'e.g. Relocating slow stock'     :
                type === 'damaged'        ? 'e.g. Broken during handling'    :
                                            'e.g. Past expiry date'
              }
              className={`${FIELD} ${needsReason && !reason.trim() ? 'border-red-200 focus:border-red-400' : ''}`}
            />
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Additional details…"
              className={`${FIELD} resize-none`} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <p className={`text-[11px] font-medium ${
            mt.dir === 'in'   ? 'text-green-600' :
            mt.dir === 'out'  ? 'text-red-600'   :
            mt.dir === 'both' ? 'text-sky-600'   : 'text-gray-400'
          }`}>{DIR_LABEL[mt.dir]}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={!canSubmit}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {isSubmitting
                ? <><PiSpinner className="h-3.5 w-3.5 animate-spin" /> Recording…</>
                : <><PiCheckCircle className="h-3.5 w-3.5" /> Record Move</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
