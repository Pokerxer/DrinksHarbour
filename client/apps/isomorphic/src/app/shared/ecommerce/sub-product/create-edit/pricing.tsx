// @ts-nocheck
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Select } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiCaretDown, PiCalculator, PiPercent, PiTag, PiCurrencyNgn, 
  PiTrendUp, PiTrendDown, PiArrowsDownUp, PiReceipt,
  PiChartLine, PiWarningCircle, PiCheckCircle, PiInfo,
  PiEraser, PiCopy, PiLightning, PiTrophy, PiStar
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';

const MARKUP_PRESETS = [
  { value: 15, label: '15%', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', description: 'Low margin' },
  { value: 25, label: '25%', color: 'bg-teal-100 text-teal-700 border-teal-200', description: 'Standard' },
  { value: 35, label: '35%', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', description: 'Good' },
  { value: 50, label: '50%', color: 'bg-blue-100 text-blue-700 border-blue-200', description: 'Popular' },
  { value: 75, label: '75%', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', description: 'High' },
  { value: 100, label: '100%', color: 'bg-purple-100 text-purple-700 border-purple-200', description: 'Double' },
];

const ROUND_UP_OPTIONS = [
  { value: 'none', label: 'None', description: 'Exact price' },
  { value: '100', label: 'Nearest ₦100', description: 'Round to nearest 100' },
  { value: '500', label: 'Nearest ₦500', description: 'Round to nearest 500' },
  { value: '1000', label: 'Nearest ₦1,000', description: 'Round to nearest 1,000' },
];

const PRICING_STRATEGIES = [
  { 
    value: 'cost_plus', 
    label: 'Cost Plus', 
    icon: PiCalculator, 
    description: 'Cost + Markup = Price',
    color: 'from-blue-400 to-cyan-500'
  },
  { 
    value: 'market_based', 
    label: 'Market Based', 
    icon: PiChartLine, 
    description: 'Based on competitor pricing',
    color: 'from-purple-400 to-pink-500'
  },
  { 
    value: 'value_based', 
    label: 'Value Based', 
    icon: PiTrophy, 
    description: 'Based on perceived value',
    color: 'from-amber-400 to-orange-500'
  },
  { 
    value: 'penetration', 
    label: 'Penetration', 
    icon: PiTrendDown, 
    description: 'Low price for market share',
    color: 'from-green-400 to-emerald-500'
  },
];

const COMPETITOR_PRICE_RANGES = [
  { label: 'Budget', range: '0-5000', color: 'bg-green-100 text-green-700' },
  { label: 'Mid-Range', range: '5000-15000', color: 'bg-blue-100 text-blue-700' },
  { label: 'Premium', range: '15000-50000', color: 'bg-purple-100 text-purple-700' },
  { label: 'Luxury', range: '50000+', color: 'bg-amber-100 text-amber-700' },
];

export default function SubProductPricing() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const costPrice = watch?.('subProductData.costPrice') ?? 0;
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') ?? 0;
  const markupPercentage = watch?.('subProductData.markupPercentage') ?? 25;
  const roundUpValue = watch?.('subProductData.roundUp') ?? 'none';
  const taxRate = watch?.('subProductData.taxRate') ?? 0;
  const pricingStrategy = watch?.('subProductData.pricingStrategy') ?? 'cost_plus';

  const [localMarkup, setLocalMarkup] = useState(markupPercentage);
  const [isAutoCalculating, setIsAutoCalculating] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCompetitorPricing, setShowCompetitorPricing] = useState(false);

  useEffect(() => {
    setLocalMarkup(markupPercentage);
  }, [markupPercentage]);

  useEffect(() => {
    if (isAutoCalculating && costPrice && costPrice > 0) {
      let calculatedPrice = costPrice * (1 + (localMarkup / 100));
      
      if (roundUpValue === '100') {
        calculatedPrice = Math.ceil(calculatedPrice / 100) * 100;
      } else if (roundUpValue === '500') {
        calculatedPrice = Math.ceil(calculatedPrice / 500) * 500;
      } else if (roundUpValue === '1000') {
        calculatedPrice = Math.ceil(calculatedPrice / 1000) * 1000;
      }
      
      setValue('subProductData.baseSellingPrice', Number(calculatedPrice.toFixed(2)), { shouldValidate: true });
    }
  }, [costPrice, localMarkup, roundUpValue, isAutoCalculating, setValue]);

  const profitAmount = baseSellingPrice - costPrice;
  
  const marginPercentage = useMemo(() => {
    if (!baseSellingPrice || !costPrice || costPrice <= 0) return 0;
    return Number(((baseSellingPrice - costPrice) / baseSellingPrice * 100).toFixed(2));
  }, [baseSellingPrice, costPrice]);

  const markupCalcPercentage = useMemo(() => {
    if (!baseSellingPrice || !costPrice || costPrice <= 0) return 0;
    return Number(((baseSellingPrice - costPrice) / costPrice * 100).toFixed(2));
  }, [baseSellingPrice, costPrice]);

  const taxAmount = baseSellingPrice * (taxRate / 100);
  const priceWithTax = baseSellingPrice + taxAmount;

  const getMarginStatus = () => {
    if (marginPercentage >= 50) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', icon: PiTrophy };
    if (marginPercentage >= 30) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', icon: PiStar };
    if (marginPercentage >= 15) return { label: 'Fair', color: 'text-amber-600', bg: 'bg-amber-50', icon: PiTrendUp };
    return { label: 'Low', color: 'text-red-600', bg: 'bg-red-50', icon: PiWarningCircle };
  };

  const marginStatus = getMarginStatus();

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

  const handleClearPricing = () => {
    setValue('subProductData.costPrice', 0);
    setValue('subProductData.baseSellingPrice', 0);
    setValue('subProductData.markupPercentage', 25);
    setValue('subProductData.taxRate', 0);
    setLocalMarkup(25);
    toast.success('Pricing reset to defaults');
  };

  const handleCopyPrice = () => {
    if (baseSellingPrice > 0) {
      navigator.clipboard.writeText(baseSellingPrice.toString());
      toast.success('Price copied to clipboard');
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Enhanced Header */}
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="relative overflow-hidden rounded-xl border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-purple-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg">
                <PiCurrencyNgn className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Pricing</Text>
                <Text className="text-xs text-gray-500">
                  Set your pricing strategy and calculate profits
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {baseSellingPrice > 0 && costPrice > 0 && (
                <Badge variant="flat" color={marginStatus.color.includes('green') ? 'success' : marginStatus.color.includes('blue') ? 'info' : 'warning'} className="font-medium">
                  {marginStatus.label} Margin
                </Badge>
              )}
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={handleClearPricing}
                className="text-red-600 hover:bg-red-50"
              >
                <PiEraser className="mr-1 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Price Summary Card */}
      {baseSellingPrice > 0 && costPrice > 0 && (
        <motion.div 
          variants={fieldStaggerVariants}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6"
        >
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-[-50%] rounded-full bg-indigo-100/50" />
          
          <div className="relative">
            {/* Main Price Display */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg"
                >
                  <PiTag className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <Text className="text-sm font-medium text-indigo-600">Selling Price</Text>
                  <Text className="text-3xl font-bold text-indigo-900">
                    ₦{baseSellingPrice.toLocaleString()}
                  </Text>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPrice}
                className="gap-1"
              >
                <PiCopy className="h-4 w-4" />
                Copy
              </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Cost Price */}
              <div className="rounded-lg bg-white/80 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PiCurrencyNgn className="h-4 w-4 text-gray-500" />
                  <Text className="text-xs text-gray-600">Cost Price</Text>
                </div>
                <Text className="text-lg font-bold text-gray-900">
                  ₦{costPrice.toLocaleString()}
                </Text>
              </div>

              {/* Profit */}
              <div className="rounded-lg bg-white/80 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PiTrendUp className="h-4 w-4 text-green-500" />
                  <Text className="text-xs text-gray-600">Profit</Text>
                </div>
                <Text className="text-lg font-bold text-green-600">
                  ₦{profitAmount.toLocaleString()}
                </Text>
              </div>

              {/* Margin */}
              <div className="rounded-lg bg-white/80 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PiPercent className="h-4 w-4 text-blue-500" />
                  <Text className="text-xs text-gray-600">Margin</Text>
                </div>
                <Text className="text-lg font-bold text-blue-600">
                  {marginPercentage}%
                </Text>
              </div>

              {/* Markup */}
              <div className="rounded-lg bg-white/80 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PiCalculator className="h-4 w-4 text-purple-500" />
                  <Text className="text-xs text-gray-600">Markup</Text>
                </div>
                <Text className="text-lg font-bold text-purple-600">
                  {markupCalcPercentage}%
                </Text>
              </div>
            </div>

            {/* Tax Info */}
            {taxRate > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiReceipt className="h-4 w-4 text-amber-600" />
                    <Text className="text-sm text-amber-800">Price with Tax ({taxRate}%)</Text>
                  </div>
                  <Text className="font-bold text-amber-700">
                    ₦{priceWithTax.toLocaleString()}
                  </Text>
                </div>
              </motion.div>
            )}

            {/* Margin Status Indicator */}
            <div className={`mt-4 rounded-lg ${marginStatus.bg} p-3 border`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <marginStatus.icon className={`h-5 w-5 ${marginStatus.color}`} />
                  <Text className={`font-medium ${marginStatus.color}`}>
                    {marginStatus.label} Profit Margin
                  </Text>
                </div>
                <Text className="text-sm text-gray-600">
                  {profitAmount > 0 ? `₦${profitAmount.toLocaleString()} per unit` : 'No profit'}
                </Text>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pricing Strategy */}
      <motion.div variants={fieldStaggerVariants}>
        <div className="mb-3 flex items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">Pricing Strategy</Text>
          <Badge variant="flat" color="secondary" size="sm">
            {PRICING_STRATEGIES.find(s => s.value === pricingStrategy)?.label}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_STRATEGIES.map((strategy, index) => {
            const StrategyIcon = strategy.icon;
            const isSelected = pricingStrategy === strategy.value;
            return (
              <motion.button
                key={strategy.value}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setValue('subProductData.pricingStrategy', strategy.value);
                  toast.success(`Selected ${strategy.label} pricing`);
                }}
                className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500"
                  >
                    <PiCheckCircle className="h-4 w-4 text-white" />
                  </motion.div>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${strategy.color} mb-3 shadow-md`}>
                  <StrategyIcon className="h-5 w-5 text-white" />
                </div>
                <Text className="font-medium text-gray-900">{strategy.label}</Text>
                <Text className="text-xs text-gray-500 mt-1">{strategy.description}</Text>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Markup Presets */}
      <motion.div variants={fieldStaggerVariants}>
        <div className="mb-3 flex items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">Quick Markup Presets</Text>
          <div className="flex items-center gap-2">
            <Switch
              checked={isAutoCalculating}
              onChange={(e) => setIsAutoCalculating(e.target.checked)}
              size="sm"
            />
            <Text className="text-xs text-gray-500">Auto-calculate</Text>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MARKUP_PRESETS.map((preset, index) => (
            <motion.button
              key={preset.value}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleMarkupChange(preset.value)}
              className={`rounded-lg border p-3 text-center font-medium transition-all ${
                localMarkup === preset.value
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  : preset.color + ' border hover:shadow-md'
              }`}
            >
              <div className="text-sm font-bold">{preset.label}</div>
              <div className="text-[10px] opacity-75">{preset.description}</div>
              {costPrice > 0 && (
                <div className="mt-1 text-xs font-semibold text-indigo-600">
                  ₦{(costPrice * (1 + preset.value / 100)).toLocaleString()}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Main Pricing Inputs */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-400 to-purple-600" />
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Cost Price */}
          <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiCurrencyNgn className="h-4 w-4 text-red-500" />
              Cost Price <span className="text-red-500">*</span>
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
          <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiPercent className="h-4 w-4 text-blue-500" />
              Markup (%)
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
                disabled={!isAutoCalculating}
                className="w-full pl-9"
              />
              <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <Text className="mt-1 text-xs text-gray-500">
              {isAutoCalculating ? 'Auto-calculates selling price' : 'Manual mode'}
            </Text>
          </motion.div>

          {/* Base Selling Price */}
          <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiTag className="h-4 w-4 text-green-500" />
              Base Selling Price <span className="text-red-500">*</span>
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
              <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <Text className="mt-1 text-xs text-gray-500">
              {isAutoCalculating ? 'Auto-calculated' : 'Manual - auto-calculate disabled'}
            </Text>
          </motion.div>

          {/* Round Up */}
          <motion.div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiArrowsDownUp className="h-4 w-4 text-purple-500" />
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
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                  >
                    {ROUND_UP_OPTIONS.map((option) => (
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
              Round calculated price to nearest value
            </Text>
          </motion.div>

          {/* Tax Rate */}
          <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiReceipt className="h-4 w-4 text-amber-500" />
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
            <Text className="mt-1 text-xs text-gray-500">
              Add tax to final price
            </Text>
          </motion.div>

          {/* Margin Display */}
          <motion.div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiCalculator className="h-4 w-4 text-indigo-500" />
              Profit Margin
            </label>
            <div className={`flex items-center rounded-lg border p-3 ${
              marginPercentage >= 30 ? 'border-green-200 bg-green-50' :
              marginPercentage >= 15 ? 'border-blue-200 bg-blue-50' :
              marginPercentage > 0 ? 'border-amber-200 bg-amber-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                {marginPercentage >= 30 ? (
                  <PiTrophy className="h-4 w-4 text-green-600" />
                ) : marginPercentage >= 15 ? (
                  <PiStar className="h-4 w-4 text-blue-600" />
                ) : marginPercentage > 0 ? (
                  <PiWarningCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <PiWarningCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="ml-3">
                <Text className="text-lg font-bold text-gray-900">{marginPercentage}%</Text>
                <Text className="text-xs text-gray-500">
                  ₦{profitAmount.toLocaleString()} profit
                </Text>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Advanced Options */}
      <motion.div variants={fieldStaggerVariants}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <PiLightning className="h-4 w-4" />
            Advanced Pricing Options
          </span>
          {showAdvanced ? <PiCaretDown className="h-4 w-4 rotate-180" /> : <PiCaretDown className="h-4 w-4" />}
        </Button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4 overflow-hidden"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {/* Minimum Price */}
                <motion.div className="rounded-lg border border-gray-200 bg-white p-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Minimum Price (Floor)
                  </label>
                  <Input
                    type="number"
                    placeholder="Minimum acceptable price"
                    {...register('subProductData.minPrice', { valueAsNumber: true })}
                    className="w-full"
                  />
                  <Text className="mt-1 text-xs text-gray-500">
                    Prevent pricing below this threshold
                  </Text>
                </motion.div>

                {/* Maximum Price */}
                <motion.div className="rounded-lg border border-gray-200 bg-white p-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Maximum Price (Ceiling)
                  </label>
                  <Input
                    type="number"
                    placeholder="Maximum acceptable price"
                    {...register('subProductData.maxPrice', { valueAsNumber: true })}
                    className="w-full"
                  />
                  <Text className="mt-1 text-xs text-gray-500">
                    Prevent pricing above this threshold
                  </Text>
                </motion.div>
              </div>

              {/* Competitor Pricing */}
              <motion.div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Competitor Price Reference
                  </label>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={() => setShowCompetitorPricing(!showCompetitorPricing)}
                  >
                    {showCompetitorPricing ? 'Hide' : 'Show'}
                  </Button>
                </div>
                
                <AnimatePresence>
                  {showCompetitorPricing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {COMPETITOR_PRICE_RANGES.map((range, index) => (
                          <motion.button
                            key={range.label}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`rounded-lg border p-3 text-center ${range.color}`}
                          >
                            <Text className="font-medium">{range.label}</Text>
                            <Text className="text-xs">{range.range}</Text>
                          </motion.button>
                        ))}
                      </div>
                      <Input
                        placeholder="Enter competitor URL or price..."
                        {...register('subProductData.competitorPrice')}
                        className="w-full"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tips */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg bg-blue-50 border border-blue-200 p-4"
      >
        <div className="flex items-start gap-2">
          <PiInfo className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <Text className="font-medium text-blue-800 mb-1">Pricing Tips</Text>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Cost Plus is simplest: add your desired markup to cost</li>
              <li>• Aim for 30%+ margin to cover overhead and generate profit</li>
              <li>• Use rounding (nearest 100/1000) for cleaner pricing</li>
              <li>• Consider competitor pricing when setting premium products</li>
              <li>• Enable auto-calculate for quick pricing updates</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
