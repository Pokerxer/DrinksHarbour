// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Textarea, Input, Text, Badge, Tooltip, Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import { flavorProfiles } from './form-utils';
import FormGroup from '@/app/shared/form-group';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, Fragment } from 'react';
import {
  FileText,
  AlignLeft,
  Sparkles,
  Flower2,
  ChefHat,
  Thermometer,
  GlassWater,
  Leaf,
  List,
  Info,
  Check,
} from 'lucide-react';
import { PiSparkle, PiSpinner, PiCheck } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import toast from 'react-hot-toast';

interface ProductDescriptionProps {
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

// Flavor profile colors and icons
const flavorData: Record<string, { color: string; icon: string }> = {
  sweet: { color: 'bg-pink-100 text-pink-700 border-pink-200', icon: '🍯' },
  dry: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🏜️' },
  fruity: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🍓' },
  floral: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '🌸' },
  spicy: { color: 'bg-red-100 text-red-700 border-red-200', icon: '🌶️' },
  smoky: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '🔥' },
  oaky: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '🪵' },
  vanilla: { color: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: '🍦' },
  caramel: { color: 'bg-amber-50 text-amber-800 border-amber-200', icon: '🍮' },
  chocolate: { color: 'bg-stone-100 text-stone-700 border-stone-200', icon: '🍫' },
  nutty: { color: 'bg-orange-50 text-orange-800 border-orange-200', icon: '🥜' },
  citrus: { color: 'bg-lime-100 text-lime-700 border-lime-200', icon: '🍋' },
  herbal: { color: 'bg-green-100 text-green-700 border-green-200', icon: '🌿' },
  earthy: { color: 'bg-stone-50 text-stone-600 border-stone-200', icon: '🍄' },
  peaty: { color: 'bg-stone-200 text-stone-800 border-stone-300', icon: '🌱' },
  salty: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🧂' },
  bitter: { color: 'bg-teal-100 text-teal-700 border-teal-200', icon: '☕' },
  tangy: { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: '🍊' },
  rich: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: '✨' },
  light: { color: 'bg-sky-100 text-sky-700 border-sky-200', icon: '☁️' },
};

export default function ProductDescription({
  className,
}: ProductDescriptionProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const shortDescription = watch('shortDescription') || '';
  const description = watch('description') || '';
  const productName = watch('name') || '';

  const watchedFlavors = watch('flavorProfile') || [];
  useEffect(() => {
    setSelectedFlavors(watchedFlavors);
  }, [watchedFlavors]);

  const toggleFlavor = (flavor: string) => {
    const currentFlavors = watch('flavorProfile') || [];
    if (currentFlavors.includes(flavor)) {
      setValue('flavorProfile', currentFlavors.filter((f) => f !== flavor));
    } else {
      setValue('flavorProfile', [...currentFlavors, flavor]);
    }
  };

  const shortDescLength = shortDescription.length;
  const descriptionLength = description.length;

  // Auto-fill descriptions with AI
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
    toast.loading('Generating descriptions with AI...', { id: 'ai-desc' });

    try {
      const response = await geminiService.generateDescription(
        productName,
        session.user.token,
        watch('type'),
        watch('brand')
      );

      const data = response.data;

      setValue('shortDescription', data.shortDescription || '');
      setValue('description', data.description || '');
      setValue('flavorProfile', data.flavorProfile || []);
      setValue('foodPairings', data.foodPairings || []);

      toast.success('Descriptions generated successfully!', { id: 'ai-desc' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      const errorMessage = error.message || 'Failed to generate descriptions';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('connect')) {
        toast.error('Cannot connect to server. Make sure backend is running on port 5001.', { id: 'ai-desc' });
      } else {
        toast.error(errorMessage, { id: 'ai-desc' });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <FormGroup
      title="Description & Tasting Notes"
      description="Detailed product information and tasting profile"
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
        {/* Short Description */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <FileText className="h-4 w-4 text-blue-500" />
              Short Description
              <Badge
                color={shortDescLength > 200 ? 'warning' : 'success'}
                className="ml-auto text-xs"
              >
                {shortDescLength}/280
              </Badge>
            </label>

            <Textarea
              placeholder="Brief, compelling product description for cards and previews..."
              maxLength={280}
              {...register('shortDescription')}
              className="min-h-[100px] resize-none"
            />

            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    shortDescLength > 250
                      ? 'bg-red-500'
                      : shortDescLength > 200
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${(shortDescLength / 280) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <Text className="mt-1 text-xs text-gray-500">
                Used for product cards, search results, and social sharing
              </Text>
            </div>
          </div>
        </motion.div>

        {/* Full Description */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <AlignLeft className="h-4 w-4 text-indigo-500" />
              Full Description
              <Badge color="secondary" className="ml-auto text-xs">
                {descriptionLength} chars
              </Badge>
            </label>

            <Textarea
              placeholder="Detailed product description including history, production process, unique characteristics..."
              maxLength={5000}
              {...register('description')}
              className="min-h-[250px] resize-y"
            />

            <Text className="mt-2 text-xs text-gray-500">
              Comprehensive product story, production details, and unique selling points
            </Text>
          </div>
        </motion.div>

        {/* Flavor Profile */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Flavor Profile
              <span className="ml-auto text-xs font-normal text-gray-500">
                ({selectedFlavors.length} selected)
              </span>
            </label>

            <motion.div className="flex flex-wrap gap-2" variants={staggerContainer}>
              {flavorProfiles.map((flavor) => {
                const isSelected = selectedFlavors.includes(flavor);
                const flavorInfo = flavorData[flavor] || {
                  color: 'bg-gray-100 text-gray-700 border-gray-200',
                  icon: '✨',
                };

                return (
                  <motion.button
                    key={flavor}
                    type="button"
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleFlavor(flavor)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-sm font-medium transition-all duration-200',
                      isSelected
                        ? flavorInfo.color
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    )}
                  >
                    <span>{flavorInfo.icon}</span>
                    <span className="capitalize">{flavor.replace(/_/g, ' ')}</span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-current"
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

        {/* Tasting Notes */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Flower2 className="h-4 w-4 text-rose-500" />
              Tasting Notes
              <Tooltip content="Describe the aroma, taste, and finish of the beverage">
                <Info className="h-4 w-4 cursor-help text-gray-400" />
              </Tooltip>
            </label>

            <div className="grid gap-4 @md:grid-cols-3">
              {/* Nose */}
              <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <span className="text-lg">👃</span>
                  Nose / Aroma
                </label>
                <Input
                  placeholder="e.g., Vanilla, Oak, Honey..."
                  {...register('tastingNotes.nose')}
                  className="bg-white"
                />
              </div>

              {/* Palate */}
              <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-rose-50 to-pink-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
                  <span className="text-lg">👅</span>
                  Palate / Taste
                </label>
                <Input
                  placeholder="e.g., Smooth, Caramel, Spicy..."
                  {...register('tastingNotes.palate')}
                  className="bg-white"
                />
              </div>

              {/* Finish */}
              <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-800">
                  <span className="text-lg">✨</span>
                  Finish
                </label>
                <Input
                  placeholder="e.g., Long, Warm, Sweet..."
                  {...register('tastingNotes.finish')}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Color */}
            <div className="mt-4 rounded-lg border border-gray-100 bg-gradient-to-br from-yellow-50 to-amber-50 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <span className="text-lg">🎨</span>
                Color / Appearance
              </label>
              <Input
                placeholder="e.g., Golden Amber, Pale Straw, Deep Ruby..."
                {...register('tastingNotes.color')}
                className="bg-white"
              />
            </div>
          </div>
        </motion.div>

        {/* Food Pairings */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <ChefHat className="h-4 w-4 text-green-600" />
              Food Pairings
            </label>
            <Input
              placeholder="e.g., Grilled Steak, Seafood, Chocolate Desserts, Cheese Board (comma-separated)"
              {...register('foodPairings')}
            />
            <Text className="mt-2 text-xs text-gray-500">
              Suggest complementary foods that pair well with this beverage
            </Text>
          </div>
        </motion.div>

        {/* Serving Suggestions */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Thermometer className="h-4 w-4 text-blue-500" />
              Serving Temperature
            </label>
            <Input
              placeholder="e.g., Chilled (4-6C), Room Temperature, Cellar (12-14C)"
              {...register('servingSuggestions.temperature')}
            />
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <GlassWater className="h-4 w-4 text-cyan-500" />
              Recommended Glassware
            </label>
            <Input
              placeholder="e.g., Tumbler, Wine Glass, Champagne Flute, Glencairn"
              {...register('servingSuggestions.glassware')}
            />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Leaf className="h-4 w-4 text-emerald-500" />
              Suggested Garnish
            </label>
            <Input
              placeholder="e.g., Lemon twist, Orange peel, Mint leaves, Cinnamon stick (comma-separated)"
              {...register('servingSuggestions.garnish')}
            />
          </div>
        </motion.div>

        {/* Ingredients */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <List className="h-4 w-4 text-violet-500" />
              Ingredients
            </label>
            <Textarea
              placeholder="List of ingredients, allergens, and production details (comma-separated or one per line)"
              {...register('ingredients')}
              className="min-h-[120px] resize-y"
            />
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
