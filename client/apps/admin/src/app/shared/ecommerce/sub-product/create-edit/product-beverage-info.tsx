// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Checkbox, Text, Tooltip, Badge, Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import { standardSizes } from './form-utils';
import FormGroup from '@/app/shared/form-group';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, Fragment } from 'react';
import {
  Wine,
  Droplets,
  Scale,
  Box,
  GlassWater,
  Calculator,
  Info,
} from 'lucide-react';
import { PiSparkle, PiSpinner } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import toast from 'react-hot-toast';

interface ProductBeverageInfoProps {
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

export default function ProductBeverageInfo({
  className,
}: ProductBeverageInfoProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const isAlcoholic = watch('isAlcoholic');
  const abv = watch('abv');
  const proof = watch('proof');
  const productName = watch('name') || '';
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-calculate proof from ABV
  const handleAbvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setValue('abv', value);
    if (isAlcoholic && value) {
      setValue('proof', parseFloat((value * 2).toFixed(1)));
    }
  };

  // Update selected sizes for visual feedback
  const watchedSizes = watch('standardSizes') || [];
  useEffect(() => {
    setSelectedSizes(watchedSizes);
  }, [watchedSizes]);

  // Handle size selection
  const toggleSize = (sizeValue: string) => {
    const currentSizes = watch('standardSizes') || [];
    if (currentSizes.includes(sizeValue)) {
      setValue(
        'standardSizes',
        currentSizes.filter((s) => s !== sizeValue)
      );
    } else {
      setValue('standardSizes', [...currentSizes, sizeValue]);
    }
  };

  // Auto-fill beverage info with AI
  const handleAutoFill = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }

    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating beverage details with AI...', { id: 'ai-beverage' });

    try {
      const response = await geminiService.generateBeverageInfo(
        productName,
        session.user.token,
        watch('type')
      );

      const data = response.data;

      setValue('isAlcoholic', data.isAlcoholic ?? true);
      setValue('abv', data.abv);
      setValue('volumeMl', data.volumeMl);
      setValue('proof', data.proof);
      setValue('standardSizes', data.standardSizes || []);

      toast.success('Beverage details generated!', { id: 'ai-beverage' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      const errorMessage = error.message || 'Failed to generate beverage details';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('connect')) {
        toast.error('Cannot connect to server. Make sure backend is running.', { id: 'ai-beverage' });
      } else {
        toast.error(errorMessage, { id: 'ai-beverage' });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <FormGroup
      title="Beverage Information"
      description="Specify the beverage-specific attributes"
      className={cn(className)}
    >
      {/* AI Auto-fill Button */}
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          color="primary"
          disabled={!productName || productName.length < 3 || isGenerating}
          onClick={handleAutoFill}
          className="gap-1"
        >
          {isGenerating ? (
            <>
              <PiSpinner className="h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <PiSparkle className="h-3 w-3" />
              Auto-fill with AI
            </>
          )}
        </Button>
      </div>

      <motion.div
        className="grid w-full gap-6 @2xl:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Is Alcoholic - Enhanced Card */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <motion.label
            className={cn(
              'flex cursor-pointer items-center gap-4 rounded-xl border-2 p-5 transition-all duration-300',
              isAlcoholic
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
                isAlcoholic ? 'bg-amber-500 text-white' : 'bg-gray-100'
              )}
            >
              <Wine className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <span className="block text-base font-semibold text-gray-900">
                This is an alcoholic beverage
              </span>
              <span className="block text-sm text-gray-500">
                Check this if the product contains alcohol. Age verification will
                be required.
              </span>
            </div>
            <Checkbox
              {...register('isAlcoholic')}
              onChange={(e) => {
                setValue('isAlcoholic', e.target.checked);
                if (!e.target.checked) {
                  setValue('abv', undefined);
                  setValue('proof', undefined);
                }
              }}
              className="h-6 w-6"
            />
          </motion.label>
        </motion.div>

        {/* ABV with Slider */}
        <AnimatePresence mode="wait">
          {isAlcoholic && (
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, height: 0 }}
              className="@2xl:col-span-2"
            >
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    ABV (Alcohol By Volume) %
                  </label>
                  <Tooltip content="Alcohol By Volume percentage">
                    <Info className="h-4 w-4 cursor-help text-gray-400" />
                  </Tooltip>
                </div>

                {/* ABV Slider */}
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={abv || 0}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setValue('abv', value);
                      setValue('proof', parseFloat((value * 2).toFixed(1)));
                    }}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                  />
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* ABV Input */}
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g., 40"
                    {...register('abv', { valueAsNumber: true })}
                    onChange={handleAbvChange}
                    error={errors.abv?.message}
                    className="flex-1"
                  />
                  <span className="text-lg font-semibold text-gray-900">
                    {abv?.toFixed(1) || '0.0'}%
                  </span>
                </div>

                {/* Strength Indicator */}
                {abv > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3"
                  >
                    <Badge
                      color={
                        abv < 15
                          ? 'success'
                          : abv < 40
                            ? 'warning'
                            : 'danger'
                      }
                      className="text-xs"
                    >
                      {abv < 15
                        ? '🍺 Light / Session'
                        : abv < 40
                          ? '🍷 Moderate Strength'
                          : '🔥 High Proof / Spirit'}
                    </Badge>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proof - Auto-calculated */}
        <AnimatePresence mode="wait">
          {isAlcoholic && (
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Calculator className="h-4 w-4 text-purple-500" />
                  Proof (US)
                  <Badge color="secondary" className="text-xs">
                    Auto
                  </Badge>
                </label>

                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="200"
                    placeholder="Auto-calculated"
                    disabled={true}
                    {...register('proof', { valueAsNumber: true })}
                    className="flex-1 bg-gray-100"
                  />
                  <span className="text-lg font-semibold text-gray-500">
                    {proof?.toFixed(1) || '--'}
                  </span>
                </div>

                <Text className="mt-2 text-xs text-gray-500">
                  Automatically calculated (ABV × 2)
                </Text>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Volume */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Scale className="h-4 w-4 text-indigo-500" />
              Volume (ml)
            </label>

            <Input
              type="number"
              min="1"
              placeholder="e.g., 750"
              {...register('volumeMl', { valueAsNumber: true })}
              error={errors.volumeMl?.message}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Standard bottle sizes: 200ml, 375ml, 750ml, 1000ml, 1750ml
            </Text>
          </div>
        </motion.div>

        {/* Sub Type */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 text-sm font-semibold text-gray-900">
              Sub Type
            </label>

            <Input
              placeholder="e.g., Single Malt, Blended, IPA, Cabernet"
              {...register('subType')}
              error={errors.subType?.message}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Specific classification within the product category
            </Text>
          </div>
        </motion.div>

        {/* Standard Sizes - Visual Grid */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Box className="h-4 w-4 text-emerald-500" />
              Available Bottle Sizes
              <span className="text-xs font-normal text-gray-500">
                ({selectedSizes.length} selected)
              </span>
            </label>

            <motion.div
              className="grid grid-cols-2 gap-3 @md:grid-cols-4 @lg:grid-cols-6"
              variants={staggerContainer}
            >
              {standardSizes.map((size, index) => (
                <motion.button
                  key={size.value}
                  type="button"
                  variants={itemVariants}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSize(size.value)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200',
                    selectedSizes.includes(size.value)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-lg',
                      selectedSizes.includes(size.value)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {size.label.split(' ')[0]}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      selectedSizes.includes(size.value)
                        ? 'text-blue-700'
                        : 'text-gray-700'
                    )}
                  >
                    {size.label}
                  </span>
                  {selectedSizes.includes(size.value) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500"
                    >
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Serving Size */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <GlassWater className="h-4 w-4 text-cyan-500" />
              Serving Size
            </label>

            <Input
              placeholder="e.g., 1 shot (44ml), 5oz pour"
              {...register('servingSize')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Recommended single serving amount
            </Text>
          </div>
        </motion.div>

        {/* Servings Per Container */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 text-sm font-semibold text-gray-900">
              Servings Per Container
            </label>

            <Input
              type="number"
              min="1"
              placeholder="e.g., 17"
              {...register('servingsPerContainer', { valueAsNumber: true })}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Calculated from volume and serving size
            </Text>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
