'use client';

import { Input, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiMinus, PiPlus, PiArrowUUpLeft, PiArrowUDownLeft } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';

interface QuickAddRemoveBarProps {
  stockAdjustAmount: number;
  onStockAdjustAmountChange: (amount: number) => void;
  onStockAdjust: (delta: number) => void;
  totalStock: number;
  onOpenAdjustmentModal: (type: 'add' | 'remove') => void;
}

const QUICK_AMOUNTS = [1, 5, 10, 25, 50];

export function QuickAddRemoveBar({
  stockAdjustAmount,
  onStockAdjustAmountChange,
  onStockAdjust,
  totalStock,
  onOpenAdjustmentModal,
}: QuickAddRemoveBarProps) {
  return (
    <motion.div
      variants={fieldStaggerVariants}
      className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Quick Adjust Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Decrease Button */}
            <button
              type="button"
              onClick={() => onStockAdjust(-stockAdjustAmount)}
              disabled={totalStock <= 0}
              className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
            >
              <PiMinus className="h-6 w-6" />
            </button>

            {/* Amount Input */}
            <div className="text-center">
              <Input
                type="number"
                min="1"
                value={stockAdjustAmount}
                onChange={(e) =>
                  onStockAdjustAmountChange(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-20 text-center font-bold"
              />
            </div>

            {/* Increase Button */}
            <button
              type="button"
              onClick={() => onStockAdjust(stockAdjustAmount)}
              className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-green-200 bg-green-50 text-green-600 transition-all hover:bg-green-100 hover:border-green-300"
            >
              <PiPlus className="h-6 w-6" />
            </button>
          </div>

          {/* Separator */}
          <div className="h-10 w-px bg-gray-300" />

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => onStockAdjustAmountChange(amt)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  stockAdjustAmount === amt
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                x{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenAdjustmentModal('remove')}>
            <PiArrowUDownLeft className="mr-1 h-4 w-4" /> Remove
          </Button>
          <Button onClick={() => onOpenAdjustmentModal('add')}>
            <PiArrowUUpLeft className="mr-1 h-4 w-4" /> Add Stock
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
