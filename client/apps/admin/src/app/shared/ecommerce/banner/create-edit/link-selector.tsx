// @ts-nocheck
'use client';

/**
 * Product/category link pickers for the CTA section.
 * Debounced server search with dropdown results; selection stores a slug in
 * `_id` (used to build the storefront CTA URL) plus a display name.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PiMagnifyingGlass,
  PiPackage,
  PiFolder,
  PiX,
  PiSpinnerBold,
} from 'react-icons/pi';
import { productService } from '@/services/product.service';
import { categoryService } from '@/services/category.service';

export interface LinkSelectorProps {
  linkType: string;
  targetProduct?: { _id: string; name: string };
  targetCategory?: { _id: string; name: string };
  onProductSelect: (product: { _id: string; name: string } | null) => void;
  onCategorySelect: (category: { _id: string; name: string } | null) => void;
  token: string;
}

export default function LinkSelector({
  linkType,
  targetProduct,
  targetCategory,
  onProductSelect,
  onCategorySelect,
  token,
}: LinkSelectorProps) {
  const [productSearch, setProductSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isSearchingCategories, setIsSearchingCategories] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const searchProducts = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setProducts([]);
        return;
      }

      setIsSearchingProducts(true);
      try {
        const response = await productService.getProducts(token, {
          search: query,
          limit: 10,
        });
        const productList =
          response?.data?.products || response?.products || [];
        setProducts(productList);
      } catch (err) {
        console.error('Error searching products:', err);
        setProducts([]);
      } finally {
        setIsSearchingProducts(false);
      }
    },
    [token]
  );

  const searchCategories = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setCategories([]);
        return;
      }

      setIsSearchingCategories(true);
      try {
        const response = await categoryService.getCategories(token);
        const filtered = response.filter((c: any) =>
          c.name?.toLowerCase().includes(query.toLowerCase())
        );
        setCategories(filtered.slice(0, 10));
      } catch (err) {
        console.error('Error searching categories:', err);
        setCategories([]);
      } finally {
        setIsSearchingCategories(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) searchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, searchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (categorySearch) searchCategories(categorySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [categorySearch, searchCategories]);

  const handleProductSelect = (product: any) => {
    const slug = product.slug || product._id;
    onProductSelect({ _id: slug, name: product.name });
    setProductSearch(product.name);
    setProducts([]);
    setShowProductDropdown(false);
  };

  const handleCategorySelect = (category: any) => {
    const slug = category.slug || category._id;
    onCategorySelect({ _id: slug, name: category.name });
    setCategorySearch(category.name);
    setCategories([]);
    setShowCategoryDropdown(false);
  };

  const clearProduct = () => {
    onProductSelect(null);
    setProductSearch('');
    setProducts([]);
  };

  const clearCategory = () => {
    onCategorySelect(null);
    setCategorySearch('');
    setCategories([]);
  };

  if (linkType !== 'product' && linkType !== 'category') {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
        Select "Product" or "Category" link type to link this banner to specific
        content.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {linkType === 'product' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Link to Product
          </label>
          {targetProduct ? (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <PiPackage className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {targetProduct.name}
                  </p>
                  <p className="text-xs text-green-600">Product linked</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearProduct}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <PiX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={productInputRef}
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Search products by name..."
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {isSearchingProducts && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>

              {showProductDropdown && products.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {products.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => handleProductSelect(product)}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      {product.images?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0].url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                          <PiPackage className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.type || 'Product'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showProductDropdown &&
                productSearch.length >= 2 &&
                products.length === 0 &&
                !isSearchingProducts && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">
                    No products found
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {linkType === 'category' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Link to Category
          </label>
          {targetCategory ? (
            <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <PiFolder className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {targetCategory.name}
                  </p>
                  <p className="text-xs text-purple-600">Category linked</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearCategory}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <PiX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={categoryInputRef}
                  type="text"
                  value={categorySearch}
                  onChange={(e) => {
                    setCategorySearch(e.target.value);
                    setShowCategoryDropdown(true);
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="Search categories..."
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {isSearchingCategories && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>

              {showCategoryDropdown && categories.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {categories.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                        <PiFolder className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {category.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {category.type || 'Category'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showCategoryDropdown &&
                categorySearch.length >= 2 &&
                categories.length === 0 &&
                !isSearchingCategories && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">
                    No categories found
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
