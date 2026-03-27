export interface FilterState {
  size: string | null;
  color: string | null;
  brand: string | string[] | null;
  originCountry: string | string[] | null;
  categoryType: string | string[] | null;
  subCategoryType: string | string[] | null;
  flavorCategory: string | string[] | null;
  priceRange: { min: number; max: number };
  showOnlySale: boolean;
  sortOption: string;
  minRating: number | null;
  abvRange: { min: number; max: number } | null;
  volumeRange: string | null;
}

export interface FilterOptions {
  size: string[];
  color: string[];
  brand: string[];
  originCountry: string[];
  categoryType: string[];
  subCategoryType: string[];
  flavorCategory: string[];
  priceRange: { min: number; max: number };
  abvRanges: { min: number; max: number; label: string }[];
  volumes: string[];
}

export interface SortOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ProductCountFunctions {
  getCountByBrand: (brand: string) => number;
  getCountByOriginCountry: (country: string) => number;
  getCountByCategoryType: (categoryType: string) => number;
  getCountBySubCategoryType: (subCategoryType: string) => number;
  getCountByFlavorCategory: (flavorCategory: string) => number;
}
