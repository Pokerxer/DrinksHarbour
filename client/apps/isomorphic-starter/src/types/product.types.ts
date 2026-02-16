// types/product.types.ts - Complete Product Type Definition
/**
 * Core product interface matching the beverage e-commerce backend
 */
export interface ProductType {
  // Core Identification
  id: string;
  _id?: string;
  name: string;
  slug: string;
  displayName?: string;
  barcode?: string;
  gtin?: string;
  upc?: string;
  sku?: string;

  // Beverage Classification
  type: string;
  subType?: string;
  alcoholCategory?:
    | "alcoholic"
    | "non_alcoholic"
    | "low_alcohol"
    | "alcohol_free"
    | "mixed";

  // Category & Brand
  category?: { _id?: string; name: string; type: string; slug?: string };
  subCategory?: string;
  brand?: { _id?: string; name: string; slug?: string; logo?: string };

  // Beverage Specific Attributes
  isAlcoholic?: boolean;
  abv?: number;
  // Alcohol by Volume
  volumeMl?: number;
  standardSizes?: string[];
  originCountry?: string;
  region?: string;
  producer?: string;

  // Flavors & Tasting
  flavors?: Array<{
    _id?: string;
    name: string;
    category: string;
    value?: string;
    color?: string;
    intensity?: string;
  }>;
  flavorProfile?: string[];
  tastingNotes?: { aroma?: string[]; palate?: string[]; finish?: string[] };

  // Descriptive Content
  shortDescription?: string;
  description?: string;
  tagline?: string;

  // Media
  images?: Array<{ url: string; alt?: string; publicId?: string }>;
  primaryImage?: { url: string; alt?: string; publicId?: string };
  thumbImage?: string[];

  // Pricing
  price: number;
  originPrice?: number;
  priceRange?: { min: number; max: number };
  discount?: number;
  sale?: boolean;

  // Size Variants
  sizes?: Array<{
    size: string;
    displayName?: string;
    volumeMl?: number;
    priceRange?: { min: number; max: number };
    price?: number;
    inStock?: boolean;
  }>;

  // Variations (for legacy compatibility)
  variation?: Array<{
    id: string;
    color: string;
    colorCode: string;
    colorImage?: string;
    image: string;
    size: string[];
    quantity: number;
  }>;
  variants?: any[];

  // Stock & Inventory
  quantity?: number;
  soldQuantity?: number;
  sold?: number;
  availableQuantity?: number;
  availability?: {
    totalStock: number;
    inStock: boolean;
    status?: string;
    message?: string;
    stockLevel?: string;
    availabilitySummary?: any;
    availableSizes?: any;
  };
  stats?: {
    totalSold: number;
    totalStock: number;
    totalReviews?: number;
    averageRating?: number;
  };

  // Ratings & Reviews
  rating?: number;
  rate?: number;
  reviewCount?: number;

  // Product Status
  new?: boolean;
  status?:
    | "draft"
    | "pending"
    | "approved"
    | "rejected"
    | "archived"
    | "published";

  // Tags & Metadata
  tags?: string[];
  badge?: { type: string; text: string; color: string };

  // Physical Attributes
  weight?: number;
  dimensions?: string;
  shippingInfo?: string;
  material?: string;
  shelfLifeDays?: number;
  isPerishable?: boolean;

  // SEO
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];

  // Shopping Cart
  action?: string;
  quantityPurchase?: number;

  // Timestamps
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Simplified product card data interface
 */
export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  type: string;
  category?: { name: string; type: string };
  brand?: { name: string };
  images: Array<{ url: string; alt: string }>;
  primaryImage: { url: string; alt: string };
  priceRange: { min: number; max: number };
  sizes?: Array<{
    size: string;
    displayName: string;
    volumeMl: number;
    priceRange: { min: number; max: number };
  }>;
  flavors?: Array<{ name: string; category: string; color: string }>;
  rating: number;
  reviewCount: number;
  stats?: { totalSold: number; totalStock: number };
  badge?: { type: string; text: string; color: string };
  description?: string;
  originCountry?: string;
  createdAt: string;
  sale?: boolean;
  new?: boolean;
}
