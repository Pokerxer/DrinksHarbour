'use client';
import { useCallback, useState } from 'react';
import {
  PiMagnifyingGlass,
  PiStorefrontBold,
  PiX,
  PiSpinnerBold,
} from 'react-icons/pi';
import { brandService, type Brand } from '@/services/brand.service';
import { useServerSearch } from './use-server-search';
export default function BrandPicker({
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

  const fetchSearch = useCallback(
    async (q: string) => {
      const res = await brandService.getBrands(token, {
        search: q,
        limit: 100,
      });
      return res;
    },
    [token]
  );

  const {
    items: brands,
    searching,
    error,
    retry,
  } = useServerSearch(query, fetchSearch);

  const select = (brand: Brand) => {
    onBrandSelect({ _id: brand.slug || brand._id, name: brand.name });
    setQuery(brand.name);
    setShowDropdown(false);
  };

  const clear = () => {
    onBrandSelect(null);
    setQuery('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Link to Brand
      </label>
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
          <button
            type="button"
            onClick={clear}
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
              aria-label="Search brands by name"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search brands by name..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          {showDropdown &&
            !error &&
            !searching &&
            query.trim().length >= 2 &&
            brands.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {brands.map((brand) => (
                  <button
                    key={brand._id}
                    type="button"
                    onClick={() => select(brand)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50"
                  >
                    {brand.logo?.url ? (
                      <img
                        src={brand.logo.url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                        <PiStorefrontBold className="h-5 w-5 text-amber-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {brand.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {brand.countryOfOrigin || 'Brand'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          {showDropdown && error && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-red-200 p-3 text-sm text-red-600"
            >
              {error}{' '}
              <button type="button" onClick={retry} className="ml-2 underline">
                Retry search
              </button>
            </div>
          )}
          {showDropdown &&
            query.trim().length >= 2 &&
            brands.length === 0 &&
            !searching &&
            !error && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">
                No brands match &ldquo;{query}&rdquo;
              </div>
            )}
          {showDropdown && query.trim().length < 2 && !searching && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-center text-xs text-gray-400 shadow-lg">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}
