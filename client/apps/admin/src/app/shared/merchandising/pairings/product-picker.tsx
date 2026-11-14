'use client';

/**
 * Server-side product picker for the pairing form.
 *
 * Reuses the banner editor's debounced search hook
 * (`banner/create-edit/use-server-search`) and its underlying product service
 * call, so the picker lists the tenant's own products exactly like the banner
 * CTA "Link to Product" picker does. Unlike the banner picker — which stores a
 * slug in `_id` to build storefront URLs — pairings need real ObjectIds,
 * because the pairing API validates and stores product refs.
 *
 * Two usages:
 * - source product (single — selecting replaces the current source)
 * - suggestions (multi — capped by the API's 1–4 rule, passed in `maxReached`)
 */

import { useState, useCallback } from 'react';
import {
  PiMagnifyingGlass,
  PiPackage,
  PiSpinnerBold,
  PiXBold,
} from 'react-icons/pi';
import { productService } from '@/services/product.service';
import { useServerSearch } from '@/app/shared/ecommerce/banner/create-edit/use-server-search';

export interface PickerProduct {
  _id: string;
  name: string;
  slug?: string;
  type?: string;
  images?: { url?: string }[];
}

interface PairingProductPickerProps {
  /** aria-label for the trigger button — the picker's accessible name. */
  triggerLabel: string;
  /** Search input placeholder. */
  placeholder: string;
  token: string;
  selected: PickerProduct[];
  onAdd: (product: PickerProduct) => void;
  onRemove: (id: string) => void;
  /** True when no more picks are allowed (suggestions at cap). */
  maxReached?: boolean;
}

function ProductThumb({ product }: { product: PickerProduct }) {
  const src = product.images?.[0]?.url;
  if (!src) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <PiPackage className="h-5 w-5 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

export default function PairingProductPicker({
  triggerLabel,
  placeholder,
  token,
  selected,
  onAdd,
  onRemove,
  maxReached = false,
}: PairingProductPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Same server-side search the banner editor's product picker performs —
  // the admin product list supports `search` with regex matching on
  // name/slug/description/brand, scoped to the authenticated tenant.
  const fetchSearch = useCallback(
    async (q: string) => {
      const res = (await productService.getProducts(token, {
        search: q,
        limit: 50,
        page: 1,
      })) as {
        data?: { products?: PickerProduct[] };
        products?: PickerProduct[];
      };
      return res?.data?.products || res?.products || [];
    },
    [token]
  );

  const { items: products, searching } = useServerSearch(query, fetchSearch);

  const selectedIds = new Set(selected.map((p) => p._id));

  const pick = (product: PickerProduct) => {
    onAdd(product);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
          open
            ? 'border-[#b20202] ring-2 ring-[#b20202]/20'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className="flex items-center gap-2 text-gray-500">
          <PiMagnifyingGlass className="h-4 w-4" />
          {placeholder}
        </span>
        {maxReached && (
          <span className="text-xs font-semibold text-amber-600">Full</span>
        )}
      </button>

      {open && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/20"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PiSpinnerBold className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {query.trim().length < 2 ? (
            <p className="p-3 text-center text-xs text-gray-400">
              Type at least 2 characters to search
            </p>
          ) : products.length === 0 && !searching ? (
            <p className="p-3 text-center text-sm text-gray-500">
              No products match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {products.map((product) => {
                const alreadySelected = selectedIds.has(product._id);
                const disabled = maxReached || alreadySelected;
                return (
                  <button
                    key={product._id}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(product)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ProductThumb product={product} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.type || 'Product'}
                      </p>
                    </div>
                    {alreadySelected && (
                      <span className="text-xs font-semibold text-emerald-600">
                        Added
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((product) => (
            <li
              key={product._id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <ProductThumb product={product} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {product.name}
                  </p>
                  {product.type && (
                    <p className="text-xs text-gray-500">{product.type}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${product.name}`}
                onClick={() => onRemove(product._id)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <PiXBold className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
