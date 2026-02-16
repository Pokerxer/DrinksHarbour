// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text } from 'rizzui';
import { motion } from 'framer-motion';
import { PiStorefront, PiFactory, PiNumberCircleOne, PiTimer, PiNumberCircleTwo } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants } from './animations';

export default function SubProductVendor() {
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
        <Text className="mb-2 text-lg font-semibold">Vendor & Sourcing</Text>
        <Text className="text-sm text-gray-500">
          Configure supplier and sourcing information
        </Text>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vendor */}
        <motion.div variants={fieldStaggerVariants} custom={1} className="col-span-2 transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Vendor
          </label>
          <div className="relative">
            <Input
              placeholder="Select or enter vendor"
              {...register('subProductData.vendor')}
              className="w-full pl-10"
            />
            <PiStorefront className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </motion.div>

        {/* Supplier SKU */}
        <motion.div variants={fieldStaggerVariants} custom={2} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Supplier SKU
          </label>
          <div className="relative">
            <Input
              placeholder="Supplier's SKU for this product"
              {...register('subProductData.supplierSKU')}
              className="w-full pl-10"
            />
            <PiFactory className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </motion.div>

        {/* Supplier Price */}
        <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Supplier Price
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('subProductData.supplierPrice', { valueAsNumber: true })}
            className="w-full"
          />
        </motion.div>

        {/* Lead Time */}
        <motion.div variants={fieldStaggerVariants} custom={4} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Lead Time (Days)
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.leadTimeDays', { valueAsNumber: true })}
              className="w-full pl-10"
            />
            <PiTimer className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Days from order to delivery
          </Text>
        </motion.div>

        {/* Minimum Order Quantity */}
        <motion.div variants={fieldStaggerVariants} custom={5} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Minimum Order Quantity
          </label>
          <Input
            type="number"
            min="0"
            placeholder="0"
            {...register('subProductData.minimumOrderQuantity', { valueAsNumber: true })}
            className="w-full"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
