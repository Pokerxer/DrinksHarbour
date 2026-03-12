'use client';

import { Text, Input, Switch } from 'rizzui';
import { motion } from 'framer-motion';
import { fieldStaggerVariants } from '../../animations';

interface StockSettingsProps {
  autoCalculateAvailable: boolean;
  onAutoCalculateChange: (checked: boolean) => void;
  lowStockThreshold: number;
  onLowStockThresholdChange: (value: number) => void;
  reorderPoint: number;
  onReorderPointChange: (value: number) => void;
  reorderQuantity: number;
  onReorderQuantityChange: (value: number) => void;
}

export function StockSettings({
  autoCalculateAvailable,
  onAutoCalculateChange,
  lowStockThreshold,
  onLowStockThresholdChange,
  reorderPoint,
  onReorderPointChange,
  reorderQuantity,
  onReorderQuantityChange,
}: StockSettingsProps) {
  return (
    <motion.div variants={fieldStaggerVariants}>
      <Text className="mb-3 text-sm font-medium text-gray-700">Settings</Text>
      <div className="grid gap-4 md:grid-cols-4">
        {/* Auto-calculate Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Text className="text-sm font-medium text-gray-700">Auto-calculate</Text>
            <Text className="text-xs text-gray-500">Total - Reserved</Text>
          </div>
          <Switch checked={autoCalculateAvailable} onChange={onAutoCalculateChange} />
        </div>

        {/* Low Stock Threshold */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Low Stock Alert
          </label>
          <Input
            type="number"
            min="0"
            value={lowStockThreshold}
            onChange={(e) => onLowStockThresholdChange(parseInt(e.target.value) || 0)}
            className="w-full"
          />
        </div>

        {/* Reorder Point */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Reorder Point</label>
          <Input
            type="number"
            min="0"
            value={reorderPoint}
            onChange={(e) => onReorderPointChange(parseInt(e.target.value) || 0)}
            className="w-full"
          />
        </div>

        {/* Reorder Quantity */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Reorder Qty</label>
          <Input
            type="number"
            min="1"
            value={reorderQuantity}
            onChange={(e) => onReorderQuantityChange(parseInt(e.target.value) || 50)}
            className="w-full"
          />
        </div>
      </div>
    </motion.div>
  );
}
