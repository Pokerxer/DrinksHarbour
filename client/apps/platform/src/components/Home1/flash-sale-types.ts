export interface SizeDiscount {
  hasDiscount?: boolean;
  type?: string;
  value?: number;
  percentage?: number;
  savings?: number;
  originalPrice?: number;
  source?: string;
  label?: string;
}

export interface SizePricing {
  websitePrice?: number;
  originalWebsitePrice?: number;
  currency?: string;
  formattedPrice?: string;
}

export interface ProductSize {
  _id?: string;
  size: string;
  volumeMl?: number;
  stock?: number;
  pricing?: SizePricing;
  discount?: SizeDiscount;
}

export interface AvailableAt {
  _id?: string;
  tenant?: { _id?: string; name?: string; slug?: string };
  sizes?: ProductSize[];
  isOnSale?: boolean;
  saleType?: string;
  saleDiscountValue?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  effectiveSalePrice?: number | null;
  priceRange?: { min: number; max: number };
}

export interface SaleProduct {
  shoppingOffer?: import('@/utils/representativeOffer').ShoppingOffer | null;
  _id: string;
  name: string;
  slug: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  primaryImage?: { url: string };
  priceRange?: { min: number; max: number };
  totalSold?: number;
  averageRating?: number;
  reviewCount?: number;
  availableAt?: AvailableAt[];
  discount?: SizeDiscount | null;
  stockInfo?: { totalStock: number; availableStock: number };
  availability?: { status: string; stockLevel: string };
}

