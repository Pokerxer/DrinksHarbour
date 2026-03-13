export interface FilterState {
  type: string | null;
  size: string | null;
  color: string | null;
  brand: string | null;
  originCountry: string | null;
  categoryType: string | null;
  subCategoryType: string | null;
  flavorCategory: string | null;
  priceRange: { min: number; max: number };
  showOnlySale: boolean;
  sortOption: string;
  minRating: number | null;
}

export interface FilterOptions {
  type: string[];
  size: string[];
  color: string[];
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
  getCountByOriginCountry: (country: string) => number;
  getCountByCategoryType: (categoryType: string) => number;
  getCountByFlavorCategory: (flavorCategory: string) => number;
}
