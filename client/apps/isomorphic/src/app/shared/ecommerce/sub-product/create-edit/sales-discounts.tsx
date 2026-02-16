// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input, Text, Switch } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { PiPercent, PiTag, PiCalendar, PiMegaphone, PiLightning } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants } from './animations';

export default function SubProductSalesDiscounts() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const errors = methods?.formState?.errors || {};

  const isOnSale = watch?.('subProductData.isOnSale');
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice');
  const salePrice = watch?.('subProductData.salePrice');
  const saleDiscountValue = watch?.('subProductData.saleDiscountValue');
  const saleType = watch?.('subProductData.saleType');

  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  useEffect(() => {
    if (baseSellingPrice && salePrice) {
      const calculatedDiscount = ((baseSellingPrice - salePrice) / baseSellingPrice * 100).toFixed(2);
      setDiscountPercentage(parseFloat(calculatedDiscount));
    }
  }, [baseSellingPrice, salePrice]);

  useEffect(() => {
    if (isAutoCalculating && baseSellingPrice && baseSellingPrice > 0 && saleType === 'percentage') {
      const discountAmount = baseSellingPrice * (discountPercentage / 100);
      const calculatedSalePrice = baseSellingPrice - discountAmount;
      setValue?.('subProductData.salePrice', Number(calculatedSalePrice.toFixed(2)), { shouldValidate: true });
      setValue?.('subProductData.saleDiscountValue', discountPercentage, { shouldValidate: true });
    }
  }, [discountPercentage, baseSellingPrice, saleType, isAutoCalculating, setValue]);

  const handleDiscountPercentageChange = (value: number) => {
    setDiscountPercentage(value);
    if (baseSellingPrice && baseSellingPrice > 0 && saleType === 'percentage') {
      setIsAutoCalculating(true);
    }
  };

  const handleSalePriceChange = () => {
    setIsAutoCalculating(false);
  };

  const calculatedDiscountPercentage = baseSellingPrice && salePrice && baseSellingPrice > 0
    ? ((baseSellingPrice - salePrice) / baseSellingPrice * 100).toFixed(2)
    : '0.00';

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Sales & Discounts</Text>
        <Text className="text-sm text-gray-500">
          Configure sale pricing and promotional discounts
        </Text>
      </motion.div>

      {/* On Sale Toggle */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-all hover:border-gray-300"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
            <PiMegaphone className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <Text className="font-medium">Enable Sale</Text>
            <Text className="text-sm text-gray-500">
              Mark this product as being on sale
            </Text>
          </div>
        </div>
        <Switch
          checked={isOnSale}
          onChange={(checked) => setValue('subProductData.isOnSale', checked)}
        />
      </motion.div>

      <AnimatePresence>
        {isOnSale && (
          <motion.div
            variants={toggleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-6 rounded-lg border border-gray-200 bg-gray-50/50 p-6"
          >
            <div className="grid gap-6 md:grid-cols-2">
              {/* Sale Type */}
              <motion.div variants={fieldStaggerVariants} custom={2}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale Type
                </label>
                <select
                  {...register('subProductData.saleType')}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="percentage">Percentage Discount</option>
                  <option value="fixed">Fixed Amount Discount</option>
                  <option value="flash_sale">Flash Sale</option>
                  <option value="bundle">Bundle Deal</option>
                  <option value="bogo">Buy One Get One</option>
                </select>
              </motion.div>

              {/* Discount Percentage (for auto-calculation) */}
              <AnimatePresence>
                {saleType === 'percentage' && (
                  <motion.div 
                    variants={toggleVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Discount Percentage (%)
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={discountPercentage}
                        onChange={(e) => handleDiscountPercentageChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9"
                      />
                      <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <Text className="mt-1 text-xs text-gray-500">
                      Enter % to auto-calculate sale price
                    </Text>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sale Price */}
              <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register('subProductData.salePrice', { valueAsNumber: true })}
                    onChange={handleSalePriceChange}
                    error={errors.subProductData?.salePrice?.message}
                    className="w-full pl-9"
                  />
                  <PiTag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
                {saleType === 'percentage' && (
                  <Text className="mt-1 text-xs text-gray-500">
                    Auto-calculated from discount %, or enter manually
                  </Text>
                )}
              </motion.div>

              {/* Discount Value (for fixed amount) */}
              <AnimatePresence>
                {saleType === 'fixed' && (
                  <motion.div 
                    variants={toggleVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="transition-transform duration-200 focus-within:scale-[1.01]"
                  >
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Discount Amount
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register('subProductData.saleDiscountValue', { valueAsNumber: true })}
                      className="w-full"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Calculated Discount % */}
              <motion.div variants={fieldStaggerVariants} custom={4}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Actual Discount
                </label>
                <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <PiPercent className="mr-2 h-4 w-4 text-gray-400" />
                  <Text className="text-sm font-medium text-gray-700">
                    {calculatedDiscountPercentage}%
                  </Text>
                </div>
                <Text className="mt-1 text-xs text-gray-500">
                  Calculated from selling price and sale price
                </Text>
              </motion.div>

              {/* Sale Start Date */}
              <motion.div variants={fieldStaggerVariants} custom={5}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale Start Date
                </label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    {...register('subProductData.saleStartDate')}
                    className="w-full pl-9"
                  />
                  <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Sale End Date */}
              <motion.div variants={fieldStaggerVariants} custom={6}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale End Date
                </label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    {...register('subProductData.saleEndDate')}
                    className="w-full pl-9"
                  />
                  <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>
            </div>

            {/* Sale Banner */}
            <motion.div 
              variants={fieldStaggerVariants} 
              custom={7}
              className="grid gap-6 md:grid-colss-2"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale Banner URL
                </label>
                <Input
                  placeholder="https://..."
                  {...register('subProductData.saleBanner.url')}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Banner Alt Text
                </label>
                <Input
                  placeholder="Sale banner description"
                  {...register('subProductData.saleBanner.alt')}
                  className="w-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
