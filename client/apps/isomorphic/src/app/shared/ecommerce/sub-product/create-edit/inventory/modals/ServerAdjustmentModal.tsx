'use client';

import { Input, Text, Textarea, Button } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { PiX } from 'react-icons/pi';

interface ServerAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  adjustmentType: 'received' | 'adjustment_in' | 'adjustment_out';
  onTypeChange: (type: 'received' | 'adjustment_in' | 'adjustment_out') => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
}

export function ServerAdjustmentModal({
  isOpen,
  onClose,
  adjustmentType,
  onTypeChange,
  quantity,
  onQuantityChange,
  reason,
  onReasonChange,
  notes,
  onNotesChange,
  onSubmit,
}: ServerAdjustmentModalProps) {
  const canSubmit = quantity > 0 && reason.trim().length > 0;

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
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Text className="text-xl font-bold">Record Stock Movement</Text>
                <Text className="text-sm text-gray-500">Record inventory changes in the system</Text>
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
              {/* Movement Type */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Movement Type
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) =>
                    onTypeChange(e.target.value as typeof adjustmentType)
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                >
                  <option value="received">Received (Stock In)</option>
                  <option value="adjustment_in">Adjustment In</option>
                  <option value="adjustment_out">Adjustment Out</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => onQuantityChange(Number(e.target.value))}
                  placeholder="Enter quantity"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Reason</label>
                <Input
                  value={reason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  placeholder="e.g., Restock, Damaged, Inventory count"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes (Optional)
                </label>
                <Textarea
                  value={notes}
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
                Record Movement
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
