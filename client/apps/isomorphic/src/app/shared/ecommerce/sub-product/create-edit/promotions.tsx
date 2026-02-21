// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Textarea } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiGift, PiPercent, PiLightning, PiCalendar, PiCurrencyNgn, PiTag, 
  PiPackage, PiClock, PiWarningCircle, PiCheckCircle, PiXBold, PiPlus,
  PiArrowsDownUp, PiTimer, PiStar, PiHeart
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants, itemVariants } from './animations';

const CURRENCY_SYMBOL = '₦';

export default function SubProductPromotions() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const discount = watch?.('subProductData.discount') || 0;
  const discountType = watch?.('subProductData.discountType') || 'percentage';
  const discountStart = watch?.('subProductData.discountStart');
  const discountEnd = watch?.('subProductData.discountEnd');
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') || 0;
  const flashSale = watch?.('subProductData.flashSale') || {};
  const bundleDeals = watch?.('subProductData.bundleDeals') || [];

  const [showFlashSale, setShowFlashSale] = useState(flashSale?.isActive || false);
  const [showBundleDeals, setShowBundleDeals] = useState(false);

  const calculateDiscount = () => {
    if (!baseSellingPrice || baseSellingPrice <= 0 || !discount) return 0;
    
    if (discountType === 'percentage') {
      return baseSellingPrice * (discount / 100);
    } else {
      return Math.min(discount, baseSellingPrice);
    }
  };

  const discountedPrice = baseSellingPrice - calculateDiscount();
  const savings = calculateDiscount();

  const isDiscountActive = () => {
    const now = new Date();
    if (!discountStart && !discountEnd) return false;
    
    const start = discountStart ? new Date(discountStart) : null;
    const end = discountEnd ? new Date(discountEnd) : null;
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    
    return true;
  };

  const handleFlashSaleToggle = (checked: boolean) => {
    setShowFlashSale(checked);
    setValue('subProductData.flashSale.isActive', checked);
  };

  const handleAddBundle = () => {
    const newBundle = {
      id: Date.now(),
      name: '',
      quantity: 2,
      discount: 10,
      discountType: 'percentage',
    };
    setValue('subProductData.bundleDeals', [...bundleDeals, newBundle]);
  };

  const handleRemoveBundle = (index: number) => {
    const updated = [...bundleDeals];
    updated.splice(index, 1);
    setValue('subProductData.bundleDeals', updated);
  };

  const flashSaleActive = () => {
    if (!flashSale?.isActive) return false;
    
    const now = new Date();
    const start = flashSale?.startDate ? new Date(flashSale.startDate) : null;
    const end = flashSale?.endDate ? new Date(flashSale.endDate) : null;
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    
    return true;
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Promotions & Discounts</Text>
        <Text className="text-sm text-gray-500">
          Configure ongoing discounts, flash sales, and bundle deals
        </Text>
      </motion.div>

      {/* Price Summary */}
      {baseSellingPrice > 0 && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <PiCurrencyNgn className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Text className="font-medium text-blue-900">Base Selling Price</Text>
                <Text className="text-sm text-blue-700">
                  {CURRENCY_SYMBOL}{baseSellingPrice.toLocaleString()}
                </Text>
              </div>
            </div>
            {discount > 0 && (
              <div className="text-right">
                <Text className="text-sm text-blue-600">After Discount</Text>
                <Text className="text-lg font-bold text-blue-700">
                  {CURRENCY_SYMBOL}{discountedPrice.toLocaleString()}
                </Text>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Regular Discount */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiGift className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Regular Discount</Text>
            {discount > 0 && (
              <Badge color={isDiscountActive() ? 'success' : 'warning'}>
                {isDiscountActive() ? 'Active' : 'Scheduled'}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Discount Type */}
          <motion.div variants={fieldStaggerVariants} custom={2}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Discount Type
            </label>
            <Controller
              name="subProductData.discountType"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₦)</option>
                </select>
              )}
            />
          </motion.div>

          {/* Discount Value */}
          <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Discount Value {discountType === 'percentage' ? '(%)' : '(₦)'}
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max={discountType === 'percentage' ? 100 : undefined}
                placeholder={discountType === 'percentage' ? "10" : "500"}
                {...register('subProductData.discount', { valueAsNumber: true })}
                className="w-full pl-10"
              />
              {discountType === 'percentage' ? (
                <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              ) : (
                <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              )}
            </div>
          </motion.div>

          {/* Discount Start */}
          <motion.div variants={fieldStaggerVariants} custom={4}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Start Date (Optional)
            </label>
            <div className="relative">
              <Input
                type="datetime-local"
                {...register('subProductData.discountStart')}
                className="w-full pl-9"
              />
              <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </motion.div>

          {/* Discount End */}
          <motion.div variants={fieldStaggerVariants} custom={5}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              End Date (Optional)
            </label>
            <div className="relative">
              <Input
                type="datetime-local"
                {...register('subProductData.discountEnd')}
                className="w-full pl-9"
              />
              <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </motion.div>
        </div>

        {/* Savings Preview */}
        {discount > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiArrowsDownUp className="h-4 w-4 text-green-600" />
                <Text className="text-sm font-medium text-green-800">Customer Savings:</Text>
              </div>
              <Text className="font-bold text-green-700">
                {CURRENCY_SYMBOL}{savings.toLocaleString()} ({discount}{discountType === 'percentage' ? '%' : ''} off)
              </Text>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Flash Sale */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={6}
        className="rounded-lg border border-amber-200 bg-amber-50/50 p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiLightning className="h-5 w-5 text-amber-500" />
            <Text className="font-medium">Flash Sale</Text>
            {flashSaleActive() && (
              <Badge color="warning">
                <PiTimer className="mr-1 h-3 w-3" />
                Live Now
              </Badge>
            )}
          </div>
          <Switch
            checked={showFlashSale}
            onChange={handleFlashSaleToggle}
          />
        </div>

        <AnimatePresence>
          {showFlashSale && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid gap-6 md:grid-cols-2"
            >
              {/* Flash Sale Start */}
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Flash Sale Start
                </label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    {...register('subProductData.flashSale.startDate')}
                    className="w-full pl-9"
                  />
                  <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Flash Sale End */}
              <motion.div variants={fieldStaggerVariants}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Flash Sale End
                </label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    {...register('subProductData.flashSale.endDate')}
                    className="w-full pl-9"
                  />
                  <PiTimer className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Flash Discount Percentage */}
              <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Flash Discount (%)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="20"
                    {...register('subProductData.flashSale.discountPercentage', { valueAsNumber: true })}
                    className="w-full pl-10"
                  />
                  <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              {/* Remaining Quantity */}
              <motion.div className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Limited Quantity (Optional)
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="100"
                  {...register('subProductData.flashSale.remainingQuantity', { valueAsNumber: true })}
                  className="w-full"
                />
                <Text className="mt-1 text-xs text-gray-500">
                  Set limit for flash sale quantity
                </Text>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bundle Deals */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={7}
        className="rounded-lg border border-purple-200 bg-purple-50/50 p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiPackage className="h-5 w-5 text-purple-500" />
            <Text className="font-medium">Bundle Deals</Text>
            {bundleDeals.length > 0 && (
              <Badge color="info">{bundleDeals.length} deal(s)</Badge>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBundleDeals(!showBundleDeals)}
          >
            {showBundleDeals ? 'Hide' : 'Show'} Bundle Deals
          </Button>
        </div>

        <AnimatePresence>
          {showBundleDeals && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              {/* Existing Bundle Deals */}
              {bundleDeals.map((bundle: any, index: number) => (
                <motion.div
                  key={bundle.id || index}
                  variants={itemVariants}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid flex-1 gap-4 md:grid-cols-3">
                      <Input
                        placeholder="Bundle name"
                        value={bundle.name}
                        onChange={(e) => {
                          const updated = [...bundleDeals];
                          updated[index].name = e.target.value;
                          setValue('subProductData.bundleDeals', updated);
                        }}
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={bundle.quantity}
                        onChange={(e) => {
                          const updated = [...bundleDeals];
                          updated[index].quantity = parseInt(e.target.value) || 2;
                          setValue('subProductData.bundleDeals', updated);
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Discount"
                          value={bundle.discount}
                          onChange={(e) => {
                            const updated = [...bundleDeals];
                            updated[index].discount = parseFloat(e.target.value) || 0;
                            setValue('subProductData.bundleDeals', updated);
                          }}
                          className="flex-1"
                        />
                        <Controller
                          name={`subProductData.bundleDeals.${index}.discountType`}
                          control={control}
                          render={({ field }) => (
                            <select
                              {...field}
                              className="rounded-lg border border-gray-300 px-2 text-sm"
                            >
                              <option value="percentage">%</option>
                              <option value="fixed">₦</option>
                            </select>
                          )}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      onClick={() => handleRemoveBundle(index)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <PiXBold className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              {/* Add Bundle Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddBundle}
                className="w-full"
              >
                <PiPlus className="mr-2 h-4 w-4" />
                Add Bundle Deal
              </Button>

              {bundleDeals.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <PiPackage className="mx-auto h-8 w-8 mb-2 text-gray-400" />
                  <Text>No bundle deals yet. Click above to add one.</Text>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Quick Promo Actions */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Quick Promotions</Text>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.discount', 10);
              setValue('subProductData.discountType', 'percentage');
            }}
          >
            <PiTag className="mr-1 h-4 w-4" />
            10% Off
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.discount', 25);
              setValue('subProductData.discountType', 'percentage');
            }}
          >
            <PiTag className="mr-1 h-4 w-4" />
            25% Off
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.discount', 50);
              setValue('subProductData.discountType', 'percentage');
            }}
          >
            <PiTag className="mr-1 h-4 w-4" />
            50% Off
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('subProductData.discount', 0);
              setValue('subProductData.discountType', 'percentage');
            }}
          >
            Clear Discount
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
