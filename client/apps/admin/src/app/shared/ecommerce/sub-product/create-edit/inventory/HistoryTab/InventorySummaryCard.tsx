'use client';

import { Text, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPlus, PiSpinner } from 'react-icons/pi';
import type { InventorySummary } from '@/services/inventory.service';

interface InventorySummaryCardProps {
  subProductId: string | undefined;
  inventorySummary: InventorySummary | null;
  isLoading: boolean;
  onRecordStock: () => void;
}

export function InventorySummaryCard({
  subProductId,
  inventorySummary,
  isLoading,
  onRecordStock,
}: InventorySummaryCardProps) {
  if (!subProductId) {
    return null;
  }

  return (
    <motion.div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Text className="font-semibold text-lg">Inventory Summary</Text>
          {isLoading && <PiSpinner className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <Button size="sm" variant="outline" onClick={onRecordStock}>
          <PiPlus className="mr-1 h-4 w-4" /> Record Stock
        </Button>
      </div>

      {inventorySummary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <Text className="text-xs text-blue-600 font-medium">Current Stock</Text>
            <Text className="text-2xl font-bold text-blue-700">
              {inventorySummary.subProduct?.totalStock || 0}
            </Text>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-100">
            <Text className="text-xs text-green-600 font-medium">Total Received</Text>
            <Text className="text-2xl font-bold text-green-700">
              {inventorySummary.totals?.received || 0}
            </Text>
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-100">
            <Text className="text-xs text-red-600 font-medium">Total Sold</Text>
            <Text className="text-2xl font-bold text-red-700">
              {inventorySummary.totals?.sold || 0}
            </Text>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
            <Text className="text-xs text-amber-600 font-medium">Returned</Text>
            <Text className="text-2xl font-bold text-amber-700">
              {inventorySummary.totals?.returned || 0}
            </Text>
          </div>
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
            <Text className="text-xs text-purple-600 font-medium">Adjusted</Text>
            <Text className="text-2xl font-bold text-purple-700">
              {inventorySummary.totals?.adjusted || 0}
            </Text>
          </div>
        </div>
      ) : (
        <Text className="text-sm text-gray-500">
          {!subProductId
            ? 'Save the product to start tracking inventory.'
            : 'No inventory data available.'}
        </Text>
      )}
    </motion.div>
  );
}
