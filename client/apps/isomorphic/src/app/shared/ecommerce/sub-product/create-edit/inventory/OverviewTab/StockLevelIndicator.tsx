'use client';

import { Text } from 'rizzui';
import { motion } from 'framer-motion';
import { fieldStaggerVariants } from '../../animations';

interface StockLevelIndicatorProps {
  availableStock: number;
  lowStockThreshold: number;
  stockStatus: string;
}

export function StockLevelIndicator({
  availableStock,
  lowStockThreshold,
  stockStatus,
}: StockLevelIndicatorProps) {
  // Don't show for pre-order or discontinued
  if (stockStatus === 'pre_order' || stockStatus === 'discontinued') {
    return null;
  }

  const getBarColor = () => {
    if (availableStock === 0) return 'bg-red-500';
    if (availableStock <= lowStockThreshold) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getBarWidth = () => {
    const percentage = Math.min(100, (availableStock / (lowStockThreshold * 3)) * 100);
    return `${percentage}%`;
  };

  return (
    <motion.div variants={fieldStaggerVariants}>
      <div className="flex items-center justify-between mb-2">
        <Text className="text-sm font-medium text-gray-700">Stock Level</Text>
        <Text className="text-xs text-gray-500">
          {availableStock} / {lowStockThreshold}
        </Text>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: getBarWidth() }}
        />
      </div>
    </motion.div>
  );
}
