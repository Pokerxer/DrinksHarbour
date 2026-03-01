// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Textarea, Text, Switch, Button, Badge } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiSliders, PiTextAa, PiTextAlignLeft, PiTag, PiNote, PiPencil, 
  PiPlus, PiXBold, PiEye, PiCopy, PiSparkle, PiTrash,
  PiCheck, PiX, PiClock, PiFunnel, PiTrendUp, PiStar
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';

const KEYWORD_PRESETS = [
  'premium', 'organic', 'imported', 'craft', 'local', 'limited-edition',
  'bestseller', 'new-arrival', 'sale', 'featured', 'exclusive', 'seasonal'
];

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
  const [activeOverrides, setActiveOverrides] = useState({
    shortDescription: !!shortDescOverride,
    description: !!descriptionOverride,
    keywords: customKeywords?.length > 0,
    notes: !!tenantNotes,
  });

  const overridesCount = useMemo(() => {
    return Object.values(activeOverrides).filter(Boolean).length;
  }, [activeOverrides]);

  const handleKeywordsAdd = () => {
    if (keywordsInput.trim()) {
      const newKeywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k);
      const existingKeywords = Array.isArray(customKeywords) ? customKeywords : [];
      const updated = [...new Set([...existingKeywords, ...newKeywords])];
      setValue('subProductData.customKeywords', updated);
      setKeywordsInput('');
      setActiveOverrides(prev => ({ ...prev, keywords: updated.length > 0 }));
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    const existingKeywords = Array.isArray(customKeywords) ? customKeywords : [];
    const updated = existingKeywords.filter(k => k !== keyword);
    setValue('subProductData.customKeywords', updated);
    setActiveOverrides(prev => ({ ...prev, keywords: updated.length > 0 }));
  };

  const handleQuickKeywordAdd = (keyword: string) => {
    const existingKeywords = Array.isArray(customKeywords) ? customKeywords : [];
    if (!existingKeywords.includes(keyword)) {
      const updated = [...existingKeywords, keyword];
      setValue('subProductData.customKeywords', updated);
      setActiveOverrides(prev => ({ ...prev, keywords: true }));
    }
  };

  const handleCopyFromParent = (field: string) => {
    const parentValue = watch?.(`product.${field}`);
    if (parentValue) {
      setValue(`subProductData.${field}Override`, parentValue);
      if (field === 'shortDescription') {
        setActiveOverrides(prev => ({ ...prev, shortDescription: true }));
      } else if (field === 'description') {
        setActiveOverrides(prev => ({ ...prev, description: true }));
      }
    }
  };

  const handleClearOverride = (field: string) => {
    if (field === 'shortDescription') {
      setValue('subProductData.shortDescriptionOverride', '');
      setActiveOverrides(prev => ({ ...prev, shortDescription: false }));
    } else if (field === 'description') {
      setValue('subProductData.descriptionOverride', '');
      setActiveOverrides(prev => ({ ...prev, description: false }));
    } else if (field === 'keywords') {
      setValue('subProductData.customKeywords', []);
      setActiveOverrides(prev => ({ ...prev, keywords: false }));
    } else if (field === 'notes') {
      setValue('subProductData.tenantNotes', '');
      setActiveOverrides(prev => ({ ...prev, notes: false }));
    }
  };

  const handleGenerateDescription = () => {
    const productName = watch?.('product.name') || watch?.('newProductData.name') || 'this product';
    const generatedDesc = `Discover ${productName} - a premium beverage selected for quality and taste. Perfect for any occasion, this product offers exceptional value and a memorable experience.`;
    setValue('subProductData.descriptionOverride', generatedDesc);
    setActiveOverrides(prev => ({ ...prev, description: true }));
  };

  const toggleOverride = (field: keyof typeof activeOverrides) => {
    setActiveOverrides(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="flex items-center justify-between">
          <div>
            <Text className="mb-2 text-lg font-semibold">Tenant Overrides</Text>
            <Text className="text-sm text-gray-500">
              Customize product information for your tenant catalog without affecting the parent product
            </Text>
          </div>
          {overridesCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-white"
            >
              <PiSliders className="h-4 w-4" />
              <span className="text-sm font-medium">{overridesCount} Override{overridesCount > 1 ? 's' : ''}</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Override Summary Card */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4"
      >
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-[-50%] rounded-full bg-blue-100/50" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
              >
                <PiSliders className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <Text className="text-sm font-medium text-blue-600">Override Status</Text>
                <Text className="text-xs text-blue-500">Customization summary</Text>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <PiEye className="mr-1 h-4 w-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`flex items-center justify-between rounded-lg p-3 transition-all ${
                activeOverrides.shortDescription 
                  ? 'bg-blue-100 border border-blue-300' 
                  : 'bg-white/60 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <PiTextAa className="h-4 w-4 text-blue-500" />
                <Text className="text-xs font-medium text-gray-700">Short Desc</Text>
              </div>
              {activeOverrides.shortDescription ? (
                <PiCheck className="h-4 w-4 text-blue-600" />
              ) : (
                <PiX className="h-4 w-4 text-gray-400" />
              )}
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`flex items-center justify-between rounded-lg p-3 transition-all ${
                activeOverrides.description 
                  ? 'bg-purple-100 border border-purple-300' 
                  : 'bg-white/60 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <PiTextAlignLeft className="h-4 w-4 text-purple-500" />
                <Text className="text-xs font-medium text-gray-700">Description</Text>
              </div>
              {activeOverrides.description ? (
                <PiCheck className="h-4 w-4 text-purple-600" />
              ) : (
                <PiX className="h-4 w-4 text-gray-400" />
              )}
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`flex items-center justify-between rounded-lg p-3 transition-all ${
                activeOverrides.keywords 
                  ? 'bg-amber-100 border border-amber-300' 
                  : 'bg-white/60 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <PiTag className="h-4 w-4 text-amber-500" />
                <Text className="text-xs font-medium text-gray-700">Keywords</Text>
              </div>
              {activeOverrides.keywords ? (
                <PiCheck className="h-4 w-4 text-amber-600" />
              ) : (
                <PiX className="h-4 w-4 text-gray-400" />
              )}
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`flex items-center justify-between rounded-lg p-3 transition-all ${
                activeOverrides.notes 
                  ? 'bg-gray-100 border border-gray-300' 
                  : 'bg-white/60 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <PiNote className="h-4 w-4 text-gray-500" />
                <Text className="text-xs font-medium text-gray-700">Notes</Text>
              </div>
              {activeOverrides.notes ? (
                <PiCheck className="h-4 w-4 text-gray-600" />
              ) : (
                <PiX className="h-4 w-4 text-gray-400" />
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Short Description Override */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={1}
        className={`relative overflow-hidden rounded-lg border bg-white p-4 transition-all ${
          activeOverrides.shortDescription 
            ? 'border-blue-300 shadow-md' 
            : 'border-gray-200'
        }`}
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 to-blue-600" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiTextAa className="h-5 w-5 text-blue-500" />
            <Text className="font-medium">Short Description Override</Text>
            {activeOverrides.shortDescription && (
              <Badge color="success" variant="flat">Active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {shortDescOverride.length > 0 && (
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={() => handleClearOverride('shortDescription')}
                className="text-red-600 hover:bg-red-50"
              >
                <PiTrash className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyFromParent('shortDescription')}
            >
              <PiCopy className="mr-1 h-4 w-4" />
              Copy
            </Button>
            <Switch
              checked={activeOverrides.shortDescription}
              onChange={() => toggleOverride('shortDescription')}
            />
          </div>
        </div>
        
        <AnimatePresence>
          {activeOverrides.shortDescription && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="relative">
                <Textarea
                  placeholder="Enter a custom short description (max 280 characters)"
                  maxLength={280}
                  {...register('subProductData.shortDescriptionOverride')}
                  className="w-full"
                  rows={3}
                />
                <div className="mt-1 flex justify-end">
                  <Text className={`text-xs ${shortDescOverride.length > 250 ? 'text-red-500' : 'text-gray-400'}`}>
                    {shortDescOverride.length}/280
                  </Text>
                </div>
              </div>
              <Text className="mt-2 text-xs text-gray-500">
                Override the default short description for your catalog. This appears in product cards and search results.
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Description Override */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={2}
        className={`relative overflow-hidden rounded-lg border bg-white p-4 transition-all ${
          activeOverrides.description 
            ? 'border-purple-300 shadow-md' 
            : 'border-gray-200'
        }`}
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-purple-400 to-violet-600" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiTextAlignLeft className="h-5 w-5 text-purple-500" />
            <Text className="font-medium">Description Override</Text>
            {activeOverrides.description && (
              <Badge color="success" variant="flat">Active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {descriptionOverride.length > 0 && (
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={() => handleClearOverride('description')}
                className="text-red-600 hover:bg-red-50"
              >
                <PiTrash className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyFromParent('description')}
            >
              <PiCopy className="mr-1 h-4 w-4" />
              Copy
            </Button>
            <Button
              type="button"
              variant="solid"
              size="sm"
              onClick={handleGenerateDescription}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600"
            >
              <PiSparkle className="mr-1 h-4 w-4" />
              Generate
            </Button>
            <Switch
              checked={activeOverrides.description}
              onChange={() => toggleOverride('description')}
            />
          </div>
        </div>
        
        <AnimatePresence>
          {activeOverrides.description && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="relative">
                <Textarea
                  placeholder="Enter a custom full description (max 5000 characters)"
                  maxLength={5000}
                  {...register('subProductData.descriptionOverride')}
                  className="w-full"
                  rows={6}
                />
                <div className="mt-1 flex justify-end">
                  <Text className={`text-xs ${descriptionOverride.length > 4500 ? 'text-red-500' : 'text-gray-400'}`}>
                    {descriptionOverride.length}/5000
                  </Text>
                </div>
              </div>
              <Text className="mt-2 text-xs text-gray-500">
                Override the default description for your catalog. This appears on the product detail page.
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Custom Keywords */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={3}
        className={`relative overflow-hidden rounded-lg border bg-white p-4 transition-all ${
          activeOverrides.keywords 
            ? 'border-amber-300 shadow-md' 
            : 'border-gray-200'
        }`}
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiTag className="h-5 w-5 text-amber-500" />
            <Text className="font-medium">Custom Keywords</Text>
            {activeOverrides.keywords && (
              <Badge color="warning" variant="flat">{customKeywords?.length || 0} keywords</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {customKeywords?.length > 0 && (
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={() => handleClearOverride('keywords')}
                className="text-red-600 hover:bg-red-50"
              >
                <PiTrash className="mr-1 h-4 w-4" />
                Clear All
              </Button>
            )}
            <Switch
              checked={activeOverrides.keywords}
              onChange={() => toggleOverride('keywords')}
            />
          </div>
        </div>
        
        <AnimatePresence>
          {activeOverrides.keywords && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {/* Quick Keyword Presets */}
              <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
                <Text className="w-full text-xs font-medium text-gray-500 mb-1">Quick Add:</Text>
                {KEYWORD_PRESETS.map((keyword, index) => {
                  const isAdded = customKeywords?.includes(keyword);
                  return (
                    <motion.button
                      key={keyword}
                      type="button"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickKeywordAdd(keyword)}
                      disabled={isAdded}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                        isAdded
                          ? 'border-green-500 bg-green-50 text-green-700 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      {isAdded ? <PiCheck className="mr-1 inline h-3 w-3" /> : '+'}
                      {keyword}
                    </motion.button>
                  );
                })}
              </div>

              {/* Manual Input */}
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
                    className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-1.5 border border-amber-200"
                  >
                    <span className="text-sm font-medium text-amber-700">{keyword}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="text-amber-500 hover:text-amber-700"
                    >
                      <PiXBold className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
              
              {(!customKeywords || customKeywords.length === 0) && (
                <Text className="text-sm text-gray-400 italic">
                  No custom keywords added yet. Use presets or type manually above.
                </Text>
              )}
              <Text className="mt-2 text-xs text-gray-500">
                Additional keywords for search optimization. These will be combined with parent product keywords.
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tenant Notes */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={4}
        className={`relative overflow-hidden rounded-lg border bg-white p-4 transition-all ${
          activeOverrides.notes 
            ? 'border-gray-300 shadow-md' 
            : 'border-gray-200'
        }`}
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-gray-400 to-slate-600" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiNote className="h-5 w-5 text-gray-500" />
            <Text className="font-medium">Internal Notes</Text>
            {activeOverrides.notes && (
              <Badge color="gray" variant="flat">Active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tenantNotes.length > 0 && (
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={() => handleClearOverride('notes')}
                className="text-red-600 hover:bg-red-50"
              >
                <PiTrash className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
            <Switch
              checked={activeOverrides.notes}
              onChange={() => toggleOverride('notes')}
            />
          </div>
        </div>
        
        <AnimatePresence>
          {activeOverrides.notes && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Textarea
                placeholder="Internal notes about this product (max 1000 characters)"
                maxLength={1000}
                {...register('subProductData.tenantNotes')}
                className="w-full bg-gray-50"
                rows={4}
              />
              <div className="mt-1 flex justify-between">
                <Text className="text-xs text-gray-500">
                  Internal notes visible only to your team
                </Text>
                <Text className={`text-xs ${tenantNotes.length > 900 ? 'text-red-500' : 'text-gray-400'}`}>
                  {tenantNotes.length}/1000
                </Text>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
