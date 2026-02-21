// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Text } from 'rizzui';
import { useSession } from 'next-auth/react';
import { PiCheck, PiPackage, PiArrowLeft, PiTag, PiBarcode, PiHash, PiSpinner, PiUpload, PiX, PiPlusCircle } from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { uploadService } from '@/services/upload.service';
import toast from 'react-hot-toast';

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
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fieldOnChangeRef = useRef<((value: string) => void) | null>(null);

  const control = methods?.control;
  const setValue = methods?.setValue;
  const watch = methods?.watch;
  const setError = methods?.setError;
  const clearErrors = methods?.clearErrors;
  const errors = methods?.formState?.errors || {};

  const selectedProductId = watch?.('subProductData.product');
  const createNewProduct = watch?.('subProductData.createNewProduct');

  const hasSearched = searchQuery.length >= 2 && !selectedProductId;
  const hasNoResults = hasSearched && products.length === 0 && !isLoading;

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
        
        // Fetch product details if we have a session token
        if (session?.user?.token) {
          setIsLoadingProduct(true);
          try {
            const response = await productService.getProductById(existingProductId, session.user.token);
            if (response.success && response.data?.product) {
              const product = response.data.product;
              setFetchedProduct(product);
              setSearchQuery(product.name || 'Selected Product');
            } else {
              setSearchQuery('Selected Product');
            }
          } catch (error) {
            console.error('Error fetching product:', error);
            setSearchQuery('Selected Product');
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
      const response = await fetch(
        `${API_URL}/api/products/search?q=${encodeURIComponent(query)}&limit=15`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

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

  const handleSelectProduct = useCallback((product: Product) => {
    const productId = product._id || product.id || '';
    
    console.log('🔍 handleSelectProduct called:', { productId, productName: product.name });
    
    // Prevent search effect from triggering
    setIsSelectingProduct(true);
    
    // Clear create mode first
    setIsCreateMode(false);
    setNewProductData(null);
    setSelectedIndex(-1);
    setProducts([]);
    
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

  return (
    <div className="space-y-6">
      <div>
        <Text className="mb-2 text-lg font-semibold">Basic Information</Text>
        <Text className="text-sm text-gray-500">
          Search for an existing product or create a new one
        </Text>
      </div>

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

      {/* Currency */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Currency
        </label>
        <select
          {...control.register('subProductData.currency')}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
        >
          <option value="NGN">NGN - Nigerian Naira</option>
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
          <option value="ZAR">ZAR - South African Rand</option>
          <option value="KES">KES - Kenyan Shilling</option>
          <option value="GHS">GHS - Ghanaian Cedi</option>
        </select>
      </div>

      {/* Product Images */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Product Images
        </label>
        <div className="space-y-3">
          {/* Image Upload Area */}
          <div className="flex items-center gap-2">
            <label className="relative cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={isUploading}
                className="sr-only"
              />
              <div className={`
                flex items-center gap-2 rounded-lg border-2 border-dashed 
                ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-blue-300 bg-blue-50 hover:bg-blue-100'}
                px-4 py-2 transition-colors
              `}>
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </>
                ) : (
                  <>
                    <PiUpload className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-600">Upload Images</span>
                  </>
                )}
              </div>
            </label>
            <Text className="text-xs text-gray-500">
              {subProductImages.length > 0 && `${subProductImages.length} image(s) uploaded`}
            </Text>
          </div>

          {/* Image Preview Grid */}
          {subProductImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {subProductImages.map((image: any, index: number) => (
                <div
                  key={index}
                  className={`
                    group relative aspect-square overflow-hidden rounded-lg border-2
                    ${image.isPrimary ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                  `}
                >
                  <Image
                    src={image.url || image.thumbnail}
                    alt={`Product image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Primary Badge */}
                  {image.isPrimary && (
                    <div className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Primary
                    </div>
                  )}
                  
                  {/* Hover Actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {!image.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="rounded bg-red-500 p-1.5 text-white hover:bg-red-600"
                    >
                      <PiX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {errors.subProductData?.images && (
            <Text className="text-xs text-red-500">{errors.subProductData.images.message}</Text>
          )}
        </div>
      </div>
    </div>
  );
}
