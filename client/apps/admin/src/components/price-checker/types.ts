export interface KioskSettings {
  displayImages: boolean;
  displayTenantName: boolean;
  displayBrand: boolean;
  displaySize: boolean;
  displayStockStatus: boolean;
  displayStockQuantity: boolean;
  displayPromotions: boolean;
  displayDiscountPercentage: boolean;
  displayStoreName: boolean;
  displayBarcode: boolean;
  manualEntry: boolean;
  fullscreen: boolean;
  enableCompare: boolean;
  enablePhoneScan: boolean;
  resetSeconds: number;
  outOfStock: 'DISPLAY' | 'HIDE' | 'STAFF_MESSAGE';
  theme: 'light' | 'dark';
  welcomeMessage: string;
  resultMessage: string;
  notFoundMessage: string;
  logo: string;
  background: string;
  accent: string;
}
export interface KioskConfig {
  slug: string;
  revision?: number;
  currency: string;
  settings: KioskSettings;
  store?: { name: string; location: string };
  tenantName?: string;
}
export interface KioskProduct {
  name: string;
  price: number;
  currency: string;
  alcoholic: boolean;
  taxLabel: string;
  image?: string;
  brand?: string;
  size?: string;
  barcode?: string;
  quantity?: number;
  availability?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  staffMessage?: string;
  originalPrice?: number;
  savings?: number;
  discountPercentage?: number;
  abv?: number;
  volume?: string;
  origin?: string;
  volumeMl?: number;
  beverageType?: string;
  category?: string;
  subCategory?: string;
  grapeVarieties?: string[];
  description?: string;
  variantKey?: string;
}
export interface ScanResult {
  config: KioskConfig;
  found: boolean;
  product?: KioskProduct;
  status: 'FOUND' | 'NOT_FOUND' | 'UNAVAILABLE' | 'PRICE_UNAVAILABLE';
}
export type Screen =
  | 'initializing'
  | 'idle'
  | 'loading'
  | 'result'
  | 'compare'
  | 'missing'
  | 'unavailable'
  | 'offline'
  | 'closed';
