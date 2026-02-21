// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge } from 'rizzui';
import { motion } from 'framer-motion';
import { 
  PiCube, PiWarning, PiArrowCounterClockwise, PiCheckCircle, PiPlus, 
  PiMinus, PiCalendar, PiWarehouse, PiPackage, PiTrendUp, PiTrendDown,
  PiArrowsDownUp
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants } from './animations';

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock', icon: PiCheckCircle, color: 'success' },
  { value: 'low_stock', label: 'Low Stock', icon: PiWarning, color: 'warning' },
  { value: 'out_of_stock', label: 'Out of Stock', icon: PiCube, color: 'danger' },
  { value: 'pre_order', label: 'Pre-Order', icon: PiArrowCounterClockwise, color: 'info' },
  { value: 'discontinued', label: 'Discontinued', icon: PiCube, color: 'secondary' },
];

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
};

export default function SubProductInventory() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const totalStock = watch?.('subProductData.totalStock') || 0;
  const reservedStock = watch?.('subProductData.reservedStock') || 0;
  const lowStockThreshold = watch?.('subProductData.lowStockThreshold') || 10;
  const reorderPoint = watch?.('subProductData.reorderPoint') || 5;
  const costPrice = watch?.('subProductData.costPrice');
  const currency = watch?.('subProductData.currency') || 'NGN';
  
  const currencySymbol = currencySymbols[currency] || '₦';

  const availableStock = Math.max(0, totalStock - reservedStock);
  
  const [autoCalculateAvailable, setAutoCalculateAvailable] = useState(true);

  useEffect(() => {
    if (autoCalculateAvailable) {
      const calculated = Math.max(0, (totalStock || 0) - (reservedStock || 0));
      setValue?.('subProductData.availableStock', calculated);
    }
  }, [totalStock, reservedStock, autoCalculateAvailable, setValue]);

  useEffect(() => {
    const stockStatus = watch?.('subProductData.stockStatus');
    if (stockStatus === 'in_stock') {
      if (availableStock <= lowStockThreshold && availableStock > 0) {
        setValue?.('subProductData.stockStatus', 'low_stock');
      } else if (availableStock === 0) {
        setValue?.('subProductData.stockStatus', 'out_of_stock');
      }
    }
  }, [availableStock, lowStockThreshold, watch, setValue]);

  const handleTotalStockChange = (delta: number) => {
    const current = totalStock || 0;
    const newValue = Math.max(0, current + delta);
    setValue?.('subProductData.totalStock', newValue);
  };

  const handleReservedStockChange = (delta: number) => {
    const current = reservedStock || 0;
    const newValue = Math.max(0, current + delta);
    setValue?.('subProductData.reservedStock', newValue);
  };

  const getCurrentStockStatus = () => {
    if (availableStock === 0) return 'out_of_stock';
    if (availableStock <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
  };

  const currentStatus = getCurrentStockStatus();
  const inventoryValue = (costPrice && totalStock) ? (costPrice * totalStock) : 0;
  const potentialRevenue = (watch?.('subProductData.baseSellingPrice') && totalStock) 
    ? (watch('subProductData.baseSellingPrice') * totalStock) 
    : 0;

  const StatusIcon = STOCK_STATUS_OPTIONS.find(o => o.value === currentStatus)?.icon || PiCube;
  const statusColor = currentStatus === 'in_stock' ? 'success' : currentStatus === 'low_stock' ? 'warning' : 'danger';

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
          Configure stock levels, reorder settings, and track inventory value
        </Text>
      </motion.div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Stock */}
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Text className="text-xs font-medium text-gray-500">Total Stock</Text>
            <PiPackage className="h-4 w-4 text-blue-500" />
          </div>
          <Text className="text-2xl font-bold text-gray-900">{totalStock || 0}</Text>
          <div className="flex gap-1 mt-2">
            <button
              type="button"
              onClick={() => handleTotalStockChange(-1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <PiMinus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => handleTotalStockChange(1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <PiPlus className="h-3 w-3" />
            </button>
          </div>
        </motion.div>

        {/* Available Stock */}
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Text className="text-xs font-medium text-gray-500">Available</Text>
            <PiCheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <Text className="text-2xl font-bold text-green-600">{availableStock}</Text>
          <Text className="text-xs text-gray-400 mt-1">Ready to sell</Text>
        </motion.div>

        {/* Reserved Stock */}
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Text className="text-xs font-medium text-gray-500">Reserved</Text>
            <PiCube className="h-4 w-4 text-amber-500" />
          </div>
          <Text className="text-2xl font-bold text-amber-600">{reservedStock || 0}</Text>
          <div className="flex gap-1 mt-2">
            <button
              type="button"
              onClick={() => handleReservedStockChange(-1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <PiMinus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => handleReservedStockChange(1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <PiPlus className="h-3 w-3" />
            </button>
          </div>
        </motion.div>

        {/* Stock Status */}
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Text className="text-xs font-medium text-gray-500">Status</Text>
            <StatusIcon className={`h-4 w-4 text-${statusColor}-500`} />
          </div>
          <Badge color={statusColor} className="text-sm">
            {STOCK_STATUS_OPTIONS.find(o => o.value === currentStatus)?.label || 'Unknown'}
          </Badge>
          <Text className="text-xs text-gray-400 mt-1">Auto-detected</Text>
        </motion.div>
      </div>

      {/* Inventory Value */}
      {(inventoryValue > 0 || potentialRevenue > 0) && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <PiTrendDown className="h-4 w-4 text-amber-600" />
              <Text className="text-sm font-medium text-amber-800">Inventory Value (Cost)</Text>
            </div>
            <Text className="text-xl font-bold text-amber-700">
              {currencySymbol}{inventoryValue.toLocaleString()}
            </Text>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <PiTrendUp className="h-4 w-4 text-green-600" />
              <Text className="text-sm font-medium text-green-800">Potential Revenue</Text>
            </div>
            <Text className="text-xl font-bold text-green-700">
              {currencySymbol}{potentialRevenue.toLocaleString()}
            </Text>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Stock Status */}
        <motion.div variants={fieldStaggerVariants} custom={2}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Stock Status
          </label>
          <Controller
            name="subProductData.stockStatus"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STOCK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
        </motion.div>

        {/* Auto-calculate Available Stock Toggle */}
        <motion.div variants={fieldStaggerVariants} custom={2}>
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-700">Auto-calculate Available</Text>
              <Text className="text-xs text-gray-500">Automatically calc: Total - Reserved</Text>
            </div>
            <Switch
              checked={autoCalculateAvailable}
              onChange={(checked) => setAutoCalculateAvailable(checked)}
            />
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
            <PiPackage className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </motion.div>

        {/* Available Stock (Manual override) */}
        {!autoCalculateAvailable && (
          <motion.div variants={fieldStaggerVariants} custom={4} className="transition-transform duration-200 focus-within:scale-[1.01]">
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
          </motion.div>
        )}

        {/* Reserved Stock */}
        <motion.div variants={fieldStaggerVariants} custom={5} className="transition-transform duration-200 focus-within:scale-[1.01]">
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

      {/* Restock Dates */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Restock Schedule (Optional)</Text>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Last Restock Date */}
          <motion.div variants={fieldStaggerVariants}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Last Restock Date
            </label>
            <div className="relative">
              <Input
                type="date"
                {...register('subProductData.lastRestockDate')}
                className="w-full pl-9"
              />
              <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </motion.div>

          {/* Next Restock Date */}
          <motion.div variants={fieldStaggerVariants}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Next Restock Date
            </label>
            <div className="relative">
              <Input
                type="date"
                {...register('subProductData.nextRestockDate')}
                className="w-full pl-9"
              />
              <PiWarehouse className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setValue?.('subProductData.totalStock', 0);
              setValue?.('subProductData.availableStock', 0);
              setValue?.('subProductData.stockStatus', 'out_of_stock');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <PiCube className="h-4 w-4" />
            Out of Stock
          </button>
          <button
            type="button"
            onClick={() => {
              setValue?.('subProductData.totalStock', 100);
              setValue?.('subProductData.stockStatus', 'in_stock');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
          >
            <PiPlus className="h-4 w-4" />
            Add Stock
          </button>
          <button
            type="button"
            onClick={() => {
              setValue?.('subProductData.totalStock', 0);
              setValue?.('subProductData.availableStock', 0);
              setValue?.('subProductData.stockStatus', 'pre_order');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <PiArrowCounterClockwise className="h-4 w-4" />
            Pre-Order
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
