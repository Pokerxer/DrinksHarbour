export interface ReviewPricing {
  costPrice?: number;
  tenantSellingPrice?: number;
  platformCostPrice?: number;
  platformSellingPrice?: number;
  platformMarkupPct?: number;
  packPlatformMarkupPct?: number;
  packCommissionPct?: number | null;
  tenantReceives?: number;
  revenueModel?: string;
  markupPct?: number;
  commissionPct?: number;
  packPlatformCostPrice?: number | null;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
  isPlatformCostFromWholesale?: boolean;
  productDiscount?: { active?: boolean; type?: string; value?: number } | null;
}
export interface ReviewSize {
  _id: string;
  size?: string;
  displayName?: string;
  sku?: string;
  currency?: string;
  unitsPerPack?: number;
  packPlatformMarkupOverridePct?: number | null;
  stock?: number;
  reservedStock?: number;
  availableStock?: number;
  pricing?: ReviewPricing;
}
export interface ReviewListing {
  _id: string;
  sku?: string;
  status: string;
  currency?: string;
  tenant?: {
    _id?: string;
    name?: string;
    businessName?: string;
    revenueModel?: string;
    markupPercentage?: number;
    commissionPercentage?: number;
    packCommissionPercentage?: number;
  };
  product?: {
    name?: string;
    slug?: string;
    platformMarkup?: number;
    description?: string;
    isAlcoholic?: boolean;
    abv?: number;
    volumeMl?: number;
    originCountry?: string;
    images?: { url?: string }[];
  };
  pricing?: ReviewPricing;
  sizes?: ReviewSize[];
  totalStock?: number;
  reservedStock?: number;
  availableStock?: number;
  isOnSale?: boolean;
  saleType?: string;
  saleDiscountValue?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  shortDescriptionOverride?: string;
  descriptionOverride?: string;
  tenantNotes?: string;
  imagesOverride?: { url?: string; alt?: string }[];
  createdAt?: string;
  updatedAt?: string;
  shipping?: {
    weight?: number;
    fragile?: boolean;
    requiresAgeVerification?: boolean;
    shippingClass?: string;
  };
  warehouse?: {
    location?: string;
    zone?: string;
    aisle?: string;
    shelf?: string;
    bin?: string;
  };
}
export interface PriceLine {
  id: string;
  label: string;
  sku?: string;
  currency: string;
  pricing: ReviewPricing;
  packThreshold: number | null;
}
export interface ReviewOverrides {
  baseWebsitePrice?: number;
  sizes?: { id: string; websitePrice?: number; packUnitPrice?: number }[];
}
export interface PriceDraft {
  normal: string;
  pack: string;
}
export interface PriceTargets {
  platform: string;
  tenant: string;
}
