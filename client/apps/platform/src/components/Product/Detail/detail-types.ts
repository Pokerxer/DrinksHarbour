export interface VendorSize {
  _id: string;
  size: string;
  displayName: string;
  stock: number;
  availableStock?: number;
  inStock?: boolean;
  availability: string;
  price: number;
  originalPrice: number;
  displayPrice: string;
  currencySymbol: string;
  discount?: { label?: string; percentage?: number; type?: string; value?: number; hasDiscount?: boolean } | null;
  volumeMl?: number;
  minOrderQuantity: number;
  maxOrderQuantity?: number;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
  packSavingsPct?: number | null;
  packPlatformCostPrice?: number | null;
}
