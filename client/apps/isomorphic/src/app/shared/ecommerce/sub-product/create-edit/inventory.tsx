// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text } from 'rizzui';
import { motion } from 'framer-motion';
import { PiCube, PiWarning, PiArrowCounterClockwise, PiCheckCircle } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants } from './animations';

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock', icon: PiCheckCircle },
  { value: 'low_stock', label: 'Low Stock', icon: PiWarning },
  { value: 'out_of_stock', label: 'Out of Stock', icon: PiCube },
  { value: 'pre_order', label: 'Pre-Order', icon: PiArrowCounterClockwise },
  { value: 'discontinued', label: 'Discontinued', icon: PiCube },
];

export default function SubProductInventory() {
  const methods = useFormContext();
  const register = methods?.register;
  const errors = methods?.formState?.errors || {};

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Inventory Management</Text>
        <Text className="text-sm text-gray-500">
          Configure stock levels and reorder settings
        </Text>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Stock Status */}
        <motion.div variants={fieldStaggerVariants} custom={2}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Stock Status
          </label>
          <div className="relative">
            <select
              {...register('subProductData.stockStatus')}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STOCK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Total Stock */}
        <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Total Stock
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.totalStock', { valueAsNumber: true })}
              error={errors.subProductData?.totalStock?.message}
              className="w-full pl-9"
            />
            <PiCube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </motion.div>

        {/* Reserved Stock */}
        <motion.div variants={fieldStaggerVariants} custom={4} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Reserved Stock
          </label>
          <Input
            type="number"
            min="0"
            placeholder="0"
            {...register('subProductData.reservedStock', { valueAsNumber: true })}
            error={errors.subProductData?.reservedStock?.message}
            className="w-full"
          />
          <Text className="mt-1 text-xs text-gray-500">
            Stock reserved for pending orders
          </Text>
        </motion.div>

        {/* Available Stock */}
        <motion.div variants={fieldStaggerVariants} custom={5} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Available Stock
          </label>
          <Input
            type="number"
            min="0"
            placeholder="0"
            {...register('subProductData.availableStock', { valueAsNumber: true })}
            error={errors.subProductData?.availableStock?.message}
            className="w-full"
          />
          <Text className="mt-1 text-xs text-gray-500">
            Stock available for new orders
          </Text>
        </motion.div>

        {/* Low Stock Threshold */}
        <motion.div variants={fieldStaggerVariants} custom={6} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Low Stock Threshold
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              placeholder="10"
              {...register('subProductData.lowStockThreshold', { valueAsNumber: true })}
              error={errors.subProductData?.lowStockThreshold?.message}
              className="w-full pl-9"
            />
            <PiWarning className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Alert when stock falls below this number
          </Text>
        </motion.div>

        {/* Reorder Point */}
        <motion.div variants={fieldStaggerVariants} custom={7} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Reorder Point
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              placeholder="5"
              {...register('subProductData.reorderPoint', { valueAsNumber: true })}
              error={errors.subProductData?.reorderPoint?.message}
              className="w-full pl-9"
            />
            <PiArrowCounterClockwise className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Stock level that triggers reorder
          </Text>
        </motion.div>

        {/* Reorder Quantity */}
        <motion.div variants={fieldStaggerVariants} custom={8} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Reorder Quantity
          </label>
          <Input
            type="number"
            min="1"
            placeholder="50"
            {...register('subProductData.reorderQuantity', { valueAsNumber: true })}
            error={errors.subProductData?.reorderQuantity?.message}
            className="w-full"
          />
          <Text className="mt-1 text-xs text-gray-500">
            Amount to reorder when triggered
          </Text>
        </motion.div>
      </div>
    </motion.div>
  );
}
