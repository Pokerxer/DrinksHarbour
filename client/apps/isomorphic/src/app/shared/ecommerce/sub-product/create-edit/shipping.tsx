// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Switch } from 'rizzui';
import { motion } from 'framer-motion';
import { PiTruck, PiWarning, PiHourglass, PiFactory, PiMapPin, PiPackage } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';

export default function SubProductShipping() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;

  const shipping = watch?.('subProductData.shipping') || {};
  const warehouse = watch?.('subProductData.warehouse') || {};

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Shipping & Logistics</Text>
        <Text className="text-sm text-gray-500">
          Configure shipping details and warehouse location
        </Text>
      </motion.div>

      {/* Dimensions */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <PiPackage className="h-5 w-5 text-blue-500" />
          <Text className="font-medium">Package Dimensions</Text>
        </div>
        
        <div className="grid gap-6 md:grid-cols-4">
          <motion.div variants={fieldStaggerVariants} custom={2} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Weight (g)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.weight', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Length (cm)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.length', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={4} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Width (cm)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.width', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={5} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Height (cm)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.height', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Shipping Options */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={6}
        className="space-y-4 rounded-lg border border-gray-200 p-4"
      >
        <div className="flex items-center gap-2">
          <PiTruck className="h-5 w-5 text-blue-500" />
          <Text className="font-medium">Shipping Options</Text>
        </div>

        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <PiWarning className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <Text className="font-medium">Fragile</Text>
              <Text className="text-sm text-gray-500">
                This product requires fragile handling
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping.fragile}
            onChange={(checked) => setValue('subProductData.shipping.fragile', checked)}
          />
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <PiHourglass className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <Text className="font-medium">Requires Age Verification</Text>
              <Text className="text-sm text-gray-500">
                Customer must verify age at delivery
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping.requiresAgeVerification}
            onChange={(checked) => setValue('subProductData.shipping.requiresAgeVerification', checked)}
          />
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
              <PiFactory className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <Text className="font-medium">Hazmat</Text>
              <Text className="text-sm text-gray-500">
                This is a hazardous material
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping.hazmat}
            onChange={(checked) => setValue('subProductData.shipping.hazmat', checked)}
          />
        </motion.div>

        <motion.div variants={fieldStaggerVariants} custom={9} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Shipping Class
          </label>
          <Input
            placeholder="e.g., Standard, Express"
            {...register('subProductData.shipping.shippingClass')}
            className="w-full"
          />
        </motion.div>
      </motion.div>

      {/* Warehouse Location */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={10}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <PiMapPin className="h-5 w-5 text-blue-500" />
          <Text className="font-medium">Warehouse Location</Text>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <motion.div variants={fieldStaggerVariants} custom={11} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Location
            </label>
            <Input
              placeholder="Warehouse location"
              {...register('subProductData.warehouse.location')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={12} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Zone
            </label>
            <Input
              placeholder="Zone"
              {...register('subProductData.warehouse.zone')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={13} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Aisle
            </label>
            <Input
              placeholder="Aisle"
              {...register('subProductData.warehouse.aisle')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={14} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Shelf
            </label>
            <Input
              placeholder="Shelf"
              {...register('subProductData.warehouse.shelf')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={15} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Bin
            </label>
            <Input
              placeholder="Bin"
              {...register('subProductData.warehouse.bin')}
              className="w-full"
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
