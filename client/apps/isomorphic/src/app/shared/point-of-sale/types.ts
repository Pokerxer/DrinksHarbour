export interface POSStaff {
  _id: string;
  firstName: string;
  lastName: string;
  posName?: string;
  role: string;
  avatar?: string;
  hasPin: boolean;
  posPermissions?: string[];
  terminalPermissions?: {
    retail: boolean;
    wholesale: boolean;
  };
}

export interface POSTenantBankAccount {
  bankName: string;
  accountNumber: string;
  accountName?: string;
}

export interface POSDiscountProgram {
  _id?: string;
  name: string;
  description?: string;
  type: 'pct' | 'fixed';
  value: number;
  active: boolean;
  color?: string;
  minOrderValue?: number;
}

// ── Shared discount program fields ────────────────────────────────────────────
export interface POSDiscountAvailability {
  pos:     boolean;  // available in POS terminal
  sales:   boolean;  // available on sales orders
  website: boolean;  // available on the website
}

export interface POSDiscountRules {
  minQty?:        number;   // minimum cart quantity
  minOrderValue?: number;   // minimum cart total
}

/** Where to apply the discount when it triggers */
export type POSRewardApplyOn = 'order' | 'cheapest' | 'most_expensive';

export interface POSDiscountReward {
  discountType:  'pct' | 'fixed';
  discountValue: number;
  applyOn:       POSRewardApplyOn;
  maxDiscount?:  number;   // hard cap on the naira saving
}

// ── Applicable items (products / categories / brands) ─────────────────────────
export interface POSApplicableItems {
  products?:   string[];  // product _id values
  categories?: string[];  // category _id values (top-level or sub)
  brands?:     string[];  // brand _id values
}

// ── Coupons ────────────────────────────────────────────────────────────────────
export interface POSCoupon {
  _id?: string;
  code: string;
  name: string;
  description?: string;
  pricelistIds?: string[];
  applyTo?: POSApplicableItems;
  availableOn?: POSDiscountAvailability;
  rules?: POSDiscountRules;
  reward?: POSDiscountReward;
  /** legacy — kept for backward compat */
  type: 'pct' | 'fixed';
  value: number;
  minOrderValue?: number;
  maxUsage?: number;
  usageCount?: number;
  validFrom?: string;
  validTo?: string;
  active: boolean;
  onePerOrder?: boolean;
}

// ── Discount Codes ─────────────────────────────────────────────────────────────
export interface POSDiscountCode {
  _id?: string;
  code: string;
  name: string;
  description?: string;
  pricelistIds?: string[];
  applyTo?: POSApplicableItems;
  availableOn?: POSDiscountAvailability;
  rules?: POSDiscountRules;
  reward?: POSDiscountReward;
  type: 'pct' | 'fixed';
  value: number;
  minOrderValue?: number;
  validFrom?: string;
  validTo?: string;
  maxUsage?: number;
  usageCount?: number;
  color?: string;
  active: boolean;
}

// ── Promotions ─────────────────────────────────────────────────────────────────
export interface POSPromotion {
  _id?: string;
  name: string;
  description?: string;
  pricelistIds?: string[];
  applyTo?: POSApplicableItems;
  availableOn?: POSDiscountAvailability;
  rules?: POSDiscountRules;
  reward?: POSDiscountReward;
  type: 'pct' | 'fixed';
  value: number;
  startDate?: string;
  endDate?: string;
  maxUsage?: number;
  usageCount?: number;
  color?: string;
  stackable?: boolean;
  priority?: number;
  active: boolean;
}

// ── Buy X Get Y ────────────────────────────────────────────────────────────────
export interface POSBuyXGetY {
  _id?: string;
  name: string;
  description?: string;
  pricelistIds?: string[];
  buyProducts?: string[];   // product _ids that must be in cart (empty = any product)
  getProducts?: string[];   // product _ids that receive the discount (empty = same as buy)
  availableOn?: POSDiscountAvailability;
  buyQty: number;
  getQty: number;
  getDiscountPct: number;
  minOrderValue?: number;
  maxUsage?: number;
  usageCount?: number;
  validFrom?: string;
  validTo?: string;
  color?: string;
  stackable?: boolean;
  active: boolean;
}

// ── Loyalty Card Tier ─────────────────────────────────────────────────────────
export interface POSLoyaltyTier {
  _id?: string;
  name: string;           // e.g. "Silver", "Gold"
  minPoints: number;      // points needed to reach this tier
  multiplier: number;     // earn rate multiplier at this tier
  color: string;          // display colour
  benefits?: string;      // freeform description of tier perks
}

// ── Loyalty Card Config ────────────────────────────────────────────────────────
export interface POSLoyaltyCardConfig {
  enabled: boolean;
  cardPrefix: string;       // e.g. "DH-" → cards like DH-0001
  earnMultiplier: number;   // base card-holder multiplier (overridden by tier if set)
  welcomeBonus: number;     // points given on first purchase
  pointsExpiry: number;          // days until points expire (0 = never)
  minRedemption: number;         // minimum points balance needed before customer can redeem
  doublePointsDays?: number[];   // 0=Sun…6=Sat, days earning is multiplied
  bonusMultiplierDays?: number;  // multiplier applied on doublePointsDays
  tiers?: POSLoyaltyTier[];
}

// ── Next Order Coupon Config ───────────────────────────────────────────────────
export interface POSNextOrderCouponConfig {
  enabled: boolean;
  type: 'pct' | 'fixed';
  value: number;
  validDays: number;            // how long the generated coupon lasts
  minOrderForCoupon: number;    // min purchase amount to receive a next-order coupon
  minRedeemOrder: number;       // min order value required to USE the coupon
  codePrefix: string;           // e.g. "NOC-"
  color: string;                // coupon strip colour
  oneUse: boolean;              // generated coupon is single-use (default true)
  availableOn: POSDiscountAvailability;
}

export interface POSSettings {
  allowOverselling?: boolean;
  loyaltyEnabled?: boolean;
  loyaltyPointsPerNaira?: number;
  loyaltyPointsValue?: number;
  loyaltyMaxRedemptionPct?: number;
  discountPrograms?: POSDiscountProgram[];
  coupons?: POSCoupon[];
  discountCodes?: POSDiscountCode[];
  promotions?: POSPromotion[];
  buyXGetY?: POSBuyXGetY[];
  loyaltyCard?: Partial<POSLoyaltyCardConfig>;
  nextOrderCoupon?: Partial<POSNextOrderCouponConfig>;
}

export interface POSTenant {
  _id: string;
  slug: string;
  name: string;
  primaryColor?: string;
  logo?: string | { url?: string; alt?: string; publicId?: string };
  bankAccounts?: POSTenantBankAccount[];
  posSettings?: POSSettings;
}

export interface POSAuthResponse {
  token: string;
  staff: POSStaff;
  tenant: POSTenant;
}

export interface POSFlashSale {
  isActive: boolean;
  discountPercentage?: number;
  startDate?: string | null;
  endDate?: string | null;
  remainingQuantity?: number | null;
}

export interface POSBundleDeal {
  name?: string;
  quantity?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed' | 'markup_on_cost' | 'no_discount';
  validUntil?: string | null;
  active?: boolean;
  fromPricelist?: boolean; // true = injected by a pricelist rule, not a permanent DB deal
}

export interface POSProduct {
  _id: string;
  sku: string;
  product: {
    _id: string;
    name: string;
    images?: { url: string; thumbnail?: string }[];
    type?: string;
    brand?: { name: string };
  };
  vendor?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    posName?: string;
    email?: string;
  };
  baseSellingPrice: number;
  originalPrice?: number | null;
  costPrice: number;
  availableStock: number;
  totalStock: number;
  stockStatus: string;
  status: string;
  sizes: POSSize[];
  sellWithoutSizeVariants: boolean;
  defaultSize?: string;
  visibleInPOS: boolean;
  isFeaturedByTenant?: boolean;
  isOnSale: boolean;
  isFlashSale?: boolean;
  saleType?: string;
  saleDiscountValue?: number;
  flashSale?: POSFlashSale;
  activeBundles?: POSBundleDeal[];
}

export interface POSSize {
  _id: string;
  displayName: string;
  sellingPrice: number;
  originalPrice?: number | null;
  costPrice?: number;
  availableStock: number;
  stock?: number;
  sku?: string;
  barcode?: string;
}

export interface POSCartItem {
  subProductId: string;
  productId: string;
  sizeId?: string;
  name: string;
  variant: string;
  sku: string;
  image?: string;
  price: number;
  quantity: number;
  discount: number;
  stock: number;
  activeBundles?: POSBundleDeal[];
  costPrice?: number;       // needed for markup_on_cost bundle computation
  originalPrice?: number;   // pre-sale price, needed for no_discount bundle computation
  /** Set on items added from a combo. Groups them visually in the cart. */
  comboRef?: {
    comboId: string;
    comboName: string;
    instanceId: string;   // unique per "Add Combo" action — prevents key collision
  };
  /** Set on items auto-added by a Buy X Get Y reward. Links the item to the reward for lifecycle management. */
  bxgyRef?: {
    rewardId: string;
    discPct: number;       // 100 = free, 50 = half-price, etc.
    originalPrice: number; // unit price of the original paid item (for display as negative)
    rewardName?: string;
    rewardColor?: string;
  };
}

export interface POSOrderItem {
  product: string;
  subProduct: string;
  sizeId?: string;
  name: string;
  variant: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tenantId?: string;
  tenant?: string;
}

export interface POSReceiptItem {
  name: string;
  variant: string;
  sku: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount: number;
}

export interface POSOrderRequest {
  items: POSOrderItem[];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  paymentMethod: string;
  amountTendered?: number;
  splitPayments?: { method: string; amount: number }[];
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  note?: string;
  sessionId?: string;
  priceOverrides?: Record<string, number>;
}

export interface POSOrderResponse {
  _id: string;
  orderNumber?: string;
  receiptNumber: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  splitPayments?: { method: string; amount: number }[];
  amountTendered?: number;
  change: number;
  items: POSReceiptItem[];
  note?: string;
  placedAt: string;
  posStaff: string;
}

export interface POSRefundResponse {
  returnNumber: string;
  totalRefunded: number;
  cumulativeRefunded: number;
  paymentStatus: string;
  refundLines: POSRefundLineItem[];
  refundRecord: POSRefundRecord;
  warnings?: string[];
  order: { _id: string; receiptNumber: string };
}

export interface POSSession {
  _id: string;
  tenant: string;
  terminalType?: 'retail' | 'wholesale';
  openedBy: { _id: string; firstName: string; lastName: string; posName?: string; avatar?: string };
  closedBy?: { _id: string; firstName: string; lastName: string; posName?: string };
  activeCashier?: { _id: string; firstName: string; lastName: string; posName?: string; avatar?: string };
  cashierLog: { cashier: string; startedAt: string; endedAt?: string }[];
  cashMovements?: POSCashMovement[];
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  methodBalances: POSMethodBalance[];
  hasDifference: boolean;
  totalSales: number;
  orderCount: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  mobileMoneySales: number;
  splitSales: number;
  notes: string;
  closingNotes: string;
  openingBalance: number;
  closingBalance?: number;
  zReport?: POSZReport;
}

export interface POSMethodBalance {
  method: string;
  opening: number;
  theoretical: number;
  counted: number | null;
  difference: number | null;
}

export interface POSZReport {
  generatedAt?: string;
  totalSales: number;
  totalOrders: number;
  totalRefunds: number;
  totalVoids: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  mobileSales: number;
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
}

export interface POSDashboardData {
  currentSession: POSSession | null;
  today: { totalSales: number; orderCount: number; breakdown: Record<string, { total: number; count: number }> };
  yesterday: { totalSales: number; orderCount: number; breakdown: Record<string, { total: number; count: number }> };
  thisMonth: { totalSales: number; orderCount: number; breakdown: Record<string, { total: number; count: number }> };
  chartData: { date: string; sales: number; orders: number }[];
  recentOrders: POSRecentOrder[];
}

export interface POSRecentOrder {
  _id: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  customer?: { firstName?: string; lastName?: string };
  placedAt: string;
  createdAt: string;
}

export interface POSSessionInfo {
  currentSession: POSSession | null;
  lastSession: { _id: string; closedAt: string; totalSales: number; orderCount: number; closedBy: { firstName: string; lastName: string; posName?: string } } | null;
}

// ── Refund types (Odoo-style) ──────────────────────────────────────────────

export interface POSRefundLineItem {
  orderItemIndex: number;
  quantity: number;
  unitPrice: number;
  discPct: number;
  amount: number;
  restock?: boolean;
  reason?: string;
}

export interface POSRefundRecord {
  receiptNumber: string;
  items: POSRefundLineItem[];
  totalRefunded: number;
  reason?: string;
  refundedBy?: { _id: string; firstName: string; lastName: string; posName?: string };
  refundedAt: string;
  paymentMethod?: string;
}

export interface POSCashMovement {
  _id: string;
  type: 'in' | 'out';
  amount: number;
  reason?: string;
  performedBy?: { _id: string; firstName: string; lastName: string; posName?: string };
  performedAt: string;
}

export interface POSClosingControl {
  sessionId: string;
  openedAt: string;
  openingCash: number;
  totalSales: number;
  orderCount: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashMove: number;
  cashMovements: POSCashMovement[];
  methods: {
    method: string;
    opening: number;
    theoretical: number;
    orderTotal: number;
    orderCount: number;
  }[];
}

// ── Combo types ────────────────────────────────────────────────────────────────

export interface POSComboSize {
  _id: string;
  displayName: string;
  sellingPrice: number;
  costPrice?: number;
  availableStock: number;
  sku?: string;
}

export interface POSComboSubProduct {
  _id: string;
  sku: string;
  baseSellingPrice: number;
  costPrice?: number;
  availableStock: number;
  sellWithoutSizeVariants: boolean;
  sizes: POSComboSize[];
  product: {
    _id: string;
    name: string;
    images?: { url: string; thumbnail?: string }[];
    type?: string;
  };
}

export interface POSComboLineItem {
  subProduct: POSComboSubProduct;
  allowedSizes: string[]; // size _id list; empty = all allowed
  /** Minimum units to pick when this product is selected. Default 1. */
  minQty?: number;
  /** Maximum units the cashier can pick of this product. Default 1. */
  maxQty?: number;
}

export interface POSChoiceLine {
  _id: string;
  label: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  items: POSComboLineItem[];
}

export type POSComboPriceMode = 'dynamic' | 'fixed' | 'markup_on_cost' | 'discount_off_selling';

export interface POSCombo {
  _id: string;
  name: string;
  description: string;
  priceMode: POSComboPriceMode;
  /** Used when priceMode = 'fixed' */
  price: number;
  /** Used when priceMode = 'markup_on_cost' */
  markupPercentage?: number;
  /** Used when priceMode = 'discount_off_selling' */
  discountPercentage?: number;
  choiceLines: POSChoiceLine[];
  active: boolean;
}
