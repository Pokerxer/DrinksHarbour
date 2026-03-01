// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Input, Button, Text, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import FormGroup from '@/app/shared/form-group';
import { useFormContext } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiTagBold,
  PiXBold,
  PiSparkle,
  PiSpinner,
  PiWine,
  PiBeerBottle,
  PiCoffee,
  PiLeaf,
  PiFire,
  PiSnowflake,
  PiStar,
  PiTrendUp,
  PiGlobe,
  PiCertificate,
  PiHeart,
  PiLightning,
  PiEraser,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import toast from 'react-hot-toast';

// Tag category presets for beverages
const tagPresets = {
  type: {
    label: 'Beverage Type',
    icon: PiWine,
    color: 'bg-purple-500',
    tags: ['Wine', 'Beer', 'Spirit', 'Whiskey', 'Vodka', 'Gin', 'Rum', 'Tequila', 'Cocktail', 'Mocktail'],
  },
  flavor: {
    label: 'Flavor Profile',
    icon: PiCoffee,
    color: 'bg-amber-500',
    tags: ['Sweet', 'Dry', 'Bitter', 'Fruity', 'Spicy', 'Smoky', 'Floral', 'Herbal', 'Citrus', 'Woody'],
  },
  occasion: {
    label: 'Occasion',
    icon: PiStar,
    color: 'bg-pink-500',
    tags: ['Party', 'Celebration', 'Dinner', 'Gift', 'Wedding', 'Birthday', 'Holiday', 'Casual', 'Premium'],
  },
  dietary: {
    label: 'Dietary',
    icon: PiLeaf,
    color: 'bg-green-500',
    tags: ['Organic', 'Vegan', 'Gluten-Free', 'Sugar-Free', 'Low-Calorie', 'Natural', 'Non-GMO'],
  },
  temperature: {
    label: 'Serving',
    icon: PiSnowflake,
    color: 'bg-blue-500',
    tags: ['Chilled', 'Room Temp', 'On Ice', 'Warm', 'Hot', 'Frozen'],
  },
  trending: {
    label: 'Trending',
    icon: PiTrendUp,
    color: 'bg-red-500',
    tags: ['Best Seller', 'New Arrival', 'Limited Edition', 'Staff Pick', 'Popular', 'Award Winner'],
  },
  origin: {
    label: 'Origin',
    icon: PiGlobe,
    color: 'bg-indigo-500',
    tags: ['French', 'Italian', 'Spanish', 'American', 'Japanese', 'Scottish', 'Irish', 'Mexican'],
  },
};

export default function ProductTags({ className }: { className?: string }) {
  const { data: session } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { watch } = useFormContext();
  const tags = watch('tags') || [];

  return (
    <FormGroup
      title="Product Tags"
      description="Add tags to help customers find your product"
      className={cn(className)}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-full space-y-6"
      >
        {/* Header with gradient and summary */}
        <div className="relative overflow-hidden rounded-xl border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 via-white to-pink-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-pink-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 text-white shadow-lg">
                <PiTagBold className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Tag Manager</Text>
                <Text className="text-xs text-gray-500">
                  {tags.length} tag{tags.length !== 1 ? 's' : ''} added
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {tags.length > 0 && (
                <Badge variant="flat" color="success" className="font-medium">
                  {tags.length} Active
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* AI Auto-generate button */}
        <AutoGenerateTags
          isGenerating={isGenerating}
          setIsGenerating={setIsGenerating}
        />

        {/* Tag Category Presets */}
        <div className="space-y-3">
          <Text className="text-sm font-medium text-gray-700">Quick Add by Category</Text>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tagPresets).map(([key, category]) => {
              const Icon = category.icon;
              const isActive = activeCategory === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(isActive ? null : key)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:bg-purple-50/50'
                  )}
                >
                  <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', category.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {category.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Expanded Category Tags */}
        <AnimatePresence mode="wait">
          {activeCategory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <CategoryTagSelector
                category={tagPresets[activeCategory]}
                categoryKey={activeCategory}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Tag Input */}
        <ItemCrud name="Tag" />

        {/* Current Tags Display */}
        <CurrentTagsDisplay />
      </motion.div>
    </FormGroup>
  );
}

function CategoryTagSelector({ category, categoryKey }: { category: typeof tagPresets[keyof typeof tagPresets]; categoryKey: string }) {
  const { watch, setValue } = useFormContext();
  const currentTags: string[] = watch('tags') || [];
  const Icon = category.icon;

  const toggleTag = (tag: string) => {
    if (currentTags.includes(tag)) {
      setValue('tags', currentTags.filter((t) => t !== tag));
    } else {
      setValue('tags', [...currentTags, tag]);
    }
  };

  const addAllTags = () => {
    const newTags = category.tags.filter((tag) => !currentTags.includes(tag));
    setValue('tags', [...currentTags, ...newTags]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-purple-200 bg-purple-50/50 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white', category.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <Text className="font-medium text-gray-800">{category.label} Tags</Text>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addAllTags}
          className="text-xs"
        >
          Add All
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {category.tags.map((tag) => {
          const isSelected = currentTags.includes(tag);
          return (
            <motion.button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-all',
                isSelected
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-purple-100 border border-gray-200'
              )}
            >
              {isSelected && <span className="mr-1">✓</span>}
              {tag}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function AutoGenerateTags({ isGenerating, setIsGenerating }: { isGenerating: boolean; setIsGenerating: (v: boolean) => void }) {
  const { watch, setValue } = useFormContext();
  const { data: session } = useSession();
  const productName = watch('name') || '';
  const productType = watch('type') || '';

  const handleAutoGenerate = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }

    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating tags with AI...', { id: 'ai-tags' });

    try {
      const response = await geminiService.generateTags(
        productName,
        session.user.token,
        productType
      );

      const data = response.data;
      const tags = data.tags || [];

      setValue('tags', tags);
      toast.success(`Generated ${tags.length} tags!`, { id: 'ai-tags' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate tags', { id: 'ai-tags' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="flex items-center justify-between rounded-lg border border-dashed border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 p-3"
    >
      <div className="flex items-center gap-2">
        <PiSparkle className="h-5 w-5 text-purple-500" />
        <div>
          <Text className="text-sm font-medium text-gray-800">AI Tag Generator</Text>
          <Text className="text-xs text-gray-500">Generate relevant tags automatically</Text>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="solid"
        color="primary"
        disabled={!productName || productName.length < 3 || isGenerating}
        onClick={handleAutoGenerate}
        className="gap-1.5"
      >
        {isGenerating ? (
          <>
            <PiSpinner className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <PiSparkle className="h-4 w-4" />
            Generate Tags
          </>
        )}
      </Button>
    </motion.div>
  );
}

function ItemCrud({ name }: { name: string }) {
  const { register, setValue, watch } = useFormContext();
  const [itemText, setItemText] = useState<string>('');
  const currentTags: string[] = watch('tags') || [];

  function handleItemAdd(): void {
    if (itemText.trim() !== '' && !currentTags.includes(itemText.trim())) {
      const newTag = itemText.trim();
      setValue('tags', [...currentTags, newTag]);
      setItemText('');
      toast.success(`Added tag: ${newTag}`);
    } else if (currentTags.includes(itemText.trim())) {
      toast.error('Tag already exists');
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleItemAdd();
    }
  };

  return (
    <div className="space-y-2">
      <Text className="text-sm font-medium text-gray-700">Add Custom Tag</Text>
      <div className="flex items-center gap-3">
        <Input
          value={itemText}
          placeholder="Enter a custom tag..."
          onChange={(e) => setItemText(e.target.value)}
          onKeyPress={handleKeyPress}
          prefix={<PiTagBold className="h-4 w-4 text-gray-400" />}
          className="flex-grow"
        />
        <input type="hidden" {...register('tags', { value: currentTags })} />
        <Button
          type="button"
          onClick={handleItemAdd}
          disabled={!itemText.trim()}
          className="shrink-0"
        >
          Add {name}
        </Button>
      </div>
    </div>
  );
}

function CurrentTagsDisplay() {
  const { watch, setValue } = useFormContext();
  const currentTags: string[] = watch('tags') || [];

  const handleRemoveTag = (tagToRemove: string) => {
    setValue('tags', currentTags.filter((tag) => tag !== tagToRemove));
  };

  const handleClearAll = () => {
    setValue('tags', []);
    toast.success('All tags cleared');
  };

  if (currentTags.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-8 text-center"
      >
        <PiTagBold className="mb-2 h-8 w-8 text-gray-300" />
        <Text className="text-gray-500">No tags added yet</Text>
        <Text className="text-xs text-gray-400">Add tags using the options above</Text>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Text className="text-sm font-medium text-gray-700">
          Current Tags ({currentTags.length})
        </Text>
        <Button
          type="button"
          size="sm"
          variant="text"
          color="danger"
          onClick={handleClearAll}
          className="gap-1 text-xs"
        >
          <PiEraser className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>
      
      <motion.div layout className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {currentTags.map((tag, index) => (
            <motion.div
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.05 }}
              className="group flex items-center gap-1 rounded-full border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 py-1.5 pe-2 ps-3 text-sm font-medium text-purple-700 shadow-sm transition-all hover:shadow-md"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-500 opacity-70 transition-all hover:bg-red-100 hover:text-red-500 hover:opacity-100"
              >
                <PiXBold className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
