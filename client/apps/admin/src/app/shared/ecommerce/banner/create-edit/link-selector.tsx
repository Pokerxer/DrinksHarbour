// @ts-nocheck
'use client';

/**
 * Link pickers for the CTA section.
 * Handles product, category and brand selection with debounced search; for
 * internal/external/collection/page the admin types the URL directly.
 *
 * Selection stores the slug in `_id` (used to build the storefront CTA URL)
 * and the display name.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PiMagnifyingGlass,
  PiPackage,
  PiFolder,
  PiStorefrontBold,
  PiX,
  PiSpinnerBold,
} from 'react-icons/pi';
import { productService } from '@/services/product.service';
import { categoryService } from '@/services/category.service';
import { brandService } from '@/services/brand.service';

export interface LinkSelectorProps {
  linkType: string;
  targetProduct?: { _id: string; name: string };
  targetCategory?: { _id: string; name: string };
  targetBrand?: { _id: string; name: string };
  onProductSelect: (product: { _id: string; name: string } | null) => void;
  onCategorySelect: (category: { _id: string; name: string } | null) => void;
  onBrandSelect: (brand: { _id: string; name: string } | null) => void;
  token: string;
}

// ─── Inline search hook ───────────────────────────────────────────────────────

function useDropdownSearch<T extends { _id: string; name: string }>(
  query: string,
  fetchAll: () => Promise<T[]>,
  filterName: (item: T, q: string) => boolean,
  debounceMs = 300,
) {
  const [items, setItems] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query) { setItems([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const all = await fetchAll();
        setItems(all.filter(item => filterName(item, query)).slice(0, 10));
      } catch {
        setItems([]);
      } finally {
        setSearching(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, fetchAll, filterName, debounceMs]);

  return { items, searching };
}

// ─── LinkType picker hint for URL-only types ─────────────────────────────────

const URL_HINT: Record<string, string> = {
  internal: 'Enter a path relative to the storefront, e.g. /shop',
  external: 'Enter a full URL, e.g. https://example.com',
  page: 'Enter the page path, e.g. /about',
  collection: 'Enter a storefront URL — the collection selector is coming soon',
};

function UrlOnlyHint({ linkType }: { linkType: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
      {URL_HINT[linkType] || 'Type the destination URL in the CTA Link field below.'}
    </div>
  );
}

// ─── Product picker ───────────────────────────────────────────────────────────

function ProductPicker({
  token,
  targetProduct,
  onProductSelect,
}: {
  token: string;
  targetProduct?: { _id: string; name: string };
  onProductSelect: (p: { _id: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await productService.getProducts(token, { search: '', limit: 200 });
    return (res?.data?.products || res?.products || []) as any[];
  }, [token]);

  const { items: products, searching } = useDropdownSearch(
    query, fetchAll,
    (item: any, q: string) => item.name?.toLowerCase().includes(q.toLowerCase()),
  );

  const select = (product: any) => {
    onProductSelect({ _id: product.slug || product._id, name: product.name });
    setQuery(product.name);
    setShowDropdown(false);
  };

  const clear = () => { onProductSelect(null); setQuery(''); };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Link to Product</label>
      {targetProduct ? (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <PiPackage className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{targetProduct.name}</p>
              <p className="text-xs text-green-600">Product linked</p>
            </div>
          </div>
          <button type="button" onClick={clear} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
            <PiX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search products by name..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" /></div>}
          </div>
          {showDropdown && products.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {products.map((product: any) => (
                <button key={product._id} type="button" onClick={() => select(product)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50">
                  {product.images?.[0]?.url
                    ? <img src={product.images[0].url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100"><PiPackage className="h-5 w-5 text-gray-400" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.type || 'Product'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && query.length >= 2 && products.length === 0 && !searching && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">No products found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────

function CategoryPicker({
  token,
  targetCategory,
  onCategorySelect,
}: {
  token: string;
  targetCategory?: { _id: string; name: string };
  onCategorySelect: (c: { _id: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await categoryService.getCategories(token);
    return (Array.isArray(res) ? res : []) as any[];
  }, [token]);

  const { items: categories, searching } = useDropdownSearch(
    query, fetchAll,
    (item: any, q: string) => item.name?.toLowerCase().includes(q.toLowerCase()),
  );

  const select = (category: any) => {
    onCategorySelect({ _id: category.slug || category._id, name: category.name });
    setQuery(category.name);
    setShowDropdown(false);
  };

  const clear = () => { onCategorySelect(null); setQuery(''); };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Link to Category</label>
      {targetCategory ? (
        <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <PiFolder className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{targetCategory.name}</p>
              <p className="text-xs text-purple-600">Category linked</p>
            </div>
          </div>
          <button type="button" onClick={clear} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
            <PiX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search categories..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" /></div>}
          </div>
          {showDropdown && categories.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {categories.map((category: any) => (
                <button key={category._id} type="button" onClick={() => select(category)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <PiFolder className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{category.name}</p>
                    <p className="text-xs text-gray-500">{category.type || 'Category'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && query.length >= 2 && categories.length === 0 && !searching && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">No categories found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Brand picker ─────────────────────────────────────────────────────────────

function BrandPicker({
  token,
  targetBrand,
  onBrandSelect,
}: {
  token: string;
  targetBrand?: { _id: string; name: string };
  onBrandSelect: (b: { _id: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await brandService.getBrands(token, { limit: 500 });
    return (Array.isArray(res) ? res : []) as any[];
  }, [token]);

  const { items: brands, searching } = useDropdownSearch(
    query, fetchAll,
    (item: any, q: string) => item.name?.toLowerCase().includes(q.toLowerCase()),
  );

  const select = (brand: any) => {
    onBrandSelect({ _id: brand.slug || brand._id, name: brand.name });
    setQuery(brand.name);
    setShowDropdown(false);
  };

  const clear = () => { onBrandSelect(null); setQuery(''); };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Link to Brand</label>
      {targetBrand ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <PiStorefrontBold className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{targetBrand.name}</p>
              <p className="text-xs text-amber-600">Brand linked</p>
            </div>
          </div>
          <button type="button" onClick={clear} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
            <PiX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search brands..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" /></div>}
          </div>
          {showDropdown && brands.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {brands.map((brand: any) => (
                <button key={brand._id} type="button" onClick={() => select(brand)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50">
                  {brand.logo?.url
                    ? <img src={brand.logo.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100"><PiStorefrontBold className="h-5 w-5 text-amber-500" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{brand.name}</p>
                    <p className="text-xs text-gray-500">{brand.countryOfOrigin || 'Brand'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && query.length >= 2 && brands.length === 0 && !searching && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">No brands found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LinkSelector({
  linkType,
  targetProduct,
  targetCategory,
  targetBrand,
  onProductSelect,
  onCategorySelect,
  onBrandSelect,
  token,
}: LinkSelectorProps) {
  switch (linkType) {
    case 'product':
      return <ProductPicker token={token} targetProduct={targetProduct} onProductSelect={onProductSelect} />;
    case 'category':
      return <CategoryPicker token={token} targetCategory={targetCategory} onCategorySelect={onCategorySelect} />;
    case 'brand':
      return <BrandPicker token={token} targetBrand={targetBrand} onBrandSelect={onBrandSelect} />;
    case 'internal':
    case 'external':
    case 'page':
    case 'collection':
      return <UrlOnlyHint linkType={linkType} />;
    default:
      return <UrlOnlyHint linkType={linkType || 'default'} />;
  }
}
