// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Badge, Button, Select, type SelectOption } from 'rizzui';
import { motion } from 'framer-motion';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import { productTypes } from './form-utils';
import FormGroup from '@/app/shared/form-group';
import { useEffect, useState, Fragment } from 'react';
import { PiCheck, PiSparkle, PiSpinner, PiPlus } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import { categoryService } from '@/services/category.service';
import { brandService } from '@/services/brand.service';
import toast from 'react-hot-toast';
import CreateBrandModal from './create-brand-modal';

interface ProductIdentificationProps {
  className?: string;
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

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  primaryCategory?: string;
  countryOfOrigin?: string;
  isFeatured?: boolean;
  isPremium?: boolean;
  verified?: boolean;
}

// ── Small inline AI sparkle button ───────────────────────────────────────────
function AiBtn({
  field,
  generating,
  onClick,
  label = 'AI',
}: {
  field: string;
  generating: string | null;
  onClick: () => void;
  label?: string;
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
      {isLoading ? 'Generating…' : label}
    </button>
  );
}

export default function ProductIdentification({ className }: ProductIdentificationProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const productName      = watch('name');
  const productType      = watch('type');
  const selectedCategory = watch('category');
  const selectedSubCategory = watch('subCategory');

  const [slugFocused, setSlugFocused]       = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generating, setGenerating]           = useState<string | null>(null);

  const [categories, setCategories]         = useState<Category[]>([]);
  const [subCategories, setSubCategories]   = useState<SubCategory[]>([]);
  const [brands, setBrands]                 = useState<Brand[]>([]);
  const [isLoadingCategories, setIsLoadingCategories]       = useState(false);
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands]               = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  const token = session?.user?.token;

  // ── Data fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setIsLoadingCategories(true);
    categoryService.getCategories(token)
      .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
      .catch(() => setCategories([]))
      .finally(() => setIsLoadingCategories(false));
  }, [token]);

  const fetchBrands = async () => {
    if (!token) return;
    setIsLoadingBrands(true);
    try {
      // limit 100 silently hid every brand past the 100th (catalog is 150+)
      const fetched = await brandService.getBrands(token, { limit: 500 });
      setBrands(fetched.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setBrands([]);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  useEffect(() => { fetchBrands(); }, [token]);

  useEffect(() => {
    if (!token || !selectedCategory) return;
    const alreadyLoaded = subCategories.length > 0 && subCategories.some((sc) => sc.parent === selectedCategory);
    if (alreadyLoaded) return;
    setIsLoadingSubCategories(true);
    categoryService.getSubCategories(token, selectedCategory)
      .then((subs) => { if (watch('category') === selectedCategory) setSubCategories(Array.isArray(subs) ? subs : []); })
      .catch(() => {})
      .finally(() => { if (watch('category') === selectedCategory) setIsLoadingSubCategories(false); });
  }, [selectedCategory, token, subCategories.length]);

  // Auto-generate slug from name
  useEffect(() => {
    if (productName && !slugFocused) {
      setValue(
        'slug',
        productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        { shouldValidate: false }
      );
    }
  }, [productName, slugFocused, setValue]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const selectedType           = productTypes.find((t) => t.value === productType);
  const selectedCategoryObj    = categories.find((c) => c._id === selectedCategory);
  const selectedSubCategoryObj = subCategories.find((s) => s._id === selectedSubCategory);
  const hasPendingSubCategory  = selectedSubCategory && !selectedSubCategoryObj && !isLoadingSubCategories;

  const findCategoryByName = (name: string, list: Category[]): string | null => {
    if (!name || !list.length) return null;
    const n = name.toLowerCase().trim();
    return (
      list.find((c) => c.name.toLowerCase() === n)?._id ||
      list.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()))?._id ||
      null
    );
  };

  const findSubCategoryByName = (name: string, list: SubCategory[]): string | null => {
    if (!name || !list.length) return null;
    const n = name.toLowerCase().trim();
    return (
      list.find((s) => s.name.toLowerCase() === n)?._id ||
      list.find((s) => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase()))?._id ||
      null
    );
  };

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

  // ── Per-field AI handlers ───────────────────────────────────────────────────
  const genSlug = () =>
    gen('slug', async () => {
      const res = await geminiService.generateSlug(productName, token);
      setValue('slug', res.data.slug || '');
    });

  const genType = () =>
    gen('type', async () => {
      // Use full product details and extract just type + subType
      const res = await geminiService.generateProductDetails(productName, token, productType);
      if (res.data.type) setValue('type', res.data.type);
      if (res.data.subType) setValue('subType', res.data.subType);
    });

  const genCategory = () =>
    gen('category', async () => {
      const res = await geminiService.generateCategorySuggestion(
        productName,
        token,
        productType,
        categories
      );
      const { category: catName, subCategory: subCatName } = res.data;

      const catId = findCategoryByName(catName, categories);
      if (catId) {
        setValue('category', catId, { shouldDirty: true });
        setValue('subCategory', '');
        setSubCategories([]);

        // Also try to match subcategory
        if (subCatName) {
          const subs = await categoryService.getSubCategories(token, catId).catch(() => []);
          const subList = Array.isArray(subs) ? subs : [];
          setSubCategories(subList);
          const subId = findSubCategoryByName(subCatName, subList);
          if (subId) setValue('subCategory', subId, { shouldDirty: true });
        }
      } else {
        toast.error(`No matching category found for "${catName}"`);
        throw new Error('skip-success-toast');
      }
    });

  const genSubCategory = () =>
    gen('subCategory', async () => {
      if (!selectedCategory) {
        toast.error('Select a category first');
        throw new Error('skip-success-toast');
      }
      const res = await geminiService.generateSubCategorySuggestion(
        productName,
        token,
        productType,
        selectedCategoryObj?.name,
        subCategories
      );
      const subId = findSubCategoryByName(res.data.subCategory, subCategories);
      if (subId) {
        setValue('subCategory', subId, { shouldDirty: true });
      } else {
        toast.error(`No matching sub-category found for "${res.data.subCategory}"`);
        throw new Error('skip-success-toast');
      }
    });

  // ── Fill ALL fields ─────────────────────────────────────────────────────────
  const handleFillAll = async () => {
    if (!requireName()) return;
    setIsGeneratingAll(true);
    toast.loading('Generating product details with AI…', { id: 'ai-all' });
    try {
      const res  = await geminiService.generateProductDetails(productName, token, productType);
      const data = res.data;

      setValue('type', data.type || '');
      setValue('subType', data.subType || '');

      let matchedCatId: string | null = null;
      if (data.category) {
        matchedCatId = findCategoryByName(data.category, categories);
        if (matchedCatId) {
          setValue('category', matchedCatId, { shouldDirty: true });
          setValue('subCategory', '');
          setSubCategories([]);
        }
      }
      if (data.subCategory && matchedCatId) {
        const subs = await categoryService.getSubCategories(token, matchedCatId).catch(() => []);
        const subList = Array.isArray(subs) ? subs : [];
        setSubCategories(subList);
        const subId = findSubCategoryByName(data.subCategory, subList);
        if (subId) setValue('subCategory', subId, { shouldDirty: true });
      }

      setValue('isAlcoholic', data.isAlcoholic ?? false);
      setValue('abv', data.abv);
      setValue('volumeMl', data.volumeMl);
      setValue('originCountry', data.originCountry || '');
      setValue('region', data.region || '');
      setValue('brand', data.brand || '');
      setValue('producer', data.producer || '');
      setValue('vintage', data.vintage);
      setValue('age', data.age);
      setValue('ageStatement', data.ageStatement || '');
      setValue('productionMethod', data.productionMethod || '');
      setValue('shortDescription', data.shortDescription || '');
      setValue('description', data.description || '');
      setValue('tastingNotes.nose', data.tastingNotes?.nose || []);
      setValue('tastingNotes.aroma', data.tastingNotes?.aroma || []);
      setValue('tastingNotes.palate', data.tastingNotes?.palate || []);
      setValue('tastingNotes.taste', data.tastingNotes?.taste || []);
      setValue('tastingNotes.finish', data.tastingNotes?.finish || []);
      setValue('tastingNotes.mouthfeel', data.tastingNotes?.mouthfeel || []);
      setValue('tastingNotes.appearance', data.tastingNotes?.appearance || '');
      setValue('tastingNotes.color', data.tastingNotes?.color || '');
      setValue('flavorProfile', data.flavorProfile || []);
      setValue('foodPairings', data.foodPairings || []);
      setValue('servingSuggestions.temperature', data.servingSuggestions?.temperature || '');
      setValue('servingSuggestions.glassware', data.servingSuggestions?.glassware || '');
      setValue('servingSuggestions.garnish', data.servingSuggestions?.garnish || []);
      setValue('servingSuggestions.mixers', data.servingSuggestions?.mixers || []);
      setValue('isDietary', data.isDietary || {});
      setValue('allergens', data.allergens || []);
      setValue('ingredients', data.ingredients || []);
      setValue('metaTitle', data.metaTitle || '');
      setValue('metaDescription', data.metaDescription || '');
      setValue('keywords', data.keywords || []);

      toast.success('Product details auto-filled!', { id: 'ai-all' });
    } catch (err: any) {
      const msg = err.message || 'Failed to generate product details';
      toast.error(
        msg.includes('fetch') || msg.includes('connect')
          ? 'Cannot connect to server.'
          : msg,
        { id: 'ai-all' }
      );
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const anyGenerating = isGeneratingAll || !!generating;

  return (
    <Fragment>
      <FormGroup
        title="Product Identification"
        description="Enter the basic identification details for your product"
        className={cn(className)}
      >
        <div className="grid w-full gap-6 @2xl:grid-cols-2">

          {/* Product Name + Fill-all button */}
          <div className="@2xl:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                Product Name
                <span className="text-red-500">*</span>
                {productName && productName.length >= 3 && (
                  <Badge size="sm" color="success" variant="flat">
                    <PiCheck className="h-3 w-3" />
                  </Badge>
                )}
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                color="primary"
                disabled={!productName || productName.length < 3 || anyGenerating}
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
            <Input
              placeholder="e.g., Jameson Irish Whiskey"
              {...register('name')}
              error={errors.name?.message}
            />
            <Text className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <PiSparkle className="h-3 w-3 text-purple-500" />
              Enter a product name then use &quot;Auto-fill with AI&quot; to generate all details, or use the individual AI buttons per field.
            </Text>
          </div>

          {/* URL Slug */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              URL Slug
              {watch('slug') && (
                <span className="text-xs text-gray-400">(auto-generated)</span>
              )}
              <AiBtn field="slug" generating={generating} onClick={genSlug} />
            </label>
            <Input
              placeholder="auto-generated-from-name"
              {...register('slug')}
              error={errors.slug?.message}
              className="font-mono text-sm"
              onFocus={() => setSlugFocused(true)}
              onBlur={() => setSlugFocused(false)}
            />
            <Text className="mt-1 text-xs text-gray-500">Used in the product URL</Text>
          </div>

          {/* Product Type */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              Product Type
              <span className="text-red-500">*</span>
              {selectedType && (
                <Badge size="sm" color="primary" variant="flat">
                  {selectedType.category}
                </Badge>
              )}
              <AiBtn field="type" generating={generating} onClick={genType} />
            </label>
            <Select
              placeholder="Search and select product type"
              options={productTypes.map((t) => ({
                value: t.value,
                label: `${t.label} (${t.category})`,
              }))}
              value={(() => {
                const found = productTypes.find((t) => t.value === productType);
                return found ? { value: found.value, label: `${found.label} (${found.category})` } : '';
              })()}
              onChange={(opt: SelectOption) => setValue('type', opt.value as string, { shouldDirty: true })}
              error={errors.type?.message as string}
              className="w-full"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              Category
              {selectedCategoryObj && (
                <Badge size="sm" color="primary" variant="flat">{selectedCategoryObj.name}</Badge>
              )}
              <AiBtn field="category" generating={generating} onClick={genCategory} />
            </label>
            <Select
              placeholder={isLoadingCategories ? 'Loading categories…' : 'Search and select category'}
              options={categories.map((c) => ({ value: c._id, label: c.name }))}
              value={(() => {
                const found = categories.find((c) => c._id === selectedCategory);
                return found ? { value: found._id, label: found.name } : '';
              })()}
              onChange={(opt: SelectOption) => {
                setValue('category', opt.value as string, { shouldDirty: true });
                setValue('subCategory', '');
                setSubCategories([]);
              }}
              disabled={isLoadingCategories}
              error={errors.category?.message as string}
              className="w-full"
            />
            <Text className="mt-1 text-xs text-gray-500">
              {isLoadingCategories
                ? 'Loading…'
                : `${categories.length} categories available`}
            </Text>
          </div>

          {/* Sub-Category */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              Sub-Category
              {selectedSubCategoryObj && (
                <Badge size="sm" color="secondary" variant="flat">{selectedSubCategoryObj.name}</Badge>
              )}
              {hasPendingSubCategory && selectedSubCategory && (
                <Badge size="sm" color="warning" variant="flat">Pending</Badge>
              )}
              <AiBtn field="subCategory" generating={generating} onClick={genSubCategory} />
            </label>
            <Select
              placeholder={
                !selectedCategory
                  ? 'Select category first'
                  : isLoadingSubCategories
                  ? 'Loading sub-categories…'
                  : subCategories.length === 0
                  ? 'No sub-categories for this category'
                  : 'Search and select sub-category'
              }
              options={subCategories.map((s) => ({ value: s._id, label: s.name }))}
              value={(() => {
                if (selectedSubCategoryObj) return { value: selectedSubCategoryObj._id, label: selectedSubCategoryObj.name };
                if (selectedSubCategory) {
                  if (isLoadingSubCategories) return { value: selectedSubCategory, label: 'Loading…' };
                  return { value: selectedSubCategory, label: 'Unknown' };
                }
                return '';
              })()}
              onChange={(opt: SelectOption) => setValue('subCategory', opt.value as string, { shouldDirty: true })}
              disabled={!selectedCategory || isLoadingSubCategories}
              error={errors.subCategory?.message as string}
              className="w-full"
            />
            <Text className="mt-1 text-xs text-gray-500">
              {!selectedCategory
                ? 'Select a category first'
                : isLoadingSubCategories
                ? 'Loading…'
                : `${subCategories.length} sub-categories available`}
            </Text>
          </div>

          {/* Brand */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Brand</label>
              <Button
                type="button"
                variant="text"
                size="xs"
                onClick={() => setShowBrandModal(true)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
              >
                <PiPlus className="h-3 w-3" />
                Create New Brand
              </Button>
            </div>
            <Select
              placeholder={isLoadingBrands ? 'Loading brands…' : 'Search and select brand'}
              options={brands.map((b) => ({
                value: b._id,
                label: `${b.name}${b.isPremium ? ' ⭐' : ''}${b.verified ? ' ✓' : ''}`,
              }))}
              value={(() => {
                const found = brands.find((b) => b._id === watch('brand'));
                return found
                  ? { value: found._id, label: `${found.name}${found.isPremium ? ' ⭐' : ''}${found.verified ? ' ✓' : ''}` }
                  : '';
              })()}
              onChange={(opt: SelectOption) => setValue('brand', opt.value as string, { shouldDirty: true })}
              disabled={isLoadingBrands}
              className="w-full"
            />
            <Text className="mt-1 text-xs text-gray-500">
              {isLoadingBrands ? 'Loading…' : `${brands.length} brands available`}
            </Text>
          </div>

          {/* SKU */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">SKU</label>
            <Input
              placeholder="e.g., WHISKY-001"
              {...register('sku')}
              error={errors.sku?.message}
            />
          </div>

          {/* Barcode */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Barcode</label>
            <Input
              placeholder="e.g., 123456789012"
              {...register('barcode')}
              error={errors.barcode?.message}
            />
          </div>

          {/* GTIN */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">GTIN</label>
            <Input
              placeholder="e.g., 12345678901234"
              {...register('gtin')}
              error={errors.gtin?.message}
            />
          </div>

          {/* UPC */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">UPC</label>
            <Input
              placeholder="e.g., 123456789012"
              {...register('upc')}
              error={errors.upc?.message}
            />
          </div>
        </div>
      </FormGroup>

      <CreateBrandModal
        isOpen={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onBrandCreated={(newBrandId) => {
          fetchBrands();
          setValue('brand', newBrandId);
          setShowBrandModal(false);
          toast.success('Brand created and selected!');
        }}
        token={token || ''}
        productName={productName}
      />
    </Fragment>
  );
}
