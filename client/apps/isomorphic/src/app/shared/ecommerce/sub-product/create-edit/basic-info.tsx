// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Text, Button, Badge } from 'rizzui';
import { useSession } from 'next-auth/react';
import { PiCheck, PiPackage, PiArrowLeft, PiTag, PiBarcode, PiHash, PiSpinner, PiUpload, PiX, PiPlusCircle, PiFunnel, PiImages, PiStar, PiTrash, PiCaretRight, PiWarning } from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { uploadService } from '@/services/upload.service';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';

import {
  ProductSearchInput,
  ProductSearchResults,
  CreateNewProductForm,
  Product,
  NewProductFormData,
} from './components';
import { fieldStaggerVariants, containerVariants } from './animations';
import { productService } from '@/services/product.service';

interface SubProductBasicInfoProps {
  onProductSelect?: (productId: string) => void;
  onNewProductCreate?: (productData: NewProductFormData) => void;
}

const defaultNewProductData: NewProductFormData = {
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

const popularTypes = [
  { label: 'Wine', icon: '🍷' },
  { label: 'Beer', icon: '🍺' },
  { label: 'Whiskey', icon: '🥃' },
  { label: 'Vodka', icon: '🧊' },
  { label: 'Rum', icon: '🏝️' },
  { label: 'Gin', icon: '🌿' },
];

const currencies = [
  { value: 'NGN', label: 'NGN - Nigerian Naira', flag: '🇳🇬' },
  { value: 'USD', label: 'USD - US Dollar', flag: '🇺🇸' },
  { value: 'EUR', label: 'EUR - Euro', flag: '🇪🇺' },
  { value: 'GBP', label: 'GBP - British Pound', flag: '🇬🇧' },
  { value: 'ZAR', label: 'ZAR - South African Rand', flag: '🇿🇦' },
  { value: 'KES', label: 'KES - Kenyan Shilling', flag: '🇰🇪' },
  { value: 'GHS', label: 'GHS - Ghanaian Cedi', flag: '🇬🇭' },
];

export default function SubProductBasicInfo({
  onProductSelect,
  onNewProductCreate,
}: SubProductBasicInfoProps) {
  const { data: session } = useSession();
  const methods = useFormContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newProductData, setNewProductData] = useState<NewProductFormData | null>(null);
  const [isSelectingProduct, setIsSelectingProduct] = useState(false);
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [productNotFound, setProductNotFound] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const fieldOnChangeRef = useRef<((value: string) => void) | null>(null);

  const control = methods?.control;
  const setValue = methods?.setValue;
  const watch = methods?.watch;
  const setError = methods?.setError;
  const clearErrors = methods?.clearErrors;
  const errors = methods?.formState?.errors || {};

  const selectedProductId = watch?.('subProductData.product');
  const createNewProduct = watch?.('subProductData.createNewProduct');
  const selectedCurrency = watch?.('subProductData.currency') || 'NGN';

  const hasSearched = searchQuery.length >= 2 && !selectedProductId;
  const hasNoResults = hasSearched && products.length === 0 && !isLoading;

  // Close currency dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(event.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize state from form context on mount - fixes state loss when navigating away and back
  useEffect(() => {
    const initFromForm = async () => {
      // Prevent search effect from triggering during init
      setIsSelectingProduct(true);
      
      // Check if there's an existing product selection - use subProductData namespace
      const existingProductId = watch('subProductData.product');
      const existingCreateNew = watch('subProductData.createNewProduct');
      const existingNewProductData = watch('subProductData.newProductData');
      
      if (existingProductId) {
        // Product was selected - fetch product details and set search query to show selected product card
        setIsCreateMode(false);
        setProductNotFound(false);
        
        // Fetch product details if we have a session token
        if (session?.user?.token) {
          setIsLoadingProduct(true);
          try {
            // Pass includePending=true to fetch pending products (created via SubProduct workflow)
            const response = await productService.getProductById(existingProductId, session.user.token, true);
            if (response.success && response.data?.product) {
              const product = response.data.product;
              setFetchedProduct(product);
              setSearchQuery(product.name || 'Selected Product');
              setProductNotFound(false);
            } else {
              setSearchQuery('');
              setProductNotFound(true);
              console.warn(`Product with ID ${existingProductId} not found - may have been deleted`);
            }
          } catch (error: any) {
            console.error('Error fetching product:', error);
            // Check if it's a 404 error
            if (error.message?.includes('not found') || error.message?.includes('404')) {
              setProductNotFound(true);
              setSearchQuery('');
              toast.error('The linked product was not found. Please select a new product.');
            } else {
              setSearchQuery('Selected Product');
            }
          } finally {
            setIsLoadingProduct(false);
          }
        } else {
          setSearchQuery('Selected Product');
        }
      } else if (existingCreateNew && existingNewProductData) {
        // Was in create mode - restore new product data
        setIsCreateMode(true);
        setNewProductData(existingNewProductData);
        // Set searchQuery to the name for context
        if (existingNewProductData.name) {
          setSearchQuery(existingNewProductData.name);
        }
      }
      
      // Allow search effect to run again after initialization
      setTimeout(() => setIsSelectingProduct(false), 500);
    };
    
    initFromForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Keyboard navigation for search results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCreateMode || products.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % products.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + products.length) % products.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && products[selectedIndex]) {
            handleSelectProduct(products[selectedIndex]);
          }
          break;
        case 'Escape':
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCreateMode, products, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch products when search query changes (debounced)
  useEffect(() => {
    // Don't search if:
    // 1. Currently selecting a product
    // 2. A product is already selected (in the form)
    if (isSelectingProduct || selectedProductId) return;
    
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 && !isCreateMode) {
        searchProducts(searchQuery);
      } else if (searchQuery.length < 2) {
        setProducts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isCreateMode, isSelectingProduct, selectedProductId]);

  const searchProducts = async (query: string) => {
    if (!session?.user?.token) return;

    setIsLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      let url = `${API_URL}/api/products/search?q=${encodeURIComponent(query)}&limit=15`;
      if (selectedTypeFilter) {
        url += `&type=${encodeURIComponent(selectedTypeFilter)}`;
      }
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      const productList = data.data?.products || data.data || [];
      setProducts(productList);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error searching products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeFilterClick = (type: string) => {
    setSelectedTypeFilter(selectedTypeFilter === type ? null : type);
    if (searchQuery.length >= 2) {
      searchProducts(searchQuery);
    }
  };

  const handleSelectProduct = useCallback((product: Product) => {
    const productId = product._id || product.id || '';
    
    console.log('🔍 handleSelectProduct called:', { productId, productName: product.name });
    
    // Prevent search effect from triggering
    setIsSelectingProduct(true);
    
    // Clear create mode and product not found state
    setIsCreateMode(false);
    setNewProductData(null);
    setSelectedIndex(-1);
    setProducts([]);
    setProductNotFound(false);
    
    // Store selected product for display (persists even after products array is cleared)
    setFetchedProduct(product);
    
    // Set form values using subProductData namespace consistently
    setValue('subProductData.product', productId, { shouldValidate: true });
    setValue('subProductData.createNewProduct', false);
    setValue('subProductData.newProductData', null);
    setValue('subProductData.tenant', '');
    
    // Force update the search query display
    setSearchQuery(product.name);
    
    clearErrors('subProductData.product');
    clearErrors('subProductData.newProductData');
    
    console.log('✅ Form values set:', {
      product: watch('subProductData.product'),
      createNewProduct: watch('subProductData.createNewProduct'),
      newProductData: watch('subProductData.newProductData')
    });
    
    // Allow search effect to run again after a short delay
    setTimeout(() => setIsSelectingProduct(false), 500);
    
    onProductSelect?.(productId);
  }, [setValue, clearErrors, onProductSelect, watch]);

  const handleCreateNewProduct = useCallback((query: string) => {
    console.log('🔍 handleCreateNewProduct called:', query);
    
    // Prevent search effect from triggering
    setIsSelectingProduct(true);
    
    setIsCreateMode(true);
    setNewProductData(null);
    setSelectedIndex(-1);
    setProducts([]);
    
    // Set form values using subProductData namespace - order matters!
    setValue('subProductData.createNewProduct', true);
    setValue('subProductData.product', '');
    setValue('subProductData.newProductData', { name: query } as NewProductFormData, { shouldValidate: true });
    setValue('subProductData.tenant', '');
    
    setSearchQuery(query);
    
    clearErrors('subProductData.product');
    clearErrors('subProductData.newProductData');
    
    console.log('✅ Create mode set:', {
      createNewProduct: watch('subProductData.createNewProduct'),
      product: watch('subProductData.product'),
      newProductData: watch('subProductData.newProductData')
    });
    
    // Allow search effect to run again after a short delay
    setTimeout(() => setIsSelectingProduct(false), 500);
  }, [setValue, clearErrors, watch]);

  const handleBackToSearch = useCallback(() => {
    // Prevent search effect from triggering
    setIsSelectingProduct(true);
    
    setIsCreateMode(false);
    setNewProductData(null);
    setValue('subProductData.createNewProduct', false);
    setValue('subProductData.newProductData', null);
    
    // Allow search effect to run again after a short delay
    setTimeout(() => setIsSelectingProduct(false), 500);
  }, [setValue]);

  const handleNewProductChange = (data: NewProductFormData) => {
    setNewProductData(data);
    setValue('subProductData.newProductData', data, { shouldValidate: true });
    clearErrors('subProductData.newProductData');
    onNewProductCreate?.(data);
  };

  const handleClearSelection = () => {
    setSearchQuery('');
    setProducts([]);
    setSelectedIndex(-1);
    setNewProductData(null);
    setIsCreateMode(false);
    setFetchedProduct(null);
    setProductNotFound(false);
    setValue('subProductData.product', '', { shouldValidate: true });
    setValue('subProductData.createNewProduct', false);
    setValue('subProductData.newProductData', null);
    clearErrors('subProductData.product');
    clearErrors('subProductData.newProductData');
  };

  const getSelectedProduct = (): Product | null => {
    if (!selectedProductId || isCreateMode) return null;
    // First check local products array (from search results)
    const localProduct = products.find(p => (p._id || p.id) === selectedProductId);
    if (localProduct) return localProduct;
    // Fallback to fetched product (from form initialization)
    if (fetchedProduct) return fetchedProduct;
    return null;
  };

  const selectedProduct = getSelectedProduct();
  
  // Image upload functionality
  const subProductImages = watch?.('subProductData.images') || [];
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!session?.user?.token) {
      toast.error('Please sign in to upload images');
      return;
    }

    setIsUploading(true);

    try {
      const uploadedFiles = await uploadService.uploadMultipleFiles(Array.from(files), session.user.token);
      
      const newImages = uploadedFiles.map((file: any, index: number) => ({
        url: file.url,
        publicId: file.publicId,
        thumbnail: file.thumbnail || file.url,
        isPrimary: index === 0,
      }));

      setValue?.('subProductData.images', (currentImages: any[] = []) => {
        const updatedImages = [...currentImages, ...newImages];
        const hasPrimary = updatedImages.some((img: any) => img.isPrimary);
        if (!hasPrimary && updatedImages.length > 0) {
          updatedImages[0].isPrimary = true;
        }
        return updatedImages;
      });
      toast.success('Images uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  }, [session, setValue]);

  const handleRemoveImage = (index: number) => {
    const newImages = [...subProductImages];
    const removedImage = newImages[index];
    newImages.splice(index, 1);
    
    if (removedImage?.isPrimary && newImages.length > 0) {
      newImages[0].isPrimary = true;
    }
    
    setValue?.('subProductData.images', newImages);
  };

  const handleSetPrimary = (index: number) => {
    const newImages = subProductImages.map((img: any, idx: number) => ({
      ...img,
      isPrimary: idx === index,
    }));
    setValue?.('subProductData.images', newImages);
  };

  const getSelectedCurrency = () => currencies.find(c => c.value === selectedCurrency) || currencies[0];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <PiTag className="h-5 w-5 text-white" />
          </div>
          <div>
            <Text className="text-lg font-semibold text-gray-900">Basic Information</Text>
            <Text className="text-sm text-gray-500">
              Search for an existing product or create a new one
            </Text>
          </div>
        </div>
      </div>

      {/* Type Filter Chips */}
      {!isCreateMode && !selectedProductId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <PiFunnel className="h-4 w-4" />
              Quick Filter by Type
            </label>
            {selectedTypeFilter && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTypeFilter(null);
                  if (searchQuery.length >= 2) searchProducts(searchQuery);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <PiX className="h-3 w-3" />
                Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {popularTypes.map((type) => (
              <motion.button
                key={type.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => handleTypeFilterClick(type.label)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                  selectedTypeFilter === type.label
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                )}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Create Mode - Back Button */}
      <AnimatePresence>
        {isCreateMode && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            type="button"
            onClick={handleBackToSearch}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <PiArrowLeft className="h-4 w-4" />
            Back to search
          </motion.button>
        )}
      </AnimatePresence>

      {/* Search Mode */}
      {!isCreateMode && (
        <div ref={dropdownRef}>
          <Controller
            name="subProductData.product"
            control={control}
            rules={{
              validate: (value) => {
                if (createNewProduct) return true;
                return value ? true : 'Product is required';
              },
            }}
            render={({ field, fieldState: { error } }) => {
              fieldOnChangeRef.current = field.onChange;

              return (
                <div className="space-y-4">
                  {/* Search Input Container - relative for dropdown positioning */}
                  <div className="relative">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          Search Product <span className="text-red-500">*</span>
                        </label>
                        <ProductSearchInput
                          value={searchQuery}
                          onChange={setSearchQuery}
                          onClear={handleClearSelection}
                          isLoading={isLoading || isLoadingProduct}
                          placeholder={isLoadingProduct ? "Loading product..." : "Search by name, brand, or scan barcode..."}
                        />
                        {error && (
                          <Text className="mt-1 text-xs text-red-500">
                            {error.message}
                          </Text>
                        )}
                      </div>
                      
                      {/* Create Product First Button */}
                      {!selectedProductId && !isCreateMode && (
                        <div className="pt-1.5">
                          <button
                            type="button"
                            onClick={() => handleCreateNewProduct(searchQuery || '')}
                            className="group relative inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all whitespace-nowrap"
                            title="Create new product in central catalog (will require approval)"
                          >
                            <PiPlusCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Create Product</span>
                            <span className="sm:hidden">Create</span>
                          </button>
                          <p className="text-xs text-gray-500 mt-1 hidden lg:block">
                            Creates central Product (pending approval)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Search Results Dropdown - positioned relative to input container */}
                    <AnimatePresence>
                      {hasSearched && products.length > 0 && (
                        <ProductSearchResults
                          products={products}
                          selectedIndex={selectedIndex}
                          selectedProductId={selectedProductId}
                          highlightedText={searchQuery}
                          isLoading={isLoading}
                          searchQuery={searchQuery}
                          onSelect={handleSelectProduct}
                          onCreateNew={handleCreateNewProduct}
                        />
                      )}
                    </AnimatePresence>

                    {/* No Results - with Create New button */}
                    <AnimatePresence>
                      {hasNoResults && (
                        <ProductSearchResults
                          products={[]}
                          selectedIndex={-1}
                          selectedProductId={selectedProductId}
                          highlightedText={searchQuery}
                          isLoading={isLoading}
                          searchQuery={searchQuery}
                          onSelect={handleSelectProduct}
                          onCreateNew={handleCreateNewProduct}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected Product Display */}
                  <AnimatePresence>
                    {selectedProduct && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-white overflow-hidden">
                              {selectedProduct.primaryImage?.url || selectedProduct.images?.[0]?.url ? (
                                <Image
                                  src={selectedProduct.primaryImage?.url || selectedProduct.images?.[0]?.url || ''}
                                  alt={selectedProduct.name}
                                  width={56}
                                  height={56}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <PiPackage className="h-8 w-8 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Text className="truncate text-sm font-semibold text-green-900">
                                {selectedProduct.name}
                              </Text>
                              <Text className="text-xs text-green-700">
                                {selectedProduct.type && `${selectedProduct.type}`}
                                {selectedProduct.brand && ` • ${typeof selectedProduct.brand === 'string' ? selectedProduct.brand : selectedProduct.brand?.name}`}
                              </Text>
                              <Text className="text-xs text-green-600 mt-0.5">
                                ID: {selectedProduct._id || selectedProduct.id}
                              </Text>
                            </div>
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                              <PiCheck className="h-5 w-5 text-green-600" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Product Not Found Warning */}
                  <AnimatePresence>
                    {productNotFound && !selectedProduct && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                              <PiWarning className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <Text className="text-sm font-semibold text-amber-900">
                                Product Not Found
                              </Text>
                              <Text className="text-xs text-amber-700 mt-1">
                                The product linked to this SubProduct no longer exists or was deleted. 
                                Please search and select a new product to continue editing.
                              </Text>
                              <Text className="text-xs text-amber-600 mt-2 font-mono">
                                Missing Product ID: {selectedProductId}
                              </Text>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Create New Mode */}
      {isCreateMode && (
        <Controller
          name="subProductData.newProductData"
          control={control}
          rules={{
            validate: (value) => {
              if (!createNewProduct) return true;
              if (!value?.name || !value?.type) {
                return 'Product name and type are required';
              }
              return true;
            },
          }}
          render={({ fieldState: { error } }) => (
            <CreateNewProductForm
              value={newProductData}
              onChange={handleNewProductChange}
              errors={error ? { name: error, type: error } : {}}
              initialName={searchQuery}
            />
          )}
        />
      )}

      {/* SKU - Server-generated */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          SKU <span className="text-xs font-normal text-gray-400">(Auto-generated)</span>
        </label>
        <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <PiCheck className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <Text className="text-sm text-blue-700">
              SKU will be automatically generated by the server upon creation
            </Text>
          </div>
        </div>
      </div>

      {/* Currency - Enhanced Dropdown */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Currency <span className="text-red-500">*</span>
        </label>
        <div className="relative" ref={currencyRef}>
          <button
            type="button"
            onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left transition-all',
              'hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100',
              errors.subProductData?.currency ? 'border-red-300' : 'border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{getSelectedCurrency().flag}</span>
              <span className="font-medium text-gray-900">{getSelectedCurrency().value}</span>
              <span className="text-sm text-gray-500">- {getSelectedCurrency().label.split(' - ')[1]}</span>
            </div>
            <motion.div
              animate={{ rotate: showCurrencyDropdown ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <PiCaretRight className="h-4 w-4 text-gray-400" />
            </motion.div>
          </button>
          
          <AnimatePresence>
            {showCurrencyDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              >
                {currencies.map((currency, index) => (
                  <motion.button
                    key={currency.value}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    type="button"
                    onClick={() => {
                      setValue('subProductData.currency', currency.value);
                      setShowCurrencyDropdown(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                      selectedCurrency === currency.value && 'bg-blue-50'
                    )}
                  >
                    <span className="text-lg">{currency.flag}</span>
                    <span className={cn(
                      'font-medium',
                      selectedCurrency === currency.value ? 'text-blue-700' : 'text-gray-900'
                    )}>
                      {currency.value}
                    </span>
                    <span className="text-sm text-gray-500">
                      {currency.label.split(' - ')[1]}
                    </span>
                    {selectedCurrency === currency.value && (
                      <PiCheck className="ml-auto h-4 w-4 text-blue-600" />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {errors.subProductData?.currency && (
          <Text className="mt-1 text-xs text-red-500">{errors.subProductData.currency.message}</Text>
        )}
      </div>

      {/* Product Images - Enhanced */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <PiImages className="h-4 w-4" />
            Product Images
            {subProductImages.length > 0 && (
              <Badge color="primary" size="sm" variant="flat">
                {subProductImages.length}
              </Badge>
            )}
          </label>
          {subProductImages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setValue?.('subProductData.images', []);
                toast.success('All images cleared');
              }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <PiTrash className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
        <div className="space-y-3">
          {/* Image Upload Area */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="relative"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={isUploading}
              className="sr-only"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className={cn(
                'flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all',
                isUploading 
                  ? 'border-gray-300 bg-gray-50' 
                  : 'border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-400'
              )}
            >
              {isUploading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <PiSpinner className="h-6 w-6 text-blue-600" />
                  </motion.div>
                  <div className="text-center">
                    <Text className="text-sm font-medium text-gray-600">Uploading...</Text>
                    <Text className="text-xs text-gray-500">Please wait</Text>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <PiUpload className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <Text className="text-sm font-medium text-gray-900">
                      Drop images here or click to upload
                    </Text>
                    <Text className="text-xs text-gray-500">
                      PNG, JPG up to 10MB each
                    </Text>
                  </div>
                </>
              )}
            </label>
          </motion.div>

          {/* Image Preview Grid - Enhanced */}
          {subProductImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              {subProductImages.map((image: any, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.03 }}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-xl border-2 transition-all',
                    image.isPrimary 
                      ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg' 
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <Image
                    src={image.url || image.thumbnail}
                    alt={`Product image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Primary Badge */}
                  {image.isPrimary && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg flex items-center gap-1"
                    >
                      <PiStar className="h-3 w-3" />
                      Primary
                    </motion.div>
                  )}
                  
                  {/* Index Badge */}
                  <div className="absolute left-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {index + 1}
                  </div>

                  {/* Hover Actions */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 backdrop-blur-sm"
                  >
                    {!image.isPrimary && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrimary(index);
                        }}
                        className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-100"
                      >
                        <PiStar className="h-3 w-3" />
                        Primary
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                    >
                      <PiTrash className="h-3 w-3" />
                      Remove
                    </motion.button>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          )}
          
          {errors.subProductData?.images && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1"
            >
              <PiWarning className="h-4 w-4 text-red-500" />
              <Text className="text-xs text-red-500">{errors.subProductData.images.message}</Text>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}