// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text } from 'rizzui';
import { PiCaretDown, PiCalculator, PiPercent, PiTag, PiCurrencyNgn } from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { fieldStaggerVariants, containerVariants } from './animations';

export default function SubProductPricing() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const costPrice = watch?.('subProductData.costPrice');
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice');
  const markupPercentage = watch?.('subProductData.markupPercentage') ?? 25;
  const roundUpValue = watch?.('subProductData.roundUp') ?? 'none';

  const [localMarkup, setLocalMarkup] = useState(markupPercentage);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  useEffect(() => {
    setLocalMarkup(markupPercentage);
  }, [markupPercentage]);

  useEffect(() => {
    if (isAutoCalculating && costPrice && costPrice > 0) {
      let calculatedPrice = costPrice * (1 + (localMarkup / 100));
      
      if (roundUpValue === '100') {
        calculatedPrice = Math.ceil(calculatedPrice / 100) * 100;
      } else if (roundUpValue === '1000') {
        calculatedPrice = Math.ceil(calculatedPrice / 1000) * 1000;
      }
      
      setValue('subProductData.baseSellingPrice', Number(calculatedPrice.toFixed(2)), { shouldValidate: true });
    }
  }, [costPrice, localMarkup, roundUpValue, isAutoCalculating, setValue]);

  const marginPercentage = baseSellingPrice && costPrice && costPrice > 0
    ? ((baseSellingPrice - costPrice) / baseSellingPrice * 100).toFixed(2)
    : '0.00';

  const handleCostPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (value > 0) {
      setIsAutoCalculating(true);
    }
  };

  const handleMarkupChange = (value: number) => {
    setLocalMarkup(value);
    setValue('subProductData.markupPercentage', value, { shouldValidate: true });
    if (costPrice && costPrice > 0) {
      setIsAutoCalculating(true);
    }
  };

  const roundUpOptions = [
    { value: 'none', label: 'None' },
    { value: '100', label: 'Nearest 100' },
    { value: '1000', label: 'Nearest 1,000' },
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Pricing</Text>
        <Text className="text-sm text-gray-500">
          Set your selling price, cost price, and tax rate
        </Text>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cost Price */}
        <motion.div variants={fieldStaggerVariants} custom={1} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Cost Price <span className="text-red-500">*</span> <span className="text-xs font-normal text-gray-400">(Required)</span>
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('subProductData.costPrice', { 
                valueAsNumber: true,
                required: 'Cost price is required',
                min: { value: 0.01, message: 'Cost must be greater than 0' },
                onChange: handleCostPriceChange
              })}
              error={errors.subProductData?.costPrice?.message}
              className="w-full pl-9"
            />
            <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Your cost to acquire this product
          </Text>
        </motion.div>

        {/* Markup Percentage */}
        <motion.div variants={fieldStaggerVariants} custom={2} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Markup (%) <span className="text-xs text-gray-400">(Auto-calculates price)</span>
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="500"
              placeholder="25"
              value={localMarkup}
              onChange={(e) => handleMarkupChange(parseFloat(e.target.value) || 0)}
              className="w-full pl-9"
            />
            <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Selling price will be calculated automatically
          </Text>
        </motion.div>

        {/* Base Selling Price */}
        <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Base Selling Price <span className="text-red-500">*</span> <span className="text-xs font-normal text-gray-400">(Required)</span>
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('subProductData.baseSellingPrice', { 
                valueAsNumber: true,
                required: 'Selling price is required',
                min: { value: 0.01, message: 'Price must be greater than 0' },
                onChange: () => setIsAutoCalculating(false)
              })}
              error={errors.subProductData?.baseSellingPrice?.message}
              className="w-full pl-9"
            />
            <PiTag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Auto-calculated from cost + markup, or enter manually
          </Text>
        </motion.div>

        {/* Round Up */}
        <motion.div variants={fieldStaggerVariants} custom={4}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Round Up To
          </label>
          <Controller
            name="subProductData.roundUp"
            control={control}
            render={({ field }) => (
              <div className="relative">
                <select
                  {...field}
                  value={field.value ?? 'none'}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    setValue('subProductData.roundUp', e.target.value, { shouldValidate: true });
                    if (costPrice && costPrice > 0) {
                      setIsAutoCalculating(true);
                    }
                  }}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                >
                  {roundUpOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <PiCaretDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
          />
          <Text className="mt-1 text-xs text-gray-500">
            Round calculated price to nearest 100 or 1000
          </Text>
        </motion.div>

        {/* Tax Rate */}
        <motion.div variants={fieldStaggerVariants} custom={5} className="transition-transform duration-200 focus-within:scale-[1.01]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Tax Rate (%)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0"
            {...register('subProductData.taxRate', { valueAsNumber: true })}
            error={errors.subProductData?.taxRate?.message}
            className="w-full"
          />
        </motion.div>

        {/* Margin Percentage (Calculated) */}
        <motion.div variants={fieldStaggerVariants} custom={6}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Profit Margin
          </label>
          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <PiCalculator className="mr-2 h-4 w-4 text-gray-400" />
            <Text className="text-sm font-medium text-gray-700">
              {marginPercentage}%
            </Text>
          </div>
          <Text className="mt-1 text-xs text-gray-500">
            Automatically calculated from selling and cost price
          </Text>
        </motion.div>
      </div>
    </motion.div>
  );
}
