// @ts-nocheck
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiPercent, PiTag, PiCalendar, PiMegaphone, PiLightning, PiCurrencyNgn, 
  PiArrowsDownUp, PiWarningCircle, PiCheckCircle, PiClock, PiX, PiGift,
  PiNumberSquareOne, PiNumberSquareTwo, PiStorefront
} from 'react-icons/pi';
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

interface SaleTypeOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const saleTypeOptions: SaleTypeOption[] = [
  { 
    value: 'percentage', 
    label: 'Percentage Discount', 
    description: 'Reduce price by a percentage',
    icon: PiPercent,
    color: 'blue'
  },
  { 
    value: 'fixed', 
    label: 'Fixed Amount', 
    description: 'Reduce price by a fixed value',
    icon: PiCurrencyNgn,
    color: 'green'
  },
  { 
    value: 'flash_sale', 
    label: 'Flash Sale', 
    description: 'Limited time special offer',
    icon: PiLightning,
    color: 'amber'
  },
  { 
    value: 'bundle', 
    label: 'Bundle Deal', 
    description: 'Buy more for less',
    icon: PiGift,
    color: 'purple'
  },
  { 
    value: 'bogo', 
    label: 'Buy One Get One', 
    description: 'Free or discounted second item',
    icon: PiNumberSquareTwo,
    color: 'rose'
  },
];

export default function SubProductSalesDiscounts() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const isOnSale = watch?.('subProductData.isOnSale') ?? false;
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') ?? 0;
  const salePrice = watch?.('subProductData.salePrice') ?? 0;
  const saleDiscountPercentage = watch?.('subProductData.saleDiscountPercentage') ?? 0;
  const saleDiscountValue = watch?.('subProductData.saleDiscountValue') ?? 0;
  const saleType = watch?.('subProductData.saleType') ?? '';
  const saleStartDate = watch?.('subProductData.saleStartDate');
  const saleEndDate = watch?.('subProductData.saleEndDate');
  const currency = watch?.('subProductData.currency') || 'NGN';
  
  const currencySymbol = currencySymbols[currency] || '₦';

  const [inputPercentage, setInputPercentage] = useState(saleDiscountPercentage || 0);
  const [inputFixed, setInputFixed] = useState(saleDiscountValue || 0);

  useEffect(() => {
    setInputPercentage(saleDiscountPercentage || 0);
  }, [saleDiscountPercentage]);

  useEffect(() => {
    setInputFixed(saleDiscountValue || 0);
  }, [saleDiscountValue]);

  const calculatedSalePrice = useMemo(() => {
    if (!baseSellingPrice || baseSellingPrice <= 0) return 0;
    
    if (saleType === 'percentage' && inputPercentage > 0) {
      return baseSellingPrice - (baseSellingPrice * inputPercentage / 100);
    }
    if (saleType === 'fixed' && inputFixed > 0) {
      return Math.max(0, baseSellingPrice - inputFixed);
    }
    return 0;
  }, [baseSellingPrice, saleType, inputPercentage, inputFixed]);

  const discountPercentage = useMemo(() => {
    if (!baseSellingPrice || !salePrice || baseSellingPrice <= 0) return 0;
    return ((baseSellingPrice - salePrice) / baseSellingPrice * 100);
  }, [baseSellingPrice, salePrice]);

  const savingsAmount = useMemo(() => {
    if (!baseSellingPrice || !salePrice) return 0;
    return baseSellingPrice - salePrice;
  }, [baseSellingPrice, salePrice]);

  const saleStatus = useMemo(() => {
    if (!isOnSale || !salePrice) return { isActive: false, message: 'Not on sale' };
    
    const now = new Date();
    
    if (saleStartDate && new Date(saleStartDate) > now) {
      return { isActive: false, message: 'Scheduled', color: 'warning' };
    }
    if (saleEndDate && new Date(saleEndDate) < now) {
      return { isActive: false, message: 'Expired', color: 'danger' };
    }
    
    return { isActive: true, message: 'Active', color: 'success' };
  }, [isOnSale, salePrice, saleStartDate, saleEndDate]);

  const handlePercentageChange = (value: number) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    setInputPercentage(clampedValue);
    
    if (baseSellingPrice > 0) {
      const newSalePrice = baseSellingPrice - (baseSellingPrice * clampedValue / 100);
      setValue('subProductData.saleDiscountPercentage', clampedValue);
      setValue('subProductData.salePrice', Math.round(newSalePrice * 100) / 100);
    }
  };

  const handleFixedChange = (value: number) => {
    const clampedValue = Math.min(baseSellingPrice, Math.max(0, value));
    setInputFixed(clampedValue);
    
    if (baseSellingPrice > 0) {
      const newSalePrice = Math.max(0, baseSellingPrice - clampedValue);
      setValue('subProductData.saleDiscountValue', clampedValue);
      setValue('subProductData.salePrice', Math.round(newSalePrice * 100) / 100);
    }
  };

  const handleSalePriceChange = (value: number) => {
    setValue('subProductData.salePrice', value);
    
    if (baseSellingPrice > 0 && value > 0) {
      const newPercentage = ((baseSellingPrice - value) / baseSellingPrice * 100);
      setInputPercentage(Math.round(newPercentage * 100) / 100);
      setValue('subProductData.saleDiscountPercentage', Math.round(newPercentage * 100) / 100);
    }
  };

  const handleSaleTypeChange = (type: string) => {
    setValue('subProductData.saleType', type);
    setValue('subProductData.salePrice', 0);
    setInputPercentage(0);
    setInputFixed(0);
    setValue('subProductData.saleDiscountPercentage', 0);
    setValue('subProductData.saleDiscountValue', 0);
  };

  const handleToggleSale = (checked: boolean) => {
    setValue('subProductData.isOnSale', checked);
    if (!checked) {
      setValue('subProductData.salePrice', 0);
      setInputPercentage(0);
      setInputFixed(0);
    }
  };

  const clearSale = () => {
    setValue('subProductData.isOnSale', false);
    setValue('subProductData.saleType', '');
    setValue('subProductData.salePrice', 0);
    setValue('subProductData.saleDiscountPercentage', 0);
    setValue('subProductData.saleDiscountValue', 0);
    setValue('subProductData.saleStartDate', '');
    setValue('subProductData.saleEndDate', '');
    setInputPercentage(0);
    setInputFixed(0);
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="flex items-center justify-between">
          <div>
            <Text className="mb-1 text-lg font-semibold">Sales & Discounts</Text>
            <Text className="text-sm text-gray-500">
              Configure sale pricing and promotional discounts
            </Text>
          </div>
          {isOnSale && (
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={clearSale}
              className="text-red-600 hover:bg-red-50"
            >
              Clear Sale
            </Button>
          )}
        </div>
      </motion.div>

      {/* Base Selling Price Display */}
      {baseSellingPrice > 0 && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
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

      {/* Sale Status Banner */}
      {isOnSale && saleStatus.message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
            saleStatus.color === 'success' ? 'border-green-200 bg-green-50' :
            saleStatus.color === 'warning' ? 'border-amber-200 bg-amber-50' :
            'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {saleStatus.isActive ? (
              <PiCheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <PiClock className="h-5 w-5 text-amber-600" />
            )}
            <Text className={`font-medium ${
              saleStatus.color === 'success' ? 'text-green-800' :
              saleStatus.color === 'warning' ? 'text-amber-800' :
              'text-red-800'
            }`}>
              Sale: {saleStatus.message}
            </Text>
          </div>
          {salePrice > 0 && (
            <Text className="font-bold text-green-700">
              Sale Price: {currencySymbol}{salePrice.toLocaleString()}
            </Text>
          )}
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
          onClick={() => handleToggleSale(!isOnSale)}
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
            {/* Sale Type Selection Cards */}
            <motion.div variants={fieldStaggerVariants}>
              <label className="mb-3 block text-sm font-medium text-gray-700">
                Select Sale Type
              </label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {saleTypeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = saleType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSaleTypeChange(option.value)}
                      className={`relative flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all ${
                        isSelected 
                          ? `border-${option.color}-500 bg-${option.color}-50` 
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isSelected ? `bg-${option.color}-100` : 'bg-gray-100'
                      }`}>
                        <Icon className={`h-5 w-5 ${isSelected ? `text-${option.color}-600` : 'text-gray-500'}`} />
                      </div>
                      <Text className={`mt-2 font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {option.label}
                      </Text>
                      <Text className="mt-1 text-xs text-gray-500">
                        {option.description}
                      </Text>
                      {isSelected && (
                        <div className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-${option.color}-500`}>
                          <PiCheckCircle className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Sale Type Specific Fields */}
            <AnimatePresence mode="wait">
              {saleType === 'percentage' && (
                <motion.div
                  key="percentage"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid gap-6 md:grid-cols-2"
                >
                  {/* Discount Percentage */}
                  <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
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
                        value={inputPercentage}
                        onChange={(e) => handlePercentageChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9"
                      />
                      <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[5, 10, 15, 20, 25, 30, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handlePercentageChange(pct)}
                          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                            inputPercentage === pct 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  {/* Sale Price (Calculated) */}
                  <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Sale Price (Auto-calculated)
                    </label>
                    <div className="relative rounded-lg bg-blue-50 px-4 py-3">
                      <Text className="text-2xl font-bold text-blue-700">
                        {currencySymbol}{(calculatedSalePrice || 0).toLocaleString()}
                      </Text>
                      <Text className="text-xs text-blue-600">
                        Original: {currencySymbol}{baseSellingPrice.toLocaleString()} (-{inputPercentage}%)
                      </Text>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {saleType === 'fixed' && (
                <motion.div
                  key="fixed"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid gap-6 md:grid-cols-2"
                >
                  {/* Fixed Discount Amount */}
                  <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Discount Amount ({currencySymbol})
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={baseSellingPrice || undefined}
                        placeholder="0.00"
                        value={inputFixed}
                        onChange={(e) => handleFixedChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9"
                      />
                      <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    {baseSellingPrice > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[5, 10, 15, 20, 25].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleFixedChange(Math.round(baseSellingPrice * pct / 100 * 100) / 100)}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              inputFixed === baseSellingPrice * pct / 100
                                ? 'bg-green-600 text-white' 
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {pct}% off ({currencySymbol}{(baseSellingPrice * pct / 100).toLocaleString()})
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Sale Price (Calculated) */}
                  <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Sale Price (Auto-calculated)
                    </label>
                    <div className="relative rounded-lg bg-green-50 px-4 py-3">
                      <Text className="text-2xl font-bold text-green-700">
                        {currencySymbol}{(calculatedSalePrice || 0).toLocaleString()}
                      </Text>
                      <Text className="text-xs text-green-600">
                        Save: {currencySymbol}{(inputFixed || 0).toLocaleString()}
                      </Text>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {saleType === 'flash_sale' && (
                <motion.div
                  key="flash_sale"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <PiLightning className="h-5 w-5 text-amber-600" />
                    <Text className="font-medium text-amber-800">Flash Sale Settings</Text>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Flash Discount (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="20"
                        value={inputPercentage}
                        onChange={(e) => handlePercentageChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Limited Quantity (Optional)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="100"
                        {...register('subProductData.flashSale.remainingQuantity')}
                      />
                    </div>
                  </div>
                  <Text className="text-xs text-amber-700">
                    Flash sales are automatically activated during the specified date range
                  </Text>
                </motion.div>
              )}

              {saleType === 'bundle' && (
                <motion.div
                  key="bundle"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 rounded-lg border border-purple-200 bg-purple-50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <PiGift className="h-5 w-5 text-purple-600" />
                    <Text className="font-medium text-purple-800">Bundle Deal Settings</Text>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Min. Quantity
                      </label>
                      <Input
                        type="number"
                        min="2"
                        placeholder="2"
                        {...register('subProductData.bundleQuantity')}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Discount (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="10"
                        value={inputPercentage}
                        onChange={(e) => handlePercentageChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Free Items
                      </label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="1"
                        {...register('subProductData.bundleFreeItems')}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {saleType === 'bogo' && (
                <motion.div
                  key="bogo"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 rounded-lg border border-rose-200 bg-rose-50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <PiNumberSquareTwo className="h-5 w-5 text-rose-600" />
                    <Text className="font-medium text-rose-800">Buy One Get One Settings</Text>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Buy Quantity
                      </label>
                      <Input
                        type="number"
                        min="1"
                        defaultValue={1}
                        placeholder="1"
                        {...register('subProductData.bogoBuyQty')}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Get Quantity (Free/Discounted)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        defaultValue={1}
                        placeholder="1"
                        {...register('subProductData.bogoGetQty')}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Second Item Discount (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        defaultValue={100}
                        placeholder="100"
                        {...register('subProductData.bogoDiscount')}
                      />
                      <Text className="mt-1 text-xs text-gray-500">100% = Free</Text>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Max Uses Per Customer
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="No limit"
                        {...register('subProductData.bogoMaxUses')}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sale Price Manual Input (for all types) */}
            {(saleType === 'percentage' || saleType === 'fixed' || saleType === 'flash_sale') && (
              <motion.div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Override Sale Price (Optional)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={baseSellingPrice || undefined}
                    placeholder={`Auto: ${currencySymbol}${(calculatedSalePrice || 0).toLocaleString()}`}
                    value={salePrice || ''}
                    onChange={(e) => handleSalePriceChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-9"
                  />
                  <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
                <Text className="mt-1 text-xs text-gray-500">
                  Leave empty to use auto-calculated price
                </Text>
              </motion.div>
            )}

            {/* Savings Display */}
            {salePrice > 0 && salePrice < baseSellingPrice && baseSellingPrice > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <PiArrowsDownUp className="h-5 w-5 text-green-600" />
                  <Text className="text-sm font-medium text-green-800">Customer Savings:</Text>
                </div>
                <div className="text-right">
                  <Text className="text-lg font-bold text-green-700">
                    {currencySymbol}{savingsAmount.toLocaleString()} ({discountPercentage.toFixed(1)}%)
                  </Text>
                </div>
              </motion.div>
            )}

            {/* Sale Dates */}
            <div className="grid gap-6 md:grid-cols-2">
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale Start Date (Optional)
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

              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sale End Date (Optional)
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
            <motion.div variants={fieldStaggerVariants}>
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
