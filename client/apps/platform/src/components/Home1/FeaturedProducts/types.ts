export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  city?: string;
  logo?: { url?: string };
}

export interface ProductSize {
  _id: string;
  size: string;
  volumeMl?: number;
  stock?: number;
  inStock?: boolean;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
  };
}

export interface AvailableAtEntry {
  _id?: string;
  tenant?: Tenant;
  sizes?: ProductSize[];
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
    compareAtPrice?: number;
  };
  isOnSale?: boolean;
  saleDiscountValue?: number;
  totalStock?: number;
  availableStock?: number;
}

export interface ApiProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: string;
  primaryImage?: { url: string; alt?: string };
  images?: Array<{ url: string; alt?: string }>;
  priceRange?: { min: number; max: number };
  discount?: { value?: number };
  badge?: { name?: string };
  category?: { name: string; slug: string };
  averageRating?: number;
  reviewCount?: number;
  totalSold?: number;
  createdAt?: string;
  abv?: number;
  isAlcoholic?: boolean;
  originCountry?: string;
  volumeMl?: number;
  availableAt?: AvailableAtEntry[];
  isFeatured?: boolean;
  sale?: boolean;
  originPrice?: number;
  isOnSale?: boolean;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  originPrice: number;
  sale: boolean;
  discount: number;
  thumbImage: string[];
  primaryImage?: { url: string };
  category?: { name: string };
  averageRating: number;
  reviewCount: number;
  isNew: boolean;
  totalSold: number;
  totalStock: number;
  availableStock: number;
  sizes?: ProductSize[];
  defaultSize?: string;
  abv?: number;
  isAlcoholic?: boolean;
  originCountry?: string;
  volumeMl?: number;
  availableAt?: AvailableAtEntry[];
  tenantCount: number;
}

export interface FeaturedProductsProps {
  limit?: number;
  title?: string;
  subtitle?: string;
  initialProducts?: ApiProduct[];
}