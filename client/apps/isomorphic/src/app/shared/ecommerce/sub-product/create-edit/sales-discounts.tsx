// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { PiPercent, PiTag, PiCalendar, PiMegaphone, PiLightning, PiCurrencyNgn, PiArrowsDownUp } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants } from './animations';

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
};

export default function SubProductSalesDiscounts() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const isOnSale = watch?.('subProductData.isOnSale');
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice');
  const salePrice = watch?.('subProductData.salePrice');
  const saleDiscountPercentage = watch?.('subProductData.saleDiscountPercentage');
  const saleDiscountValue = watch?.('subProductData.saleDiscountValue');
  const saleType = watch?.('subProductData.saleType');
  const currency = watch?.('subProductData.currency') || 'NGN';
  
  const currencySymbol = currencySymbols[currency] || '₦';

  const [localDiscountPercentage, setLocalDiscountPercentage] = useState<number>(0);
  const [localDiscountValue, setLocalDiscountValue] = useState<number>(0);
  const [isAutoCalculatingPercentage, setIsAutoCalculatingPercentage] = useState(false);
  const [isAutoCalculatingFixed, setIsAutoCalculatingFixed] = useState(false);

  useEffect(() => {
    if (baseSellingPrice && salePrice && baseSellingPrice > 0) {
      const calculated = ((baseSellingPrice - salePrice) / baseSellingPrice * 100);
      setLocalDiscountPercentage(Number(calculated.toFixed(2)));
    }
  }, [baseSellingPrice, salePrice]);

  useEffect(() => {
    if (isAutoCalculatingPercentage && baseSellingPrice && baseSellingPrice > 0 && saleType === 'percentage') {
      const discountAmount = baseSellingPrice * (localDiscountPercentage / 100);
      const calculatedSalePrice = baseSellingPrice - discountAmount;
      setValue?.('subProductData.salePrice', Number(calculatedSalePrice.toFixed(2)), { shouldValidate: true });
      setValue?.('subProductData.saleDiscountPercentage', localDiscountPercentage, { shouldValidate: true });
    }
  }, [localDiscountPercentage, baseSellingPrice, saleType, isAutoCalculatingPercentage, setValue]);

  useEffect(() => {
    if (isAutoCalculatingFixed && baseSellingPrice && baseSellingPrice > 0 && saleType === 'fixed') {
      const calculatedSalePrice = baseSellingPrice - localDiscountValue;
      if (calculatedSalePrice > 0) {
        setValue?.('subProductData.salePrice', Number(calculatedSalePrice.toFixed(2)), { shouldValidate: true });
        setValue?.('subProductData.saleDiscountValue', localDiscountValue, { shouldValidate: true });
      }
    }
  }, [localDiscountValue, baseSellingPrice, saleType, isAutoCalculatingFixed, setValue]);

  const handlePercentageChange = (value: number) => {
    setLocalDiscountPercentage(value);
    if (baseSellingPrice && baseSellingPrice > 0 && saleType === 'percentage') {
      setIsAutoCalculatingPercentage(true);
      setIsAutoCalculatingFixed(false);
    }
  };

  const handleFixedAmountChange = (value: number) => {
    setLocalDiscountValue(value);
    if (baseSellingPrice && baseSellingPrice > 0 && saleType === 'fixed') {
      setIsAutoCalculatingFixed(true);
      setIsAutoCalculatingPercentage(false);
    }
  };

  const handleSalePriceChange = () => {
    setIsAutoCalculatingPercentage(false);
    setIsAutoCalculatingFixed(false);
  };

  const handleSaleTypeChange = (type: string) => {
    setValue?.('subProductData.saleType', type, { shouldValidate: true });
    if (type === 'percentage') {
      setIsAutoCalculatingPercentage(true);
      setIsAutoCalculatingFixed(false);
    } else if (type === 'fixed') {
      setIsAutoCalculatingFixed(true);
      setIsAutoCalculatingPercentage(false);
    }
  };

  const calculatedDiscountPercentage = baseSellingPrice && salePrice && baseSellingPrice > 0
    ? ((baseSellingPrice - salePrice) / baseSellingPrice * 100).toFixed(2)
    : '0.00';

  const savingsAmount = baseSellingPrice && salePrice
    ? (baseSellingPrice - salePrice).toFixed(2)
    : '0.00';

  const saleTypeOptions = [
    { value: '', label: 'Select sale type...' },
    { value: 'percentage', label: 'Percentage Discount' },
    { value: 'fixed', label: 'Fixed Amount Discount' },
    { value: 'flash_sale', label: 'Flash Sale' },
    { value: 'bundle', label: 'Bundle Deal' },
    { value: 'bogo', label: 'Buy One Get One' },
  ];

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

      {/* Base Selling Price Display */}
      {baseSellingPrice && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <PiTag className="h-5 w-5 text-blue-600" />
            <Text className="text-sm font-medium text-blue-800">Base Selling Price:</Text>
          </div>
          <Text className="text-lg font-bold text-blue-700">
            {currencySymbol}{baseSellingPrice.toLocaleString()}
          </Text>
        </motion.div>
      )}

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
                <Controller
                  name="subProductData.saleType"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        handleSaleTypeChange(e.target.value);
                      }}
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {saleTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </motion.div>

              {/* Sale Price */}
              <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale Price
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register('subProductData.salePrice', { 
                      valueAsNumber: true,
                      onChange: handleSalePriceChange 
                    })}
                    error={errors.subProductData?.salePrice?.message}
                    className="w-full pl-9"
                  />
                  <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
                <Text className="mt-1 text-xs text-gray-500">
                  Original: {currencySymbol}{(baseSellingPrice || 0).toLocaleString()}
                </Text>
              </motion.div>

              {/* Discount Percentage (for percentage-based sales) */}
              <AnimatePresence>
                {saleType === 'percentage' && (
                  <motion.div 
                    variants={toggleVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="transition-transform duration-200 focus-within:scale-[1.01]"
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
                        value={localDiscountPercentage}
                        onChange={(e) => handlePercentageChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9"
                      />
                      <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <Text className="mt-1 text-xs text-gray-500">
                      Auto-calculates sale price from discount %
                    </Text>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Discount Amount (for fixed amount sales) */}
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
                      Discount Amount ({currencySymbol})
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={localDiscountValue}
                        onChange={(e) => handleFixedAmountChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9"
                      />
                      <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <Text className="mt-1 text-xs text-gray-500">
                      Subtracts this amount from base price
                    </Text>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Savings Display */}
              {salePrice && salePrice > 0 && baseSellingPrice && (
                <motion.div 
                  variants={fieldStaggerVariants}
                  className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3 md:col-span-2"
                >
                  <div className="flex items-center gap-2">
                    <PiArrowsDownUp className="h-5 w-5 text-green-600" />
                    <Text className="text-sm font-medium text-green-800">Customer Savings:</Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-lg font-bold text-green-700">
                      {currencySymbol}{savingsAmount} ({calculatedDiscountPercentage}%)
                    </Text>
                  </div>
                </motion.div>
              )}

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
            >
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Sale Banner (Optional)
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Banner image URL"
                  {...register('subProductData.saleBanner.url')}
                  className="w-full"
                />
                <Input
                  placeholder="Banner alt text"
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
