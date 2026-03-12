'use client';

import { Text } from 'rizzui';
import { motion } from 'framer-motion';
import { PiTrendDown, PiTrendUp, PiPiggyBank } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';

interface InventoryValueCardsProps {
  inventoryValue: number;
  potentialRevenue: number;
  profitMargin: number;
  currencySymbol: string;
}

export function InventoryValueCards({
  inventoryValue,
  potentialRevenue,
  profitMargin,
  currencySymbol,
}: InventoryValueCardsProps) {
  if (inventoryValue <= 0 && potentialRevenue <= 0) {
    return null;
  }

  return (
    <motion.div variants={fieldStaggerVariants} className="grid gap-4 md:grid-cols-3">
      {/* Inventory Value */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <PiTrendDown className="h-5 w-5 text-amber-600" />
          <Text className="font-medium text-amber-800">Inventory Value</Text>
        </div>
        <Text className="text-2xl font-bold text-amber-700">
          {currencySymbol}
          {inventoryValue.toLocaleString()}
        </Text>
      </div>

      {/* Potential Revenue */}
      <div className="rounded-xl bg-green-50 border border-green-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <PiTrendUp className="h-5 w-5 text-green-600" />
          <Text className="font-medium text-green-800">Potential Revenue</Text>
        </div>
        <Text className="text-2xl font-bold text-green-700">
          {currencySymbol}
          {potentialRevenue.toLocaleString()}
        </Text>
      </div>

      {/* Profit Margin */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <PiPiggyBank className="h-5 w-5 text-blue-600" />
          <Text className="font-medium text-blue-800">Profit Margin</Text>
        </div>
        <Text className="text-2xl font-bold text-blue-700">{profitMargin.toFixed(1)}%</Text>
      </div>
    </motion.div>
  );
}
