'use client';

import { useState, useEffect, useCallback } from 'react';
import { Text, Textarea, Input, Button, Select, type SelectOption } from 'rizzui';
import { PiWarning, PiSparkle, PiSpinner } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import { categoryService } from '@/services/category.service';
import toast from 'react-hot-toast';

export interface NewProductFormData {
  name: string;
  type: string;
  subType: string;
  brand: string;
  volumeMl: string;
  abv: string;
  proof: string;
  barcode: string;
  category: string;
  subCategory: string;
  originCountry: string;
  region: string;
  producer: string;
  description: string;
  shortDescription: string;
  isAlcoholic: boolean;
  style: string;
  vintage: string;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  type: string;
}

interface SubCategory {
  _id: string;
  name: string;
  slug: string;
  type: string;
  parent: string;
}

interface CreateNewProductFormProps {
  value: NewProductFormData | null;
  onChange: (value: NewProductFormData) => void;
  errors?: Record<string, { message?: string }>;
  initialName?: string;
}

const PRODUCT_TYPE_OPTIONS = [
  { value: '', label: 'Select type...' },
  { value: 'beer', label: 'Beer' },
  { value: 'lager', label: 'Lager' },
  { value: 'ale', label: 'Ale' },
  { value: 'stout', label: 'Stout' },
  { value: 'ipa', label: 'IPA (India Pale Ale)' },
  { value: 'wine', label: 'Wine' },
  { value: 'red_wine', label: 'Red Wine' },
  { value: 'white_wine', label: 'White Wine' },
  { value: 'rose_wine', label: 'Rosé Wine' },
  { value: 'sparkling_wine', label: 'Sparkling Wine' },
  { value: 'champagne', label: 'Champagne' },
  { value: 'spirit', label: 'Spirit' },
  { value: 'whiskey', label: 'Whiskey' },
  { value: 'bourbon', label: 'Bourbon' },
  { value: 'scotch', label: 'Scotch' },
  { value: 'vodka', label: 'Vodka' },
  { value: 'gin', label: 'Gin' },
  { value: 'rum', label: 'Rum' },
  { value: 'tequila', label: 'Tequila' },
  { value: 'cognac', label: 'Cognac' },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'cocktail_ready_to_drink', label: 'Ready-to-Drink Cocktail' },
  { value: 'cider', label: 'Cider' },
  { value: 'non_alcoholic', label: 'Non-Alcoholic' },
  { value: 'soft_drink', label: 'Soft Drink' },
  { value: 'juice', label: 'Juice' },
  { value: 'water', label: 'Water' },
  { value: 'energy_drink', label: 'Energy Drink' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'tea', label: 'Tea' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'other', label: 'Other' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'Select country...' },
  { value: 'France', label: 'France' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Germany', label: 'Germany' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Scotland', label: 'Scotland' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Chile', label: 'Chile' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Greece', label: 'Greece' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Other', label: 'Other' },
];

const STYLE_OPTIONS = [
  { value: '', label: 'Select style...' },
  { value: 'dry', label: 'Dry' },
  { value: 'sweet', label: 'Sweet' },
  { value: 'semi_dry', label: 'Semi-Dry' },
  { value: 'semi_sweet', label: 'Semi-Sweet' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'still', label: 'Still' },
  { value: 'oaked', label: 'Oaked' },
  { value: 'unoaked', label: 'Unoaked' },
  { value: 'single_malt', label: 'Single Malt' },
  { value: 'blended', label: 'Blended' },
  { value: 'craft', label: 'Craft' },
  { value: 'premium', label: 'Premium' },
  { value: 'budget', label: 'Budget' },
];

const defaultFormData: NewProductFormData = {
  name: '',
  type: '',
  subType: '',
  brand: '',
  volumeMl: '',
  abv: '',
  proof: '',
  barcode: '',
  category: '',
  subCategory: '',
  originCountry: '',
  region: '',
  producer: '',
  description: '',
  shortDescription: '',
  isAlcoholic: true,
  style: '',
  vintage: '',
};

export function CreateNewProductForm({
  value,
  onChange,
  errors = {},
  initialName = '',
}: CreateNewProductFormProps) {
  const { data: session } = useSession();
  const formData = value || { ...defaultFormData, name: initialName || '' };

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resolvedCategoryId, setResolvedCategoryId] = useState<string>('');
  const [resolvedSubCategoryId, setResolvedSubCategoryId] = useState<string>('');

  const handleChange = (field: keyof NewProductFormData, fieldValue: string | boolean) => {
    onChange({
      ...formData,
      [field]: fieldValue,
    });
  };

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      if (!session?.user?.token) return;
      
      setIsLoadingCategories(true);
      try {
        const cats = await categoryService.getCategories(session.user.token);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [session]);

  // Resolve category ID from name when categories are loaded (for edit mode)
  useEffect(() => {
    if (categories.length > 0 && formData.category) {
      const matchedCategory = categories.find(c => c.name === formData.category);
      if (matchedCategory) {
        setResolvedCategoryId(matchedCategory._id);
      }
    }
  }, [categories, formData.category]);

  // Resolve subcategory ID from name when subcategories are loaded (for edit mode)
  useEffect(() => {
    if (subCategories.length > 0 && formData.subCategory) {
      const matchedSubCategory = subCategories.find(s => s.name === formData.subCategory);
      if (matchedSubCategory) {
        setResolvedSubCategoryId(matchedSubCategory._id);
      }
    }
  }, [subCategories, formData.subCategory]);

  // Fetch subcategories when category changes
  useEffect(() => {
    const fetchSubCategories = async () => {
      const categoryIdToUse = resolvedCategoryId || formData.category;
      if (!session?.user?.token || !categoryIdToUse) {
        setSubCategories([]);
        return;
      }

      setIsLoadingSubCategories(true);
      try {
        const subCats = await categoryService.getSubCategories(
          session.user.token,
          categoryIdToUse
        );
        setSubCategories(Array.isArray(subCats) ? subCats : []);
      } catch (error) {
        console.error('Failed to fetch subcategories:', error);
        setSubCategories([]);
      } finally {
        setIsLoadingSubCategories(false);
      }
    };

    fetchSubCategories();
  }, [formData.category, resolvedCategoryId, session]);

  // Reset subcategory when category changes
  useEffect(() => {
    if (formData.category) {
      handleChange('subCategory', '');
    }
  }, [formData.category, resolvedCategoryId]);

  // AI Auto-fill handler
  const handleAutoFill = useCallback(async () => {
    const productName = formData.name || initialName;
    
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first (at least 3 characters)');
      return;
    }

    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating product details with AI...', { id: 'ai-generate' });

    try {
      const response = await geminiService.generateProductDetails(
        productName,
        session.user.token,
        formData.type
      );

      const data = response.data;

      // Find matching category by name
      let matchedCategoryId = formData.category;
      if (data.category) {
        const matchedCategory = categories.find(
          (cat) => cat.name.toLowerCase() === data.category.toLowerCase()
        );
        if (matchedCategory) {
          matchedCategoryId = matchedCategory._id;
        }
      }

      // Find matching subcategory by name
      let matchedSubCategoryId = formData.subCategory;
      if (data.subCategory && matchedCategoryId) {
        const matchedSub = subCategories.find(
          (sub) => sub.name.toLowerCase() === data.subCategory.toLowerCase()
        );
        if (matchedSub) {
          matchedSubCategoryId = matchedSub._id;
        }
      }

      onChange({
        ...formData,
        name: data.name || formData.name || initialName,
        type: data.type || formData.type,
        subType: data.subType || formData.subType,
        brand: data.brand || formData.brand,
        volumeMl: data.volumeMl?.toString() || formData.volumeMl,
        abv: data.abv?.toString() || formData.abv,
        proof: data.proof?.toString() || formData.proof,
        barcode: data.barcode || formData.barcode,
        category: matchedCategoryId,
        subCategory: matchedSubCategoryId,
        originCountry: data.originCountry || formData.originCountry,
        region: data.region || formData.region,
        producer: data.producer || formData.producer,
        description: data.description || formData.description,
        shortDescription: data.shortDescription || formData.shortDescription,
        isAlcoholic: data.isAlcoholic ?? formData.isAlcoholic,
        style: data.style || formData.style,
        vintage: data.vintage?.toString() || formData.vintage,
      });

      toast.success('Product details auto-filled successfully!', { id: 'ai-generate' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      const errorMessage = error.message || 'Failed to generate product details';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('connect')) {
        toast.error('Cannot connect to server. Please make sure the backend is running.', {
          id: 'ai-generate',
          duration: 5000,
        });
      } else {
        toast.error(errorMessage, { id: 'ai-generate' });
      }
    } finally {
      setIsGenerating(false);
    }
  }, [formData, initialName, categories, subCategories, session, onChange]);

  const showAlcoholFields = formData.isAlcoholic;
  const canUseAI = (formData.name || initialName).length >= 3;

  return (
    <div className="space-y-6">
      {/* Pending Approval Notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <PiWarning className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <Text className="text-sm font-medium text-amber-800">
              New Product - Pending Approval
            </Text>
            <Text className="text-xs text-amber-700 mt-1">
              This product will be created as &quot;pending&quot; and requires admin approval 
              before appearing on the main marketplace. Your SubProduct will be available 
              immediately in your store.
            </Text>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Product Name */}
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Product Name <span className="text-red-500">*</span>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              color="primary"
              disabled={!canUseAI || isGenerating}
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
          <Input
            value={formData.name || initialName}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Johnnie Walker Blue Label"
            error={errors.name?.message}
          />
          <Text className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
            <PiSparkle className="h-3 w-3 text-purple-500" />
            Enter a product name and click &quot;Auto-fill with AI&quot; to generate details
          </Text>
        </div>

        {/* Product Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PRODUCT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.type?.message && (
            <Text className="mt-1 text-xs text-red-500">{errors.type.message}</Text>
          )}
        </div>

        {/* Sub Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Sub-Type
          </label>
          <Input
            value={formData.subType}
            onChange={(e) => handleChange('subType', e.target.value)}
            placeholder="e.g., Single Malt, Blended"
          />
        </div>

        {/* Brand */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Brand
          </label>
          <Input
            value={formData.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            placeholder="e.g., Johnnie Walker"
          />
        </div>

        {/* Vintage */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Vintage / Year
          </label>
          <Input
            type="number"
            value={formData.vintage}
            onChange={(e) => handleChange('vintage', e.target.value)}
            placeholder="e.g., 2020"
            min={1900}
            max={new Date().getFullYear()}
          />
        </div>

        {/* Volume */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Volume (ml)
          </label>
          <Input
            type="number"
            value={formData.volumeMl}
            onChange={(e) => handleChange('volumeMl', e.target.value)}
            placeholder="e.g., 750"
          />
        </div>

        {/* Style */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Style
          </label>
          <select
            value={formData.style}
            onChange={(e) => handleChange('style', e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Barcode */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Barcode
          </label>
          <Input
            value={formData.barcode}
            onChange={(e) => handleChange('barcode', e.target.value)}
            placeholder="e.g., 5000267023589"
          />
        </div>

        {/* Category - Searchable Select */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Category
          </label>
          <Select
            placeholder={isLoadingCategories ? 'Loading categories...' : 'Search and select category'}
            options={categories.map((cat) => ({
              value: cat._id,
              label: cat.name,
            }))}
            value={resolvedCategoryId || categories.find((c) => c._id === formData.category)?._id ? {
              value: resolvedCategoryId || categories.find((c) => c._id === formData.category)?._id || '',
              label: formData.category || categories.find((c) => c._id === formData.category)?.name || '',
            } : ''}
            onChange={(option: SelectOption) => {
              const selectedCategory = categories.find(c => c._id === option?.value);
              handleChange('category', selectedCategory?.name || option?.value as string || '');
              setResolvedCategoryId(option?.value as string || '');
            }}
            disabled={isLoadingCategories}
            className="w-full"
          />
          <Text className="mt-1 text-xs text-gray-400">
            {categories.length > 0 ? `${categories.length} categories available` : 'Optional'}
          </Text>
        </div>

        {/* SubCategory - Searchable Select */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Sub-Category
          </label>
          <Select
            placeholder={
              !formData.category && !resolvedCategoryId
                ? 'Select category first'
                : isLoadingSubCategories
                ? 'Loading...'
                : subCategories.length === 0
                ? 'No sub-categories available'
                : 'Search and select sub-category'
            }
            options={subCategories.map((subCat) => ({
              value: subCat._id,
              label: subCat.name,
            }))}
            value={resolvedSubCategoryId || subCategories.find((s) => s.name === formData.subCategory)?._id ? {
              value: resolvedSubCategoryId || subCategories.find((s) => s.name === formData.subCategory)?._id || '',
              label: formData.subCategory || subCategories.find((s) => s.name === formData.subCategory)?.name || '',
            } : ''}
            onChange={(option: SelectOption) => {
              const selectedSubCategory = subCategories.find(s => s._id === option?.value);
              handleChange('subCategory', selectedSubCategory?.name || option?.value as string || '');
              setResolvedSubCategoryId(option?.value as string || '');
            }}
            disabled={(!formData.category && !resolvedCategoryId) || isLoadingSubCategories}
            className="w-full"
          />
        </div>
      </div>

      {/* Alcohol-Specific Fields */}
      {showAlcoholFields && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <Text className="mb-4 text-sm font-semibold text-gray-800">
            Alcohol Information
          </Text>
          <div className="grid gap-4 md:grid-cols-2">
            {/* ABV */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                ABV (%)
              </label>
              <Input
                type="number"
                step="0.1"
                value={formData.abv}
                onChange={(e) => handleChange('abv', e.target.value)}
                placeholder="e.g., 40.0"
                min={0}
                max={100}
              />
            </div>

            {/* Proof */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Proof (US)
              </label>
              <Input
                type="number"
                value={formData.proof}
                onChange={(e) => handleChange('proof', e.target.value)}
                placeholder="e.g., 80"
                min={0}
                max={200}
              />
            </div>
          </div>
        </div>
      )}

      {/* Origin & Production */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <Text className="mb-4 text-sm font-semibold text-gray-800">
          Origin & Production
        </Text>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Country */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Country of Origin
            </label>
            <select
              value={formData.originCountry}
              onChange={(e) => handleChange('originCountry', e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Region
            </label>
            <Input
              value={formData.region}
              onChange={(e) => handleChange('region', e.target.value)}
              placeholder="e.g., Speyside, Bordeaux"
            />
          </div>

          {/* Producer */}
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Producer / Winery / Distillery
            </label>
            <Input
              value={formData.producer}
              onChange={(e) => handleChange('producer', e.target.value)}
              placeholder="e.g., Diageo, Moët & Chandon"
            />
          </div>
        </div>
      </div>

      {/* Descriptions */}
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Short Description
          </label>
          <Input
            value={formData.shortDescription}
            onChange={(e) => handleChange('shortDescription', e.target.value)}
            placeholder="Brief summary (max 280 characters)"
            maxLength={280}
          />
          <Text className="mt-1 text-xs text-gray-400">
            {(formData.shortDescription?.length || 0)}/280 characters
          </Text>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Full Description
          </label>
          <Textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Detailed product description..."
            rows={4}
          />
        </div>
      </div>

      {/* Alcohol Toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isAlcoholic"
          checked={formData.isAlcoholic}
          onChange={(e) => handleChange('isAlcoholic', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isAlcoholic" className="text-sm text-gray-700">
          This product contains alcohol
        </label>
      </div>
    </div>
  );
}

export default CreateNewProductForm;
