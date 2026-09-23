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
export interface KioskInput {
  name: string;
  internalId: string;
  slug: string;
  shopId: string;
  location: string;
  pricelist: string | null;
  currency: string;
  mode: 'STORE_ONLY';
  enabled: boolean;
  settings: KioskSettings;
}
export interface Kiosk extends KioskInput {
  _id: string;
  tenant: string;
  version: number;
  createdAt: string;
}
export interface PricelistOption {
  _id: string;
  name: string;
  currency: string;
  shops: string[];
  warehouses: string[];
  isDefault: boolean;
  isSelectable: boolean;
}
export interface KioskOptions {
  tenantName: string;
  currency: string;
  defaults: KioskSettings;
  shops: { _id: string; name: string; location: string }[];
  locations: { _id: string; name: string; isDefault: boolean }[];
  pricelists: PricelistOption[];
}
export interface InterestRow {
  kiosk: string;
  kioskName: string;
  barcode: string;
  productName: string;
  scans: number;
  currentPrice: number | null;
  currency: string | null;
  quantity?: number;
}
export interface KioskAnalytics {
  range: { from: string; to: string; page: number };
  overview: {
    total: number;
    successful: number;
    unknown: number;
    uniqueProducts: number;
    mostActiveKiosk: string | null;
    today: number;
    week: number;
    month: number;
  };
  hours: { hour: number; scans: number }[];
  popular: InterestRow[];
  lowStock: InterestRow[];
  unknown: {
    barcode: string;
    kiosk: string;
    kioskName: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
  }[];
  hasMore: boolean;
}
