'use client';

import { Text, Badge } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPackage, PiCheckCircle, PiHandPalm, PiMinus, PiPlus } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import { STOCK_STATUS_OPTIONS } from '../shared/constants';

interface StockSummaryCardsProps {
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  stockStatus: string;
  daysUntilStockout: number;
  onReservedAdjust: (delta: number) => void;
}

export function StockSummaryCards({
  totalStock,
  availableStock,
  reservedStock,
  stockStatus,
  daysUntilStockout,
  onReservedAdjust,
}: StockSummaryCardsProps) {
  const statusOption = STOCK_STATUS_OPTIONS.find(o => o.value === stockStatus);
  const StatusIcon = statusOption?.icon || PiPackage;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Total Stock Card */}
      <motion.div
        variants={fieldStaggerVariants}
        className={`rounded-xl border-2 p-5 ${statusOption?.border || 'border-gray-200'} ${statusOption?.bg || 'bg-white'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-gray-600">Total Stock</Text>
          <PiPackage className="h-5 w-5 text-gray-400" />
        </div>
        <Text className="text-4xl font-bold text-gray-900">{totalStock || 0}</Text>
        <Text className="mt-2 text-xs text-gray-500">units in inventory</Text>
      </motion.div>

      {/* Available Stock Card */}
      <motion.div
        variants={fieldStaggerVariants}
        className="rounded-xl border-2 border-green-200 bg-green-50 p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-green-700">Available</Text>
          <PiCheckCircle className="h-5 w-5 text-green-500" />
        </div>
        <Text className="text-4xl font-bold text-green-700">{availableStock}</Text>
        <Text className="mt-2 text-xs text-green-600">ready to sell</Text>
      </motion.div>

      {/* Reserved Stock Card */}
      <motion.div
        variants={fieldStaggerVariants}
        className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-amber-700">Reserved</Text>
          <PiHandPalm className="h-5 w-5 text-amber-500" />
        </div>
        <Text className="text-4xl font-bold text-amber-700">{reservedStock || 0}</Text>
        <div className="mt-2 flex gap-1">
          <button
            onClick={() => onReservedAdjust(-1)}
            className="rounded bg-amber-200 p-1 hover:bg-amber-300"
          >
            <PiMinus className="h-3 w-3" />
          </button>
          <button
            onClick={() => onReservedAdjust(1)}
            className="rounded bg-amber-200 p-1 hover:bg-amber-300"
          >
            <PiPlus className="h-3 w-3" />
          </button>
        </div>
      </motion.div>

      {/* Status Card */}
      <motion.div
        variants={fieldStaggerVariants}
        className={`rounded-xl border-2 p-5 ${statusOption?.border || 'border-gray-200'} ${statusOption?.bg || 'bg-white'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-gray-600">Status</Text>
          <StatusIcon className="h-5 w-5 text-gray-400" />
        </div>
        <Badge color={statusOption?.color as any || 'secondary'} className="text-sm">
          {statusOption?.label || 'Unknown'}
        </Badge>
        {daysUntilStockout < 30 && daysUntilStockout !== Infinity && (
          <Text className="mt-2 text-xs text-amber-600">~{daysUntilStockout} days left</Text>
        )}
      </motion.div>
    </div>
  );
}
