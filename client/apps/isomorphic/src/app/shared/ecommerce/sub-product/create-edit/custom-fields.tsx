// @ts-nocheck
'use client';

import { useCallback, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Input, Button, ActionIcon, Text, Badge, Select } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import TrashIcon from '@core/components/icons/trash';
import { customFields } from '@/app/shared/ecommerce/product/create-edit/form-utils';
import {
  PiPlusBold,
  PiTextT,
  PiCalendar,
  PiLink,
  PiHash,
  PiListBullets,
  PiToggleLeft,
  PiCopy,
  PiEraser,
  PiDotsSixVertical,
  PiLightning,
  PiWine,
  PiThermometer,
  PiClock,
  PiCertificate,
  PiWarning,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';

// Field type options
const fieldTypeOptions = [
  { value: 'text', label: 'Text', icon: PiTextT },
  { value: 'number', label: 'Number', icon: PiHash },
  { value: 'date', label: 'Date', icon: PiCalendar },
  { value: 'url', label: 'URL', icon: PiLink },
  { value: 'boolean', label: 'Yes/No', icon: PiToggleLeft },
  { value: 'list', label: 'List', icon: PiListBullets },
];

// Beverage-specific field presets
const fieldPresets = {
  beverage: {
    label: 'Beverage Info',
    icon: PiWine,
    color: 'bg-purple-500',
    fields: [
      { label: 'Grape Variety', value: '', type: 'text' },
      { label: 'Vintage Year', value: '', type: 'text' },
      { label: 'Winery/Distillery', value: '', type: 'text' },
      { label: 'Barrel Aged', value: '', type: 'text' },
      { label: 'Tasting Notes', value: '', type: 'text' },
    ],
  },
  storage: {
    label: 'Storage & Serving',
    icon: PiThermometer,
    color: 'bg-blue-500',
    fields: [
      { label: 'Serving Temperature', value: '', type: 'text' },
      { label: 'Storage Instructions', value: '', type: 'text' },
      { label: 'Best Before', value: '', type: 'text' },
      { label: 'Open Shelf Life', value: '', type: 'text' },
    ],
  },
  pairing: {
    label: 'Food Pairing',
    icon: PiListBullets,
    color: 'bg-amber-500',
    fields: [
      { label: 'Pairs With', value: '', type: 'text' },
      { label: 'Cuisine Type', value: '', type: 'text' },
      { label: 'Occasion', value: '', type: 'text' },
    ],
  },
  compliance: {
    label: 'Compliance',
    icon: PiCertificate,
    color: 'bg-green-500',
    fields: [
      { label: 'License Number', value: '', type: 'text' },
      { label: 'Import Permit', value: '', type: 'text' },
      { label: 'Health Warning', value: '', type: 'text' },
      { label: 'Producer ID', value: '', type: 'text' },
    ],
  },
  production: {
    label: 'Production',
    icon: PiClock,
    color: 'bg-rose-500',
    fields: [
      { label: 'Batch Number', value: '', type: 'text' },
      { label: 'Production Date', value: '', type: 'text' },
      { label: 'Bottling Date', value: '', type: 'text' },
      { label: 'Lot Number', value: '', type: 'text' },
    ],
  },
};

export default function CustomFields() {
  const { control, register, watch } = useFormContext();
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customFields',
  });

  const customFieldValues = watch('customFields') || [];

  const addCustomField = useCallback(() => {
    append({ label: '', value: '', type: 'text' });
    toast.success('Custom field added');
  }, [append]);

  const addPresetFields = (presetKey: string) => {
    const preset = fieldPresets[presetKey];
    if (preset) {
      preset.fields.forEach((field) => {
        append(field);
      });
      toast.success(`Added ${preset.fields.length} ${preset.label} fields`);
      setActivePreset(null);
    }
  };

  const duplicateField = (index: number) => {
    const field = customFieldValues[index];
    if (field) {
      append({ ...field, label: `${field.label} (Copy)` });
      toast.success('Field duplicated');
    }
  };

  const clearAllFields = () => {
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    toast.success('All custom fields cleared');
  };

  const filledFields = customFieldValues.filter((f) => f?.value?.trim()).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full space-y-6"
    >
      {/* Header with Summary */}
      <div className="relative overflow-hidden rounded-xl border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 via-white to-amber-50 p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-100/50" />
        <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-amber-100/50" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white shadow-lg">
              <PiTextT className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-semibold text-gray-900">Custom Fields</Text>
              <Text className="text-xs text-gray-500">
                Add additional product information
              </Text>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {fields.length > 0 && (
              <>
                <Badge variant="flat" color="warning" className="font-medium">
                  {fields.length} Field{fields.length !== 1 ? 's' : ''}
                </Badge>
                {filledFields > 0 && (
                  <Badge variant="flat" color="success" className="font-medium">
                    {filledFields} Filled
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add Presets */}
      <div className="space-y-3">
        <Text className="text-sm font-medium text-gray-700">Quick Add Field Sets</Text>
        <div className="flex flex-wrap gap-2">
          {Object.entries(fieldPresets).map(([key, preset]) => {
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
                    ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/50'
                )}
              >
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', preset.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {preset.label}
                <Badge size="sm" variant="flat" className="ml-1">
                  {preset.fields.length}
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
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Text className="font-medium text-gray-800">
                    {fieldPresets[activePreset].label} Fields
                  </Text>
                  <Badge size="sm" variant="flat">
                    {fieldPresets[activePreset].fields.length} fields
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => addPresetFields(activePreset)}
                  className="gap-1"
                >
                  <PiLightning className="h-4 w-4" />
                  Add All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {fieldPresets[activePreset].fields.map((field, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                  >
                    <PiTextT className="h-3.5 w-3.5 text-orange-500" />
                    {field.label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Fields List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">
            Current Fields ({fields.length})
          </Text>
          {fields.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="text"
              color="danger"
              onClick={clearAllFields}
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
              <PiTextT className="mb-2 h-8 w-8 text-gray-300" />
              <Text className="text-gray-500">No custom fields added yet</Text>
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
                  className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-orange-200 hover:shadow-md"
                >
                  {/* Drag Handle */}
                  <div className="cursor-grab text-gray-400 hover:text-gray-600">
                    <PiDotsSixVertical className="h-5 w-5" />
                  </div>

                  {/* Field Number */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-sm font-semibold text-orange-600">
                    {index + 1}
                  </div>

                  {/* Field Name */}
                  <Input
                    label=""
                    placeholder="Field name"
                    className="min-w-[150px] flex-grow"
                    prefix={<PiTextT className="h-4 w-4 text-gray-400" />}
                    {...register(`customFields.${index}.label`)}
                  />

                  {/* Field Value */}
                  <Input
                    label=""
                    placeholder="Field value"
                    className="min-w-[200px] flex-grow"
                    {...register(`customFields.${index}.value`)}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <ActionIcon
                      type="button"
                      onClick={() => duplicateField(index)}
                      variant="text"
                      size="sm"
                      className="text-gray-400 hover:text-orange-500"
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

      {/* Add Field Button */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          type="button"
          onClick={addCustomField}
          variant="outline"
          className="w-full gap-2 border-dashed border-orange-300 text-orange-600 hover:border-orange-400 hover:bg-orange-50"
        >
          <PiPlusBold className="h-4 w-4" />
          Add Custom Field
        </Button>
      </motion.div>

      {/* Tips */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm">
        <PiWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <Text className="font-medium text-amber-800">Pro Tip</Text>
          <Text className="text-xs text-amber-700">
            Custom fields are great for storing unique product attributes like batch numbers, 
            production details, or compliance information that don't fit standard fields.
          </Text>
        </div>
      </div>
    </motion.div>
  );
}
