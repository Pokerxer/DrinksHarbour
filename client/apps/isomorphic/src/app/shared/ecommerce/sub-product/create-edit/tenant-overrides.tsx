// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Textarea, Text, Switch, Button, Badge } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiSliders, PiTextAa, PiTextAlignLeft, PiTag, PiNote, PiPencil, 
  PiPlus, PiXBold, PiEye, PiCopy, PiSparkle, PiWand
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';

export default function SubProductTenantOverrides() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const shortDescOverride = watch?.('subProductData.shortDescriptionOverride') || '';
  const descriptionOverride = watch?.('subProductData.descriptionOverride') || '';
  const customKeywords = watch?.('subProductData.customKeywords') || [];
  const tenantNotes = watch?.('subProductData.tenantNotes') || '';
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') || 0;
  const costPrice = watch?.('subProductData.costPrice') || 0;

  const [keywordsInput, setKeywordsInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeOverride, setActiveOverride] = useState({
    shortDescription: false,
    description: false,
    keywords: false,
    price: false,
  });

  // Handle keywords input
  const handleKeywordsAdd = () => {
    if (keywordsInput.trim()) {
      const newKeywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k);
      const existingKeywords = Array.isArray(customKeywords) ? customKeywords : [];
      const updated = [...new Set([...existingKeywords, ...newKeywords])];
      setValue('subProductData.customKeywords', updated);
      setKeywordsInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    const existingKeywords = Array.isArray(customKeywords) ? customKeywords : [];
    const updated = existingKeywords.filter(k => k !== keyword);
    setValue('subProductData.customKeywords', updated);
  };

  const handleCopyFromParent = (field: string) => {
    const parentValue = watch?.(`product.${field}`);
    if (parentValue) {
      setValue(`subProductData.${field}Override`, parentValue);
    }
  };

  // Generate AI description
  const handleGenerateDescription = () => {
    const productName = watch?.('product.name') || watch?.('newProductData.name') || 'this product';
    const generatedDesc = `Discover ${productName} - a premium beverage selected for quality and taste. Perfect for any occasion, this product offers exceptional value.`;
    setValue('subProductData.descriptionOverride', generatedDesc);
  };

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
          Customize product information for your tenant catalog without affecting the parent product
        </Text>
      </motion.div>

      {/* Short Description Override */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiTextAa className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Short Description Override</Text>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={() => handleCopyFromParent('shortDescription')}
            >
              <PiCopy className="mr-1 h-4 w-4" />
              Copy from Parent
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Textarea
            placeholder="Enter a custom short description (max 280 characters)"
            maxLength={280}
            {...register('subProductData.shortDescriptionOverride')}
            className="w-full"
            rows={3}
          />
          <div className="mt-1 flex justify-end">
            <Text className="text-xs text-gray-400">
              {shortDescOverride.length}/280
            </Text>
          </div>
        </div>
        <Text className="mt-2 text-xs text-gray-500">
          Override the default short description for your catalog. This appears in product cards and search results.
        </Text>
      </motion.div>

      {/* Description Override */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={2}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiTextAlignLeft className="h-5 w-5 text-purple-500" />
            <Text className="font-medium">Description Override</Text>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={() => handleCopyFromParent('description')}
            >
              <PiCopy className="mr-1 h-4 w-4" />
              Copy from Parent
            </Button>
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={handleGenerateDescription}
            >
              <PiSparkle className="mr-1 h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Textarea
            placeholder="Enter a custom full description (max 5000 characters)"
            maxLength={5000}
            {...register('subProductData.descriptionOverride')}
            className="w-full"
            rows={6}
          />
          <div className="mt-1 flex justify-end">
            <Text className="text-xs text-gray-400">
              {descriptionOverride.length}/5000
            </Text>
          </div>
        </div>
        <Text className="mt-2 text-xs text-gray-500">
          Override the default description for your catalog. This appears on the product detail page.
        </Text>
      </motion.div>

      {/* Custom Keywords */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={3}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <PiTag className="h-5 w-5 text-amber-500" />
          <Text className="font-medium">Custom Keywords</Text>
        </div>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Type keyword and press Enter"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleKeywordsAdd();
                  }
                }}
                className="w-full pl-10"
              />
              <PiTag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleKeywordsAdd}
              disabled={!keywordsInput.trim()}
            >
              <PiPlus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          
          {/* Keywords Display */}
          <div className="flex flex-wrap gap-2">
            {Array.isArray(customKeywords) && customKeywords.map((keyword, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1"
              >
                <span className="text-sm text-blue-700">{keyword}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <PiXBold className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </div>
          
          {(!customKeywords || customKeywords.length === 0) && (
            <Text className="text-sm text-gray-400 italic">
              No custom keywords added yet
            </Text>
          )}
        </div>
        <Text className="mt-2 text-xs text-gray-500">
          Additional keywords for search optimization. These will be combined with parent product keywords.
        </Text>
      </motion.div>

      {/* Tenant Notes */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={4}
        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <PiNote className="h-5 w-5 text-gray-500" />
          <Text className="font-medium">Internal Notes</Text>
        </div>
        
        <Textarea
          placeholder="Internal notes about this product (max 1000 characters)"
          maxLength={1000}
          {...register('subProductData.tenantNotes')}
          className="w-full bg-white"
          rows={4}
        />
        <div className="mt-1 flex justify-between">
          <Text className="text-xs text-gray-500">
            Internal notes visible only to your team
          </Text>
          <Text className="text-xs text-gray-400">
            {tenantNotes.length}/1000
          </Text>
        </div>
      </motion.div>

      {/* Override Summary */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg border border-blue-200 bg-blue-50 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <PiSliders className="h-5 w-5 text-blue-500" />
          <Text className="font-medium">Override Summary</Text>
        </div>
        
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center justify-between rounded-lg bg-white p-3">
            <div>
              <Text className="text-xs text-gray-500">Short Desc</Text>
              <Text className={shortDescOverride.length > 0 ? 'text-green-600' : 'text-gray-400'}>
                {shortDescOverride.length > 0 ? 'Overridden' : 'Default'}
              </Text>
            </div>
            {shortDescOverride.length > 0 && <PiPencil className="h-4 w-4 text-green-500" />}
          </div>
          
          <div className="flex items-center justify-between rounded-lg bg-white p-3">
            <div>
              <Text className="text-xs text-gray-500">Description</Text>
              <Text className={descriptionOverride.length > 0 ? 'text-green-600' : 'text-gray-400'}>
                {descriptionOverride.length > 0 ? 'Overridden' : 'Default'}
              </Text>
            </div>
            {descriptionOverride.length > 0 && <PiPencil className="h-4 w-4 text-green-500" />}
          </div>
          
          <div className="flex items-center justify-between rounded-lg bg-white p-3">
            <div>
              <Text className="text-xs text-gray-500">Keywords</Text>
              <Text className={customKeywords?.length > 0 ? 'text-green-600' : 'text-gray-400'}>
                {customKeywords?.length || 0} added
              </Text>
            </div>
            {customKeywords?.length > 0 && <PiTag className="h-4 w-4 text-amber-500" />}
          </div>
          
          <div className="flex items-center justify-between rounded-lg bg-white p-3">
            <div>
              <Text className="text-xs text-gray-500">Notes</Text>
              <Text className={tenantNotes.length > 0 ? 'text-blue-600' : 'text-gray-400'}>
                {tenantNotes.length > 0 ? `${tenantNotes.length} chars` : 'None'}
              </Text>
            </div>
            {tenantNotes.length > 0 && <PiNote className="h-4 w-4 text-gray-500" />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
