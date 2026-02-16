// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Textarea, Text } from 'rizzui';
import { motion } from 'framer-motion';
import { PiSliders, PiTextAa, PiTextAlignLeft, PiTag, PiNote } from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants } from './animations';

export default function SubProductTenantOverrides() {
  const methods = useFormContext();
  const register = methods?.register;
  const errors = methods?.formState?.errors || {};

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Tenant Overrides</Text>
        <Text className="text-sm text-gray-500">
          Customize product information for your tenant catalog
        </Text>
      </motion.div>

      {/* Short Description Override */}
      <motion.div variants={fieldStaggerVariants} custom={1}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Short Description Override
        </label>
        <div className="relative">
          <Textarea
            placeholder="Enter a custom short description (max 280 characters)"
            maxLength={280}
            {...register('subProductData.shortDescriptionOverride')}
            className="w-full"
            rows={3}
          />
        </div>
        <Text className="mt-1 text-xs text-gray-500">
          Override the default short description for your catalog
        </Text>
      </motion.div>

      {/* Description Override */}
      <motion.div variants={fieldStaggerVariants} custom={2}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Description Override
        </label>
        <Textarea
          placeholder="Enter a custom full description (max 5000 characters)"
          maxLength={5000}
          {...register('subProductData.descriptionOverride')}
          className="w-full"
          rows={6}
        />
        <Text className="mt-1 text-xs text-gray-500">
          Override the default description for your catalog
        </Text>
      </motion.div>

      {/* Custom Keywords */}
      <motion.div variants={fieldStaggerVariants} custom={3} className="transition-transform duration-200 focus-within:scale-[1.01]">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Custom Keywords
        </label>
        <div className="relative">
          <Input
            placeholder="Enter keywords separated by commas"
            {...register('subProductData.customKeywords')}
            className="w-full pl-10"
          />
          <PiTag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <Text className="mt-1 text-xs text-gray-500">
          Additional keywords for search optimization
        </Text>
      </motion.div>

      {/* Tenant Notes */}
      <motion.div variants={fieldStaggerVariants} custom={4}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Tenant Notes
        </label>
        <Textarea
          placeholder="Internal notes about this product (max 1000 characters)"
          maxLength={1000}
          {...register('subProductData.tenantNotes')}
          className="w-full"
          rows={4}
        />
        <Text className="mt-1 text-xs text-gray-500">
          Internal notes visible only to your team
        </Text>
      </motion.div>
    </motion.div>
  );
}
