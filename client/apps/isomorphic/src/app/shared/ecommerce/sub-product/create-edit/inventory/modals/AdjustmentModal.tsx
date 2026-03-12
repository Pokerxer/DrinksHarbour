'use client';

import { Input, Text, Textarea, Badge, Button } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { PiPlus, PiMinus, PiPencil, PiX } from 'react-icons/pi';
import { REASON_OPTIONS } from '../shared/constants';
import type { SizeVariant } from '../shared/types';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  adjustmentType: 'add' | 'remove' | 'set';
  adjustmentQuantity: number;
  onQuantityChange: (qty: number) => void;
  adjustmentReason: string;
  onReasonChange: (reason: string) => void;
  adjustmentNotes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  
  // Size variant props
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  selectedSize: string;
  onSelectSize: (size: string) => void;
  sizeStockMap: Record<string, number>;
  currentSizeStock: number;
  totalStock: number;
}

const QUICK_QUANTITIES = [1, 5, 10, 25, 50, 100];

export function AdjustmentModal({
  isOpen,
  onClose,
  adjustmentType,
  adjustmentQuantity,
  onQuantityChange,
  adjustmentReason,
  onReasonChange,
  adjustmentNotes,
  onNotesChange,
  onSubmit,
  hasSizeVariants,
  sizes,
  selectedSize,
  onSelectSize,
  sizeStockMap,
  currentSizeStock,
  totalStock,
}: AdjustmentModalProps) {
  const getIconComponent = () => {
    switch (adjustmentType) {
      case 'add':
        return <PiPlus className="h-6 w-6 text-green-600" />;
      case 'remove':
        return <PiMinus className="h-6 w-6 text-red-600" />;
      case 'set':
        return <PiPencil className="h-6 w-6 text-blue-600" />;
    }
  };

  const getIconBgClass = () => {
    switch (adjustmentType) {
      case 'add':
        return 'bg-green-100';
      case 'remove':
        return 'bg-red-100';
      case 'set':
        return 'bg-blue-100';
    }
  };

  const getTitle = () => {
    switch (adjustmentType) {
      case 'add':
        return 'Add Stock';
      case 'remove':
        return 'Remove Stock';
      case 'set':
        return 'Set Stock';
    }
  };

  const calculateNewStock = () => {
    switch (adjustmentType) {
      case 'add':
        return currentSizeStock + adjustmentQuantity;
      case 'remove':
        return Math.max(0, currentSizeStock - adjustmentQuantity);
      case 'set':
        return adjustmentQuantity;
    }
  };

  const canSubmit =
    adjustmentQuantity > 0 &&
    adjustmentReason &&
    !(adjustmentType === 'remove' && adjustmentQuantity > currentSizeStock);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${getIconBgClass()}`}
                >
                  {getIconComponent()}
                </div>
                <div>
                  <Text className="text-xl font-bold">{getTitle()}</Text>
                  {hasSizeVariants && selectedSize ? (
                    <Text className="text-sm text-gray-500">
                      {sizes.find((s) => s?.size === selectedSize)?.label || selectedSize}:{' '}
                      {currentSizeStock} units
                    </Text>
                  ) : (
                    <Text className="text-sm text-gray-500">Current: {totalStock} units</Text>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <PiX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Size Variant Selector */}
              {hasSizeVariants && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Size Variant
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s?.size}
                        type="button"
                        onClick={() => onSelectSize(s?.size)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                          selectedSize === s?.size
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {s?.label || s?.size} ({sizeStockMap[s?.size] || 0})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {adjustmentType === 'set' ? 'New Stock Level' : 'Quantity'}
                  {hasSizeVariants && selectedSize && (
                    <span className="ml-1 text-purple-600">
                      ({sizes.find((s) => s?.size === selectedSize)?.label || selectedSize})
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  min="0"
                  max={adjustmentType === 'remove' ? currentSizeStock : undefined}
                  value={adjustmentQuantity}
                  onChange={(e) => onQuantityChange(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                  className="text-lg"
                  autoFocus
                />
                {adjustmentQuantity > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Text className="text-sm text-gray-500">New stock:</Text>
                    <Badge
                      color={
                        adjustmentType === 'add'
                          ? 'success'
                          : adjustmentType === 'remove'
                          ? 'warning'
                          : 'info'
                      }
                    >
                      {calculateNewStock()} units
                    </Badge>
                    {hasSizeVariants && (
                      <Text className="text-xs text-gray-400">
                        (Total:{' '}
                        {adjustmentType === 'add'
                          ? totalStock + adjustmentQuantity
                          : adjustmentType === 'remove'
                          ? Math.max(0, totalStock - adjustmentQuantity)
                          : adjustmentQuantity}
                        )
                      </Text>
                    )}
                  </div>
                )}
                {adjustmentType === 'remove' && adjustmentQuantity > currentSizeStock && (
                  <Text className="mt-1 text-xs text-red-500">
                    Cannot remove more than current stock ({currentSizeStock})
                  </Text>
                )}
              </div>

              {/* Reason Select */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Reason *</label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  required
                >
                  <option value="">Select a reason...</option>
                  {REASON_OPTIONS[adjustmentType].map((opt) => (
                    <option key={opt.value} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Quantity Buttons */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUANTITIES.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => onQuantityChange(amt)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        adjustmentQuantity === amt
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes (Optional)
                </label>
                <Textarea
                  value={adjustmentNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Additional details..."
                  rows={2}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="flex-1">
                Confirm {getTitle()}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
