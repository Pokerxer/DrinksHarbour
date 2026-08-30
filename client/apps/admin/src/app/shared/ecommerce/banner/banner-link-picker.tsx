// @ts-nocheck
'use client';

/**
 * BannerLinkPicker — reusable "Banner Link" editor.
 *
 * Used by the Brand / Category / SubCategory create-edit forms, which store a
 * single destination string (`bannerLink`) plus an internal/external flag
 * (`bannerLinkType`). This picker reuses the banner CTA link machinery:
 * - a Link Type select (internal / external / product / category / brand /
 *   page / collection)
 * - product/category/brand are picked via debounced server search and the
 *   canonical storefront path is built automatically
 * - internal / external / page / collection are typed raw
 *
 * The link type drives what gets built; the flag persisted to the model stays
 * `internal` or `external` (derived from the chosen type) so the existing
 * storefront consumer (ShopHeroBanner) keeps working unchanged.
 */

import { useState } from 'react';
import { Input, Select } from 'rizzui';
import {
  BANNER_LINK_TYPE_OPTIONS,
  type BannerLinkType,
} from '@/types/banner.types';
import LinkSelector from './link-selector';

function resolveType(linkType: BannerLinkType): 'internal' | 'external' {
  return linkType === 'external' ? 'external' : 'internal';
}

/** Build the canonical storefront path for a picked item. */
function buildInternalUrl(linkType: BannerLinkType, slug: string): string {
  switch (linkType) {
    case 'product':
      return `/product/${slug}`;
    case 'category':
      return `/categories/${slug}`;
    case 'brand':
      return `/brands/${slug}`;
    default:
      return `/${slug}`;
  }
}

export interface BannerLinkValue {
  url: string;
  type: 'internal' | 'external';
}

export interface BannerLinkPickerProps {
  token: string;
  value?: string; // existing bannerLink
  linkType?: BannerLinkType; // existing link type (defaults to internal)
  onChange: (value: BannerLinkValue) => void;
  /** Space to display the selector UI in the owning form. */
  className?: string;
}

export default function BannerLinkPicker({
  token,
  value = '',
  linkType = 'internal',
  onChange,
  className,
}: BannerLinkPickerProps) {
  const [selectedType, setSelectedType] = useState<BannerLinkType>(linkType);
  const [product, setProduct] = useState<{ _id: string; name: string } | null>(
    null
  );
  const [category, setCategory] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const [brand, setBrand] = useState<{ _id: string; name: string } | null>(null);

  const handleTypeChange = (v: any) => {
    const next = (v?.value ?? v) as BannerLinkType;
    setSelectedType(next);
    setProduct(null);
    setCategory(null);
    setBrand(null);
    // Internal/external/page/collection are typed raw — keep it editable.
    onChange({ url: '', type: resolveType(next) });
  };

  const handlePicked = (url: string) => {
    onChange({ url, type: 'internal' });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ url: e.target.value, type: resolveType(selectedType) });
  };

  const isTyped =
    selectedType === 'internal' ||
    selectedType === 'external' ||
    selectedType === 'page' ||
    selectedType === 'collection';

  const placeholder =
    selectedType === 'external'
      ? 'https://example.com/shop'
      : selectedType === 'internal' || selectedType === 'page'
        ? '/some/page'
        : selectedType === 'collection'
          ? '/shop?collection=name'
          : '/product/some-slug';

  return (
    <div className={className}>
      <Select
        label="Banner Link Type"
        options={BANNER_LINK_TYPE_OPTIONS}
        value={selectedType}
        getOptionValue={(o) => o.value}
        displayValue={(v: any) => v}
        onChange={handleTypeChange}
        selectClassName="w-full"
      />
      <div className="mt-3">
        {isTyped ? (
          <Input
            label="Banner Link"
            placeholder={placeholder}
            value={value}
            onChange={handleUrlChange}
            hint={
              selectedType === 'external'
                ? 'Full URL including https://'
                : 'Path relative to storefront, e.g. /shop'
            }
          />
        ) : (
          <>
            <LinkSelector
              linkType={selectedType}
              targetProduct={product ?? undefined}
              targetCategory={category ?? undefined}
              targetBrand={brand ?? undefined}
              onProductSelect={(p) => {
                setProduct(p);
                setCategory(null);
                setBrand(null);
                if (p) handlePicked(buildInternalUrl('product', p._id));
              }}
              onCategorySelect={(c) => {
                setCategory(c);
                setProduct(null);
                setBrand(null);
                if (c) handlePicked(buildInternalUrl('category', c._id));
              }}
              onBrandSelect={(b) => {
                setBrand(b);
                setProduct(null);
                setCategory(null);
                if (b) handlePicked(buildInternalUrl('brand', b._id));
              }}
              token={token}
            />
            <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">
                Banner link:{' '}
                <span className="font-medium text-gray-700">
                  {value || '—'}
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
