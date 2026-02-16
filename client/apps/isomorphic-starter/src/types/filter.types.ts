// types/filter.types.ts - Fixed version with correct field names /** * Current active filters applied by the user in the beverage shop */
export interface FilterState { /** Product type/subcategory (e.g., "Red Wine", "IPA", "Vodka") */ type: string | null /** Volume / packaging size (e.g., "750ml", "6-pack", "1L") */;
size: string | null /** Color is used for legacy compatibility - maps to flavors */ color: string | null /** Brand name (e.g., "Johnnie Walker", "Heineken") */;
brand: string | null /** Origin country filter */ originCountry: string | null /** Category type filter */;
categoryType: string | null /** Sub-category type filter */ subCategoryType: string | null /** Flavor category filter */;
flavorCategory: string | null /** Price range filter (in local currency) */ priceRange: { min: number; max: number } /** Only show products currently on sale/discount */ showOnlySale: boolean /** Selected sorting method */;
sortOption: string /** Minimum rating filter */ minRating: number | null
} /** * All available filter options (static or derived from product data) */
export interface FilterOptions { /** Available product types/subcategories */ type: string[] /** Available sizes/volumes/packaging options */;
size: string[] /** Color options - kept for backward compatibility */ color: string[] /** Available brands */;
brand: string[] /** Available origin countries */ originCountry: string[] /** Available category types */;
categoryType: string[] /** Available sub-category types */ subCategoryType: string[] /** Available flavor categories */;
flavorCategory: string[] /** Price range boundaries across all products */ priceRange: { min: number; max: number }
} /** * One sorting option shown in the dropdown */
export interface SortOption { /** Value used in state (must match backend or client-side sort logic) */ value: string /** Human-readable label */;
label: string /** If true, this option is disabled (e.g., placeholder "Sort by...") */ disabled?: boolean
} /** * Functions passed from Shop component to FilterSidebar to show product counts */
export interface ProductCountFunctions { getCountByType: (type: string) => number;
getCountByBrand: (brand: string) => number;
getCountByOriginCountry: (country: string) => number;
getCountByCategoryType: (categoryType: string) => number;
getCountByFlavorCategory: (flavorCategory: string) => number
}