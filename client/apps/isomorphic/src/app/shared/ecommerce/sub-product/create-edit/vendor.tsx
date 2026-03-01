// @ts-nocheck
'use client';

import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Textarea, Button, Badge } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiStorefront, PiFactory, PiNumberCircleOne, PiTimer, PiNumberCircleTwo,
  PiCurrencyNgn, PiPackage, PiTruck, PiPhone, PiEnvelope, PiGlobe,
  PiStar, PiPlus, PiTrash, PiNotes, PiWarningCircle, PiCheckCircle,
  PiHandshake, PiTrendUp, PiTrendDown
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants } from './animations';

const currencyOptions = [
  { value: 'NGN', label: 'NGN - Nigerian Naira', symbol: '₦' },
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'ZAR', label: 'ZAR - South African Rand', symbol: 'R' },
  { value: 'KES', label: 'KES - Kenyan Shilling', symbol: 'KSh' },
  { value: 'GHS', label: 'GHS - Ghanaian Cedi', symbol: '₵' },
];

const supplierRatingOptions = [
  { value: 5, label: '★★★★★ Excellent' },
  { value: 4, label: '★★★★☆ Good' },
  { value: 3, label: '★★★☆☆ Average' },
  { value: 2, label: '★★☆☆☆ Poor' },
  { value: 1, label: '★☆☆☆☆ Very Poor' },
];

export default function SubProductVendor() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const vendor = watch?.('subProductData.vendor');
  const supplierPrice = watch?.('subProductData.supplierPrice');
  const costPrice = watch?.('subProductData.costPrice');
  const currency = watch?.('subProductData.currency') || 'NGN';

  const [showVendorDetails, setShowVendorDetails] = useState(false);

  const currencySymbol = currencyOptions.find(c => c.value === currency)?.symbol || '₦';
  const supplierCurrencySymbol = '₦'; // Could add supplier currency field

  const priceDifference = supplierPrice && costPrice 
    ? ((costPrice - supplierPrice) / supplierPrice * 100).toFixed(2)
    : null;

  const handleClearVendor = () => {
    setValue?.('subProductData.vendor', '');
    setValue?.('subProductData.supplierSKU', '');
    setValue?.('subProductData.supplierPrice', null);
    setValue?.('subProductData.leadTimeDays', null);
    setValue?.('subProductData.minimumOrderQuantity', null);
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30">
            <PiHandshake className="h-5 w-5 text-white" />
          </div>
          <div>
            <Text className="text-lg font-semibold">Vendor & Sourcing</Text>
            <Text className="text-sm text-gray-500">
              Configure supplier information and sourcing details for this product
            </Text>
          </div>
        </div>
      </motion.div>

      {/* Vendor Summary Card */}
      {vendor && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <PiStorefront className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Text className="font-medium text-blue-900">{vendor}</Text>
                <Text className="text-xs text-blue-700">
                  {supplierPrice ? `Supplier Price: ${supplierCurrencySymbol}${supplierPrice.toLocaleString()}` : 'No supplier price set'}
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="success">
                <PiCheckCircle className="mr-1 h-3 w-3" />
                Vendor Selected
              </Badge>
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={handleClearVendor}
                className="text-red-600 hover:text-red-700"
              >
                Clear
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Price Comparison */}
      {supplierPrice && costPrice && priceDifference && (
        <motion.div 
          variants={fieldStaggerVariants}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl border p-4 ${
            parseFloat(priceDifference) > 0 
              ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50' 
              : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {parseFloat(priceDifference) > 0 ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <PiTrendUp className="h-5 w-5 text-green-600" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <PiTrendDown className="h-5 w-5 text-amber-600" />
                </div>
              )}
              <div>
                <Text className={`font-semibold ${
                  parseFloat(priceDifference) > 0 ? 'text-green-800' : 'text-amber-800'
                }`}>
                  {parseFloat(priceDifference) > 0 
                    ? `Your margin: +${priceDifference}% above supplier price`
                    : `Warning: Supplier price is ${Math.abs(parseFloat(priceDifference))}% above your price`
                  }
                </Text>
                <Text className="text-xs text-gray-600 mt-0.5">
                  Supplier: {supplierCurrencySymbol}{supplierPrice?.toLocaleString()} → Your Cost: {supplierCurrencySymbol}{costPrice?.toLocaleString()}
                </Text>
              </div>
            </div>
            <Badge color={parseFloat(priceDifference) > 0 ? 'success' : 'warning'} variant="flat">
              {parseFloat(priceDifference) > 0 ? 'Profitable' : 'Loss'}
            </Badge>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vendor Name */}
        <motion.div variants={fieldStaggerVariants} custom={1} className="col-span-2 transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Vendor / Supplier Name
          </label>
          <div className="relative">
            <Input
              placeholder="Enter vendor name"
              {...register('subProductData.vendor')}
              className="w-full pl-10"
            />
            <PiStorefront className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            The supplier or wholesaler you purchase this product from
          </Text>
        </motion.div>

        {/* Supplier SKU */}
        <motion.div variants={fieldStaggerVariants} custom={2} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Supplier SKU
          </label>
          <div className="relative">
            <Input
              placeholder="Supplier's product SKU"
              {...register('subProductData.supplierSKU')}
              className="w-full pl-10"
            />
            <PiFactory className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </motion.div>

        {/* Supplier Price */}
        <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Supplier Price (Cost)
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('subProductData.supplierPrice', { valueAsNumber: true })}
              className="w-full pl-10"
            />
            <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Your cost from this supplier
          </Text>
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
          <div className="flex flex-wrap gap-1 mt-2">
            {[1, 3, 5, 7, 14, 21, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setValue?.('subProductData.leadTimeDays', days)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  watch?.('subProductData.leadTimeDays') === days 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </motion.div>

        {/* Minimum Order Quantity */}
        <motion.div variants={fieldStaggerVariants} custom={5} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Minimum Order Quantity (MOQ)
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.minimumOrderQuantity', { valueAsNumber: true })}
              className="w-full pl-10"
            />
            <PiPackage className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Minimum units per order from this supplier
          </Text>
          <div className="flex flex-wrap gap-1 mt-2">
            {[6, 10, 12, 24, 50, 100].map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => setValue?.('subProductData.minimumOrderQuantity', qty)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  watch?.('subProductData.minimumOrderQuantity') === qty 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {qty}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Estimated Shipping Cost */}
        <motion.div variants={fieldStaggerVariants} custom={6} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Estimated Shipping Cost
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('subProductData.estimatedShippingCost', { valueAsNumber: true })}
              className="w-full pl-10"
            />
            <PiTruck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </motion.div>

        {/* Supplier Rating */}
        <motion.div variants={fieldStaggerVariants} custom={7}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Supplier Rating
          </label>
          <Controller
            name="subProductData.supplierRating"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select rating...</option>
                {supplierRatingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
        </motion.div>

        {/* Vendor Notes */}
        <motion.div variants={fieldStaggerVariants} custom={8} className="col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Vendor Notes
          </label>
          <Textarea
            placeholder="Add notes about this vendor, payment terms, special instructions..."
            {...register('subProductData.vendorNotes')}
            rows={3}
            className="w-full"
          />
        </motion.div>

        {/* Vendor Contact Information Toggle */}
        <motion.div variants={fieldStaggerVariants} custom={9} className="col-span-2">
          <button
            type="button"
            onClick={() => setShowVendorDetails(!showVendorDetails)}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <PiPlus className={`h-4 w-4 transition-transform ${showVendorDetails ? 'rotate-45' : ''}`} />
            {showVendorDetails ? 'Hide' : 'Add'} Vendor Contact Details
          </button>
        </motion.div>

        <AnimatePresence>
          {showVendorDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="col-span-2 grid gap-6 md:grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              {/* Vendor Contact Person */}
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Contact Person
                </label>
                <Input
                  placeholder="Contact name"
                  {...register('subProductData.vendorContactName')}
                  className="w-full"
                />
              </motion.div>

              {/* Vendor Phone */}
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="relative">
                  <Input
                    placeholder="+234..."
                    {...register('subProductData.vendorPhone')}
                    className="w-full pl-9"
                  />
                  <PiPhone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Vendor Email */}
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="vendor@example.com"
                    {...register('subProductData.vendorEmail')}
                    className="w-full pl-9"
                  />
                  <PiEnvelope className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Vendor Website */}
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Website
                </label>
                <div className="relative">
                  <Input
                    placeholder="https://..."
                    {...register('subProductData.vendorWebsite')}
                    className="w-full pl-9"
                  />
                  <PiGlobe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Vendor Address */}
              <motion.div variants={fieldStaggerVariants} className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Address
                </label>
                <Textarea
                  placeholder="Full vendor address"
                  {...register('subProductData.vendorAddress')}
                  rows={2}
                  className="w-full"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue?.('subProductData.vendor', 'Local Distributor');
              setValue?.('subProductData.leadTimeDays', 3);
              setValue?.('subProductData.minimumOrderQuantity', 10);
            }}
          >
            <PiStorefront className="mr-1 h-4 w-4" />
            Set Local Distributor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue?.('subProductData.vendor', 'Direct Import');
              setValue?.('subProductData.leadTimeDays', 14);
              setValue?.('subProductData.minimumOrderQuantity', 50);
            }}
          >
            <PiTruck className="mr-1 h-4 w-4" />
            Set Direct Import
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue?.('subProductData.vendor', 'Wholesale Supplier');
              setValue?.('subProductData.leadTimeDays', 7);
              setValue?.('subProductData.minimumOrderQuantity', 24);
            }}
          >
            <PiFactory className="mr-1 h-4 w-4" />
            Set Wholesale
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
