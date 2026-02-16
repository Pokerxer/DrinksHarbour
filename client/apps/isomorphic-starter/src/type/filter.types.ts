// Update this file with new filter types
export interface FilterState { type: string | null;
size: string | null color: string | null // Keep for now, might remove;
brand: string | null priceRange: { min: number,
max: number } showOnlySale: boolean; sortOption: string // New filters;
originCountry: string | null categoryType: string | null;
subCategoryType: string | null flavorCategory: string | null;
minRating: number | null
}
export interface FilterOptions { type: string[];
size: string[] color: Array<{ value: string; color: string; label: string }> brand: string[] // New options;
originCountry: string[] categoryType: string[];
subCategoryType: string[] flavorCategory: string[];
priceRange: { min: number; max: number }
}
export interface SortOption { value: string; label: string;
disabled?: boolean
}
export interface ProductCountFunctions { getCountByType: (type: string) => number;
getCountByBrand: (brand: string) => number // New count functions;
getCountByOriginCountry: (country: string) => number;
getCountByCategoryType: (categoryType: string) => number;
getCountByFlavorCategory: (flavorCategory: string) => number
}