// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Textarea } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiGift, PiPercent, PiLightning, PiCalendar, PiCurrencyNgn, PiTag, 
  PiPackage, PiClock, PiWarningCircle, PiCheckCircle, PiXBold, PiPlus,
  PiArrowsDownUp, PiTimer, PiStar, PiHeart, PiFire, PiTrendDown, PiCurrencyCircleDollar,
  PiUsers, PiShoppingCart, PiMedal, PiTarget, PiCalendarPlus, PiFlask, 
  PiCopy, PiEraser, PiInfo, PiWarning, PiTrophy, PiChartBar, PiCurrencyDollar,
  PiCaretUp, PiCaretDown, PiEye, PiEyeClosed, PiThumbsUp
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants, itemVariants } from './animations';
import toast from 'react-hot-toast';

const CURRENCY_SYMBOL = '₦';

const DISCOUNT_PRESETS = [
  { value: 5, label: '5%', color: 'bg-green-100 text-green-700 border-green-200', description: 'Slight discount' },
  { value: 10, label: '10%', color: 'bg-green-100 text-green-700 border-green-200', description: 'Popular choice' },
  { value: 15, label: '15%', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', description: 'Good savings' },
  { value: 20, label: '20%', color: 'bg-teal-100 text-teal-700 border-teal-200', description: 'Strong offer' },
  { value: 25, label: '25%', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', description: 'Great deal' },
  { value: 50, label: '50%', color: 'bg-orange-100 text-orange-700 border-orange-200', description: 'Half price!' },
];

const BUNDLE_PRESETS = [
  { 
    label: 'Buy 2 Get 1 Free', 
    quantity: 3, 
    discount: 33, 
    discountType: 'percentage',
    description: 'Classic BOGO deal',
    icon: PiGift
  },
  { 
    label: 'Buy 3 Save 20%', 
    quantity: 3, 
    discount: 20, 
    discountType: 'percentage',
    description: 'Volume discount',
    icon: PiPackage
  },
  { 
    label: '6-Pack Special', 
    quantity: 6, 
    discount: 15, 
    discountType: 'percentage',
    description: 'Half case deal',
    icon: PiShoppingCart
  },
  { 
    label: 'Case Deal (12)', 
    quantity: 12, 
    discount: 25, 
    discountType: 'percentage',
    description: 'Full case savings',
    icon: PiMedal
  },
];

// Promotion type presets for beverages
const PROMOTION_TYPES = {
  seasonal: {
    label: 'Seasonal Promotions',
    icon: PiCalendarPlus,
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    options: [
      { name: 'Summer Sale', discount: 20, duration: 30 },
      { name: 'Holiday Special', discount: 25, duration: 14 },
      { name: 'New Year Clearance', discount: 30, duration: 7 },
      { name: 'Spring Fresh', discount: 15, duration: 21 },
    ]
  },
  loyalty: {
    label: 'Loyalty Rewards',
    icon: PiStar,
    color: 'from-purple-400 to-violet-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    options: [
      { name: 'VIP Members Only', discount: 10, duration: 365 },
      { name: 'Return Customer', discount: 8, duration: 60 },
      { name: 'Premium Club', discount: 15, duration: 180 },
      { name: 'Gold Tier Discount', discount: 12, duration: 90 },
    ]
  },
  clearance: {
    label: 'Clearance Sales',
    icon: PiTarget,
    color: 'from-red-400 to-rose-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    options: [
      { name: 'End of Line', discount: 40, duration: 7 },
      { name: 'Overstock Clear', discount: 35, duration: 14 },
      { name: 'Best Before Sale', discount: 50, duration: 3 },
      { name: 'Warehouse Clear', discount: 45, duration: 10 },
    ]
  },
};

// Advanced promotion features
const ADVANCED_FEATURES = [
  {
    id: 'minOrderValue',
    label: 'Minimum Order Value',
    description: 'Set minimum purchase amount for discount',
    icon: PiCurrencyDollar,
    type: 'number',
    suffix: CURRENCY_SYMBOL
  },
  {
    id: 'maxUsagePerCustomer',
    label: 'Usage Limit Per Customer',
    description: 'Limit how many times each customer can use this promotion',
    icon: PiUsers,
    type: 'number',
    suffix: 'uses'
  },
  {
    id: 'totalUsageLimit',
    label: 'Total Usage Limit',
    description: 'Maximum total uses across all customers',
    icon: PiTarget,
    type: 'number',
    suffix: 'total'
  },
  {
    id: 'stackable',
    label: 'Stackable with Other Offers',
    description: 'Allow combining with other promotions',
    icon: PiChartBar,
    type: 'boolean'
  }
];

const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2 }
};

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
  const loyaltyDiscount = watch?.('subProductData.loyaltyDiscount') || {};
  const seasonalPromos = watch?.('subProductData.seasonalPromos') || [];
  const advancedFeatures = watch?.('subProductData.advancedFeatures') || {};

  const [showFlashSale, setShowFlashSale] = useState(flashSale?.isActive || false);
  const [showBundleDeals, setShowBundleDeals] = useState(bundleDeals.length > 0);
  const [showLoyaltyProgram, setShowLoyaltyProgram] = useState(loyaltyDiscount?.enabled || false);
  const [showSeasonalPromos, setShowSeasonalPromos] = useState(seasonalPromos.length > 0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPromoType, setSelectedPromoType] = useState<string | null>(null);
  const [promotionHistory, setPromotionHistory] = useState([]);

  const isDiscountActive = useMemo(() => {
    const now = new Date();
    if (!discountStart && !discountEnd) return discount > 0;
    
    const start = discountStart ? new Date(discountStart) : null;
    const end = discountEnd ? new Date(discountEnd) : null;
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    
    return discount > 0;
  }, [discountStart, discountEnd, discount]);

  const flashSaleActive = () => {
    if (!flashSale?.isActive) return false;
    
    const now = new Date();
    const start = flashSale?.startDate ? new Date(flashSale.startDate) : null;
    const end = flashSale?.endDate ? new Date(flashSale.endDate) : null;
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    
    return true;
  };

  const calculateDiscount = () => {
    if (!baseSellingPrice || baseSellingPrice <= 0 || !discount) return 0;
    
    if (discountType === 'percentage') {
      return baseSellingPrice * (discount / 100);
    } else {
      return Math.min(discount, baseSellingPrice);
    }
  };

  const calculateFlashDiscount = () => {
    if (!flashSale?.discountPercentage || !baseSellingPrice) return 0;
    return baseSellingPrice * (flashSale.discountPercentage / 100);
  };

  const calculateTotalSavings = () => {
    let total = calculateDiscount();
    if (flashSaleActive()) total += calculateFlashDiscount();
    if (loyaltyDiscount?.enabled && loyaltyDiscount?.percentage) {
      total += baseSellingPrice * (loyaltyDiscount.percentage / 100);
    }
    return Math.min(total, baseSellingPrice * 0.9); // Max 90% discount
  };

  const discountedPrice = baseSellingPrice - calculateDiscount();
  const flashSalePrice = baseSellingPrice - calculateFlashDiscount();
  const totalSavings = calculateTotalSavings();
  const finalPrice = baseSellingPrice - totalSavings;

  const activePromotionsCount = [
    isDiscountActive,
    flashSaleActive(),
    bundleDeals.length > 0,
    loyaltyDiscount?.enabled,
    seasonalPromos?.filter(p => p?.active)?.length > 0
  ].filter(Boolean).length;

  const handleFlashSaleToggle = (checked: boolean) => {
    setShowFlashSale(checked);
    const currentFlashSale = watch('subProductData.flashSale') || {};
    setValue('subProductData.flashSale', {
      ...currentFlashSale,
      isActive: checked,
      ...(checked ? {} : { startDate: '', endDate: '', discountPercentage: 0, remainingQuantity: 0 })
    });
    toast.success(`Flash sale ${checked ? 'enabled' : 'disabled'}`);
  };

  const handleLoyaltyToggle = (checked: boolean) => {
    setShowLoyaltyProgram(checked);
    const currentLoyalty = watch('subProductData.loyaltyDiscount') || {};
    setValue('subProductData.loyaltyDiscount', {
      ...currentLoyalty,
      enabled: checked,
      ...(checked ? {} : { percentage: 0, tierRequirement: '' })
    });
    toast.success(`Loyalty program ${checked ? 'enabled' : 'disabled'}`);
  };

  const handleAddBundle = (preset?: typeof BUNDLE_PRESETS[0]) => {
    const newBundle = {
      id: Date.now(),
      name: preset?.label || '',
      description: preset?.description || '',
      quantity: preset?.quantity || 2,
      discount: preset?.discount || 10,
      discountType: preset?.discountType || 'percentage',
      active: true,
      createdAt: new Date().toISOString(),
    };
    setValue('subProductData.bundleDeals', [...bundleDeals, newBundle]);
    setShowBundleDeals(true);
    toast.success(`Added bundle deal: ${preset?.label || 'Custom bundle'}`);
  };

  const handleRemoveBundle = (index: number) => {
    const updated = [...bundleDeals];
    const removed = updated.splice(index, 1)[0];
    setValue('subProductData.bundleDeals', updated);
    toast.success(`Removed bundle: ${removed.name}`);
  };

  const handleDuplicateBundle = (index: number) => {
    const bundle = bundleDeals[index];
    const duplicated = {
      ...bundle,
      id: Date.now(),
      name: `${bundle.name} (Copy)`
    };
    setValue('subProductData.bundleDeals', [...bundleDeals, duplicated]);
    toast.success('Bundle duplicated successfully');
  };

  const handleClearDiscount = () => {
    setValue('subProductData.discount', 0);
    setValue('subProductData.discountStart', '');
    setValue('subProductData.discountEnd', '');
    toast.success('Discount cleared');
  };

  const handleClearAllPromotions = () => {
    setValue('subProductData.discount', 0);
    setValue('subProductData.discountStart', '');
    setValue('subProductData.discountEnd', '');
    setValue('subProductData.flashSale', {});
    setValue('subProductData.bundleDeals', []);
    setValue('subProductData.loyaltyDiscount', {});
    setValue('subProductData.seasonalPromos', []);
    setShowFlashSale(false);
    setShowBundleDeals(false);
    setShowLoyaltyProgram(false);
    setShowSeasonalPromos(false);
    toast.success('All promotions cleared');
  };

  const applyPromotionPreset = (type: string, option: any) => {
    setValue('subProductData.discount', option.discount);
    setValue('subProductData.discountType', 'percentage');
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + option.duration);
    
    setValue('subProductData.discountStart', startDate.toISOString().slice(0, 16));
    setValue('subProductData.discountEnd', endDate.toISOString().slice(0, 16));
    
    setSelectedPromoType(null);
    toast.success(`Applied ${option.name} promotion`);
  };

  const getPromotionEffectiveness = () => {
    const savingsPercentage = (totalSavings / baseSellingPrice) * 100;
    
    if (savingsPercentage >= 30) return { level: 'Excellent', color: 'text-green-600', icon: PiTrophy };
    if (savingsPercentage >= 20) return { level: 'Very Good', color: 'text-blue-600', icon: PiStar };
    if (savingsPercentage >= 10) return { level: 'Good', color: 'text-amber-600', icon: PiThumbsUp };
    return { level: 'Moderate', color: 'text-gray-600', icon: PiInfo };
  };

  const effectiveness = getPromotionEffectiveness();

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header with Controls */}
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="relative overflow-hidden rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-teal-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg">
                <PiFire className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Promotions & Discounts</Text>
                <Text className="text-xs text-gray-500">
                  Boost sales with compelling offers and bundles
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {activePromotionsCount > 0 && (
                <Badge variant="flat" color="success" className="font-medium">
                  {activePromotionsCount} Active
                </Badge>
              )}
              {totalSavings > 0 && (
                <Badge variant="flat" color="warning" className="font-medium">
                  <effectiveness.icon className="mr-1 h-3 w-3" />
                  {effectiveness.level}
                </Badge>
              )}
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={handleClearAllPromotions}
                className="text-red-600 hover:bg-red-50"
              >
                <PiEraser className="mr-1 h-4 w-4" />
                Clear All
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Price Summary */}
      {baseSellingPrice > 0 && (
        <motion.div 
          variants={fieldStaggerVariants}
          className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6"
        >
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-[-50%] rounded-full bg-blue-100/50" />
          
          <div className="relative">
            {/* Main Price Display */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
                >
                  <PiCurrencyCircleDollar className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <Text className="text-sm font-medium text-blue-600">Original Price</Text>
                  <Text className="text-3xl font-bold text-blue-900">
                    {CURRENCY_SYMBOL}{baseSellingPrice.toLocaleString()}
                  </Text>
                </div>
              </div>
              
              <div className="text-right">
                <Text className="text-sm font-medium text-green-600">Final Price</Text>
                <Text className="text-3xl font-bold text-green-700">
                  {CURRENCY_SYMBOL}{finalPrice.toLocaleString()}
                </Text>
                {totalSavings > 0 && (
                  <Text className="text-sm text-green-600">
                    Save {CURRENCY_SYMBOL}{totalSavings.toLocaleString()} ({((totalSavings/baseSellingPrice)*100).toFixed(1)}%)
                  </Text>
                )}
              </div>
            </div>

            {/* Savings Breakdown */}
            {totalSavings > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {isDiscountActive && discount > 0 && (
                  <div className="rounded-lg bg-white/80 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PiGift className="h-4 w-4 text-emerald-600" />
                      <Text className="text-xs font-medium text-emerald-800">Regular Discount</Text>
                    </div>
                    <Text className="font-bold text-emerald-700">
                      -{CURRENCY_SYMBOL}{calculateDiscount().toLocaleString()}
                    </Text>
                  </div>
                )}
                
                {flashSaleActive() && flashSale?.discountPercentage && (
                  <div className="rounded-lg bg-white/80 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PiLightning className="h-4 w-4 text-amber-600" />
                      <Text className="text-xs font-medium text-amber-800">Flash Sale</Text>
                    </div>
                    <Text className="font-bold text-amber-700">
                      -{CURRENCY_SYMBOL}{calculateFlashDiscount().toLocaleString()}
                    </Text>
                  </div>
                )}

                {loyaltyDiscount?.enabled && loyaltyDiscount?.percentage && (
                  <div className="rounded-lg bg-white/80 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PiStar className="h-4 w-4 text-purple-600" />
                      <Text className="text-xs font-medium text-purple-800">Loyalty Bonus</Text>
                    </div>
                    <Text className="font-bold text-purple-700">
                      -{CURRENCY_SYMBOL}{(baseSellingPrice * (loyaltyDiscount.percentage / 100)).toLocaleString()}
                    </Text>
                  </div>
                )}

                {bundleDeals.length > 0 && (
                  <div className="rounded-lg bg-white/80 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PiPackage className="h-4 w-4 text-indigo-600" />
                      <Text className="text-xs font-medium text-indigo-800">Bundle Deals</Text>
                    </div>
                    <Text className="font-bold text-indigo-700">
                      {bundleDeals.length} active
                    </Text>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Promotion Type Presets */}
      <motion.div variants={fieldStaggerVariants}>
        <div className="mb-4 flex items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">Quick Setup by Type</Text>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setSelectedPromoType(selectedPromoType ? null : 'seasonal')}
            className="gap-1"
          >
            {selectedPromoType ? <PiEyeClosed className="h-4 w-4" /> : <PiEye className="h-4 w-4" />}
            {selectedPromoType ? 'Hide' : 'Show'} Presets
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(PROMOTION_TYPES).map(([key, type]) => {
            const Icon = type.icon;
            const isActive = selectedPromoType === key;
            
            return (
              <motion.button
                key={key}
                type="button"
                onClick={() => setSelectedPromoType(isActive ? null : key)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${
                  isActive
                    ? `${type.borderColor} ${type.bgColor} shadow-md`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${type.color} text-white shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <Text className="text-sm font-medium text-gray-700">{type.label}</Text>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Expanded Preset Options */}
        <AnimatePresence>
          {selectedPromoType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className={`rounded-xl border p-4 ${PROMOTION_TYPES[selectedPromoType].borderColor} ${PROMOTION_TYPES[selectedPromoType].bgColor}`}>
                <Text className="mb-3 font-medium text-gray-800">
                  {PROMOTION_TYPES[selectedPromoType].label} Options
                </Text>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROMOTION_TYPES[selectedPromoType].options.map((option, idx) => (
                    <motion.button
                      key={idx}
                      type="button"
                      onClick={() => applyPromotionPreset(selectedPromoType, option)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-lg border border-white/50 bg-white/80 p-3 text-left transition-all hover:bg-white"
                    >
                      <Text className="font-medium text-gray-800">{option.name}</Text>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge size="sm" variant="flat" color="success">
                          {option.discount}% off
                        </Badge>
                        <Text className="text-xs text-gray-600">
                          {option.duration} days
                        </Text>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Enhanced Discount Presets */}
      <motion.div variants={fieldStaggerVariants}>
        <div className="mb-3 flex items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">Quick Discount Presets</Text>
          {discount > 0 && (
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={handleClearDiscount}
              className="text-red-600 hover:bg-red-50"
            >
              Clear Discount
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DISCOUNT_PRESETS.map((preset, index) => (
            <motion.button
              key={preset.value}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover="hover"
              whileTap={{ scale: 0.95 }}
              variants={cardHoverVariants}
              onClick={() => {
                const newValue = discount === preset.value ? 0 : preset.value;
                setValue('subProductData.discount', newValue);
                setValue('subProductData.discountType', 'percentage');
                toast.success(`${newValue > 0 ? 'Applied' : 'Removed'} ${preset.label} discount`);
              }}
              className={`rounded-lg border p-3 text-center font-medium transition-all ${
                discount === preset.value
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : preset.color + ' border hover:shadow-md'
              }`}
            >
              <PiTrendDown className={`mx-auto mb-1 h-5 w-5 ${discount === preset.value ? 'text-blue-600' : ''}`} />
              <div className="text-sm font-bold">{preset.label}</div>
              <div className="text-xs opacity-75">{preset.description}</div>
              {baseSellingPrice > 0 && (
                <div className="text-xs font-medium mt-1">
                  Save {CURRENCY_SYMBOL}{(baseSellingPrice * (preset.value / 100)).toLocaleString()}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Regular Discount - Enhanced */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 to-blue-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiGift className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Regular Discount</Text>
            {discount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Badge color={isDiscountActive ? 'success' : 'warning'}>
                  {isDiscountActive ? 'Active' : 'Scheduled'}
                </Badge>
              </motion.div>
            )}
          </div>
          {discount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {discountType === 'percentage' ? `${discount}%` : `${CURRENCY_SYMBOL}${discount}`} off
              </span>
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={() => {
                  const currentDiscount = { discount, discountType, discountStart, discountEnd };
                  navigator.clipboard.writeText(JSON.stringify(currentDiscount));
                  toast.success('Discount copied to clipboard');
                }}
              >
                <PiCopy className="h-4 w-4" />
              </Button>
            </div>
          )}
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
              {discount > 0 && baseSellingPrice > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  Customer saves {CURRENCY_SYMBOL}{calculateDiscount().toLocaleString()}
                </div>
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

        {/* Enhanced Savings Preview */}
        <AnimatePresence>
          {discount > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiArrowsDownUp className="h-5 w-5 text-green-600" />
                  <div>
                    <Text className="font-medium text-green-800">Customer Savings</Text>
                    <Text className="text-xs text-green-600">
                      {((calculateDiscount() / baseSellingPrice) * 100).toFixed(1)}% off original price
                    </Text>
                  </div>
                </div>
                <div className="text-right">
                  <Text className="font-bold text-green-700 text-xl">
                    {CURRENCY_SYMBOL}{calculateDiscount().toLocaleString()}
                  </Text>
                  <Badge color="success" variant="flat" size="sm">
                    {discount}{discountType === 'percentage' ? '%' : ''} discount
                  </Badge>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Enhanced Flash Sale */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={6}
        className="relative overflow-hidden rounded-lg border border-amber-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={flashSaleActive() ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <PiLightning className="h-5 w-5 text-amber-500" />
            </motion.div>
            <Text className="font-medium">Flash Sale</Text>
            {flashSaleActive() && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Badge color="warning">
                  <PiTimer className="mr-1 h-3 w-3 animate-pulse" />
                  Live Now
                </Badge>
              </motion.div>
            )}
          </div>
          <Switch
            checked={showFlashSale}
            onChange={(e) => handleFlashSaleToggle(e.target.checked)}
          />
        </div>

        <AnimatePresence>
          {showFlashSale && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              <div className="grid gap-6 md:grid-cols-2">
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
                  {flashSale?.discountPercentage > 0 && baseSellingPrice > 0 && (
                    <Text className="mt-1 text-xs text-gray-500">
                      Flash price: {CURRENCY_SYMBOL}{(baseSellingPrice * (1 - flashSale.discountPercentage / 100)).toLocaleString()}
                    </Text>
                  )}
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
                    Create urgency with limited stock
                  </Text>
                </motion.div>
              </div>

              {/* Flash Sale Preview */}
              {flashSale?.discountPercentage > 0 && (
                <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiLightning className="h-5 w-5 text-amber-600" />
                      <div>
                        <Text className="font-medium text-amber-800">Flash Sale Preview</Text>
                        <Text className="text-xs text-amber-600">
                          {flashSale.discountPercentage}% off for limited time
                        </Text>
                      </div>
                    </div>
                    <div className="text-right">
                      <Text className="font-bold text-amber-700 text-xl">
                        {CURRENCY_SYMBOL}{flashSalePrice.toLocaleString()}
                      </Text>
                      <Text className="text-xs text-amber-600 line-through">
                        {CURRENCY_SYMBOL}{baseSellingPrice.toLocaleString()}
                      </Text>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Enhanced Bundle Deals */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={7}
        className="relative overflow-hidden rounded-lg border border-purple-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-purple-400 to-violet-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiPackage className="h-5 w-5 text-purple-500" />
            <Text className="font-medium">Bundle Deals</Text>
            {bundleDeals.length > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Badge color="info">{bundleDeals.length} deal(s)</Badge>
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBundleDeals(!showBundleDeals)}
            >
              {showBundleDeals ? <PiCaretUp className="h-4 w-4" /> : <PiCaretDown className="h-4 w-4" />}
              {showBundleDeals ? 'Hide' : 'Show'} ({bundleDeals.length})
            </Button>
          </div>
        </div>

        {/* Enhanced Bundle Presets */}
        {!showBundleDeals && bundleDeals.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {BUNDLE_PRESETS.map((preset, index) => {
              const Icon = preset.icon;
              return (
                <motion.button
                  key={preset.label}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAddBundle(preset)}
                  className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-left transition-all hover:bg-purple-100 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500 text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <Text className="font-medium text-purple-900">{preset.label}</Text>
                  </div>
                  <Text className="text-xs text-purple-700">{preset.description}</Text>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge size="sm" variant="flat" color="info">
                      {preset.discount}% off
                    </Badge>
                    <Text className="text-xs text-purple-600">
                      Buy {preset.quantity}
                    </Text>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {showBundleDeals && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              {/* Bundle Presets Row */}
              <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
                <Text className="w-full text-xs font-medium text-gray-500 mb-1">Quick Add:</Text>
                {BUNDLE_PRESETS.map((preset, index) => (
                  <motion.button
                    key={preset.label}
                    type="button"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAddBundle(preset)}
                    className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-all hover:bg-purple-100"
                  >
                    + {preset.label}
                  </motion.button>
                ))}
              </div>

              {/* Enhanced Bundle Deals List */}
              {bundleDeals.map((bundle: any, index: number) => (
                <motion.div
                  key={bundle.id || index}
                  variants={itemVariants}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="group relative rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all hover:border-purple-300 hover:shadow-md"
                >
                  <div className="space-y-4">
                    {/* Bundle Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                          <PiPackage className="h-4 w-4 text-purple-600" />
                        </div>
                        <Text className="font-medium text-gray-900">Bundle #{index + 1}</Text>
                        <Switch
                          size="sm"
                          checked={bundle.active !== false}
                          onChange={(e) => {
                            const updated = [...bundleDeals];
                            updated[index].active = e.target.checked;
                            setValue('subProductData.bundleDeals', updated);
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          onClick={() => handleDuplicateBundle(index)}
                          className="text-purple-600 hover:bg-purple-50"
                        >
                          <PiCopy className="h-4 w-4" />
                        </Button>
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
                    </div>

                    {/* Bundle Configuration */}
                    <div className="grid gap-4 md:grid-cols-12">
                      <div className="md:col-span-5">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Bundle Name</label>
                        <Input
                          placeholder="e.g., Buy 2 Get 1 Free"
                          value={bundle.name}
                          onChange={(e) => {
                            const updated = [...bundleDeals];
                            updated[index].name = e.target.value;
                            setValue('subProductData.bundleDeals', updated);
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Quantity</label>
                        <Input
                          type="number"
                          min="2"
                          placeholder="3"
                          value={bundle.quantity}
                          onChange={(e) => {
                            const updated = [...bundleDeals];
                            updated[index].quantity = parseInt(e.target.value) || 2;
                            setValue('subProductData.bundleDeals', updated);
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Discount</label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="15"
                          value={bundle.discount}
                          onChange={(e) => {
                            const updated = [...bundleDeals];
                            updated[index].discount = parseFloat(e.target.value) || 0;
                            setValue('subProductData.bundleDeals', updated);
                          }}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Type</label>
                        <Controller
                          name={`subProductData.bundleDeals.${index}.discountType`}
                          control={control}
                          render={({ field }) => (
                            <select
                              {...field}
                              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                            >
                              <option value="percentage">%</option>
                              <option value="fixed">₦</option>
                            </select>
                          )}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Savings</label>
                        <div className="flex items-center h-10 px-3 rounded-lg bg-purple-50 border border-purple-200">
                          <Text className="text-sm font-medium text-purple-700">
                            {bundle.discountType === 'percentage' 
                              ? `${bundle.discount}% off`
                              : `${CURRENCY_SYMBOL}${bundle.discount} off`
                            }
                          </Text>
                        </div>
                      </div>
                    </div>

                    {/* Bundle Description */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Description (Optional)</label>
                      <Textarea
                        placeholder="e.g., Perfect for sharing with friends!"
                        value={bundle.description || ''}
                        onChange={(e) => {
                          const updated = [...bundleDeals];
                          updated[index].description = e.target.value;
                          setValue('subProductData.bundleDeals', updated);
                        }}
                        rows={2}
                      />
                    </div>

                    {/* Bundle Preview */}
                    {baseSellingPrice > 0 && bundle.discount > 0 && (
                      <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
                        <Text className="text-xs font-medium text-purple-700 mb-1">Bundle Preview:</Text>
                        <div className="flex items-center justify-between">
                          <Text className="text-sm text-purple-800">
                            Buy {bundle.quantity} items
                          </Text>
                          <div className="text-right">
                            <Text className="text-sm line-through text-purple-600">
                              {CURRENCY_SYMBOL}{(baseSellingPrice * bundle.quantity).toLocaleString()}
                            </Text>
                            <Text className="font-bold text-purple-800">
                              {CURRENCY_SYMBOL}{
                                bundle.discountType === 'percentage'
                                  ? ((baseSellingPrice * bundle.quantity) * (1 - bundle.discount / 100)).toLocaleString()
                                  : ((baseSellingPrice * bundle.quantity) - bundle.discount).toLocaleString()
                              }
                            </Text>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Add Bundle Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddBundle()}
                className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                <PiPlus className="mr-2 h-4 w-4" />
                Add Custom Bundle Deal
              </Button>

              {bundleDeals.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-gray-500"
                >
                  <PiPackage className="mx-auto h-12 w-12 mb-3 text-gray-300" />
                  <Text className="font-medium mb-1">No bundle deals yet</Text>
                  <Text className="text-sm">Click a preset above or add a custom deal</Text>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Loyalty Program */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={8}
        className="relative overflow-hidden rounded-lg border border-yellow-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-yellow-400 to-amber-500" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiStar className="h-5 w-5 text-yellow-500" />
            <Text className="font-medium">Loyalty Program</Text>
            {loyaltyDiscount?.enabled && (
              <Badge color="warning">
                {loyaltyDiscount.percentage}% for {loyaltyDiscount.tierRequirement || 'members'}
              </Badge>
            )}
          </div>
          <Switch
            checked={showLoyaltyProgram}
            onChange={(e) => handleLoyaltyToggle(e.target.checked)}
          />
        </div>

        <AnimatePresence>
          {showLoyaltyProgram && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid gap-4 md:grid-cols-2"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Loyalty Discount (%)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    placeholder="5"
                    {...register('subProductData.loyaltyDiscount.percentage', { valueAsNumber: true })}
                    className="w-full pl-10"
                  />
                  <PiPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Required Tier
                </label>
                <Controller
                  name="subProductData.loyaltyDiscount.tierRequirement"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">All Members</option>
                      <option value="bronze">Bronze Tier</option>
                      <option value="silver">Silver Tier</option>
                      <option value="gold">Gold Tier</option>
                      <option value="platinum">Platinum Tier</option>
                    </select>
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Advanced Features */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={9}
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-slate-400 to-gray-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiFlask className="h-5 w-5 text-slate-500" />
            <Text className="font-medium">Advanced Settings</Text>
            <Badge variant="flat" color="secondary" size="sm">
              Optional
            </Badge>
          </div>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <PiCaretUp className="h-4 w-4" /> : <PiCaretDown className="h-4 w-4" />}
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              variants={toggleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              {ADVANCED_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.id}
                    variants={fieldStaggerVariants}
                    custom={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                        <Icon className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="flex-grow">
                        <Text className="font-medium text-gray-800 mb-1">{feature.label}</Text>
                        <Text className="text-xs text-gray-600 mb-3">{feature.description}</Text>
                        
                        {feature.type === 'boolean' ? (
                          <Switch
                            size="sm"
                            {...register(`subProductData.advancedFeatures.${feature.id}`)}
                          />
                        ) : (
                          <div className="relative">
                            <Input
                              type={feature.type}
                              placeholder="0"
                              {...register(`subProductData.advancedFeatures.${feature.id}`, { 
                                valueAsNumber: feature.type === 'number' 
                              })}
                              className="w-full"
                            />
                            {feature.suffix && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                {feature.suffix}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Enhanced Active Promotions Summary */}
      {activePromotionsCount > 0 && (
        <motion.div 
          variants={fieldStaggerVariants}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <PiChartBar className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-white">Active Promotions Summary</Text>
                <Text className="text-xs text-gray-300">
                  Total customer savings: {CURRENCY_SYMBOL}{totalSavings.toLocaleString()}
                </Text>
              </div>
            </div>
            <Badge variant="flat" className="bg-white/20 text-white">
              {effectiveness.level} Impact
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isDiscountActive && discount > 0 && (
              <div className="rounded-lg bg-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiGift className="h-5 w-5 text-green-400" />
                  <Text className="font-medium">Regular Discount</Text>
                </div>
                <Text className="text-xl font-bold mb-1">{discount}{discountType === 'percentage' ? '%' : '₦'} off</Text>
                <Text className="text-xs text-gray-400">
                  Saves {CURRENCY_SYMBOL}{calculateDiscount().toLocaleString()}
                </Text>
              </div>
            )}

            {flashSaleActive() && flashSale?.discountPercentage && (
              <div className="rounded-lg bg-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiLightning className="h-5 w-5 text-amber-400" />
                  <Text className="font-medium">Flash Sale</Text>
                </div>
                <Text className="text-xl font-bold mb-1">{flashSale.discountPercentage}% off</Text>
                <Text className="text-xs text-gray-400">
                  Price: {CURRENCY_SYMBOL}{flashSalePrice.toLocaleString()}
                </Text>
              </div>
            )}

            {bundleDeals.length > 0 && (
              <div className="rounded-lg bg-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiPackage className="h-5 w-5 text-purple-400" />
                  <Text className="font-medium">Bundle Deals</Text>
                </div>
                <Text className="text-xl font-bold mb-1">{bundleDeals.length} active</Text>
                <Text className="text-xs text-gray-400">
                  Various quantity discounts
                </Text>
              </div>
            )}

            {loyaltyDiscount?.enabled && loyaltyDiscount?.percentage && (
              <div className="rounded-lg bg-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiStar className="h-5 w-5 text-yellow-400" />
                  <Text className="font-medium">Loyalty Program</Text>
                </div>
                <Text className="text-xl font-bold mb-1">{loyaltyDiscount.percentage}% off</Text>
                <Text className="text-xs text-gray-400">
                  For {loyaltyDiscount.tierRequirement || 'all'} members
                </Text>
              </div>
            )}
          </div>

          {/* Promotion Effectiveness Meter */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-300">Promotion Effectiveness</Text>
              <Text className={`text-sm font-semibold ${effectiveness.color.replace('text-', 'text-')}`}>
                {effectiveness.level}
              </Text>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((totalSavings / baseSellingPrice) * 100, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
              />
            </div>
            <Text className="text-xs text-gray-400 mt-1">
              {((totalSavings / baseSellingPrice) * 100).toFixed(1)}% total savings on original price
            </Text>
          </div>
        </motion.div>
      )}

      {/* Tips and Best Practices */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg bg-blue-50 border border-blue-200 p-4"
      >
        <div className="flex items-start gap-2">
          <PiInfo className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <Text className="font-medium text-blue-800 mb-1">Promotion Tips</Text>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Use flash sales to create urgency and boost immediate sales</li>
              <li>• Bundle deals work great for moving inventory and increasing order value</li>
              <li>• Loyalty discounts help retain customers and encourage repeat purchases</li>
              <li>• Test different discount percentages to find the sweet spot for your product</li>
              <li>• Set clear start and end dates to create time-bound offers</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}