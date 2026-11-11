export interface Store {
  _id: string;
  name: string;
  slug: string;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  city?: string;
  state?: string;
  plan?: string;
  productCount?: number;
  /** Denormalised seller-rating aggregate (approved customer reviews only). */
  ratingAvg?: number;
  ratingCount?: number;
  /** Denormalised gross marketplace sales (posted sales_revenue journals, source 'marketplace'). */
  marketplaceSalesTotal?: number;
  marketplaceSalesOrders?: number;
  description?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type SortKey = 'products' | 'name_asc' | 'name_desc';

