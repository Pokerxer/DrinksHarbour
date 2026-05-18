// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  PiX,
  PiArrowDown,
  PiPlus,
  PiMinus,
  PiArrowCounterClockwise,
  PiSpinner,
} from 'react-icons/pi';

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
}

interface ServerAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdjustmentData) => void;
  isSubmitting: boolean;
  sizes?: Array<{ _id?: string; size: string; displayName?: string; stock?: number }>;
  hasSizes?: boolean;
  nextPONumber?: string;
}

const MOVEMENT_TYPES = [
  {
    id: 'received',
    label: 'Received',
    description: 'Received from supplier',
    Icon: PiArrowDown,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-300',
    selectedBg: 'bg-green-100',
  },
  {
    id: 'adjustment_in',
    label: 'Adjustment In',
    description: 'Manual adjustment in',
    Icon: PiPlus,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    selectedBg: 'bg-blue-100',
  },
  {
    id: 'adjustment_out',
    label: 'Adjustment Out',
    description: 'Manual adjustment out',
    Icon: PiMinus,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-300',
    selectedBg: 'bg-red-100',
  },
  {
    id: 'return',
    label: 'Return',
    description: 'Customer return',
    Icon: PiArrowCounterClockwise,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    selectedBg: 'bg-amber-100',
  },
] as const;

export function ServerAdjustmentModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  sizes = [],
  hasSizes = false,
  nextPONumber,
}: ServerAdjustmentModalProps) {
  const [type, setType] = useState<string>('received');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');

  // Pre-fill reference with PO number when type = received
  useEffect(() => {
    if (type === 'received' && nextPONumber && !reference) {
      setReference(nextPONumber);
    }
  }, [type, nextPONumber]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setType('received');
      setQuantity(1);
      setReason('');
      setNotes('');
      setSelectedSizeId('');
      setReference('');
      setUnitCost('');
      setSupplierName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canSubmit = quantity > 0 && reason.trim().length > 0 && !isSubmitting;
  const showSizes = hasSizes && sizes.length > 0;
  const showReceivedFields = type === 'received';

  const selectedSize = sizes.find((s) => s._id === selectedSizeId || s.size === selectedSizeId);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      type,
      quantity,
      reason: reason.trim(),
      notes: notes.trim(),
      sizeId: selectedSizeId || undefined,
      sizeName: selectedSize?.displayName || selectedSize?.size || undefined,
      reference: reference.trim() || undefined,
      unitCost: unitCost ? parseFloat(unitCost) : undefined,
      supplierName: supplierName.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Record Stock Movement</h2>
            <p className="text-sm text-gray-500">Record inventory changes in the system</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="space-y-5">
            {/* Type selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Movement Type</label>
              <div className="grid grid-cols-2 gap-2">
                {MOVEMENT_TYPES.map((mt) => {
                  const isSelected = type === mt.id;
                  return (
                    <button
                      key={mt.id}
                      type="button"
                      onClick={() => setType(mt.id)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                        isSelected
                          ? `${mt.border} ${mt.selectedBg}`
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${mt.bg} ${mt.color}`}
                      >
                        <mt.Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? mt.color : 'text-gray-800'}`}>
                          {mt.label}
                        </p>
                        <p className="text-xs text-gray-400">{mt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size selector */}
            {showSizes && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Size</label>
                <select
                  value={selectedSizeId}
                  onChange={(e) => setSelectedSizeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All sizes (total stock)</option>
                  {sizes.map((s) => (
                    <option key={s._id || s.size} value={s._id || s.size}>
                      {s.displayName || s.size}
                      {s.stock !== undefined ? ` (${s.stock} in stock)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter quantity"
              />
            </div>

            {/* Reference/PO */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {showReceivedFields ? 'PO / Reference Number' : 'Reference'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={showReceivedFields ? nextPONumber || 'e.g. PO-2024-001' : 'e.g. REF-001'}
              />
            </div>

            {/* Unit Cost — only for received */}
            {showReceivedFields && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unit Cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {/* Supplier — only for received */}
            {showReceivedFields && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Supplier Name</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. ABC Distributors"
                />
              </div>
            )}

            {/* Reason (required) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Restock, Damaged goods, Inventory count"
              />
            </div>

            {/* Notes (optional) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Notes <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Additional details..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <PiSpinner className="h-4 w-4 animate-spin" />}
            Record Movement
          </button>
        </div>
      </div>
    </div>
  );
}
