// @ts-nocheck
'use client';

import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Select } from 'rizzui';
import { motion } from 'framer-motion';
import { 
  PiTruck, PiWarning, PiHourglass, PiFactory, PiMapPin, PiPackage, 
  PiCurrencyNgn, PiClock, PiStar, PiCheckCircle, PiPercent, PiGift,
  PiArrowsDownUp, PiWarehouse, PiHouse, PiStorefront
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';

const SHIPPING_CARRIERS = [
  { value: 'dhl', label: 'DHL Express' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'ups', label: 'UPS' },
  { value: 'usps', label: 'USPS' },
  { value: 'local_courier', label: 'Local Courier' },
  { value: 'inhouse', label: 'In-House Delivery' },
  { value: 'pickup', label: 'Customer Pickup' },
];

const DELIVERY_AREAS = [
  { value: 'local', label: 'Local Delivery' },
  { value: 'regional', label: 'Regional' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
];

export default function SubProductShipping() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const shipping = watch?.('subProductData.shipping') || {};
  const warehouse = watch?.('subProductData.warehouse') || {};
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') || 0;

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate dimensional weight (L x W x H / 5000)
  const weight = shipping?.weight || 0;
  const length = shipping?.length || 0;
  const width = shipping?.width || 0;
  const height = shipping?.height || 0;
  
  const dimensionalWeight = length && width && height 
    ? Math.ceil((length * width * height) / 5000) 
    : 0;
  
  const chargeableWeight = Math.max(weight, dimensionalWeight);

  // Estimate shipping cost (simplified calculation)
  const estimateShippingCost = () => {
    if (chargeableWeight <= 500) return 1500;
    if (chargeableWeight <= 1000) return 2500;
    if (chargeableWeight <= 2000) return 3500;
    if (chargeableWeight <= 5000) return 5000;
    return 8000;
  };

  const estimatedCost = chargeableWeight > 0 ? estimateShippingCost() : 0;

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
          Configure shipping details, warehouse location, and delivery options
        </Text>
      </motion.div>

      {/* Shipping Summary */}
      {chargeableWeight > 0 && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <PiPackage className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Text className="font-medium text-blue-900">Package Weight</Text>
                <Text className="text-sm text-blue-700">
                  {weight}g actual • {dimensionalWeight}g dimensional
                </Text>
              </div>
            </div>
            <div className="text-right">
              <Text className="text-sm text-blue-600">Chargeable Weight</Text>
              <Text className="text-lg font-bold text-blue-700">{chargeableWeight}g</Text>
            </div>
          </div>
        </motion.div>
      )}

      {/* Free Shipping Option */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="rounded-lg border border-green-200 bg-green-50 p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <PiGift className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <Text className="font-medium text-green-900">Free Shipping</Text>
              <Text className="text-sm text-green-700">
                Offer free shipping to customers
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping?.isFreeShipping || false}
            onChange={(checked) => setValue('subProductData.shipping.isFreeShipping', checked)}
          />
        </div>
        
        {shipping?.isFreeShipping && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Minimum Order Value (₦)
                </label>
                <Input
                  type="number"
                  placeholder="e.g., 10000"
                  {...register('subProductData.shipping.freeShippingMinOrder', { valueAsNumber: true })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Free Shipping Label
                </label>
                <Input
                  placeholder="e.g., Free Delivery"
                  {...register('subProductData.shipping.freeShippingLabel')}
                  className="w-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Dimensions */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiPackage className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Package Dimensions</Text>
          </div>
          {estimatedCost > 0 && !shipping?.isFreeShipping && (
            <Badge color="info">
              Est. Cost: ₦{estimatedCost.toLocaleString()}
            </Badge>
          )}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiTruck className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Shipping Options</Text>
          </div>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>

        {/* Fragile */}
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
                Handle with care
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping?.fragile || false}
            onChange={(checked) => setValue('subProductData.shipping.fragile', checked)}
          />
        </motion.div>

        {/* Age Verification */}
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
            checked={shipping?.requiresAgeVerification || false}
            onChange={(checked) => setValue('subProductData.shipping.requiresAgeVerification', checked)}
          />
        </motion.div>

        {/* Hazmat */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
              <PiFactory className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <Text className="font-medium">Hazardous Material</Text>
              <Text className="text-sm text-gray-500">
                Special shipping required
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping?.hazmat || false}
            onChange={(checked) => setValue('subProductData.shipping.hazmat', checked)}
          />
        </motion.div>

        {/* Show in Store */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <PiStorefront className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <Text className="font-medium">Available for Store Pickup</Text>
              <Text className="text-sm text-gray-500">
                Customers can pick up from store
              </Text>
            </div>
          </div>
          <Switch
            checked={shipping?.availableForPickup || false}
            onChange={(checked) => setValue('subProductData.shipping.availableForPickup', checked)}
          />
        </motion.div>

        {/* Advanced Options */}
        {showAdvanced && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 pt-4 border-t border-gray-200"
          >
            {/* Shipping Class */}
            <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Shipping Class
              </label>
              <Controller
                name="subProductData.shipping.shippingClass"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select class...</option>
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                    <option value="overnight">Overnight</option>
                    <option value="freight">Freight</option>
                    <option value="oversize">Oversize</option>
                  </select>
                )}
              />
            </motion.div>

            {/* Carrier */}
            <motion.div variants={fieldStaggerVariants}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Preferred Carrier
              </label>
              <Controller
                name="subProductData.shipping.carrier"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select carrier...</option>
                    {SHIPPING_CARRIERS.map((carrier) => (
                      <option key={carrier.value} value={carrier.value}>
                        {carrier.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </motion.div>

            {/* Delivery Area */}
            <motion.div variants={fieldStaggerVariants}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Delivery Area
              </label>
              <Controller
                name="subProductData.shipping.deliveryArea"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select area...</option>
                    {DELIVERY_AREAS.map((area) => (
                      <option key={area.value} value={area.value}>
                        {area.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </motion.div>

            {/* Estimated Delivery Days */}
            <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Estimated Delivery (days)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  min="0"
                  placeholder="Min days"
                  {...register('subProductData.shipping.minDeliveryDays', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Max days"
                  {...register('subProductData.shipping.maxDeliveryDays', { valueAsNumber: true })}
                />
              </div>
            </motion.div>

            {/* Shipping Cost Override */}
            <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Fixed Shipping Cost (₦) - Override
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Leave empty for calculated"
                {...register('subProductData.shipping.fixedShippingCost', { valueAsNumber: true })}
                className="w-full"
              />
              <Text className="mt-1 text-xs text-gray-500">
                Leave empty to use calculated rate
              </Text>
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      {/* Warehouse Location */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={10}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <PiWarehouse className="h-5 w-5 text-blue-500" />
          <Text className="font-medium">Warehouse Location</Text>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <motion.div variants={fieldStaggerVariants} custom={11} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Location
            </label>
            <Input
              placeholder="e.g., Main Warehouse"
              {...register('subProductData.warehouse.location')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={12} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Zone
            </label>
            <Input
              placeholder="e.g., A"
              {...register('subProductData.warehouse.zone')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={13} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Aisle
            </label>
            <Input
              placeholder="e.g., 1"
              {...register('subProductData.warehouse.aisle')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={14} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Shelf
            </label>
            <Input
              placeholder="e.g., B"
              {...register('subProductData.warehouse.shelf')}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} custom={15} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Bin
            </label>
            <Input
              placeholder="e.g., 3"
              {...register('subProductData.warehouse.bin')}
              className="w-full"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.shipping.weight', 750);
              setValue('subProductData.shipping.length', 30);
              setValue('subProductData.shipping.width', 30);
              setValue('subProductData.shipping.height', 30);
            }}
          >
            <PiPackage className="mr-1 h-4 w-4" />
            Standard Wine Bottle
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.shipping.weight', 500);
              setValue('subProductData.shipping.length', 20);
              setValue('subProductData.shipping.width', 20);
              setValue('subProductData.shipping.height', 20);
            }}
          >
            <PiPackage className="mr-1 h-4 w-4" />
            Standard Spirit Bottle
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.shipping.isFreeShipping', true);
            }}
          >
            <PiGift className="mr-1 h-4 w-4" />
            Enable Free Shipping
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
