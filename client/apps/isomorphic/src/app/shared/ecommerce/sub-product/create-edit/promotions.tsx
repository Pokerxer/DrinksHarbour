// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Switch } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { PiGift, PiPercent, PiLightning, PiCalendar } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants, itemVariants } from './animations';

export default function SubProductPromotions() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;

  const discount = watch?.('subProductData.discount');
  const discountType = watch?.('subProductData.discountType');
  const flashSale = watch?.('subProductData.flashSale') || {};

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
          Configure ongoing discounts and flash sales
        </Text>
      </motion.div>

      {/* Regular Discount */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <PiGift className="h-5 w-5 text-blue-500" />
          <Text className="font-medium">Regular Discount</Text>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Discount Value */}
          <motion.div variants={fieldStaggerVariants} custom={2} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Discount Value
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              {...register('subProductData.discount', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          {/* Discount Type */}
          <motion.div variants={fieldStaggerVariants} custom={3}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Discount Type
            </label>
            <select
              {...register('subProductData.discountType')}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select type...</option>
              <option value="fixed">Fixed Amount</option>
              <option value="percentage">Percentage</option>
            </select>
          </motion.div>

          {/* Discount Start */}
          <motion.div variants={fieldStaggerVariants} custom={4}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Discount Start
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
              Discount End
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
      </motion.div>

      {/* Flash Sale */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={6}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiLightning className="h-5 w-5 text-amber-500" />
            <Text className="font-medium">Flash Sale</Text>
          </div>
          <Switch
            checked={flashSale.isActive}
            onChange={(checked) => setValue('subProductData.flashSale.isActive', checked)}
          />
        </div>

        <AnimatePresence>
          {flashSale.isActive && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid gap-6 md:grid-cols-2"
            >
              <motion.div variants={fieldStaggerVariants} custom={7}>
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

              <motion.div variants={fieldStaggerVariants} custom={8}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Flash Sale End
                </label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    {...register('subProductData.flashSale.endDate')}
                    className="w-full pl-9"
                  />
                  <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              <motion.div variants={fieldStaggerVariants} custom={9} className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Discount Percentage
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    {...register('subProductData.flashSale.discountPercentage', { valueAsNumber: true })}
                    className="w-full pl-9"
                  />
                  <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </motion.div>

              <motion.div variants={fieldStaggerVariants} custom={10} className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Remaining Quantity
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register('subProductData.flashSale.remainingQuantity', { valueAsNumber: true })}
                  className="w-full"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
