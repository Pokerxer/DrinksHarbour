import type { FilterState } from '../../types/filter.types';

export function readShopFilters(params: URLSearchParams, priceBounds: FilterState['priceRange']): Partial<FilterState> {
  const parse = (value: string | null) => value ? (value.includes(',') ? value.split(',') : value) : null;
  return {
    categoryType: parse(params.get('category')),
    subCategoryType: parse(params.get('subcategory')),
    brand: parse(params.get('brand')),
    originCountry: parse(params.get('origin')),
    flavorCategory: parse(params.get('flavor')),
    size: params.get('size') || null,
    volumeRange: params.get('volume') || null,
    priceRange: {
      min: numberParam(params, 'minPrice', priceBounds.min),
      max: numberParam(params, 'maxPrice', priceBounds.max),
    },
    abvRange: params.has('minABV') || params.has('maxABV') ? {
      min: numberParam(params, 'minABV', 0),
      max: numberParam(params, 'maxABV', 100),
    } : null,
    minRating: params.has('minRating') ? numberParam(params, 'minRating', 0) || null : null,
    sortOption: params.get('sort') || '',
    showOnlySale: params.get('sale') === 'true',
  };
}

function numberParam(params: URLSearchParams, key: string, fallback: number): number {
  const value = params.get(key);
  if (!value?.trim()) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

interface CatalogFacets {
  countries?: string[];
  origins?: string[];
  flavors?: Array<{ category?: string }>;
}

export function readCatalogFacets(data: CatalogFacets) {
  return {
    originCountry: data.countries ?? data.origins ?? [],
    flavorCategory: Array.from(new Set((data.flavors ?? []).map(flavor => flavor.category).filter((category): category is string => Boolean(category)))),
  };
}
