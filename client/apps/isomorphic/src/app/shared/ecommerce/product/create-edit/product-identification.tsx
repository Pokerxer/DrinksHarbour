// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Badge, Button, Select, type SelectOption } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
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

// Animation variants
const inputVariants = {
  focus: { scale: 1.01, boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' },
  blur: { scale: 1, boxShadow: '0 0 0 0px rgba(59, 130, 246, 0)' },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  }),
};

export default function ProductIdentification({
  className,
}: ProductIdentificationProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const productName = watch('name');
  const productType = watch('type');
  const selectedCategory = watch('category');
  const selectedSubCategory = watch('subCategory');
  const [slugFocused, setSlugFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      if (!session?.user?.token) {
        console.log('No session token available');
        return;
      }
      
      console.log('Fetching categories...');
      setIsLoadingCategories(true);
      setLoadError(null);
      try {
        const cats = await categoryService.getCategories(session.user.token);
        console.log('Categories fetched:', cats);
        // Ensure we always set an array, even if the API returns something unexpected
        const categoriesArray = Array.isArray(cats) ? cats : [];
        setCategories(categoriesArray);
        console.log('Categories set:', categoriesArray.length);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setLoadError('Failed to load categories');
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [session]);

  // Fetch brands function - extracted for reuse
  const fetchBrands = async () => {
    if (!session?.user?.token) {
      console.log('No session token available for brands');
      return;
    }

    console.log('Fetching brands...');
    setIsLoadingBrands(true);
    try {
      const fetchedBrands = await brandService.getBrands(session.user.token, { limit: 100 });
      console.log('Brands fetched:', fetchedBrands.length);
      setBrands(fetchedBrands);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      setBrands([]);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  // Fetch brands on mount
  useEffect(() => {
    fetchBrands();
  }, [session]);

  // Fetch subcategories when category changes
  useEffect(() => {
    const fetchSubCategoriesIfNeeded = async () => {
      if (!session?.user?.token || !selectedCategory) {
        return;
      }

      // Skip if already loaded for this category
      const alreadyLoaded = subCategories.length > 0 && 
        subCategories.some(sc => sc.parent === selectedCategory);
      if (alreadyLoaded) {
        return;
      }

      setIsLoadingSubCategories(true);
      try {
        const subCats = await categoryService.getSubCategories(
          session.user.token, 
          selectedCategory
        );
        const newSubCats = Array.isArray(subCats) ? subCats : [];
        // Only update if the category hasn't changed during fetch
        if (watch('category') === selectedCategory) {
          setSubCategories(newSubCats);
        }
      } catch (error) {
        console.error('Failed to fetch subcategories:', error);
      } finally {
        if (watch('category') === selectedCategory) {
          setIsLoadingSubCategories(false);
        }
      }
    };

    fetchSubCategoriesIfNeeded();
  }, [selectedCategory, session?.user?.token, subCategories.length]);

  // Auto-generate slug when name changes
  useEffect(() => {
    if (productName && !slugFocused) {
      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setValue('slug', slug, { shouldValidate: false });
    }
  }, [productName, slugFocused, setValue]);

  const selectedType = productTypes.find((t) => t.value === productType);
  const selectedCategoryObj = categories.find((c) => c._id === selectedCategory);
  const selectedSubCategoryObj = subCategories.find((s) => s._id === selectedSubCategory);

  // Check if we have a selected subcategory that's not in the list yet
  const hasPendingSubCategory = selectedSubCategory && !selectedSubCategoryObj && !isLoadingSubCategories;

  // Helper function to find category ID by name (case-insensitive, fuzzy match)
  const findCategoryByName = (categoryName: string, categoriesList: Category[]): string | null => {
    if (!categoryName || categoriesList.length === 0) return null;
    
    const normalizedName = categoryName.toLowerCase().trim();
    
    // Exact match first
    const exactMatch = categoriesList.find(
      cat => cat.name.toLowerCase().trim() === normalizedName
    );
    if (exactMatch) return exactMatch._id;
    
    // Partial match (contains)
    const partialMatch = categoriesList.find(
      cat => cat.name.toLowerCase().includes(normalizedName) || 
             normalizedName.includes(cat.name.toLowerCase())
    );
    if (partialMatch) return partialMatch._id;
    
    // Fuzzy match by words
    const words = normalizedName.split(/\s+/);
    const fuzzyMatch = categoriesList.find(cat => {
      const catWords = cat.name.toLowerCase().split(/\s+/);
      return words.some(word => catWords.some(catWord => 
        catWord.includes(word) || word.includes(catWord)
      ));
    });
    
    return fuzzyMatch?._id || null;
  };

  // Helper function to find subcategory ID by name
  const findSubCategoryByName = (subCategoryName: string, subCategoriesList: SubCategory[]): string | null => {
    if (!subCategoryName || subCategoriesList.length === 0) return null;
    
    const normalizedName = subCategoryName.toLowerCase().trim();
    
    // Exact match first
    const exactMatch = subCategoriesList.find(
      sub => sub.name.toLowerCase().trim() === normalizedName
    );
    if (exactMatch) return exactMatch._id;
    
    // Partial match
    const partialMatch = subCategoriesList.find(
      sub => sub.name.toLowerCase().includes(normalizedName) || 
             normalizedName.includes(sub.name.toLowerCase())
    );
    
    return partialMatch?._id || null;
  };

  // Auto-fill form with AI-generated data
  const handleAutoFill = async () => {
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
        productType
      );

      const data = response.data;

      // Fill in all form fields
      setValue('type', data.type || '');
      setValue('subType', data.subType || '');
      
      // Handle category - match AI-generated name to available category IDs
      let matchedCategoryId: string | null = null;
      if (data.category) {
        matchedCategoryId = findCategoryByName(data.category, categories);
        if (matchedCategoryId) {
          setValue('category', matchedCategoryId);
          console.log('Category matched:', data.category, '->', matchedCategoryId);
        } else {
          console.log('Category not matched:', data.category, 'Available:', categories.map(c => c.name));
        }
      }
      
      // Handle subcategory - need to wait for subcategories to load if category changed
      if (data.subCategory && matchedCategoryId) {
        // Fetch subcategories for the matched category first
        try {
          const subCats = await categoryService.getSubCategories(session.user.token, matchedCategoryId);
          const subCategoriesList = Array.isArray(subCats) ? subCats : [];
          const matchedSubCategoryId = findSubCategoryByName(data.subCategory, subCategoriesList);
          if (matchedSubCategoryId) {
            setValue('subCategory', matchedSubCategoryId);
            console.log('SubCategory matched:', data.subCategory, '->', matchedSubCategoryId);
          } else {
            console.log('SubCategory not matched:', data.subCategory, 'Available:', subCategoriesList.map(s => s.name));
          }
        } catch (err) {
          console.error('Failed to fetch subcategories for matching:', err);
        }
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

      toast.success('Product details auto-filled successfully!', { id: 'ai-generate' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      const errorMessage = error.message || 'Failed to generate product details';
      
      // Show more user-friendly error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('connect')) {
        toast.error('Cannot connect to server. Please make sure the backend is running on port 5001.', { 
          id: 'ai-generate',
          duration: 5000 
        });
      } else {
        toast.error(errorMessage, { id: 'ai-generate' });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Fragment>
      <FormGroup
        title="Product Identification"
        description="Enter the basic identification details for your product"
        className={cn(className)}
      >
        <div className="grid w-full gap-6 @2xl:grid-cols-2">
        {/* Product Name with AI Button */}
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
            
            {/* AI Auto-fill Button */}
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
          
          <Input
            placeholder="e.g., Jameson Irish Whiskey"
            {...register('name')}
            error={errors.name?.message}
            className="transition-all duration-200"
          />
          
          {/* AI Feature Info */}
          <Text className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <PiSparkle className="h-3 w-3 text-purple-500" />
            Enter a product name and click &quot;Auto-fill with AI&quot; to automatically generate all product details
          </Text>
        </div>

        {/* Slug */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            URL Slug
            {watch('slug') && (
              <span className="text-xs text-gray-400">
                (auto-generated)
              </span>
            )}
          </label>
          <Input
            placeholder="auto-generated-from-name"
            {...register('slug')}
            error={errors.slug?.message}
            className="font-mono text-sm"
          />
          <Text className="mt-1 text-xs text-gray-500">
            This will be used in the product URL
          </Text>
        </div>

        {/* Category - Searchable */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            Category
            {selectedCategoryObj && (
              <Badge size="sm" color="primary" variant="flat">
                {selectedCategoryObj.name}
              </Badge>
            )}
          </label>
          <Select
            placeholder={isLoadingCategories ? 'Loading categories...' : 'Search and select category'}
            options={categories.map((cat) => ({
              value: cat._id,
              label: cat.name,
            }))}
            value={
              (() => {
                const currentCatId = watch('category');
                const found = categories.find((c) => c._id === currentCatId);
                if (found) {
                  return { value: found._id, label: found.name };
                }
                return '';
              })()
            }
            onChange={(option: SelectOption) => {
              setValue('category', option.value as string, { shouldDirty: true });
              // Reset subcategory when category changes
              setValue('subCategory', '');
              setSubCategories([]);
            }}
            disabled={isLoadingCategories}
            error={errors.category?.message as string}
            className="w-full"
          />
          <Text className="mt-2 text-xs text-gray-500">
            {isLoadingCategories
              ? 'Loading categories...'
              : categories.length > 0
              ? `${categories.length} categories available`
              : 'No categories loaded'}
          </Text>
        </div>

        {/* SubCategory - Searchable */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            Sub-Category
            {selectedSubCategoryObj && (
              <Badge size="sm" color="secondary" variant="flat">
                {selectedSubCategoryObj.name}
              </Badge>
            )}
            {hasPendingSubCategory && selectedSubCategory && (
              <Badge size="sm" color="warning" variant="flat">
                Pending Load
              </Badge>
            )}
          </label>
          <Select
            placeholder={
              !selectedCategory
                ? 'Select category first'
                : isLoadingSubCategories
                ? 'Loading sub-categories...'
                : selectedSubCategory && !selectedSubCategoryObj
                ? 'Subcategory selected (refreshing...)'
                : subCategories.length === 0
                ? 'No sub-categories available for this category'
                : 'Search and select sub-category'
            }
            options={subCategories.map((subCat) => ({
              value: subCat._id,
              label: subCat.name,
            }))}
            value={
              (() => {
                // First check if the subcategory is in our loaded list
                if (selectedSubCategoryObj) {
                  return { value: selectedSubCategoryObj._id, label: selectedSubCategoryObj.name };
                }
                // If we have a selected subcategory that's not in the list yet
                // Keep displaying it even if subcategories haven't loaded
                if (selectedSubCategory) {
                  if (isLoadingSubCategories) {
                    return { value: selectedSubCategory, label: 'Loading...' };
                  }
                  // Subcategories are loaded but this one isn't in the list
                  // This could be because it belongs to a different category or was deleted
                  return { value: selectedSubCategory, label: 'Unknown Subcategory' };
                }
                return '';
              })()
            }
            onChange={(option: SelectOption) => {
              setValue('subCategory', option.value as string, { shouldDirty: true });
            }}
            disabled={!selectedCategory}
            error={errors.subCategory?.message as string}
            className="w-full"
          />
          <Text className="mt-2 text-xs text-gray-500">
            {!selectedCategory
              ? 'Select a category to see available sub-categories'
              : isLoadingSubCategories
              ? 'Loading...'
              : subCategories.length > 0
              ? `${subCategories.length} sub-categories available`
              : 'No sub-categories found for this category'}
          </Text>
        </div>

        {/* Brand - Searchable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Brand
            </label>
            <Button
              type="button"
              variant="text"
              size="xs"
              onClick={() => setShowBrandModal(true)}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <PiPlus className="h-3 w-3" />
              Create New Brand
            </Button>
          </div>
          <Select
            placeholder={isLoadingBrands ? 'Loading brands...' : 'Search and select brand'}
            options={brands.map((brand) => ({
              value: brand._id,
              label: `${brand.name}${brand.isPremium ? ' ⭐' : ''}${brand.verified ? ' ✓' : ''}`,
            }))}
            value={
              (() => {
                const currentBrandId = watch('brand');
                const found = brands.find((b) => b._id === currentBrandId);
                if (found) {
                  return { 
                    value: found._id, 
                    label: `${found.name}${found.isPremium ? ' ⭐' : ''}${found.verified ? ' ✓' : ''}` 
                  };
                }
                return '';
              })()
            }
            onChange={(option: SelectOption) => {
              setValue('brand', option.value as string, { shouldDirty: true });
            }}
            disabled={isLoadingBrands}
            className="w-full"
          />
          <Text className="mt-2 text-xs text-gray-500">
            {isLoadingBrands
              ? 'Loading brands...'
              : brands.length > 0
              ? `${brands.length} brands available`
              : 'No brands loaded'}
          </Text>
        </div>

        {/* Create Brand Modal */}
        <CreateBrandModal
          isOpen={showBrandModal}
          onClose={() => setShowBrandModal(false)}
          onBrandCreated={(newBrandId) => {
            // Refresh brands list
            fetchBrands();
            // Select the new brand
            setValue('brand', newBrandId);
            setShowBrandModal(false);
          }}
          token={session?.user?.token || ''}
          productName={productName}
        />

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
          </label>
          <Select
            placeholder="Search and select product type"
            options={productTypes.map((type) => ({
              value: type.value,
              label: `${type.label} (${type.category})`,
            }))}
            value={
              (() => {
                const currentType = watch('type');
                const found = productTypes.find((t) => t.value === currentType);
                if (found) {
                  return { 
                    value: found.value, 
                    label: `${found.label} (${found.category})` 
                  };
                }
                return '';
              })()
            }
            onChange={(option: SelectOption) => {
              setValue('type', option.value as string, { shouldDirty: true });
            }}
            error={errors.type?.message as string}
            className="w-full"
          />
        </div>

        {/* SKU */}
        <div>
          <label className="mb-2 text-sm font-medium text-gray-700">
            SKU
          </label>
          <Input
            placeholder="e.g., WHISKY-001"
            {...register('sku')}
            error={errors.sku?.message}
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="mb-2 text-sm font-medium text-gray-700">
            Barcode
          </label>
          <Input
            placeholder="e.g., 123456789012"
            {...register('barcode')}
            error={errors.barcode?.message}
          />
        </div>

        {/* GTIN */}
        <div>
          <label className="mb-2 text-sm font-medium text-gray-700">
            GTIN
          </label>
          <Input
            placeholder="e.g., 12345678901234"
            {...register('gtin')}
            error={errors.gtin?.message}
          />
        </div>

        {/* UPC */}
        <div>
          <label className="mb-2 text-sm font-medium text-gray-700">
            UPC
          </label>
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
      token={session?.user?.token || ''}
    />
    </Fragment>
  );
}
