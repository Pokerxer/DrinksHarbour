import type {ProductType} from '@/types/product.types';
export interface SearchFilters {
  category?: string;
  type?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface SearchResult {
  products: ProductType[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RecentSearch {
  query: string;
  filters?: SearchFilters;
  timestamp: number;
}
