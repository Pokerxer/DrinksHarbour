'use client';

import { Input, Text, Textarea, Badge, Button } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { PiArrowsLeftRight, PiX, PiArrowRight } from 'react-icons/pi';
import { WAREHOUSE_OPTIONS } from '../shared/constants';
import type { SizeVariant } from '../shared/types';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferQuantity: number;
  onQuantityChange: (qty: number) => void;
  transferFromWarehouse: string;
  onFromWarehouseChange: (warehouse: string) => void;
  transferToWarehouse: string;
  onToWarehouseChange: (warehouse: string) => void;
  transferNotes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  
  // Size variant props
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  selectedSize: string;
  onSelectSize: (size: string) => void;
  sizeStockMap: Record<string, number>;
  currentSizeStock: number;
  availableStock: number;
}

export function TransferModal({
  isOpen,
  onClose,
  transferQuantity,
  onQuantityChange,
  transferFromWarehouse,
  onFromWarehouseChange,
  transferToWarehouse,
  onToWarehouseChange,
  transferNotes,
  onNotesChange,
  onSubmit,
  hasSizeVariants,
  sizes,
  selectedSize,
  onSelectSize,
  sizeStockMap,
  currentSizeStock,
  availableStock,
}: TransferModalProps) {
  const maxQuantity = hasSizeVariants && selectedSize ? currentSizeStock : availableStock;
  const fromWarehouse = WAREHOUSE_OPTIONS.find((w) => w.value === transferFromWarehouse);
  const toWarehouse = WAREHOUSE_OPTIONS.find((w) => w.value === transferToWarehouse);

  const canSubmit =
    transferQuantity > 0 &&
    transferQuantity <= maxQuantity &&
    transferFromWarehouse &&
    transferToWarehouse &&
    transferFromWarehouse !== transferToWarehouse;

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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                  <PiArrowsLeftRight className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <Text className="text-xl font-bold">Transfer Stock</Text>
                  <Text className="text-sm text-gray-500">Move stock between locations</Text>
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

              {/* Transfer Quantity */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Transfer Quantity *
                  {hasSizeVariants && selectedSize && (
                    <span className="ml-1 text-purple-600">
                      ({sizes.find((s) => s?.size === selectedSize)?.label || selectedSize})
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={transferQuantity}
                  onChange={(e) => onQuantityChange(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity to transfer"
                  className="text-lg"
                />
                <Text className="mt-1 text-xs text-gray-500">Available: {maxQuantity} units</Text>
              </div>

              {/* Warehouse Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* From Warehouse */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    From Warehouse *
                  </label>
                  <div className="space-y-2">
                    <select
                      value={transferFromWarehouse}
                      onChange={(e) => onFromWarehouseChange(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      <option value="">Select source warehouse...</option>
                      {WAREHOUSE_OPTIONS.map((wh) => (
                        <option key={wh.value} value={wh.value}>
                          {wh.label} {wh.isDefault && '(Default)'}
                        </option>
                      ))}
                    </select>
                    {transferFromWarehouse && (
                      <Text className="text-xs text-gray-500">{fromWarehouse?.address}</Text>
                    )}
                  </div>
                </div>

                {/* To Warehouse */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    To Warehouse *
                  </label>
                  <div className="space-y-2">
                    <select
                      value={transferToWarehouse}
                      onChange={(e) => onToWarehouseChange(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      <option value="">Select destination warehouse...</option>
                      {WAREHOUSE_OPTIONS.map((wh) => (
                        <option
                          key={wh.value}
                          value={wh.value}
                          disabled={wh.value === transferFromWarehouse}
                        >
                          {wh.label} {wh.isDefault && '(Default)'}
                        </option>
                      ))}
                    </select>
                    {transferToWarehouse && (
                      <Text className="text-xs text-gray-500">{toWarehouse?.address}</Text>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes (Optional)
                </label>
                <Textarea
                  value={transferNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Transfer notes..."
                  rows={2}
                />
              </div>

              {/* Transfer Preview */}
              {transferFromWarehouse && transferToWarehouse && transferQuantity > 0 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <Text className="text-sm font-medium text-purple-800 mb-2">Transfer Preview</Text>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                      <Text className="text-xs text-gray-500">From</Text>
                      <Text className="font-semibold text-purple-700">{fromWarehouse?.label}</Text>
                    </div>
                    <div className="flex flex-col items-center">
                      <PiArrowRight className="h-5 w-5 text-purple-400" />
                      <Badge color="primary" variant="flat" className="mt-1">
                        {transferQuantity} units
                      </Badge>
                    </div>
                    <div className="text-center">
                      <Text className="text-xs text-gray-500">To</Text>
                      <Text className="font-semibold text-purple-700">{toWarehouse?.label}</Text>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="flex-1">
                <PiArrowsLeftRight className="mr-1 h-4 w-4" /> Confirm Transfer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
