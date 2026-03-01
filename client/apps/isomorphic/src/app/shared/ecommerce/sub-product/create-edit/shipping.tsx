// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Select } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiTruck, PiWarning, PiHourglass, PiFactory, PiMapPin, PiPackage, 
  PiCurrencyNgn, PiClock, PiStar, PiCheckCircle, PiPercent, PiGift,
  PiArrowsDownUp, PiWarehouse, PiStorefront, PiRuler, PiScales,
  PiAirplane, PiShieldWarning, PiTimer, PiCube, PiCopy, PiEraser,
  PiInfo, PiWarningCircle, PiSnowflake, PiSun, PiThermometer,
  PiCurrencyCircleDollar, PiUsers, PiShieldCheck, PiEye, PiEyeClosed,
  PiCaretUp, PiCaretDown, PiDotsThree, PiAnchor, PiMapTrifold
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';
import toast from 'react-hot-toast';

const SHIPPING_CARRIERS = [
  { value: 'dhl', label: 'DHL Express', icon: PiAirplane, color: 'text-red-600', bgColor: 'bg-red-50', description: 'International Express' },
  { value: 'fedex', label: 'FedEx', icon: PiAirplane, color: 'text-purple-600', bgColor: 'bg-purple-50', description: 'Global Shipping' },
  { value: 'ups', label: 'UPS', icon: PiTruck, color: 'text-amber-600', bgColor: 'bg-amber-50', description: 'Ground & Air' },
  { value: 'usps', label: 'USPS', icon: PiTruck, color: 'text-blue-600', bgColor: 'bg-blue-50', description: 'Postal Service' },
  { value: 'local_courier', label: 'Local Courier', icon: PiTruck, color: 'text-green-600', bgColor: 'bg-green-50', description: 'Same City' },
  { value: 'inhouse', label: 'In-House Delivery', icon: PiPackage, color: 'text-indigo-600', bgColor: 'bg-indigo-50', description: 'Own Fleet' },
  { value: 'pickup', label: 'Customer Pickup', icon: PiStorefront, color: 'text-gray-600', bgColor: 'bg-gray-50', description: 'Store Collection' },
  { value: 'third_party', label: 'Third Party', icon: PiDotsThree, color: 'text-slate-600', bgColor: 'bg-slate-50', description: 'External Service' },
];

const DELIVERY_AREAS = [
  { value: 'local', label: 'Local Delivery', range: '0-50km', color: 'bg-green-100 text-green-700', price: 1500, icon: PiMapPin },
  { value: 'regional', label: 'Regional', range: '50-200km', color: 'bg-blue-100 text-blue-700', price: 2500, icon: PiMapTrifold },
  { value: 'national', label: 'National', range: '200km+', color: 'bg-purple-100 text-purple-700', price: 4000, icon: PiTruck },
  { value: 'international', label: 'International', range: 'Cross-border', color: 'bg-orange-100 text-orange-700', price: 8000, icon: PiAirplane },
];

const SHIPPING_PRESETS = [
  { label: 'Wine Bottle (750ml)', weight: 1200, length: 8, width: 8, height: 30, type: 'glass' },
  { label: 'Spirit Bottle (700ml)', weight: 1000, length: 7, width: 7, height: 28, type: 'glass' },
  { label: 'Beer Bottle (330ml)', weight: 400, length: 6, width: 6, height: 20, type: 'glass' },
  { label: 'Beer Can (330ml)', weight: 350, length: 6, width: 6, height: 12, type: 'can' },
  { label: 'Champagne Bottle', weight: 1500, length: 9, width: 9, height: 32, type: 'glass' },
  { label: '6-Pack Box', weight: 3000, length: 25, width: 20, height: 25, type: 'box' },
  { label: '12-Pack Case', weight: 6000, length: 40, width: 25, height: 30, type: 'box' },
  { label: 'Mini Bottle (50ml)', weight: 100, length: 4, width: 4, height: 10, type: 'glass' },
];

const DELIVERY_TIME_PRESETS = [
  { label: 'Same Day', min: 0, max: 1, icon: PiTimer, color: 'from-red-400 to-orange-500' },
  { label: '1-2 Days', min: 1, max: 2, icon: PiClock, color: 'from-amber-400 to-yellow-500' },
  { label: '3-5 Days', min: 3, max: 5, icon: PiClock, color: 'from-green-400 to-emerald-500' },
  { label: '1 Week', min: 5, max: 7, icon: PiClock, color: 'from-blue-400 to-cyan-500' },
  { label: '2 Weeks', min: 10, max: 14, icon: PiClock, color: 'from-indigo-400 to-purple-500' },
];

const WAREHOUSE_LOCATIONS = [
  { value: 'main', label: 'Main Warehouse', icon: PiWarehouse, color: 'bg-blue-500' },
  { value: 'secondary', label: 'Secondary Warehouse', icon: PiWarehouse, color: 'bg-green-500' },
  { value: 'distribution', label: 'Distribution Center', icon: PiTruck, color: 'bg-purple-500' },
  { value: 'cold_storage', label: 'Cold Storage', icon: PiSnowflake, color: 'bg-cyan-500' },
  { value: 'fulfillment', label: 'Fulfillment Center', icon: PiPackage, color: 'bg-amber-500' },
];

const STORAGE_CONDITIONS = [
  { value: 'ambient', label: 'Ambient', icon: PiSun, temp: '15-25°C', description: 'Room temperature storage' },
  { value: 'refrigerated', label: 'Refrigerated', icon: PiSnowflake, temp: '2-8°C', description: 'Keep chilled' },
  { value: 'frozen', label: 'Frozen', icon: PiThermometer, temp: '-18°C or below', description: 'Deep freeze' },
  { value: 'climate_controlled', label: 'Climate Controlled', icon: PiThermometer, temp: '12-18°C', description: 'Temperature monitored' },
];

export default function SubProductShipping() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const shipping = watch?.('subProductData.shipping') || {};
  const warehouse = watch?.('subProductData.warehouse') || {};
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') ?? 0;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [selectedCarrierTab, setSelectedCarrierTab] = useState<string | null>(null);

  const [toggleStates, setToggleStates] = useState({
    isFreeShipping: false,
    fragile: false,
    requiresAgeVerification: false,
    hazmat: false,
    availableForPickup: false,
    internationalShipping: false,
    trackingEnabled: false,
    signatureRequired: false,
    insurance: false,
  });

  const handleToggle = (key: keyof typeof toggleStates) => (checked: boolean) => {
    setToggleStates(prev => ({ ...prev, [key]: checked }));
    const fieldMap: Record<string, string> = {
      isFreeShipping: 'subProductData.shipping.isFreeShipping',
      fragile: 'subProductData.shipping.fragile',
      requiresAgeVerification: 'subProductData.shipping.requiresAgeVerification',
      hazmat: 'subProductData.shipping.hazmat',
      availableForPickup: 'subProductData.shipping.availableForPickup',
      internationalShipping: 'subProductData.shipping.internationalShipping',
      trackingEnabled: 'subProductData.shipping.trackingEnabled',
      signatureRequired: 'subProductData.shipping.signatureRequired',
      insurance: 'subProductData.shipping.insurance',
    };
    setValue(fieldMap[key], checked);
    toast.success(`${key.replace(/([A-Z])/g, ' $1').trim()} ${checked ? 'enabled' : 'disabled'}`);
  };

  const weight = shipping?.weight ?? 0;
  const length = shipping?.length ?? 0;
  const width = shipping?.width ?? 0;
  const height = shipping?.height ?? 0;
  
  const dimensionalWeight = useMemo(() => {
    return length > 0 && width > 0 && height > 0 
      ? Math.ceil((length * width * height) / 5000) 
      : 0;
  }, [length, width, height]);
  
  const chargeableWeight = Math.max(weight, dimensionalWeight);

  const estimatedCost = useMemo(() => {
    if (chargeableWeight === 0) return 0;
    if (chargeableWeight <= 500) return 1500;
    if (chargeableWeight <= 1000) return 2500;
    if (chargeableWeight <= 2000) return 3500;
    if (chargeableWeight <= 5000) return 5000;
    return 8000;
  }, [chargeableWeight]);

  const selectedCarrier = SHIPPING_CARRIERS.find(c => c.value === shipping?.carrier);
  const selectedArea = DELIVERY_AREAS.find(a => a.value === shipping?.deliveryArea);

  const hasSpecialHandling = toggleStates.fragile || toggleStates.hazmat || toggleStates.requiresAgeVerification;
  const hasDimensions = weight > 0 || (length > 0 && width > 0 && height > 0);
  const activeOptionsCount = Object.values(toggleStates).filter(Boolean).length;

  const handlePresetClick = (preset: typeof SHIPPING_PRESETS[0]) => {
    setValue('subProductData.shipping.weight', preset.weight);
    setValue('subProductData.shipping.length', preset.length);
    setValue('subProductData.shipping.width', preset.width);
    setValue('subProductData.shipping.height', preset.height);
    setValue('subProductData.shipping.packageType', preset.type);
    toast.success(`Applied ${preset.label} preset`);
  };

  const handleDeliveryTimePreset = (preset: typeof DELIVERY_TIME_PRESETS[0]) => {
    const currentShipping = watch('subProductData.shipping') || {};
    setValue('subProductData.shipping', {
      ...currentShipping,
      minDeliveryDays: preset.min,
      maxDeliveryDays: preset.max,
    });
    toast.success(`Set delivery time: ${preset.label}`);
  };

  const handleCarrierSelect = (carrierValue: string) => {
    const isSelected = shipping?.carrier === carrierValue;
    setValue('subProductData.shipping.carrier', isSelected ? '' : carrierValue);
    if (!isSelected) {
      const carrier = SHIPPING_CARRIERS.find(c => c.value === carrierValue);
      toast.success(`Selected ${carrier?.label}`);
    } else {
      toast.success('Carrier cleared');
    }
  };

  const handleClearAll = () => {
    setToggleStates({
      isFreeShipping: false,
      fragile: false,
      requiresAgeVerification: false,
      hazmat: false,
      availableForPickup: false,
      internationalShipping: false,
      trackingEnabled: false,
      signatureRequired: false,
      insurance: false,
    });
    setValue('subProductData.shipping', {});
    setValue('subProductData.warehouse', {});
    toast.success('All shipping settings cleared');
  };

  const getShippingClass = () => {
    if (chargeableWeight <= 500) return { label: 'Letter/Small', color: 'text-green-600', bg: 'bg-green-50' };
    if (chargeableWeight <= 2000) return { label: 'Parcel', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (chargeableWeight <= 5000) return { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Heavy/Freight', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const shippingClass = getShippingClass();

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Enhanced Header */}
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="relative overflow-hidden rounded-xl border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-blue-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 text-white shadow-lg">
                <PiTruck className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Shipping & Logistics</Text>
                <Text className="text-xs text-gray-500">
                  Configure shipping details, carriers, and delivery options
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasDimensions && (
                <Badge variant="flat" color="success" className="font-medium">
                  <PiCheckCircle className="mr-1 h-3 w-3" />
                  Dimensions Set
                </Badge>
              )}
              {activeOptionsCount > 0 && (
                <Badge variant="flat" color="primary" className="font-medium">
                  {activeOptionsCount} Options
                </Badge>
              )}
              <Button
                type="text"
                size="sm"
                variant="text"
                onClick={handleClearAll}
                className="text-red-600 hover:bg-red-50"
              >
                <PiEraser className="mr-1 h-4 w-4" />
                Clear All
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Package Presets - Enhanced */}
      <motion.div variants={fieldStaggerVariants}>
        <div className="mb-3 flex items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">Quick Package Presets</Text>
          <Badge variant="flat" color="secondary" size="sm">
            Beverages
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {SHIPPING_PRESETS.map((preset, index) => (
            <motion.button
              key={preset.label}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePresetClick(preset)}
              className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-center text-xs font-medium text-cyan-700 transition-all hover:bg-cyan-100 hover:shadow-md"
            >
              <PiCube className="mx-auto mb-1 h-5 w-5" />
              <div className="truncate">{preset.label}</div>
              <div className="text-[10px] text-cyan-600">{preset.weight}g</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Enhanced Package Summary */}
      <AnimatePresence>
        {hasDimensions && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            variants={fieldStaggerVariants}
            className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6"
          >
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-[-50%] rounded-full bg-blue-100/50" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div 
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg"
                  >
                    <PiScales className="h-7 w-7 text-white" />
                  </motion.div>
                  <div>
                    <Text className="text-sm font-medium text-blue-600">Package Summary</Text>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${shippingClass.bg} ${shippingClass.color}`}>
                        {shippingClass.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  {estimatedCost > 0 && !shipping?.isFreeShipping && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Text className="text-xs text-blue-600">Estimated Cost</Text>
                      <Text className="text-2xl font-bold text-blue-700">
                        ₦{estimatedCost.toLocaleString()}
                      </Text>
                    </motion.div>
                  )}
                  {shipping?.isFreeShipping && (
                    <Badge variant="flat" color="success" className="text-lg px-3 py-1">
                      Free Shipping
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <Text className="text-xs text-gray-600">Actual Weight</Text>
                  <Text className="text-lg font-bold text-gray-900">{weight}g</Text>
                  <Text className="text-[10px] text-gray-500">{(weight/1000).toFixed(2)} kg</Text>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <Text className="text-xs text-gray-600">Volumetric</Text>
                  <Text className="text-lg font-bold text-gray-900">{dimensionalWeight}g</Text>
                  <Text className="text-[10px] text-gray-500">L×W×H/5000</Text>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <Text className="text-xs text-gray-600">Chargeable</Text>
                  <Text className="text-lg font-bold text-blue-700">{chargeableWeight}g</Text>
                  <Text className="text-[10px] text-gray-500">Max of both</Text>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <Text className="text-xs text-gray-600">Dimensions</Text>
                  <Text className="text-lg font-bold text-gray-900">
                    {length}×{width}×{height}
                  </Text>
                  <Text className="text-[10px] text-gray-500">cm</Text>
                </div>
              </div>
              
              {/* Volume & Cubic Weight */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <Text className="text-xs text-blue-600 mb-1">Volume</Text>
                  <Text className="font-semibold text-blue-900">
                    {((length * width * height) / 1000).toFixed(2)} liters
                  </Text>
                </div>
                <div className="rounded-lg bg-cyan-50 border border-cyan-200 p-3">
                  <Text className="text-xs text-cyan-600 mb-1">Cubic Weight</Text>
                  <Text className="font-semibold text-cyan-900">
                    {(chargeableWeight / 1000).toFixed(2)} kg
                  </Text>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free Shipping - Enhanced */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-green-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-green-400 to-emerald-600" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: [0, -10, 10, -10, 0] }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100"
            >
              <PiGift className="h-5 w-5 text-green-600" />
            </motion.div>
            <div>
              <Text className="font-medium text-green-900">Free Shipping</Text>
              <Text className="text-sm text-green-700">
                Offer free shipping to boost conversions
              </Text>
            </div>
          </div>
          <Switch
            checked={toggleStates.isFreeShipping}
            onChange={(e) => handleToggle('isFreeShipping')(e.target.checked)}
          />
        </div>
        
        <AnimatePresence>
          {toggleStates.isFreeShipping && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Minimum Order (₦)
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g., 10000"
                    {...register('subProductData.shipping.freeShippingMinOrder', { valueAsNumber: true })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Label
                  </label>
                  <Input
                    placeholder="e.g., Free Delivery"
                    {...register('subProductData.shipping.freeShippingLabel')}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Eligible Areas
                  </label>
                  <Controller
                    name="subProductData.shipping.freeShippingAreas"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">All Areas</option>
                        <option value="local">Local Only</option>
                        <option value="regional">Regional Only</option>
                        <option value="national">National Only</option>
                      </select>
                    )}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Dimensions - Enhanced */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 to-blue-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiRuler className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Package Dimensions</Text>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-4">
          <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <PiScales className="h-4 w-4" />
              Weight (g)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.weight', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <PiRuler className="h-4 w-4" />
              Length (cm)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.length', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <PiRuler className="h-4 w-4" />
              Width (cm)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.width', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>

          <motion.div variants={fieldStaggerVariants} className="transition-transform duration-200 focus-within:scale-[1.01]">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <PiRuler className="h-4 w-4" />
              Height (cm)
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              {...register('subProductData.shipping.height', { valueAsNumber: true })}
              className="w-full"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Enhanced Special Handling */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-purple-400 to-indigo-600" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiShieldWarning className="h-5 w-5 text-purple-500" />
            <Text className="font-medium">Special Handling Options</Text>
            {hasSpecialHandling && (
              <Badge color="warning">{hasSpecialHandling ? 'Active' : ''}</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Fragile */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-red-200 hover:bg-red-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                <PiWarning className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Fragile</Text>
                <Text className="text-xs text-gray-500">Handle with care</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.fragile}
              onChange={handleToggle('fragile')}
            />
          </motion.div>

          {/* Age Verification */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-amber-200 hover:bg-amber-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <PiHourglass className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Age Verification</Text>
                <Text className="text-xs text-gray-500">18+ at delivery</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.requiresAgeVerification}
              onChange={handleToggle('requiresAgeVerification')}
            />
          </motion.div>

          {/* Hazmat */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-orange-200 hover:bg-orange-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                <PiFactory className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Hazardous Material</Text>
                <Text className="text-xs text-gray-500">Special shipping</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.hazmat}
              onChange={handleToggle('hazmat')}
            />
          </motion.div>

          {/* Store Pickup */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-green-200 hover:bg-green-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
                <PiStorefront className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Store Pickup</Text>
                <Text className="text-xs text-gray-500">Click & Collect</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.availableForPickup}
              onChange={handleToggle('availableForPickup')}
            />
          </motion.div>

          {/* International */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-indigo-200 hover:bg-indigo-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                <PiAirplane className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">International</Text>
                <Text className="text-xs text-gray-500">Cross-border shipping</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.internationalShipping}
              onChange={handleToggle('internationalShipping')}
            />
          </motion.div>

          {/* Tracking */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-cyan-200 hover:bg-cyan-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50">
                <PiMapPin className="h-4 w-4 text-cyan-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Tracking</Text>
                <Text className="text-xs text-gray-500">Enable tracking</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.trackingEnabled}
              onChange={handleToggle('trackingEnabled')}
            />
          </motion.div>

          {/* Signature Required */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-slate-200 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
                <PiShieldCheck className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Signature Required</Text>
                <Text className="text-xs text-gray-500">Delivery confirmation</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.signatureRequired}
              onChange={handleToggle('signatureRequired')}
            />
          </motion.div>

          {/* Insurance */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-all hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <PiCurrencyCircleDollar className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <Text className="font-medium text-sm">Insurance</Text>
                <Text className="text-xs text-gray-500">Shipping insurance</Text>
              </div>
            </div>
            <Switch
              checked={toggleStates.insurance}
              onChange={handleToggle('insurance')}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Carrier Selection - Enhanced */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-400 to-blue-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiTruck className="h-5 w-5 text-cyan-500" />
            <Text className="font-medium">Shipping Carrier</Text>
            {selectedCarrier && (
              <Badge color="success" variant="flat">{selectedCarrier.label}</Badge>
            )}
          </div>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <PiCaretUp className="h-4 w-4" /> : <PiCaretDown className="h-4 w-4" />}
            {showAdvanced ? 'Hide' : 'Show'} Options
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {SHIPPING_CARRIERS.map((carrier, index) => {
            const CarrierIcon = carrier.icon;
            const isSelected = shipping?.carrier === carrier.value;
            return (
              <motion.button
                key={carrier.value}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCarrierSelect(carrier.value)}
                className={`relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 shadow-md ring-2 ring-cyan-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                }`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500"
                  >
                    <PiCheckCircle className="h-3 w-3 text-white" />
                  </motion.div>
                )}
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? carrier.bgColor : 'bg-gray-100'}`}>
                  <CarrierIcon className={`h-4 w-4 ${isSelected ? carrier.color : 'text-gray-500'}`} />
                </div>
                <span className={`text-[10px] font-medium ${isSelected ? 'text-cyan-700' : 'text-gray-600'}`}>
                  {carrier.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Selected Carrier Details */}
        <AnimatePresence>
          {showAdvanced && selectedCarrier && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-lg bg-cyan-50 border border-cyan-200 p-4"
            >
              <div className="flex items-center gap-3">
                <selectedCarrier.icon className={`h-6 w-6 ${selectedCarrier.color}`} />
                <div>
                  <Text className="font-medium text-cyan-900">{selectedCarrier.label}</Text>
                  <Text className="text-sm text-cyan-700">{selectedCarrier.description}</Text>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Delivery Area & Time - Enhanced */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-violet-400 to-purple-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiMapTrifold className="h-5 w-5 text-violet-500" />
            <Text className="font-medium">Delivery Area & Time</Text>
          </div>
        </div>

        {/* Delivery Area */}
        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-gray-700">Delivery Area</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DELIVERY_AREAS.map((area, index) => {
              const AreaIcon = area.icon;
              const isSelected = shipping?.deliveryArea === area.value;
              return (
                <motion.button
                  key={area.value}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setValue('subProductData.shipping.deliveryArea', isSelected ? '' : area.value)}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
                    isSelected
                      ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 shadow-md ring-2 ring-violet-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500"
                    >
                      <PiCheckCircle className="h-3 w-3 text-white" />
                    </motion.div>
                  )}
                  <AreaIcon className={`h-6 w-6 ${isSelected ? 'text-violet-600' : 'text-gray-400'}`} />
                  <div>
                    <span className={`block text-sm font-semibold ${isSelected ? 'text-violet-700' : 'text-gray-700'}`}>
                      {area.label}
                    </span>
                    <span className="block text-xs text-gray-500">{area.range}</span>
                  </div>
                  <Badge size="sm" variant="flat" className={isSelected ? 'bg-violet-100 text-violet-700' : ''}>
                    ₦{area.price.toLocaleString()}
                  </Badge>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Delivery Time */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">Estimated Delivery Time</label>
          <div className="mb-4 flex flex-wrap gap-2">
            {DELIVERY_TIME_PRESETS.map((preset, index) => {
              const PresetIcon = preset.icon;
              const isActive = shipping?.minDeliveryDays === preset.min && shipping?.maxDeliveryDays === preset.max;
              return (
                <motion.button
                  key={preset.label}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDeliveryTimePreset(preset)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? `border-violet-500 bg-gradient-to-r ${preset.color} text-white shadow-md`
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <PresetIcon className="mr-1.5 inline h-4 w-4" />
                  {preset.label}
                </motion.button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Min Days</label>
              <Input
                type="number"
                min="0"
                placeholder="Min days"
                {...register('subProductData.shipping.minDeliveryDays', { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Max Days</label>
              <Input
                type="number"
                min="0"
                placeholder="Max days"
                {...register('subProductData.shipping.maxDeliveryDays', { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Storage Conditions - New Section */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-400 to-teal-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiSnowflake className="h-5 w-5 text-cyan-500" />
            <Text className="font-medium">Storage Conditions</Text>
            {shipping?.storageCondition && (
              <Badge color="info" variant="flat">
                {STORAGE_CONDITIONS.find(s => s.value === shipping?.storageCondition)?.label}
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setShowStorage(!showStorage)}
          >
            {showStorage ? <PiCaretUp className="h-4 w-4" /> : <PiCaretDown className="h-4 w-4" />}
          </Button>
        </div>
        
        <AnimatePresence>
          {showStorage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STORAGE_CONDITIONS.map((condition, index) => {
                  const CondIcon = condition.icon;
                  const isSelected = shipping?.storageCondition === condition.value;
                  return (
                    <motion.button
                      key={condition.value}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setValue('subProductData.shipping.storageCondition', isSelected ? '' : condition.value)}
                      className={`relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                        isSelected
                          ? 'border-cyan-500 bg-gradient-to-br from-cyan-50 to-teal-50 shadow-md ring-2 ring-cyan-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500"
                        >
                          <PiCheckCircle className="h-3 w-3 text-white" />
                        </motion.div>
                      )}
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? 'bg-cyan-100' : 'bg-gray-100'}`}>
                        <CondIcon className={`h-4 w-4 ${isSelected ? 'text-cyan-600' : 'text-gray-500'}`} />
                      </div>
                      <span className={`text-xs font-medium ${isSelected ? 'text-cyan-700' : 'text-gray-600'}`}>
                        {condition.label}
                      </span>
                      <span className="text-[10px] text-gray-500">{condition.temp}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Warehouse Location - Enhanced */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-green-600" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiWarehouse className="h-5 w-5 text-emerald-500" />
            <Text className="font-medium">Warehouse Location</Text>
            {warehouse?.location && (
              <Badge color="success" variant="flat">{warehouse.location}</Badge>
            )}
          </div>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setShowWarehouse(!showWarehouse)}
          >
            {showWarehouse ? <PiCaretUp className="h-4 w-4" /> : <PiCaretDown className="h-4 w-4" />}
          </Button>
        </div>
        
        <AnimatePresence>
          {showWarehouse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Quick Location Presets */}
              <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
                <Text className="w-full text-xs font-medium text-gray-500 mb-1">Quick Locations:</Text>
                {WAREHOUSE_LOCATIONS.map((loc, index) => {
                  const LocIcon = loc.icon;
                  return (
                    <motion.button
                      key={loc.value}
                      type="button"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setValue('subProductData.warehouse.location', loc.label)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                        warehouse?.location === loc.label
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md text-white ${loc.color}`}>
                        <LocIcon className="h-3.5 w-3.5" />
                      </div>
                      {loc.label}
                    </motion.button>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <motion.div variants={fieldStaggerVariants}>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <PiWarehouse className="h-4 w-4 text-emerald-500" />
                    Location
                  </label>
                  <Input
                    placeholder="e.g., Main Warehouse"
                    {...register('subProductData.warehouse.location')}
                    className="w-full"
                  />
                </motion.div>

                <motion.div variants={fieldStaggerVariants}>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <PiMapPin className="h-4 w-4 text-emerald-500" />
                    Zone
                  </label>
                  <Input
                    placeholder="e.g., A"
                    {...register('subProductData.warehouse.zone')}
                    className="w-full"
                  />
                </motion.div>

                <motion.div variants={fieldStaggerVariants}>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <PiAnchor className="h-4 w-4 text-emerald-500" />
                    Aisle
                  </label>
                  <Input
                    placeholder="e.g., 1"
                    {...register('subProductData.warehouse.aisle')}
                    className="w-full"
                  />
                </motion.div>

                <motion.div variants={fieldStaggerVariants}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Shelf
                  </label>
                  <Input
                    placeholder="e.g., B"
                    {...register('subProductData.warehouse.shelf')}
                    className="w-full"
                  />
                </motion.div>

                <motion.div variants={fieldStaggerVariants}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Bin
                  </label>
                  <Input
                    placeholder="e.g., 3"
                    {...register('subProductData.warehouse.bin')}
                    className="w-full"
                  />
                </motion.div>

                <motion.div variants={fieldStaggerVariants}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <Input
                    placeholder="Full address"
                    {...register('subProductData.warehouse.address')}
                    className="w-full"
                  />
                </motion.div>
              </div>

              {/* Warehouse Summary */}
              {warehouse?.location && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 p-4"
                >
                  <Text className="text-sm font-medium text-emerald-900 mb-2">Warehouse Address</Text>
                  <Text className="text-sm text-emerald-700">
                    {[
                      warehouse.location,
                      warehouse.zone && `Zone ${warehouse.zone}`,
                      warehouse.aisle && `Aisle ${warehouse.aisle}`,
                      warehouse.shelf && `Shelf ${warehouse.shelf}`,
                      warehouse.bin && `Bin ${warehouse.bin}`,
                      warehouse.address
                    ].filter(Boolean).join(' • ')}
                  </Text>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Shipping Cost Override */}
      <motion.div 
        variants={fieldStaggerVariants} 
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-orange-600" />
        <div className="mb-4 flex items-center gap-2">
          <PiCurrencyCircleDollar className="h-5 w-5 text-amber-500" />
          <Text className="font-medium">Shipping Cost Configuration</Text>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Fixed Shipping Cost (₦)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Leave empty for calculated"
              {...register('subProductData.shipping.fixedShippingCost', { valueAsNumber: true })}
              className="w-full"
            />
            <Text className="mt-1 text-xs text-gray-500">
              Leave empty to use calculated rate
            </Text>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <Text className="text-sm font-medium text-amber-800 mb-1">Calculated Estimate</Text>
            <Text className="text-2xl font-bold text-amber-700">
              ₦{estimatedCost.toLocaleString()}
            </Text>
            <Text className="text-xs text-amber-600">
              Based on {chargeableWeight}g chargeable weight
            </Text>
          </div>
        </div>
      </motion.div>

      {/* Tips */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg bg-blue-50 border border-blue-200 p-4"
      >
        <div className="flex items-start gap-2">
          <PiInfo className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <Text className="font-medium text-blue-800 mb-1">Shipping Tips</Text>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Use package presets for common beverage sizes to save time</li>
              <li>• Enable age verification for alcohol deliveries (legal requirement)</li>
              <li>• Add tracking and insurance for high-value orders</li>
              <li>• Configure cold storage for wines and certain beers</li>
              <li>• Free shipping with minimum order can increase average order value</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
