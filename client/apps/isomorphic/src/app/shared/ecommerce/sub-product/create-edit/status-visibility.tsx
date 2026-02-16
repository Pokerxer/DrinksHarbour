// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Switch } from 'rizzui';
import { motion } from 'framer-motion';
import { PiEye, PiStar, PiSparkle, PiCrown, PiCalendar } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'low_stock', label: 'Low Stock', color: 'orange' },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'red' },
  { value: 'discontinued', label: 'Discontinued', color: 'gray' },
  { value: 'hidden', label: 'Hidden', color: 'gray' },
  { value: 'archived', label: 'Archived', color: 'gray' },
];

export default function SubProductStatusVisibility() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const errors = methods?.formState?.errors || {};

  const status = watch?.('subProductData.status');
  const isFeaturedByTenant = watch?.('subProductData.isFeaturedByTenant');
  const isNewArrival = watch?.('subProductData.isNewArrival');
  const isBestSeller = watch?.('subProductData.isBestSeller');

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Status & Visibility</Text>
        <Text className="text-sm text-gray-500">
          Control the visibility and featured status of this sub-product
        </Text>
      </motion.div>

      {/* Status */}
      <motion.div variants={fieldStaggerVariants} custom={1}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          {...register('subProductData.status')}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Activation/Deactivation Dates */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={2}
        className="grid gap-6 md:grid-cols-2"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Activated At
          </label>
          <div className="relative">
            <Input
              type="datetime-local"
              {...register('subProductData.activatedAt')}
              className="w-full pl-9"
            />
            <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Deactivated At
          </label>
          <div className="relative">
            <Input
              type="datetime-local"
              {...register('subProductData.deactivatedAt')}
              className="w-full pl-9"
            />
            <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Discontinued At
          </label>
          <div className="relative">
            <Input
              type="datetime-local"
              {...register('subProductData.discontinuedAt')}
              className="w-full pl-9"
            />
            <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </motion.div>

      {/* Visibility Toggles */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={3}
        className="space-y-4 rounded-lg border border-gray-200 p-4"
      >
        <Text className="font-medium">Visibility Options</Text>

        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <PiStar className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <Text className="font-medium">Featured by Tenant</Text>
              <Text className="text-sm text-gray-500">
                Highlight this product in featured sections
              </Text>
            </div>
          </div>
          <Switch
            checked={isFeaturedByTenant}
            onChange={(checked) => setValue('subProductData.isFeaturedByTenant', checked)}
          />
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <PiSparkle className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <Text className="font-medium">New Arrival</Text>
              <Text className="text-sm text-gray-500">
                Mark as a new arrival
              </Text>
            </div>
          </div>
          <Switch
            checked={isNewArrival}
            onChange={(checked) => setValue('subProductData.isNewArrival', checked)}
          />
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <PiCrown className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <Text className="font-medium">Best Seller</Text>
              <Text className="text-sm text-gray-500">
                Mark as a best seller
              </Text>
            </div>
          </div>
          <Switch
            checked={isBestSeller}
            onChange={(checked) => setValue('subProductData.isBestSeller', checked)}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
