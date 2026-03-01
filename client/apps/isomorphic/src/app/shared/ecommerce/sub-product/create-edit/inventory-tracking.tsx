// @ts-nocheck
'use client';

import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Radio, RadioGroup, Input, Text, Badge } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import cn from '@core/utils/class-names';
import {
  PiChartLine,
  PiPackage,
  PiWarning,
  PiCheckCircle,
  PiXCircle,
  PiArrowUp,
  PiArrowDown,
  PiLightning,
  PiCube,
  PiListChecks,
  PiInfo,
} from 'react-icons/pi';

const trackingOptions = [
  {
    value: 'yes',
    label: 'Track Inventory',
    description: 'Monitor stock levels for this product',
    icon: PiChartLine,
    color: 'from-green-400 to-emerald-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
  },
  {
    value: 'no',
    label: 'No Tracking',
    description: 'Unlimited availability (digital products, services)',
    icon: PiXCircle,
    color: 'from-gray-400 to-slate-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-700',
  },
  {
    value: 'by-options',
    label: 'Track by Variants',
    description: 'Separate stock per size, color, or variant',
    icon: PiListChecks,
    color: 'from-purple-400 to-violet-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
  },
];

// Stock level presets
const stockPresets = [
  { label: '12', value: 12, description: 'Case' },
  { label: '24', value: 24, description: '2 Cases' },
  { label: '48', value: 48, description: '4 Cases' },
  { label: '100', value: 100, description: 'Bulk' },
  { label: '500', value: 500, description: 'Wholesale' },
];

// Low stock presets
const lowStockPresets = [
  { label: '5', value: 5, description: 'Very Low' },
  { label: '10', value: 10, description: 'Low' },
  { label: '20', value: 20, description: 'Medium' },
  { label: '50', value: 50, description: 'High' },
];

export default function InventoryTracing() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const trackingMode = watch('inventoryTracking');
  const currentStock = watch('currentStock') || 0;
  const lowStock = watch('lowStock') || 0;

  // Calculate stock status
  const getStockStatus = () => {
    const stock = Number(currentStock);
    const low = Number(lowStock);
    
    if (stock === 0) return { status: 'out', label: 'Out of Stock', color: 'danger', icon: PiXCircle };
    if (stock <= low) return { status: 'low', label: 'Low Stock', color: 'warning', icon: PiWarning };
    if (stock <= low * 2) return { status: 'medium', label: 'Medium Stock', color: 'info', icon: PiInfo };
    return { status: 'good', label: 'In Stock', color: 'success', icon: PiCheckCircle };
  };

  const stockStatus = getStockStatus();
  const stockPercentage = lowStock > 0 ? Math.min((currentStock / (lowStock * 5)) * 100, 100) : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full space-y-6"
    >
      {/* Header with Stock Summary */}
      <div className="relative overflow-hidden rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-100/50" />
        <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-teal-100/50" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg">
              <PiPackage className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-semibold text-gray-900">Inventory Tracking</Text>
              <Text className="text-xs text-gray-500">
                Monitor and manage stock levels
              </Text>
            </div>
          </div>
          
          {trackingMode === 'yes' && (
            <div className="flex items-center gap-2">
              <Badge variant="flat" color={stockStatus.color as any} className="font-medium">
                <stockStatus.icon className="mr-1 h-3.5 w-3.5" />
                {stockStatus.label}
              </Badge>
              <Badge variant="flat" color="primary" className="font-medium">
                {currentStock} units
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Tracking Mode Selection */}
      <Controller
        name="inventoryTracking"
        control={control}
        render={({ field: { onChange, value } }) => (
          <div className="grid gap-3 @lg:grid-cols-3">
            {trackingOptions.map((option, index) => {
              const Icon = option.icon;
              const isSelected = value === option.value;
              
              return (
                <motion.button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all',
                    isSelected
                      ? `${option.borderColor} ${option.bgColor} shadow-lg`
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  )}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="tracking-bg"
                      className={cn(
                        'absolute inset-0 bg-gradient-to-br opacity-10',
                        option.color
                      )}
                    />
                  )}

                  <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gray-100/50" />
                  
                  <div className="relative flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md transition-all',
                        isSelected
                          ? `bg-gradient-to-br ${option.color} text-white`
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <Text
                          className={cn(
                            'font-semibold transition-colors',
                            isSelected ? option.textColor : 'text-gray-800'
                          )}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={cn('rounded-full p-0.5', option.bgColor)}
                          >
                            <PiCheckCircle className={cn('h-4 w-4', option.textColor)} />
                          </motion.div>
                        )}
                      </div>
                      <Text className="mt-0.5 text-xs text-gray-500">
                        {option.description}
                      </Text>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        className={cn(
                          'absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r',
                          option.color
                        )}
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        )}
      />

      {/* Stock Level Configuration */}
      <AnimatePresence>
        {trackingMode === 'yes' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Visual Stock Meter */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <Text className="text-sm font-medium text-gray-700">Stock Level Indicator</Text>
                <Text className={cn('text-sm font-semibold', `text-${stockStatus.color}-600`)}>
                  {stockPercentage.toFixed(0)}% Capacity
                </Text>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stockPercentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={cn(
                    'h-full rounded-full',
                    stockStatus.status === 'out' ? 'bg-red-500' :
                    stockStatus.status === 'low' ? 'bg-amber-500' :
                    stockStatus.status === 'medium' ? 'bg-blue-500' :
                    'bg-green-500'
                  )}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span className="text-amber-600">Low ({lowStock})</span>
                <span className="text-green-600">Optimal</span>
              </div>
            </div>

            {/* Current Stock Input */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                    <PiCube className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <Text className="text-sm font-medium text-gray-700">Current Stock Level</Text>
                    <Text className="text-xs text-gray-500">Units available in inventory</Text>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="0"
                  className="w-32"
                  {...register('currentStock')}
                  error={errors.currentStock?.message as string}
                />
                <div className="flex flex-wrap gap-1">
                  {stockPresets.map((preset) => (
                    <motion.button
                      key={preset.label}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setValue('currentStock', preset.value)}
                      className="flex flex-col items-center rounded-lg bg-gray-100 px-3 py-1.5 hover:bg-emerald-100"
                    >
                      <span className="text-sm font-semibold text-gray-700">{preset.label}</span>
                      <span className="text-xs text-gray-500">{preset.description}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Quick Adjust Buttons */}
              <div className="mt-3 flex items-center gap-2">
                <Text className="text-xs text-gray-500">Quick adjust:</Text>
                {[-10, -5, -1, 1, 5, 10].map((delta) => (
                  <motion.button
                    key={delta}
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      const newValue = Math.max(0, Number(currentStock) + delta);
                      setValue('currentStock', newValue);
                    }}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium',
                      delta > 0
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    )}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Low Stock Threshold */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <PiWarning className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <Text className="text-sm font-medium text-gray-700">Low Stock Alert</Text>
                    <Text className="text-xs text-gray-500">Notify when stock falls below</Text>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="0"
                  className="w-32"
                  {...register('lowStock')}
                  error={errors.lowStock?.message as string}
                />
                <div className="flex flex-wrap gap-1">
                  {lowStockPresets.map((preset) => (
                    <motion.button
                      key={preset.label}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setValue('lowStock', preset.value)}
                      className="flex flex-col items-center rounded-lg bg-gray-100 px-3 py-1.5 hover:bg-amber-100"
                    >
                      <span className="text-sm font-semibold text-gray-700">{preset.label}</span>
                      <span className="text-xs text-gray-500">{preset.description}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock Status Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-xl border p-4',
                stockStatus.status === 'out' ? 'border-red-300 bg-red-50' :
                stockStatus.status === 'low' ? 'border-amber-300 bg-amber-50' :
                stockStatus.status === 'medium' ? 'border-blue-300 bg-blue-50' :
                'border-green-300 bg-green-50'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  stockStatus.status === 'out' ? 'bg-red-500' :
                  stockStatus.status === 'low' ? 'bg-amber-500' :
                  stockStatus.status === 'medium' ? 'bg-blue-500' :
                  'bg-green-500',
                  'text-white'
                )}>
                  <stockStatus.icon className="h-5 w-5" />
                </div>
                <div>
                  <Text className={cn(
                    'font-semibold',
                    stockStatus.status === 'out' ? 'text-red-700' :
                    stockStatus.status === 'low' ? 'text-amber-700' :
                    stockStatus.status === 'medium' ? 'text-blue-700' :
                    'text-green-700'
                  )}>
                    {stockStatus.label}
                  </Text>
                  <Text className="text-xs text-gray-600">
                    {stockStatus.status === 'out' 
                      ? 'Product is out of stock. Restock immediately.'
                      : stockStatus.status === 'low'
                      ? `Only ${currentStock} units left. Consider restocking soon.`
                      : stockStatus.status === 'medium'
                      ? `${currentStock} units available. Stock is at moderate levels.`
                      : `${currentStock} units in stock. Inventory is healthy.`
                    }
                  </Text>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
