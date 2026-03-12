// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Input, Text, Button, Switch, Badge } from 'rizzui';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  PiPlus, PiTrash, PiRuler, PiPackage, PiCaretDown, PiCaretUp, 
  PiCopy, PiArrowsDownUp, PiCheck, PiWarning, PiX, PiCheckCircle,
  PiMagnifyingGlass, PiFunnel, PiGauge, PiSparkle, PiTrendUp, PiStack,
  PiCurrencyNgn, PiPercent, PiWarehouse, PiTimer, PiEraser, PiInfo,
  PiDotsSixVertical, PiCopySimple, PiTrashSimple, PiChartLine
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants, itemVariants } from './animations';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';

// Enhanced animations
const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }),
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    x: -100,
    transition: { duration: 0.2 }
  },
  hover: {
    scale: 1.01,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
    transition: { duration: 0.2 }
  }
};

const expandVariants = {
  hidden: { 
    opacity: 0, 
    height: 0,
    overflow: 'hidden'
  },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: 'easeInOut'
    }
  },
  exit: { 
    opacity: 0, 
    height: 0,
    transition: {
      duration: 0.2
    }
  }
};

const buttonTapVariants = {
  tap: { scale: 0.95 },
  hover: { scale: 1.02 }
};

const shimmerVariants = {
  initial: { x: '-100%' },
  animate: { x: '100%' }
};

const quickAddVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 }
};

// Quick size presets for beverages
const SIZE_PRESETS = {
  wine: [
    { value: '37.5cl', label: '37.5cl (Half)', quickAdd: true },
    { value: '75cl', label: '75cl (Standard)', quickAdd: true },
    { value: '150cl', label: '150cl (Magnum)', quickAdd: true },
    { value: '300cl', label: '300cl (Double Mag)', quickAdd: true },
  ],
  spirit: [
    { value: '5cl', label: '5cl (Mini)', quickAdd: true },
    { value: '70cl', label: '70cl (Standard)', quickAdd: true },
    { value: '1L', label: '1 Liter', quickAdd: true },
    { value: '1.5L', label: '1.5 Liter', quickAdd: true },
  ],
  beer: [
    { value: '33cl', label: '33cl', quickAdd: true },
    { value: '50cl', label: '50cl', quickAdd: true },
    { value: 'bottle-500ml', label: '500ml Bottle', quickAdd: true },
    { value: 'can-440ml', label: '440ml Can', quickAdd: true },
  ],
  soft: [
    { value: '250ml', label: '250ml', quickAdd: true },
    { value: '500ml', label: '500ml', quickAdd: true },
    { value: '1L', label: '1 Liter', quickAdd: true },
    { value: '2L', label: '2 Liter', quickAdd: true },
  ],
  packs: [
    { value: 'pack-6', label: '6-Pack', quickAdd: true },
    { value: 'pack-12', label: '12-Pack', quickAdd: true },
    { value: 'case-12', label: 'Case of 12', quickAdd: true },
    { value: 'case-24', label: 'Case of 24', quickAdd: true },
  ],
};

const BEVERAGE_CATEGORIES = [
  { id: 'wine', label: 'Wine', icon: '🍷', color: 'bg-red-100 text-red-700' },
  { id: 'spirit', label: 'Spirit', icon: '🥃', color: 'bg-amber-100 text-amber-700' },
  { id: 'beer', label: 'Beer', icon: '🍺', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'soft', label: 'Soft Drinks', icon: '🥤', color: 'bg-blue-100 text-blue-700' },
  { id: 'packs', label: 'Multi-Packs', icon: '📦', color: 'bg-green-100 text-green-700' },
];

const MARKUP_PRESETS = [10, 15, 20, 25, 30, 35, 50, 75, 100];

export const SIZE_OPTIONS = [
  // Wine & Champagne Bottles
  { value: '10cl', label: '10cl', category: 'Wine & Champagne' },
  { value: '18.7cl', label: '18.7cl', category: 'Wine & Champagne' },
  { value: '20cl', label: '20cl', category: 'Wine & Champagne' },
  { value: '25cl', label: '25cl', category: 'Wine & Champagne' },
  { value: '37.5cl', label: '37.5cl (Half Bottle)', category: 'Wine & Champagne' },
  { value: '50cl', label: '50cl', category: 'Wine & Champagne' },
  { value: '75cl', label: '75cl (Standard)', category: 'Wine & Champagne' },
  { value: '100cl', label: '100cl', category: 'Wine & Champagne' },
  { value: '150cl', label: '150cl (Magnum)', category: 'Wine & Champagne' },
  { value: '300cl', label: '300cl (Double Magnum)', category: 'Wine & Champagne' },
  { value: '450cl', label: '450cl (Jeroboam)', category: 'Wine & Champagne' },
  { value: '600cl', label: '600cl (Imperial)', category: 'Wine & Champagne' },
  { value: '900cl', label: '900cl (Salmanazar)', category: 'Wine & Champagne' },
  { value: '1200cl', label: '1200cl (Balthazar)', category: 'Wine & Champagne' },
  { value: '1500cl', label: '1500cl (Nebuchadnezzar)', category: 'Wine & Champagne' },
  { value: '1800cl', label: '1800cl (Melchior)', category: 'Wine & Champagne' },
  
  // Spirits
  { value: '5cl', label: '5cl (Miniature)', category: 'Spirits' },
  { value: '10cl', label: '10cl', category: 'Spirits' },
  { value: '20cl', label: '20cl', category: 'Spirits' },
  { value: '35cl', label: '35cl', category: 'Spirits' },
  { value: '50ml', label: '50ml (Nip)', category: 'Spirits' },
  { value: '70cl', label: '70cl (Standard)', category: 'Spirits' },
  { value: '1L', label: '1 Liter', category: 'Spirits' },
  { value: '1.5L', label: '1.5 Liter', category: 'Spirits' },
  { value: '1.75L', label: '1.75 Liter', category: 'Spirits' },
  { value: '3L', label: '3 Liter', category: 'Spirits' },
  
  // Beer & Cider Bottles
  { value: '27.5cl', label: '27.5cl', category: 'Beer & Cider' },
  { value: '33cl', label: '33cl', category: 'Beer & Cider' },
  { value: '35cl', label: '35cl', category: 'Beer & Cider' },
  { value: '44cl', label: '44cl', category: 'Beer & Cider' },
  { value: '50cl', label: '50cl', category: 'Beer & Cider' },
  { value: '56.8cl', label: '56.8cl', category: 'Beer & Cider' },
  { value: '66cl', label: '66cl', category: 'Beer & Cider' },
  { value: 'bottle-275ml', label: 'Bottle 275ml', category: 'Beer & Cider' },
  { value: 'bottle-330ml', label: 'Bottle 330ml', category: 'Beer & Cider' },
  { value: 'bottle-355ml', label: 'Bottle 355ml', category: 'Beer & Cider' },
  { value: 'bottle-500ml', label: 'Bottle 500ml', category: 'Beer & Cider' },
  { value: 'bottle-568ml', label: 'Bottle 568ml (Pint)', category: 'Beer & Cider' },
  { value: 'bottle-600ml', label: 'Bottle 600ml', category: 'Beer & Cider' },
  { value: 'bottle-650ml', label: 'Bottle 650ml', category: 'Beer & Cider' },
  { value: 'bottle-750ml', label: 'Bottle 750ml', category: 'Beer & Cider' },
  
  // Beer Cans
  { value: 'can-200ml', label: 'Can 200ml', category: 'Beer Cans' },
  { value: 'can-250ml', label: 'Can 250ml', category: 'Beer Cans' },
  { value: 'can-330ml', label: 'Can 330ml', category: 'Beer Cans' },
  { value: 'can-355ml', label: 'Can 355ml', category: 'Beer Cans' },
  { value: 'can-440ml', label: 'Can 440ml', category: 'Beer Cans' },
  { value: 'can-473ml', label: 'Can 473ml', category: 'Beer Cans' },
  { value: 'can-500ml', label: 'Can 500ml', category: 'Beer Cans' },
  { value: 'can-568ml', label: 'Can 568ml', category: 'Beer Cans' },
  
  // Soft Drinks & Water
  { value: '200ml', label: '200ml', category: 'Soft Drinks & Water' },
  { value: '250ml', label: '250ml', category: 'Soft Drinks & Water' },
  { value: '300ml', label: '300ml', category: 'Soft Drinks & Water' },
  { value: '330ml', label: '330ml', category: 'Soft Drinks & Water' },
  { value: '355ml', label: '355ml', category: 'Soft Drinks & Water' },
  { value: '500ml', label: '500ml', category: 'Soft Drinks & Water' },
  { value: '600ml', label: '600ml', category: 'Soft Drinks & Water' },
  { value: '750ml', label: '750ml', category: 'Soft Drinks & Water' },
  { value: '1L', label: '1 Liter', category: 'Soft Drinks & Water' },
  { value: '1.25L', label: '1.25 Liter', category: 'Soft Drinks & Water' },
  { value: '1.5L', label: '1.5 Liter', category: 'Soft Drinks & Water' },
  { value: '2L', label: '2 Liter', category: 'Soft Drinks & Water' },
  { value: '2.5L', label: '2.5 Liter', category: 'Soft Drinks & Water' },
  { value: '3L', label: '3 Liter', category: 'Soft Drinks & Water' },
  { value: '5L', label: '5 Liter', category: 'Soft Drinks & Water' },
  
  // Multi-Packs
  { value: 'pack-4', label: '4-Pack', category: 'Multi-Packs' },
  { value: 'pack-6', label: '6-Pack', category: 'Multi-Packs' },
  { value: 'pack-8', label: '8-Pack', category: 'Multi-Packs' },
  { value: 'pack-10', label: '10-Pack', category: 'Multi-Packs' },
  { value: 'pack-12', label: '12-Pack', category: 'Multi-Packs' },
  { value: 'pack-18', label: '18-Pack', category: 'Multi-Packs' },
  { value: 'pack-24', label: '24-Pack', category: 'Multi-Packs' },
  { value: 'pack-30', label: '30-Pack', category: 'Multi-Packs' },
  { value: 'pack-36', label: '36-Pack', category: 'Multi-Packs' },
  { value: 'case-6', label: 'Case of 6', category: 'Multi-Packs' },
  { value: 'case-12', label: 'Case of 12', category: 'Multi-Packs' },
  { value: 'case-24', label: 'Case of 24', category: 'Multi-Packs' },
  
  // Coffee & Tea (Weight-based)
  { value: '50g', label: '50g', category: 'Coffee & Tea' },
  { value: '100g', label: '100g', category: 'Coffee & Tea' },
  { value: '125g', label: '125g', category: 'Coffee & Tea' },
  { value: '200g', label: '200g', category: 'Coffee & Tea' },
  { value: '250g', label: '250g', category: 'Coffee & Tea' },
  { value: '340g', label: '340g', category: 'Coffee & Tea' },
  { value: '500g', label: '500g', category: 'Coffee & Tea' },
  { value: '1kg', label: '1kg', category: 'Coffee & Tea' },
  { value: '2kg', label: '2kg', category: 'Coffee & Tea' },
  
  // Tea Bags
  { value: 'teabag-20', label: '20 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-25', label: '25 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-40', label: '40 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-50', label: '50 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-100', label: '100 Tea Bags', category: 'Tea Bags' },
  
  // Single Serve
  { value: 'unit-single', label: 'Single Unit', category: 'Single Serve' },
  { value: 'shot-25ml', label: 'Shot 25ml', category: 'Single Serve' },
  { value: 'shot-35ml', label: 'Shot 35ml', category: 'Single Serve' },
  { value: 'shot-50ml', label: 'Shot 50ml', category: 'Single Serve' },
  
  // Gift Sets
  { value: 'set-2', label: 'Set of 2', category: 'Gift Sets' },
  { value: 'set-3', label: 'Set of 3', category: 'Gift Sets' },
  { value: 'set-4', label: 'Set of 4', category: 'Gift Sets' },
  { value: 'set-6', label: 'Set of 6', category: 'Gift Sets' },
  { value: 'set-12', label: 'Set of 12', category: 'Gift Sets' },
  { value: 'gift-set', label: 'Gift Set', category: 'Gift Sets' },
  { value: 'tasting-set', label: 'Tasting Set', category: 'Gift Sets' },
  { value: 'variety-pack', label: 'Variety Pack', category: 'Gift Sets' },
  
  // Custom
  { value: 'custom', label: 'Custom Size', category: 'Other' },
  { value: 'variable', label: 'Variable Size', category: 'Other' },
  { value: 'assorted', label: 'Assorted', category: 'Other' },
];

export default function SubProductSizes() {
  const methods = useFormContext();
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProductData.sizes',
  });

  const sellWithoutSizeVariants = watch?.('subProductData.sellWithoutSizeVariants');
  const defaultMarkup = watch?.('subProductData.markupPercentage') ?? 25;
  const defaultRoundUp = watch?.('subProductData.roundUp') ?? '100';
  const defaultCostPrice = watch?.('subProductData.costPrice');
  const defaultDiscount = watch?.('subProductData.saleDiscountPercentage') ?? 0;
  const defaultCurrency = watch?.('subProductData.currency') ?? 'NGN';

  const calculateBasePrice = (variantCostPrice: number, variantMarkup: number, variantRoundUp: string) => {
    if (!variantCostPrice || variantCostPrice <= 0) return 0;
    let calculatedPrice = variantCostPrice * (1 + (variantMarkup / 100));
    
    if (variantRoundUp === '100') {
      calculatedPrice = Math.ceil(calculatedPrice / 100) * 100;
    } else if (variantRoundUp === '1000') {
      calculatedPrice = Math.ceil(calculatedPrice / 1000) * 1000;
    }
    
    return Number(calculatedPrice.toFixed(2));
  };

  const calculateSalePrice = (variantBasePrice: number, discountPercentage: number) => {
    if (!variantBasePrice || variantBasePrice <= 0 || !discountPercentage) return null;
    const salePrice = variantBasePrice * (1 - (discountPercentage / 100));
    return Number(salePrice.toFixed(2));
  };

  const addSize = () => {
    const baseSellingPrice = defaultCostPrice ? calculateBasePrice(defaultCostPrice, defaultMarkup, defaultRoundUp) : null;
    const salePrice = baseSellingPrice && defaultDiscount > 0 ? calculateSalePrice(baseSellingPrice, defaultDiscount) : null;
    
    append({
      size: '',
      displayName: '',
      sizeCategory: '',
      unitType: 'volume_ml',
      volumeMl: null,
      weightGrams: null,
      servingsPerUnit: null,
      unitsPerPack: 6,
      packaging: 'pack-6',
      basePrice: baseSellingPrice,
      compareAtPrice: null,
      costPrice: defaultCostPrice ?? null,
      wholesalePrice: null,
      currency: defaultCurrency,
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
      lowStockThreshold: 10,
      reorderPoint: 5,
      reorderQuantity: 50,
      sku: '',
      barcode: '',
      markupPercentage: defaultMarkup,
      roundUp: defaultRoundUp,
      saleDiscountPercentage: defaultDiscount,
      salePrice: salePrice,
      isDefault: false,
      isOnSale: false,
      rank: fields.length + 1,
    });
    toast.success('Size variant added');
  };

  const duplicateSize = (index: number) => {
    const currentSize = watch(`subProductData.sizes.${index}`);
    if (currentSize) {
      append({
        ...currentSize,
        size: `${currentSize.size} (Copy)`,
        displayName: currentSize.displayName ? `${currentSize.displayName} (Copy)` : '',
        rank: fields.length + 1,
      });
      toast.success('Size variant duplicated');
    }
  };

  const clearAllSizes = () => {
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    toast.success('All sizes cleared');
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
        <div className="relative overflow-hidden rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-indigo-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
              >
                <PiPackage className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <Text className="font-semibold text-gray-900">Sizes & Variants</Text>
                <Text className="text-xs text-gray-500">
                  Configure product size variants for inventory management
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {fields.length > 0 && (
                <>
                  <Badge variant="flat" color="primary" className="font-medium">
                    {fields.length} Variant{fields.length !== 1 ? 's' : ''}
                  </Badge>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={clearAllSizes}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <PiEraser className="mr-1 h-4 w-4" />
                    Clear All
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sell Without Variants Toggle */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <PiRuler className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <Text className="font-semibold text-gray-800">Sell Without Size Variants</Text>
            <Text className="text-sm text-gray-500">
              Offer this product as a single item without size options
            </Text>
          </div>
        </div>
        <Controller
          name="subProductData.sellWithoutSizeVariants"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              onChange={(checked) => {
                field.onChange(checked);
                setValue('subProductData.sellWithoutSizeVariants', checked);
              }}
            />
          )}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {!sellWithoutSizeVariants && (
          <motion.div
            key="sizes-section"
            variants={toggleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4"
          >
            {/* Summary Header */}
            {fields.length > 0 && (
              <motion.div 
                variants={fieldStaggerVariants}
                className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <PiStack className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <Text className="font-semibold text-gray-800">
                      {fields.length} Size Variant{fields.length !== 1 ? 's' : ''} Configured
                    </Text>
                    <div className="flex items-center gap-3 mt-1">
                      <Text className="text-sm text-gray-500">
                        Total stock: <span className="font-medium text-blue-600">{fields.reduce((sum, _, i) => {
                          const stock = watch(`subProductData.sizes.${i}.stock`) || 0;
                          return sum + stock;
                        }, 0)}</span> units
                      </Text>
                      <div className="h-3 w-px bg-gray-300" />
                      <Text className="text-sm text-gray-500">
                        Avg Price: <span className="font-medium text-green-600">
                          {fields.filter((_, i) => watch(`subProductData.sizes.${i}.basePrice`)).length > 0 
                            ? `${defaultCurrency} ${(fields.reduce((sum, _, i) => {
                              const price = watch(`subProductData.sizes.${i}.basePrice`) || 0;
                              return sum + price;
                            }, 0) / fields.filter((_, i) => watch(`subProductData.sizes.${i}.basePrice`)).length).toFixed(2)}`
                            : '-'}
                        </span>
                      </Text>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {fields.filter((_, i) => watch(`subProductData.sizes.${i}.isDefault`)).length > 0 ? (
                    <Badge color="success" variant="flat" className="gap-1">
                      <PiCheckCircle className="h-3 w-3" />
                      Default Set
                    </Badge>
                  ) : (
                    <Badge color="warning" variant="flat" className="gap-1">
                      <PiWarning className="h-3 w-3" />
                      No Default
                    </Badge>
                  )}
                </div>
              </motion.div>
            )}

            {/* Quick Add Section with Category Tabs */}
            {fields.length < 20 && (
              <motion.div 
                variants={quickAddVariants}
                initial="hidden"
                animate="visible"
                className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PiSparkle className="h-4 w-4 text-amber-500" />
                    <Text className="text-sm font-medium text-gray-700">Quick Add Common Sizes</Text>
                  </div>
                  <Badge variant="flat" color="secondary" size="sm">
                    Click to add
                  </Badge>
                </div>
                
                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {BEVERAGE_CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.id}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        SIZE_PRESETS[cat.id as keyof typeof SIZE_PRESETS]?.length > 0
                          ? 'cursor-pointer hover:shadow-md'
                          : 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </motion.button>
                  ))}
                </div>
                
                {/* Size Buttons by Category */}
                <div className="space-y-3">
                  {BEVERAGE_CATEGORIES.map((cat) => {
                    const sizes = SIZE_PRESETS[cat.id as keyof typeof SIZE_PRESETS];
                    if (!sizes || sizes.length === 0) return null;
                    
                    return (
                      <div key={cat.id} className="space-y-2">
                        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {cat.icon} {cat.label}
                        </Text>
                        <div className="flex flex-wrap gap-2">
                          {sizes.map((size) => (
                            <motion.button
                              key={size.value}
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const exists = fields.some((_, i) => watch(`subProductData.sizes.${i}.size`) === size.value);
                                if (exists) {
                                  toast.error(`${size.label} already exists`);
                                  return;
                                }
                                const baseSellingPrice = defaultCostPrice ? calculateBasePrice(defaultCostPrice, defaultMarkup, defaultRoundUp) : null;
                                const salePrice = baseSellingPrice && defaultDiscount > 0 ? calculateSalePrice(baseSellingPrice, defaultDiscount) : null;
                                append({
                                  size: size.value,
                                  displayName: size.label,
                                  sizeCategory: 'standard',
                                  unitType: 'volume_cl',
                                  volumeMl: parseFloat(size.value.replace('cl', '').replace('ml', '').replace('L', '')) * 10 || null,
                                  weightGrams: null,
                                  servingsPerUnit: null,
                                  unitsPerPack: 6,
                                  packaging: 'pack-6',
                                  basePrice: baseSellingPrice,
                                  compareAtPrice: null,
                                  costPrice: defaultCostPrice ?? null,
                                  wholesalePrice: null,
                                  currency: defaultCurrency,
                                  stock: 0,
                                  reservedStock: 0,
                                  availableStock: 0,
                                  lowStockThreshold: 10,
                                  reorderPoint: 5,
                                  reorderQuantity: 50,
                                  sku: '',
                                  barcode: '',
                                  markupPercentage: defaultMarkup,
                                  roundUp: defaultRoundUp,
                                  saleDiscountPercentage: defaultDiscount,
                                  salePrice: salePrice,
                                  isDefault: fields.length === 0,
                                  isOnSale: false,
                                  rank: fields.length + 1,
                                });
                                toast.success(`Added ${size.label}`);
                              }}
                              className="px-3 py-1.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              + {size.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Size Variants */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    custom={index}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileHover="hover"
                    layout
                  >
                    <SizeVariantRow
                      index={index}
                      setValue={setValue}
                      watch={watch}
                      control={control}
                      remove={remove}
                      totalSizes={fields.length}
                      calculateBasePrice={calculateBasePrice}
                      calculateSalePrice={calculateSalePrice}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add Button */}
            <motion.div variants={fieldStaggerVariants} custom={fields.length + 2}>
              <motion.button
                type="button"
                whileHover="hover"
                whileTap="tap"
                variants={buttonTapVariants}
                onClick={addSize}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all group"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <PiPlus className="h-5 w-5" />
                </motion.div>
                <span>Add Size Variant</span>
                <Text className="text-xs text-gray-400 group-hover:text-blue-400">
                  (Max 20 variants)
                </Text>
              </motion.button>
            </motion.div>

            {/* Empty State */}
            {fields.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 px-6 rounded-xl border-2 border-dashed border-gray-200"
              >
                <div className="flex h-16 w-16 items-center justify-center mx-auto mb-4 rounded-full bg-gray-50">
                  <PiRuler className="h-8 w-8 text-gray-400" />
                </div>
                <Text className="text-lg font-medium text-gray-600 mb-2">No Size Variants Yet</Text>
                <Text className="text-sm text-gray-500 mb-4">
                  Add size variants to manage different product sizes and their stock levels
                </Text>
                <Button
                  type="button"
                  onClick={addSize}
                  className="mx-auto"
                >
                  <PiPlus className="mr-2 h-4 w-4" />
                  Add Your First Size
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SizeVariantRow({
  index,
  setValue,
  watch,
  control,
  remove,
  totalSizes,
  calculateBasePrice,
  calculateSalePrice,
}: {
  index: number;
  setValue: any;
  watch: any;
  control: any;
  remove: (index: number) => void;
  totalSizes: number;
  calculateBasePrice: (costPrice: number, markup: number, roundUp: string) => number;
  calculateSalePrice: (basePrice: number, discount: number) => number | null;
}) {
  const variantCostPrice = watch(`subProductData.sizes.${index}.costPrice`);
  const variantMarkup = watch(`subProductData.sizes.${index}.markupPercentage`) ?? 25;
  const variantRoundUp = watch(`subProductData.sizes.${index}.roundUp`) ?? '100';
  const variantBasePrice = watch(`subProductData.sizes.${index}.basePrice`);
  const variantDiscount = watch(`subProductData.sizes.${index}.saleDiscountPercentage`) ?? 0;

  const [localMarkup, setLocalMarkup] = useState(variantMarkup);
  const [localDiscount, setLocalDiscount] = useState(variantDiscount);
  const [expanded, setExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setLocalMarkup(variantMarkup);
  }, [variantMarkup]);

  useEffect(() => {
    setLocalDiscount(variantDiscount);
  }, [variantDiscount]);

  // Initialize once on mount
  useEffect(() => {
    if (!initialized && variantCostPrice && variantCostPrice > 0) {
      const calculatedPrice = calculateBasePrice(variantCostPrice, localMarkup, variantRoundUp);
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
      setInitialized(true);
    }
  }, []);

  // Handle cost price change
  const handleCostPriceChange = (value: number | null) => {
    if (value && value > 0) {
      const calculatedPrice = calculateBasePrice(value, localMarkup, variantRoundUp);
      setValue(`subProductData.sizes.${index}.costPrice`, value);
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
    } else {
      setValue(`subProductData.sizes.${index}.costPrice`, value);
    }
  };

  const handleMarkupChange = (value: number) => {
    setLocalMarkup(value);
    setValue(`subProductData.sizes.${index}.markupPercentage`, value);
    if (variantCostPrice && variantCostPrice > 0) {
      const calculatedPrice = calculateBasePrice(variantCostPrice, value, variantRoundUp);
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
    }
  };

  const handleRoundUpChange = (value: string) => {
    setValue(`subProductData.sizes.${index}.roundUp`, value);
    if (variantCostPrice && variantCostPrice > 0) {
      const calculatedPrice = calculateBasePrice(variantCostPrice, localMarkup, value);
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
    }
  };

  const handleDiscountChange = (value: number) => {
    setLocalDiscount(value);
    setValue(`subProductData.sizes.${index}.saleDiscountPercentage`, value);
    if (variantBasePrice && variantBasePrice > 0 && value > 0) {
      const calculatedSalePrice = calculateSalePrice(variantBasePrice, value);
      setValue(`subProductData.sizes.${index}.salePrice`, calculatedSalePrice);
    } else if (value === 0) {
      setValue(`subProductData.sizes.${index}.salePrice`, null);
    }
  };

  const handleBasePriceChange = (value: number | null) => {
    setValue(`subProductData.sizes.${index}.basePrice`, value);
    if (value && value > 0 && localDiscount > 0) {
      const calculatedSalePrice = calculateSalePrice(value, localDiscount);
      setValue(`subProductData.sizes.${index}.salePrice`, calculatedSalePrice);
    } else if (localDiscount === 0) {
      setValue(`subProductData.sizes.${index}.salePrice`, null);
    }
  };

  const handleSizeChange = (sizeValue: string) => {
    const selectedOption = SIZE_OPTIONS.find(opt => opt.value === sizeValue);
    if (selectedOption) {
      setValue(`subProductData.sizes.${index}.size`, sizeValue);
      setValue(`subProductData.sizes.${index}.displayName`, selectedOption.label);
    }
  };

  const roundUpOptions = [
    { value: 'none', label: 'None' },
    { value: '100', label: 'Nearest 100' },
    { value: '1000', label: 'Nearest 1,000' },
  ];

  const sizeCategoryOptions = [
    { value: 'miniature', label: 'Miniature' },
    { value: 'single_serve', label: 'Single Serve' },
    { value: 'standard', label: 'Standard' },
    { value: 'large', label: 'Large' },
    { value: 'extra_large', label: 'Extra Large' },
    { value: 'multi_pack', label: 'Multi-Pack' },
    { value: 'bulk', label: 'Bulk' },
    { value: 'gift_set', label: 'Gift Set' },
    { value: 'variety_pack', label: 'Variety Pack' },
    { value: 'keg', label: 'Keg' },
  ];

  const packagingOptions = [
    { value: 'pack-6', label: '6-Pack' },
    { value: 'pack-12', label: '12-Pack' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'can', label: 'Can' },
    { value: 'glass_bottle', label: 'Glass Bottle' },
    { value: 'plastic_bottle', label: 'Plastic Bottle' },
    { value: 'tetra_pak', label: 'Tetra Pak' },
    { value: 'keg', label: 'Keg' },
    { value: 'barrel', label: 'Barrel' },
    { value: 'box', label: 'Box' },
    { value: 'bag', label: 'Bag' },
    { value: 'pouch', label: 'Pouch' },
    { value: 'carton', label: 'Carton' },
    { value: 'jar', label: 'Jar' },
    { value: 'tin', label: 'Tin' },
    { value: 'tub', label: 'Tub' },
  ];

  const availabilityOptions = [
    { value: 'available', label: 'Available' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'pre_order', label: 'Pre-Order' },
    { value: 'coming_soon', label: 'Coming Soon' },
    { value: 'discontinued', label: 'Discontinued' },
    { value: 'backorder', label: 'Backorder' },
    { value: 'limited_stock', label: 'Limited Stock' },
  ];

  // Group sizes by category
  const groupedOptions = SIZE_OPTIONS.reduce((acc, option) => {
    if (!acc[option.category]) {
      acc[option.category] = [];
    }
    acc[option.category].push(option);
    return acc;
  }, {} as Record<string, typeof SIZE_OPTIONS>);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Text className="font-medium">Size Variant #{index + 1}</Text>
          <Controller
            name={`subProductData.sizes.${index}.isDefault`}
            control={control}
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => {
                    field.onChange(e.target.checked);
                    setValue(`subProductData.sizes.${index}.isDefault`, e.target.checked);
                  }}
                  className="rounded border-gray-300"
                />
                Default
              </label>
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-gray-600"
          >
            {expanded ? <PiCaretUp className="h-4 w-4" /> : <PiCaretDown className="h-4 w-4" />}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const currentSize = watch(`subProductData.sizes.${index}`);
              if (currentSize) {
                append({
                  ...currentSize,
                  size: `${currentSize.size} (Copy)`,
                  displayName: currentSize.displayName ? `${currentSize.displayName} (Copy)` : '',
                  rank: totalSizes + 1,
                });
                toast.success('Size variant duplicated');
              }
            }}
            className="text-blue-600 hover:bg-blue-50"
          >
            <PiCopySimple className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              remove(index);
              toast.success('Size variant removed');
            }}
            className="text-red-600 hover:bg-red-50"
          >
            <PiTrashSimple className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Basic Info - Always Visible */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Size Dropdown */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Size <span className="text-red-500">*</span>
          </label>
          <Controller
            name={`subProductData.sizes.${index}.size`}
            control={control}
            defaultValue=""
            render={({ field }) => (
              <select
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  handleSizeChange(e.target.value);
                }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select size...</option>
                {Object.entries(groupedOptions).map(([category, options]) => (
                  <optgroup key={category} label={category}>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Display Name
          </label>
          <Controller
            name={`subProductData.sizes.${index}.displayName`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="e.g., Large Bottle"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Unit Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Unit Type
          </label>
          <Controller
            name={`subProductData.sizes.${index}.unitType`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="volume_ml">Volume (ml)</option>
                <option value="volume_cl">Volume (cl)</option>
                <option value="volume_l">Volume (L)</option>
                <option value="volume_oz">Volume (oz)</option>
                <option value="weight_g">Weight (g)</option>
                <option value="weight_kg">Weight (kg)</option>
                <option value="count_unit">Count (unit)</option>
                <option value="count_pack">Count (pack)</option>
              </select>
            )}
          />
        </div>

        {/* Volume/Weight */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Volume/Weight (ml/g)
          </label>
          <Controller
            name={`subProductData.sizes.${index}.volumeMl`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="0"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Weight (grams) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Weight (grams)
          </label>
          <Controller
            name={`subProductData.sizes.${index}.weightGrams`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="0"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Servings Per Unit */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Servings Per Unit
          </label>
          <Controller
            name={`subProductData.sizes.${index}.servingsPerUnit`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="1"
                placeholder="1"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Cost Price */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Cost Price
          </label>
          <Controller
            name={`subProductData.sizes.${index}.costPrice`}
            control={control}
            defaultValue={null}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) => handleCostPriceChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Markup */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Markup (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="500"
            placeholder="25"
            value={localMarkup}
            onChange={(e) => handleMarkupChange(parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
          />
          {/* Quick Markup Presets */}
          <div className="flex flex-wrap gap-1">
            {MARKUP_PRESETS.slice(0, 6).map((markup) => (
              <button
                key={markup}
                type="button"
                onClick={() => handleMarkupChange(markup)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  localMarkup === markup 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {markup}%
              </button>
            ))}
          </div>
        </div>

        {/* Round Up */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Round Up To
          </label>
          <Controller
            name={`subProductData.sizes.${index}.roundUp`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? 'none'}
                onChange={(e) => handleRoundUpChange(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {roundUpOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        {/* Base Price (Auto-calculated) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Selling Price <span className="text-xs text-gray-400">(Auto)</span>
          </label>
          <Controller
            name={`subProductData.sizes.${index}.basePrice`}
            control={control}
            defaultValue={null}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="Auto-calculated"
                value={field.value ?? ''}
                onChange={(e) => handleBasePriceChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Compare At Price (MSRP) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Compare at Price (MSRP)
          </label>
          <Controller
            name={`subProductData.sizes.${index}.compareAtPrice`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Discount Percentage */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Discount (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="0"
            value={localDiscount}
            onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
          />
          {/* Quick Discount Presets */}
          <div className="flex flex-wrap gap-1">
            {[5, 10, 15, 20, 25, 50].map((discount) => (
              <button
                key={discount}
                type="button"
                onClick={() => handleDiscountChange(discount)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  localDiscount === discount 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {discount}%
              </button>
            ))}
          </div>
        </div>

        {/* Sale Price (Read-only - Auto-calculated) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Sale Price <span className="text-xs text-gray-400">(Auto)</span>
          </label>
          <Controller
            name={`subProductData.sizes.${index}.salePrice`}
            control={control}
            defaultValue={null}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="Auto-calculated"
                value={field.value ?? ''}
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Wholesale Price */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Wholesale Price
          </label>
          <Controller
            name={`subProductData.sizes.${index}.wholesalePrice`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Stock */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Stock
          </label>
          <Controller
            name={`subProductData.sizes.${index}.stock`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="0"
                value={field.value ?? 0}
                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* SKU */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Size SKU
          </label>
          <Controller
            name={`subProductData.sizes.${index}.sku`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="SKU for this size"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Barcode
          </label>
          <Controller
            name={`subProductData.sizes.${index}.barcode`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="Barcode"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>
      </div>

      {/* Expandable Fields */}
      {expanded && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <Text className="mb-4 font-medium text-gray-700">Additional Details</Text>
          
          <div className="grid gap-4 md:grid-cols-3">
            {/* Size Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Size Category
              </label>
              <Controller
                name={`subProductData.sizes.${index}.sizeCategory`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    {sizeCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Units Per Pack */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Units Per Pack
              </label>
              <Controller
                name={`subProductData.sizes.${index}.unitsPerPack`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="1"
                    value={field.value ?? 1}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Low Stock Threshold */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Low Stock Threshold
              </label>
              <Controller
                name={`subProductData.sizes.${index}.lowStockThreshold`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="0"
                    placeholder="10"
                    value={field.value ?? 10}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Reorder Point */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Reorder Point
              </label>
              <Controller
                name={`subProductData.sizes.${index}.reorderPoint`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="0"
                    placeholder="5"
                    value={field.value ?? 5}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Reorder Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Reorder Quantity
              </label>
              <Controller
                name={`subProductData.sizes.${index}.reorderQuantity`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="50"
                    value={field.value ?? 50}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Rank */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Display Rank
              </label>
              <Controller
                name={`subProductData.sizes.${index}.rank`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder={String(index + 1)}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Packaging */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Packaging
              </label>
              <Controller
                name={`subProductData.sizes.${index}.packaging`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select packaging...</option>
                    {packagingOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Availability */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Availability
              </label>
              <Controller
                name={`subProductData.sizes.${index}.availability`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {availabilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Min Order Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Min Order Quantity
              </label>
              <Controller
                name={`subProductData.sizes.${index}.minOrderQuantity`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="1"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Max Order Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Max Order Quantity
              </label>
              <Controller
                name={`subProductData.sizes.${index}.maxOrderQuantity`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="No limit"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Requires Age Verification */}
            <div className="flex items-center pt-5">
              <Controller
                name={`subProductData.sizes.${index}.requiresAgeVerification`}
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        setValue(`subProductData.sizes.${index}.requiresAgeVerification`, e.target.checked);
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Requires Age Verification</span>
                  </label>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
