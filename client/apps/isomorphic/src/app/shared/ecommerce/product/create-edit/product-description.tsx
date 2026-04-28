// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Textarea, Input, Text, Badge, Tooltip, Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import { flavorProfiles } from './form-utils';
import FormGroup from '@/app/shared/form-group';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
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
import { PiSparkle, PiSpinner } from 'react-icons/pi';
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
    transition: { staggerChildren: 0.05 },
  },
};

const flavorData: Record<string, { color: string; icon: string }> = {
  sweet:     { color: 'bg-pink-100 text-pink-700 border-pink-200',     icon: '🍯' },
  dry:       { color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: '🏜️' },
  fruity:    { color: 'bg-orange-100 text-orange-700 border-orange-200',icon: '🍓' },
  floral:    { color: 'bg-purple-100 text-purple-700 border-purple-200',icon: '🌸' },
  spicy:     { color: 'bg-red-100 text-red-700 border-red-200',         icon: '🌶️' },
  smoky:     { color: 'bg-gray-100 text-gray-700 border-gray-200',      icon: '🔥' },
  oaky:      { color: 'bg-yellow-100 text-yellow-700 border-yellow-200',icon: '🪵' },
  vanilla:   { color: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: '🍦' },
  caramel:   { color: 'bg-amber-50 text-amber-800 border-amber-200',    icon: '🍮' },
  chocolate: { color: 'bg-stone-100 text-stone-700 border-stone-200',   icon: '🍫' },
  nutty:     { color: 'bg-orange-50 text-orange-800 border-orange-200', icon: '🥜' },
  citrus:    { color: 'bg-lime-100 text-lime-700 border-lime-200',      icon: '🍋' },
  herbal:    { color: 'bg-green-100 text-green-700 border-green-200',   icon: '🌿' },
  earthy:    { color: 'bg-stone-50 text-stone-600 border-stone-200',    icon: '🍄' },
  peaty:     { color: 'bg-stone-200 text-stone-800 border-stone-300',   icon: '🌱' },
  salty:     { color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: '🧂' },
  bitter:    { color: 'bg-teal-100 text-teal-700 border-teal-200',      icon: '☕' },
  tangy:     { color: 'bg-rose-100 text-rose-700 border-rose-200',      icon: '🍊' },
  rich:      { color: 'bg-amber-100 text-amber-800 border-amber-200',   icon: '✨' },
  light:     { color: 'bg-sky-100 text-sky-700 border-sky-200',         icon: '☁️' },
};

// Small inline sparkle button used next to each field label
function AiBtn({
  field,
  generating,
  onClick,
}: {
  field: string;
  generating: string | null;
  onClick: () => void;
}) {
  const isLoading = generating === field;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!generating}
      title="Generate with AI"
      className={cn(
        'ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        isLoading
          ? 'cursor-not-allowed text-gray-400'
          : 'text-violet-600 hover:bg-violet-50 hover:text-violet-700'
      )}
    >
      {isLoading ? (
        <PiSpinner className="h-3 w-3 animate-spin" />
      ) : (
        <PiSparkle className="h-3 w-3" />
      )}
      {isLoading ? 'Generating…' : 'AI'}
    </button>
  );
}

export default function ProductDescription({ className }: ProductDescriptionProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  // tracks which individual field is being generated
  const [generating, setGenerating] = useState<string | null>(null);

  const shortDescription = watch('shortDescription') || '';
  const description      = watch('description') || '';
  const productName      = watch('name') || '';
  const productType      = watch('type');
  const productBrand     = watch('brand');

  const watchedFlavors = watch('flavorProfile') || [];
  useEffect(() => { setSelectedFlavors(watchedFlavors); }, [watchedFlavors]);

  const toggleFlavor = (flavor: string) => {
    const current = watch('flavorProfile') || [];
    setValue(
      'flavorProfile',
      current.includes(flavor) ? current.filter((f) => f !== flavor) : [...current, flavor]
    );
  };

  const token = session?.user?.token;

  // Guard for all AI calls
  const requireName = () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return false;
    }
    if (!token) {
      toast.error('Please sign in to use AI features');
      return false;
    }
    return true;
  };

  // ── Fill all descriptions at once ──────────────────────────────────────────
  const handleFillAll = async () => {
    if (!requireName()) return;
    setIsGeneratingAll(true);
    toast.loading('Generating all descriptions with AI…', { id: 'ai-all' });
    try {
      const res = await geminiService.generateDescription(productName, token, productType, productBrand);
      const d = res.data;
      setValue('shortDescription', d.shortDescription || '');
      setValue('description', d.description || '');
      setValue('flavorProfile', d.flavorProfile || []);
      setValue('foodPairings', d.foodPairings || []);
      toast.success('Descriptions generated!', { id: 'ai-all' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate', { id: 'ai-all' });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // ── Per-field helpers ───────────────────────────────────────────────────────
  const gen = async (field: string, fn: () => Promise<void>) => {
    if (!requireName()) return;
    setGenerating(field);
    try {
      await fn();
      toast.success('Generated!');
    } catch (err: any) {
      toast.error(err.message || 'AI generation failed');
    } finally {
      setGenerating(null);
    }
  };

  const genShortDesc = () =>
    gen('shortDescription', async () => {
      const res = await geminiService.generateShortDescription(productName, token, productType, productBrand);
      setValue('shortDescription', res.data.shortDescription || '');
    });

  const genFullDesc = () =>
    gen('description', async () => {
      const res = await geminiService.generateFullDescription(
        productName, token, productType, productBrand, watch('originCountry')
      );
      setValue('description', res.data.description || '');
    });

  const genFlavorProfile = () =>
    gen('flavorProfile', async () => {
      const res = await geminiService.generateFlavorProfile(productName, token, productType);
      setValue('flavorProfile', res.data.flavorProfile || []);
    });

  const genNose = () =>
    gen('nose', async () => {
      const res = await geminiService.generateTastingNose(productName, token, productType, watch('flavorProfile'));
      const val = res.data.nose;
      setValue('tastingNotes.nose', Array.isArray(val) ? val.join(', ') : val || '');
    });

  const genPalate = () =>
    gen('palate', async () => {
      const res = await geminiService.generateTastingPalate(productName, token, productType, watch('flavorProfile'));
      const val = res.data.palate;
      setValue('tastingNotes.palate', Array.isArray(val) ? val.join(', ') : val || '');
    });

  const genFinish = () =>
    gen('finish', async () => {
      const res = await geminiService.generateTastingFinish(productName, token, productType);
      const val = res.data.finish;
      setValue('tastingNotes.finish', Array.isArray(val) ? val.join(', ') : val || '');
    });

  const genColor = () =>
    gen('color', async () => {
      const res = await geminiService.generateTastingColor(productName, token, productType, watch('age'));
      setValue('tastingNotes.color', res.data.color || '');
    });

  const genFoodPairings = () =>
    gen('foodPairings', async () => {
      const res = await geminiService.generateFoodPairings(productName, token, productType, watch('flavorProfile'));
      const val = res.data.foodPairings;
      setValue('foodPairings', Array.isArray(val) ? val.join(', ') : val || '');
    });

  const genTemperature = () =>
    gen('temperature', async () => {
      const res = await geminiService.generateServingTemperature(productName, token, productType);
      setValue('servingSuggestions.temperature', res.data.temperature || '');
    });

  const genGlassware = () =>
    gen('glassware', async () => {
      const res = await geminiService.generateGlassware(productName, token, productType);
      setValue('servingSuggestions.glassware', res.data.glassware || '');
    });

  const genGarnish = () =>
    gen('garnish', async () => {
      const res = await geminiService.generateGarnish(productName, token, productType);
      const val = res.data.garnish;
      setValue('servingSuggestions.garnish', Array.isArray(val) ? val.join(', ') : val || '');
    });

  const genIngredients = () =>
    gen('ingredients', async () => {
      const res = await geminiService.generateIngredients(productName, token, productType);
      const val = res.data.ingredients;
      setValue('ingredients', Array.isArray(val) ? val.join(', ') : val || '');
    });

  const shortDescLength = shortDescription.length;
  const descriptionLength = description.length;

  return (
    <FormGroup
      title="Description & Tasting Notes"
      description="Detailed product information and tasting profile"
      className={cn(className)}
    >
      {/* Fill-all button */}
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          color="primary"
          disabled={!productName || productName.length < 3 || isGeneratingAll || !!generating}
          onClick={handleFillAll}
          className="gap-1"
        >
          {isGeneratingAll ? (
            <><PiSpinner className="h-3 w-3 animate-spin" /> Generating…</>
          ) : (
            <><PiSparkle className="h-3 w-3" /> Auto-fill with AI</>
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
              <Badge color={shortDescLength > 200 ? 'warning' : 'success'} className="ml-2 text-xs">
                {shortDescLength}/280
              </Badge>
              <AiBtn field="shortDescription" generating={generating} onClick={genShortDesc} />
            </label>
            <Textarea
              placeholder="Brief, compelling product description for cards and previews…"
              maxLength={280}
              {...register('shortDescription')}
              className="min-h-[100px] resize-none"
            />
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    shortDescLength > 250 ? 'bg-red-500' : shortDescLength > 200 ? 'bg-amber-500' : 'bg-green-500'
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
              <Badge color="secondary" className="ml-2 text-xs">
                {descriptionLength} chars
              </Badge>
              <AiBtn field="description" generating={generating} onClick={genFullDesc} />
            </label>
            <Textarea
              placeholder="Detailed product description including history, production process, unique characteristics…"
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
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({selectedFlavors.length} selected)
              </span>
              <AiBtn field="flavorProfile" generating={generating} onClick={genFlavorProfile} />
            </label>
            <motion.div className="flex flex-wrap gap-2" variants={staggerContainer}>
              {flavorProfiles.map((flavor) => {
                const isSelected = selectedFlavors.includes(flavor);
                const info = flavorData[flavor] || { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '✨' };
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
                      isSelected ? info.color : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    )}
                  >
                    <span>{info.icon}</span>
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
                  <AiBtn field="nose" generating={generating} onClick={genNose} />
                </label>
                <Input
                  placeholder="e.g., Vanilla, Oak, Honey…"
                  {...register('tastingNotes.nose')}
                  className="bg-white"
                />
              </div>

              {/* Palate */}
              <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-rose-50 to-pink-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
                  <span className="text-lg">👅</span>
                  Palate / Taste
                  <AiBtn field="palate" generating={generating} onClick={genPalate} />
                </label>
                <Input
                  placeholder="e.g., Smooth, Caramel, Spicy…"
                  {...register('tastingNotes.palate')}
                  className="bg-white"
                />
              </div>

              {/* Finish */}
              <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-800">
                  <span className="text-lg">✨</span>
                  Finish
                  <AiBtn field="finish" generating={generating} onClick={genFinish} />
                </label>
                <Input
                  placeholder="e.g., Long, Warm, Sweet…"
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
                <AiBtn field="color" generating={generating} onClick={genColor} />
              </label>
              <Input
                placeholder="e.g., Golden Amber, Pale Straw, Deep Ruby…"
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
              <AiBtn field="foodPairings" generating={generating} onClick={genFoodPairings} />
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

        {/* Serving Temperature */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Thermometer className="h-4 w-4 text-blue-500" />
              Serving Temperature
              <AiBtn field="temperature" generating={generating} onClick={genTemperature} />
            </label>
            <Input
              placeholder="e.g., Chilled (4-6°C), Room Temperature, Cellar (12-14°C)"
              {...register('servingSuggestions.temperature')}
            />
          </div>
        </motion.div>

        {/* Glassware */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <GlassWater className="h-4 w-4 text-cyan-500" />
              Recommended Glassware
              <AiBtn field="glassware" generating={generating} onClick={genGlassware} />
            </label>
            <Input
              placeholder="e.g., Tumbler, Wine Glass, Champagne Flute, Glencairn"
              {...register('servingSuggestions.glassware')}
            />
          </div>
        </motion.div>

        {/* Garnish */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Leaf className="h-4 w-4 text-emerald-500" />
              Suggested Garnish
              <AiBtn field="garnish" generating={generating} onClick={genGarnish} />
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
              <AiBtn field="ingredients" generating={generating} onClick={genIngredients} />
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
