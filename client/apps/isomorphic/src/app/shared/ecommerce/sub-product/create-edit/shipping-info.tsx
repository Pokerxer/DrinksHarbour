// @ts-nocheck
'use client';

import { useCallback, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Input, Switch, Button, ActionIcon, Text, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import FormGroup from '@/app/shared/form-group';
import { motion, AnimatePresence } from 'framer-motion';
import { locationShipping } from '@/app/shared/ecommerce/product/create-edit/form-utils';
import TrashIcon from '@core/components/icons/trash';
import {
  PiPlusBold,
  PiTruck,
  PiMapPin,
  PiPackage,
  PiGlobe,
  PiCurrencyDollar,
  PiLightning,
  PiEraser,
  PiDotsSixVertical,
  PiCopy,
  PiCheckCircle,
  PiCity,
  PiBuildings,
  PiHouse,
  PiAirplaneTakeoff,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// Location presets for beverages
const locationPresets = {
  local: {
    label: 'Local Delivery',
    icon: PiHouse,
    color: 'bg-green-500',
    locations: [
      { name: 'Same City', value: 5 },
      { name: 'Metro Area', value: 10 },
      { name: 'Suburbs', value: 15 },
    ],
  },
  regional: {
    label: 'Regional',
    icon: PiCity,
    color: 'bg-blue-500',
    locations: [
      { name: 'State/Province', value: 15 },
      { name: 'Neighboring States', value: 25 },
      { name: 'Regional Hub', value: 20 },
    ],
  },
  national: {
    label: 'National',
    icon: PiBuildings,
    color: 'bg-purple-500',
    locations: [
      { name: 'East Coast', value: 30 },
      { name: 'West Coast', value: 35 },
      { name: 'Midwest', value: 28 },
      { name: 'South', value: 25 },
    ],
  },
  international: {
    label: 'International',
    icon: PiAirplaneTakeoff,
    color: 'bg-rose-500',
    locations: [
      { name: 'Canada', value: 45 },
      { name: 'Mexico', value: 50 },
      { name: 'Europe', value: 75 },
      { name: 'Asia', value: 85 },
      { name: 'Australia', value: 95 },
    ],
  },
};

// Shipping rate presets
const ratePresets = [
  { label: '$5', value: 5 },
  { label: '$10', value: 10 },
  { label: '$15', value: 15 },
  { label: '$25', value: 25 },
  { label: '$50', value: 50 },
];

export default function ShippingInfo({ className }: { className?: string }) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'locationShipping',
  });

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [locationBasedEnabled, setLocationBasedEnabled] = useState(false);

  const freeShipping = watch('freeShipping');
  const shippingPrice = watch('shippingPrice');
  const locationShippingData = watch('locationShipping') || [];

  const addLocation = useCallback(() => {
    append({ name: '', value: 0 });
    toast.success('Location added');
  }, [append]);

  const addPresetLocations = (presetKey: string) => {
    const preset = locationPresets[presetKey];
    if (preset) {
      preset.locations.forEach((loc) => {
        append(loc);
      });
      toast.success(`Added ${preset.locations.length} ${preset.label} zones`);
      setActivePreset(null);
    }
  };

  const duplicateLocation = (index: number) => {
    const location = locationShippingData[index];
    if (location) {
      append({ ...location, name: `${location.name} (Copy)` });
      toast.success('Location duplicated');
    }
  };

  const clearAllLocations = () => {
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    toast.success('All locations cleared');
  };

  const handleFreeShippingToggle = (checked: boolean) => {
    setFreeShippingEnabled(checked);
    setValue('freeShipping', checked);
  };

  const handleLocationBasedToggle = (checked: boolean) => {
    setLocationBasedEnabled(checked);
    setValue('locationBasedShipping', checked);
  };

  const totalLocations = fields.length;
  const avgShippingCost = locationShippingData.length > 0
    ? Math.round(locationShippingData.reduce((sum, l) => sum + (Number(l?.value) || 0), 0) / locationShippingData.length)
    : 0;

  return (
    <FormGroup
      title="Shipping"
      description="Configure shipping options and zones"
      className={cn(className)}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-full space-y-6"
      >
        {/* Header with Summary */}
        <div className="relative overflow-hidden rounded-xl border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-blue-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 text-white shadow-lg">
                <PiTruck className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Shipping Configuration</Text>
                <Text className="text-xs text-gray-500">
                  Set up delivery zones and rates
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {freeShippingEnabled && (
                <Badge variant="flat" color="success" className="font-medium">
                  Free Shipping
                </Badge>
              )}
              {totalLocations > 0 && (
                <Badge variant="flat" color="info" className="font-medium">
                  {totalLocations} Zone{totalLocations !== 1 ? 's' : ''}
                </Badge>
              )}
              {avgShippingCost > 0 && (
                <Badge variant="flat" color="warning" className="font-medium">
                  Avg ${avgShippingCost}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Free Shipping Toggle */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={cn(
            'flex items-center justify-between rounded-xl border p-4 transition-all',
            freeShippingEnabled
              ? 'border-green-300 bg-green-50'
              : 'border-gray-200 bg-white hover:border-green-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              freeShippingEnabled ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              <PiPackage className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-medium text-gray-800">Free Shipping</Text>
              <Text className="text-xs text-gray-500">Offer free shipping on this product</Text>
            </div>
          </div>
          <Controller
            name="freeShipping"
            control={control}
            render={({ field: { value, onChange } }) => (
              <Switch
                checked={freeShippingEnabled}
                onChange={(e) => handleFreeShippingToggle(e.target.checked)}
              />
            )}
          />
        </motion.div>

        {/* Standard Shipping Price */}
        <AnimatePresence>
          {!freeShippingEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <Text className="mb-3 text-sm font-medium text-gray-700">Standard Shipping Rate</Text>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="w-32"
                    prefix={<PiCurrencyDollar className="h-4 w-4" />}
                    {...register('shippingPrice')}
                    error={errors.shippingPrice?.message as string}
                  />
                  <div className="flex gap-1">
                    {ratePresets.map((preset) => (
                      <motion.button
                        key={preset.label}
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setValue('shippingPrice', preset.value)}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-cyan-100 hover:text-cyan-700"
                      >
                        {preset.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Location Based Shipping Toggle */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={cn(
            'flex items-center justify-between rounded-xl border p-4 transition-all',
            locationBasedEnabled
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-blue-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              locationBasedEnabled ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              <PiMapPin className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-medium text-gray-800">Location-Based Shipping</Text>
              <Text className="text-xs text-gray-500">Set different rates per delivery zone</Text>
            </div>
          </div>
          <Controller
            name="locationBasedShipping"
            control={control}
            render={({ field: { value, onChange } }) => (
              <Switch
                checked={locationBasedEnabled}
                onChange={(e) => handleLocationBasedToggle(e.target.checked)}
              />
            )}
          />
        </motion.div>

        {/* Location-Based Shipping Configuration */}
        <AnimatePresence>
          {locationBasedEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Quick Add Presets */}
              <div className="space-y-3">
                <Text className="text-sm font-medium text-gray-700">Quick Add Zones</Text>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(locationPresets).map(([key, preset]) => {
                    const Icon = preset.icon;
                    const isActive = activePreset === key;
                    return (
                      <motion.button
                        key={key}
                        type="button"
                        onClick={() => setActivePreset(isActive ? null : key)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-700 shadow-md'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-200 hover:bg-cyan-50/50'
                        )}
                      >
                        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', preset.color)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {preset.label}
                        <Badge size="sm" variant="flat">
                          {preset.locations.length}
                        </Badge>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Expanded Preset Options */}
              <AnimatePresence mode="wait">
                {activePreset && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <Text className="font-medium text-gray-800">
                          {locationPresets[activePreset].label} Zones
                        </Text>
                        <Button
                          type="button"
                          size="sm"
                          variant="solid"
                          color="primary"
                          onClick={() => addPresetLocations(activePreset)}
                          className="gap-1"
                        >
                          <PiLightning className="h-4 w-4" />
                          Add All
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {locationPresets[activePreset].locations.map((loc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-sm"
                          >
                            <span className="text-gray-700">{loc.name}</span>
                            <Badge size="sm" variant="flat" color="info">
                              ${loc.value}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Locations List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Text className="text-sm font-medium text-gray-700">
                    Shipping Zones ({fields.length})
                  </Text>
                  {fields.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="text"
                      color="danger"
                      onClick={clearAllLocations}
                      className="gap-1 text-xs"
                    >
                      <PiEraser className="h-3.5 w-3.5" />
                      Clear All
                    </Button>
                  )}
                </div>

                <AnimatePresence mode="popLayout">
                  {fields.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-8 text-center"
                    >
                      <PiMapPin className="mb-2 h-8 w-8 text-gray-300" />
                      <Text className="text-gray-500">No shipping zones added yet</Text>
                      <Text className="text-xs text-gray-400">Use presets above or add manually</Text>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {fields.map((item, index) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-cyan-200 hover:shadow-md"
                        >
                          {/* Drag Handle */}
                          <div className="cursor-grab text-gray-400 hover:text-gray-600">
                            <PiDotsSixVertical className="h-5 w-5" />
                          </div>

                          {/* Zone Number */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-sm font-semibold text-cyan-600">
                            {index + 1}
                          </div>

                          {/* Location Name */}
                          <Input
                            label=""
                            placeholder="Zone name (e.g., East Coast)"
                            className="min-w-[180px] flex-grow"
                            prefix={<PiMapPin className="h-4 w-4 text-gray-400" />}
                            {...register(`locationShipping.${index}.name`)}
                          />

                          {/* Shipping Rate */}
                          <Input
                            type="number"
                            label=""
                            placeholder="0.00"
                            className="w-28"
                            prefix={<PiCurrencyDollar className="h-4 w-4" />}
                            {...register(`locationShipping.${index}.value`)}
                          />

                          {/* Quick Rate Presets */}
                          <div className="hidden gap-1 lg:flex">
                            {ratePresets.slice(0, 3).map((preset) => (
                              <motion.button
                                key={preset.label}
                                type="button"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setValue(`locationShipping.${index}.value`, preset.value)}
                                className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-cyan-100 hover:text-cyan-700"
                              >
                                {preset.label}
                              </motion.button>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <ActionIcon
                              type="button"
                              onClick={() => duplicateLocation(index)}
                              variant="text"
                              size="sm"
                              className="text-gray-400 hover:text-cyan-500"
                            >
                              <PiCopy className="h-4 w-4" />
                            </ActionIcon>
                            <ActionIcon
                              type="button"
                              onClick={() => remove(index)}
                              variant="text"
                              size="sm"
                              className="text-gray-400 hover:text-red-500"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </ActionIcon>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Add Zone Button */}
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="button"
                  onClick={addLocation}
                  variant="outline"
                  className="w-full gap-2 border-dashed border-cyan-300 text-cyan-600 hover:border-cyan-400 hover:bg-cyan-50"
                >
                  <PiPlusBold className="h-4 w-4" />
                  Add Shipping Zone
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </FormGroup>
  );
}
