/**
 * Comprehensive Type Definitions for Product Filtering System
 * These types ensure type safety across the entire filtering workflow
 */

// ============================================================================
// Filter State Types
// ============================================================================
export interface PriceRange {
  min: number;
  max: number;
}

export interface FilterState {
  type: string | null;
  size: string | null;
  color: string | null;
  brand: string | null;
  priceRange: PriceRange;
  showOnlySale: boolean;
  sortOption: string;
  originCountry: string | null;
  categoryType: string | null;
  subCategoryType: string | null;
  flavorCategory: string | null;
  minRating: number | null;
}

// ============================================================================
// Filter Options Types
// ============================================================================
export interface FilterOptions {
  type: string[];
  size: string[];
  color: string[];
  brand: string[];
  originCountry: string[];
  categoryType: string[];
  subCategoryType: string[];
  flavorCategory: string[];
  priceRange: PriceRange;
}

// ============================================================================
// Sort Options Types
// ============================================================================
export interface SortOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SortValue =
  | ""
  | "popularity"
  | "priceHighToLow"
  | "priceLowToHigh"
  | "ratingHighToLow"
  | "newest"
  | "bestSelling";

// ============================================================================
// Product Count Function Types
// ============================================================================
export interface ProductCountFunctions {
  getCountByType: (type: string) => number;
  getCountByBrand: (brand: string) => number;
  getCountByOriginCountry: (country: string) => number;
  getCountByCategoryType: (categoryType: string) => number;
  getCountByFlavorCategory: (flavorCategory: string) => number;
}

// ============================================================================
// Product Types
// ============================================================================
export interface ProductImage {
  url: string;
  alt: string;
}

export interface ProductBrand {
  name: string;
  slug?: string;
}

export interface ProductCategory {
  name: string;
  type: string;
  slug?: string;
}

export interface ProductSize {
  size: string;
  displayName: string;
  volumeMl?: number;
  priceRange: PriceRange;
  availability?: number;
}

export interface ProductFlavor {
  _id?: string;
  name: string;
  value: string;
  category: string;
  color?: string;
}

export interface ProductStats {
  totalSold: number;
  totalStock: number;
  viewCount?: number;
}

export interface ProductBadge {
  type: "new" | "sale" | "featured" | "bestseller";
  text: string;
  color: string;
}

export interface ProductAvailability {
  totalStock: number;
  reservedStock?: number;
  availableStock?: number;
}

export interface BeverageProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  category: ProductCategory;
  brand: ProductBrand;
  images: ProductImage[];
  primaryImage: ProductImage;
  priceRange: PriceRange;
  sizes: ProductSize[];
  flavors: ProductFlavor[];
  rating: number;
  reviewCount: number;
  stats: ProductStats;
  badge?: ProductBadge;
  sale?: boolean;
  originCountry?: string;
  availability?: ProductAvailability;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any; // Allow for additional fields
}

// ============================================================================
// Component Prop Types
// ============================================================================
export interface BaseFilterProps {
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
}

export interface ShopProps {
  data: BeverageProduct[];
  productPerPage: number;
  dataType: string | null;
  slug?: string;
  productStyle: string;
}

export interface ProductGridProps {
  products: BeverageProduct[];
  layoutCol: number;
  productStyle: string;
}

export interface PaginationProps {
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

// ============================================================================
// Utility Types
// ============================================================================
export type FilterKey = keyof FilterState;
export type FilterValue<K extends FilterKey> = FilterState[K];
export type UpdateFilterFunction = <K extends FilterKey>(
  key: K,
  value: FilterValue<K>,
) => void;

// ============================================================================
// Event Handler Types
// ============================================================================
export type FilterClickHandler = (value: string) => void;
export type FilterChangeHandler = (value: string | boolean) => void;
export type PriceRangeChangeHandler = (values: number | number[]) => void;
export type PageChangeHandler = (selected: number) => void;

// ============================================================================
// Layout Types
// ============================================================================
export type LayoutColumn = 3 | 4 | 5;

export interface LayoutOption {
  value: LayoutColumn;
  icon: string;
  label: string;
}

// ============================================================================
// Validation Types
// ============================================================================
export interface FilterValidation {
  isValid: boolean;
  errors: string[];
}

export interface ProductValidation {
  isValid: boolean;
  errors: string[];
}

// ============================================================================
// Helper Function Types
// ============================================================================
export type ExtractUniqueValuesFunction = <T>(
  array: T[],
  accessor: (item: T) => any,
) => string[];

export type CalculatePriceRangeFunction = (
  products: BeverageProduct[],
) => PriceRange;

export type FilterProductsFunction = (
  products: BeverageProduct[],
  filters: FilterState,
) => BeverageProduct[];

export type SortProductsFunction = (
  products: BeverageProduct[],
  sortOption: SortValue,
) => BeverageProduct[];

// ============================================================================
// Export all types
// ============================================================================
export type {
  BeverageProduct as Product,
  ProductImage as Image,
  ProductBrand as Brand,
  ProductCategory as Category,
  ProductSize as Size,
  ProductFlavor as Flavor,
  ProductStats as Stats,
  ProductBadge as Badge,
  ProductAvailability as Availability,
};
