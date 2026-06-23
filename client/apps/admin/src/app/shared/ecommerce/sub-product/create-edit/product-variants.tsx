// @ts-nocheck
'use client';

import { useCallback, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Input, Button, ActionIcon, Select, Text, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import FormGroup from '@/app/shared/form-group';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  variantOption,
  productVariants,
} from '@/app/shared/ecommerce/product/create-edit/form-utils';
import TrashIcon from '@core/components/icons/trash';
import {
  PiPlusBold,
  PiWine,
  PiBeerBottle,
  PiPackage,
  PiArrowsDownUp,
  PiCurrencyDollar,
  PiPercent,
  PiLightning,
  PiCopy,
  PiEraser,
  PiDotsSixVertical,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// Beverage variant presets
const variantPresets = {
  size: {
    label: 'Size Variants',
    icon: PiPackage,
    color: 'bg-blue-500',
    options: [
      { name: 'Size - 250ml', value: 0 },
      { name: 'Size - 330ml', value: 0 },
      { name: 'Size - 500ml', value: 0 },
      { name: 'Size - 750ml', value: 0 },
      { name: 'Size - 1L', value: 0 },
    ],
  },
  packaging: {
    label: 'Packaging Type',
    icon: PiWine,
    color: 'bg-purple-500',
    options: [
      { name: 'Packaging - Single Bottle', value: 0 },
      { name: 'Packaging - 6-Pack', value: 0 },
      { name: 'Packaging - 12-Pack', value: 0 },
      { name: 'Packaging - Case (24)', value: 0 },
    ],
  },
  premium: {
    label: 'Premium Options',
    icon: PiBeerBottle,
    color: 'bg-amber-500',
    options: [
      { name: 'Edition - Standard', value: 0 },
      { name: 'Edition - Reserve', value: 25 },
      { name: 'Edition - Limited', value: 50 },
      { name: 'Edition - Collectors', value: 100 },
    ],
  },
};

// Price adjustment presets
const pricePresets = [
  { label: '+$5', value: 5, color: 'bg-green-100 text-green-700' },
  { label: '+$10', value: 10, color: 'bg-green-100 text-green-700' },
  { label: '+$25', value: 25, color: 'bg-green-100 text-green-700' },
  { label: '+$50', value: 50, color: 'bg-green-100 text-green-700' },
  { label: '-$5', value: -5, color: 'bg-red-100 text-red-700' },
  { label: '-$10', value: -10, color: 'bg-red-100 text-red-700' },
];

export default function ProductVariants({ className }: { className?: string }) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'productVariants',
  });

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const variants = watch('productVariants') || [];

  const addVariant = useCallback(() => {
    append({ name: '', value: 0 });
    toast.success('Variant added');
  }, [append]);

  const addPresetVariants = (presetKey: string) => {
    const preset = variantPresets[presetKey];
    if (preset) {
      preset.options.forEach((option) => {
        append(option);
      });
      toast.success(`Added ${preset.options.length} ${preset.label}`);
      setActivePreset(null);
    }
  };

  const duplicateVariant = (index: number) => {
    const variant = variants[index];
    if (variant) {
      append({ ...variant, name: `${variant.name} (Copy)` });
      toast.success('Variant duplicated');
    }
  };

  const clearAllVariants = () => {
    // Remove all variants
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    toast.success('All variants cleared');
  };

  const totalVariants = fields.length;
  const totalPriceAdjustment = variants.reduce((sum, v) => sum + (Number(v?.value) || 0), 0);

  return (
    <FormGroup
      title="Variant Options"
      description="Add product variants with price adjustments"
      className={cn(className)}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-full space-y-6"
      >
        {/* Header with Summary */}
        <div className="relative overflow-hidden rounded-xl border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-purple-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg">
                <PiArrowsDownUp className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Variant Manager</Text>
                <Text className="text-xs text-gray-500">
                  Configure product variations
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {totalVariants > 0 && (
                <>
                  <Badge variant="flat" color="primary" className="font-medium">
                    {totalVariants} Variant{totalVariants !== 1 ? 's' : ''}
                  </Badge>
                  <Badge 
                    variant="flat" 
                    color={totalPriceAdjustment >= 0 ? 'success' : 'danger'}
                    className="font-medium"
                  >
                    {totalPriceAdjustment >= 0 ? '+' : ''}${totalPriceAdjustment}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Presets */}
        <div className="space-y-3">
          <Text className="text-sm font-medium text-gray-700">Quick Add Presets</Text>
          <div className="flex flex-wrap gap-2">
            {Object.entries(variantPresets).map(([key, preset]) => {
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
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                  )}
                >
                  <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', preset.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {preset.label}
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
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Text className="font-medium text-gray-800">
                    {variantPresets[activePreset].label}
                  </Text>
                  <Button
                    type="button"
                    size="sm"
                    variant="solid"
                    color="primary"
                    onClick={() => addPresetVariants(activePreset)}
                    className="gap-1"
                  >
                    <PiLightning className="h-4 w-4" />
                    Add All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variantPresets[activePreset].options.map((option, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm"
                    >
                      <span className="text-gray-700">{option.name}</span>
                      {option.value > 0 && (
                        <Badge size="sm" variant="flat" color="success">
                          +${option.value}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Variants List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Text className="text-sm font-medium text-gray-700">
              Current Variants ({fields.length})
            </Text>
            {fields.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="text"
                color="danger"
                onClick={clearAllVariants}
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
                <PiArrowsDownUp className="mb-2 h-8 w-8 text-gray-300" />
                <Text className="text-gray-500">No variants added yet</Text>
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
                    className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
                  >
                    {/* Drag Handle */}
                    <div className="cursor-grab text-gray-400 hover:text-gray-600">
                      <PiDotsSixVertical className="h-5 w-5" />
                    </div>

                    {/* Variant Number */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-sm font-semibold text-indigo-600">
                      {index + 1}
                    </div>

                    {/* Variant Name */}
                    <Controller
                      name={`productVariants.${index}.name`}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <Select
                          options={variantOption}
                          value={value}
                          onChange={onChange}
                          label=""
                          placeholder="Select variant type"
                          className="min-w-[200px] flex-grow"
                          getOptionValue={(option) => option.value}
                        />
                      )}
                    />

                    {/* Price Adjustment */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="w-28"
                        prefix={<PiCurrencyDollar className="h-4 w-4" />}
                        {...register(`productVariants.${index}.value`)}
                      />
                      
                      {/* Quick Price Presets */}
                      <div className="hidden gap-1 lg:flex">
                        {pricePresets.slice(0, 4).map((preset) => (
                          <motion.button
                            key={preset.label}
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              const currentValue = Number(variants[index]?.value) || 0;
                              setValue(`productVariants.${index}.value`, currentValue + preset.value);
                            }}
                            className={cn(
                              'rounded-md px-2 py-1 text-xs font-medium transition-all',
                              preset.color
                            )}
                          >
                            {preset.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <ActionIcon
                        type="button"
                        onClick={() => duplicateVariant(index)}
                        variant="text"
                        size="sm"
                        className="text-gray-400 hover:text-indigo-500"
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

        {/* Add Variant Button */}
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            type="button"
            onClick={addVariant}
            variant="outline"
            className="w-full gap-2 border-dashed border-indigo-300 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <PiPlusBold className="h-4 w-4" />
            Add Custom Variant
          </Button>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
