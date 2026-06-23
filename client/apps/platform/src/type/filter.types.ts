export interface FilterState {
  type: string | null;
  size: string | null;
  color: string | null;
  brand: string | null;
  priceRange: { min: number; max: number };
  showOnlySale: boolean;
  sortOption: string;
  originCountry: string | null;
  categoryType: string | null;
  subCategoryType: string | null;
  flavorCategory: string | null;
  minRating: number | null;
}

export interface FilterOptions {
  type: string[];
  size: string[];
  color: Array<{ value: string; color: string; label: string }>;
  brand: string[];
  originCountry: string[];
  categoryType: string[];
  subCategoryType: string[];
  flavorCategory: string[];
  priceRange: { min: number; max: number };
}

export interface SortOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ProductCountFunctions {
  getCountByType: (type: string) => number;
  getCountByBrand: (brand: string) => number;
  getCountByCategory: (category: string) => number;
  getCountBySubCategory: (subCategory: string) => number;
  getCountByFlavor: (flavor: string) => number;
  getCountByOrigin: (origin: string) => number;
  getCountByPriceRange: (min: number, max: number) => number;
}
