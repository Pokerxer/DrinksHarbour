// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Button, Badge, Tooltip } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { useFieldArray } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  PiPlus,
  PiTrash,
  PiCurrencyDollar,
  PiPackage,
  PiRuler,
  PiWarning,
  PiTrendUp,
  PiCalculator,
} from 'react-icons/pi';

interface ProductPricingProps {
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export default function ProductPricing({
  className,
}: ProductPricingProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
    control,
  } = useFormContext<CreateProductInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'sizes',
  });

  const currency = watch('currency') || 'NGN';
  const currencySymbol = currencySymbols[currency] || '₦';

  const addSize = () => {
    append({
      size: '',
      displayName: '',
      unitType: 'volume_ml',
      volumeMl: undefined,
      basePrice: 0,
      costPrice: 0,
      stock: 0,
      sku: '',
    });
  };

  // Calculate profit margin for a size variant
  const calculateMargin = (index: number) => {
    const sizes = watch('sizes') || [];
    const size = sizes[index];
    if (!size || !size.basePrice || !size.costPrice) return null;
    
    const profit = size.basePrice - size.costPrice;
    const margin = (profit / size.basePrice) * 100;
    return { profit, margin };
  };

  return (
    <FormGroup
      title="Pricing & Inventory"
      description="Set up pricing, stock levels, and size variants"
      className={cn(className)}
    >
      <motion.div
        className="grid w-full gap-6 @2xl:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Base SKU */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiPackage className="h-4 w-4 text-blue-500" />
              Base SKU
            </label>
            <Input
              placeholder="e.g., PROD-001"
              {...register('subProductData.sku')}
            />
            <Text className="mt-2 text-xs text-gray-500">
              Unique identifier for this product
            </Text>
          </div>
        </motion.div>

        {/* Currency */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiCurrencyDollar className="h-4 w-4 text-green-500" />
              Currency
            </label>
            <div className="relative">
              <select
                className="block w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('subProductData.currency')}
              >
                <option value="NGN">Nigerian Naira (₦)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pound (£)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tax Rate */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiCalculator className="h-4 w-4 text-purple-500" />
              Tax Rate (%)
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g., 7.5"
              {...register('subProductData.taxRate', { valueAsNumber: true })}
            />
          </div>
        </motion.div>

        {/* Stock Thresholds */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiWarning className="h-4 w-4 text-amber-500" />
              Stock Management
            </label>

            <motion.div
              className="grid gap-4 @md:grid-cols-3"
              variants={staggerContainer}
            >
              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Low Stock Alert Threshold
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 10"
                  {...register('subProductData.lowStockThreshold', { valueAsNumber: true })}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Reorder Point
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 5"
                  {...register('subProductData.reorderPoint', { valueAsNumber: true })}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Reorder Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 50"
                  {...register('subProductData.reorderQuantity', { valueAsNumber: true })}
                />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Shipping Info */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiRuler className="h-4 w-4 text-indigo-500" />
              Shipping Information
            </label>

            <motion.div
              className="grid gap-4 @md:grid-cols-2 @lg:grid-cols-5"
              variants={staggerContainer}
            >
              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Weight (grams)
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 1200"
                  {...register('subProductData.shipping.weight', { valueAsNumber: true })}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Length (cm)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="cm"
                  {...register('subProductData.shipping.length', { valueAsNumber: true })}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Width (cm)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="cm"
                  {...register('subProductData.shipping.width', { valueAsNumber: true })}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Height (cm)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="cm"
                  {...register('subProductData.shipping.height', { valueAsNumber: true })}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Fragile
                </label>
                <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    {...register('subProductData.shipping.fragile')}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Size Variants */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PiPackage className="h-4 w-4 text-teal-500" />
                Size Variants
                <Badge color="secondary" className="text-xs">
                  {fields.length} variant{fields.length !== 1 ? 's' : ''}
                </Badge>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSize}
                className="gap-1"
              >
                <PiPlus className="h-4 w-4" />
                Add Size
              </Button>
            </div>

            <AnimatePresence mode="popLayout">
              {fields.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center"
                >
                  <PiPackage className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <Text className="text-gray-500">
                    No size variants added. Click &quot;Add Size&quot; to create product variants.
                  </Text>
                </motion.div>
              ) : (
                <motion.div className="space-y-4" variants={staggerContainer}>
                  {fields.map((field, index) => {
                    const marginData = calculateMargin(index);
                    return (
                      <motion.div
                        key={field.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative rounded-xl border-2 border-gray-200 bg-gray-50/50 p-4"
                      >
                        {/* Variant Header */}
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge color="info" className="text-xs">
                              Variant #{index + 1}
                            </Badge>
                            {marginData && marginData.margin > 0 && (
                              <Tooltip content={`Profit: ${currencySymbol}${marginData.profit.toFixed(2)} (${marginData.margin.toFixed(1)}% margin)`}>
                                <Badge
                                  color={marginData.margin >= 30 ? 'success' : marginData.margin >= 15 ? 'warning' : 'danger'}
                                  className="cursor-help text-xs"
                                >
                                  <PiTrendUp className="mr-1 inline h-3 w-3" />
                                  {marginData.margin.toFixed(1)}% margin
                                </Badge>
                              </Tooltip>
                            )}
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => remove(index)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                          >
                            <PiTrash className="h-4 w-4" />
                          </motion.button>
                        </div>

                        {/* Variant Fields */}
                        <motion.div
                          className="grid gap-4 @md:grid-cols-2 @lg:grid-cols-4"
                          variants={staggerContainer}
                        >
                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Size
                            </label>
                            <select
                              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              {...register(`subProductData.sizes.${index}.size`)}
                            >
                              <option value="">Select size</option>
                              <option value="75cl">75cl (Standard)</option>
                              <option value="37.5cl">37.5cl (Half)</option>
                              <option value="150cl">150cl (Magnum)</option>
                              <option value="70cl">70cl (Spirits)</option>
                              <option value="1L">1 Liter</option>
                              <option value="50cl">50cl</option>
                              <option value="33cl">33cl (Beer)</option>
                              <option value="can-330ml">330ml Can</option>
                              <option value="can-500ml">500ml Can</option>
                              <option value="pack-6">6-Pack</option>
                              <option value="pack-12">12-Pack</option>
                              <option value="case-24">Case of 24</option>
                            </select>
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Display Name
                            </label>
                            <Input
                              placeholder="e.g., 750ml Bottle"
                              {...register(`subProductData.sizes.${index}.displayName`)}
                            />
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              SKU
                            </label>
                            <Input
                              placeholder="Variant SKU"
                              {...register(`subProductData.sizes.${index}.sku`)}
                            />
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Selling Price ({currencySymbol})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...register(`subProductData.sizes.${index}.basePrice`, { valueAsNumber: true })}
                            />
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Cost Price ({currencySymbol})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...register(`subProductData.sizes.${index}.costPrice`, { valueAsNumber: true })}
                            />
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Initial Stock
                            </label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...register(`subProductData.sizes.${index}.stock`, { valueAsNumber: true })}
                            />
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Volume (ml)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="ml"
                              {...register(`subProductData.sizes.${index}.volumeMl`, { valueAsNumber: true })}
                            />
                          </motion.div>

                          <motion.div variants={itemVariants}>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Unit Type
                            </label>
                            <select
                              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              {...register(`subProductData.sizes.${index}.unitType`)}
                            >
                              <option value="volume_ml">Volume (ml)</option>
                              <option value="volume_cl">Volume (cl)</option>
                              <option value="volume_l">Volume (L)</option>
                              <option value="weight_g">Weight (g)</option>
                              <option value="weight_kg">Weight (kg)</option>
                              <option value="count_unit">Count (unit)</option>
                              <option value="count_pack">Count (pack)</option>
                            </select>
                          </motion.div>
                        </motion.div>

                        {/* Quick Actions */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3"
                        >
                          <Text className="text-xs text-gray-500">
                            Quick fill:
                          </Text>
                          <button
                            type="button"
                            onClick={() => {
                              setValue(`subProductData.sizes.${index}.size`, '75cl');
                              setValue(`subProductData.sizes.${index}.displayName`, '750ml Standard Bottle');
                              setValue(`subProductData.sizes.${index}.volumeMl`, 750);
                            }}
                            className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                          >
                            Standard (750ml)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setValue(`subProductData.sizes.${index}.size`, '70cl');
                              setValue(`subProductData.sizes.${index}.displayName`, '700ml Spirits Bottle');
                              setValue(`subProductData.sizes.${index}.volumeMl`, 700);
                            }}
                            className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                          >
                            Spirits (700ml)
                          </button>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
