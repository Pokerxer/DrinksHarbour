// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Checkbox, Input, Text, Badge, Tooltip } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import { allergensList } from './form-utils';
import FormGroup from '@/app/shared/form-group';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Leaf,
  Wheat,
  Milk,
  Scale,
  AlertTriangle,
  Heart,
  Info,
  Check,
} from 'lucide-react';

interface ProductDietaryProps {
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

// Dietary badges with icons
const dietaryOptions = [
  { key: 'vegan', label: 'Vegan', icon: Leaf, color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'vegetarian', label: 'Vegetarian', icon: Leaf, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'glutenFree', label: 'Gluten Free', icon: Wheat, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'dairyFree', label: 'Dairy Free', icon: Milk, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'organic', label: 'Organic', icon: Leaf, color: 'bg-lime-100 text-lime-700 border-lime-200' },
  { key: 'kosher', label: 'Kosher', icon: Heart, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'halal', label: 'Halal', icon: Heart, color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'sugarFree', label: 'Sugar Free', icon: Scale, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { key: 'lowCalorie', label: 'Low Calorie', icon: Scale, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'lowCarb', label: 'Low Carb', icon: Scale, color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

// Allergen icons
const allergenIcons: Record<string, string> = {
  gluten: '🌾',
  dairy: '🥛',
  eggs: '🥚',
  soy: '🫘',
  nuts: '🥜',
  peanuts: '🥜',
  sesame: '🌱',
  shellfish: '🦐',
  fish: '🐟',
  celery: '🥬',
  mustard: '🟡',
  lupin: '🌸',
  molluscs: '🦪',
  sulphites: '🍷',
};

export default function ProductDietary({
  className,
}: ProductDietaryProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const [selectedDietary, setSelectedDietary] = useState<Record<string, boolean>>({});
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

  // Watch dietary values
  const watchedDietary = watch('isDietary') || {};
  const watchedAllergens = watch('allergens') || [];

  useEffect(() => {
    setSelectedDietary(watchedDietary);
  }, [watchedDietary]);

  useEffect(() => {
    setSelectedAllergens(watchedAllergens);
  }, [watchedAllergens]);

  const toggleDietary = (key: string) => {
    const currentValue = watch(`isDietary.${key}`) || false;
    setValue(`isDietary.${key}`, !currentValue);
  };

  const toggleAllergen = (value: string) => {
    const currentAllergens = watch('allergens') || [];
    if (currentAllergens.includes(value)) {
      setValue('allergens', currentAllergens.filter((a) => a !== value));
    } else {
      setValue('allergens', [...currentAllergens, value]);
    }
  };

  const selectedCount = Object.values(selectedDietary).filter(Boolean).length;

  return (
    <FormGroup
      title="Dietary & Allergen Information"
      description="Specify dietary properties and allergen warnings"
      className={cn(className)}
    >
      <motion.div
        className="grid w-full gap-6 @2xl:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Dietary Properties */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Leaf className="h-4 w-4 text-green-500" />
              Dietary Properties
              {selectedCount > 0 && (
                <Badge color="success" className="ml-auto text-xs">
                  {selectedCount} selected
                </Badge>
              )}
            </label>

            <motion.div
              className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-5"
              variants={staggerContainer}
            >
              {dietaryOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedDietary[option.key] || false;

                return (
                  <motion.button
                    key={option.key}
                    type="button"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleDietary(option.key)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200',
                      isSelected
                        ? option.color
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'text-gray-400'
                      )}
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-current"
                      >
                        <Check className="h-3 w-3 text-white" />
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </motion.div>

        {/* Allergens */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Contains Allergens
              <Tooltip content="Select all allergens present in this product for customer safety">
                <Info className="h-4 w-4 cursor-help text-gray-400" />
              </Tooltip>
              {selectedAllergens.length > 0 && (
                <Badge color="danger" className="ml-auto text-xs">
                  {selectedAllergens.length} allergens
                </Badge>
              )}
            </label>

            <motion.div className="flex flex-wrap gap-2" variants={staggerContainer}>
              {allergensList.map((allergen) => {
                const isSelected = selectedAllergens.includes(allergen.value);
                const icon = allergenIcons[allergen.value] || '⚠️';

                return (
                  <motion.button
                    key={allergen.value}
                    type="button"
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleAllergen(allergen.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-sm font-medium transition-all duration-200',
                      isSelected
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-red-200 hover:bg-red-50/50'
                    )}
                  >
                    <span>{icon}</span>
                    <span>{allergen.label}</span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500"
                      >
                        <Check className="h-3 w-3 text-white" />
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>

            {selectedAllergens.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3"
              >
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Allergen Warning:</span>
                </div>
                <p className="mt-1 text-sm text-red-600">
                  This product contains: {selectedAllergens.map(a => 
                    allergensList.find(al => al.value === a)?.label
                  ).join(', ')}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Nutritional Information */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Scale className="h-4 w-4 text-blue-500" />
              Nutritional Information
              <span className="text-xs font-normal text-gray-500">(per serving)</span>
            </label>

            <motion.div
              className="grid gap-4 @md:grid-cols-2 @lg:grid-cols-4"
              variants={staggerContainer}
            >
              {/* Calories */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">🔥</span>
                  Calories (kcal)
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 95"
                  {...register('nutritionalInfo.calories', { valueAsNumber: true })}
                />
              </motion.div>

              {/* Carbs */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">🍞</span>
                  Carbohydrates (g)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g., 2.5"
                  {...register('nutritionalInfo.carbohydrates', { valueAsNumber: true })}
                />
              </motion.div>

              {/* Sugar */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">🍯</span>
                  Sugar (g)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g., 0.5"
                  {...register('nutritionalInfo.sugar', { valueAsNumber: true })}
                />
              </motion.div>

              {/* Protein */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">🥩</span>
                  Protein (g)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g., 0.3"
                  {...register('nutritionalInfo.protein', { valueAsNumber: true })}
                />
              </motion.div>

              {/* Fat */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">🧈</span>
                  Fat (g)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g., 0"
                  {...register('nutritionalInfo.fat', { valueAsNumber: true })}
                />
              </motion.div>

              {/* Sodium */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">🧂</span>
                  Sodium (mg)
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 10"
                  {...register('nutritionalInfo.sodium', { valueAsNumber: true })}
                />
              </motion.div>

              {/* Caffeine */}
              <motion.div variants={itemVariants}>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <span className="text-lg">☕</span>
                  Caffeine (mg)
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 80"
                  {...register('nutritionalInfo.caffeine', { valueAsNumber: true })}
                />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
