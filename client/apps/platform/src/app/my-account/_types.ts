import { type ElementType } from 'react';

export interface OrderItem {
  product?: string | { _id: string; name: string; image?: string; thumbImage?: string[] };
  subproduct?: string;
  size?: string;
  tenant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  image?: string;
  thumbImage?: string[];
}

export interface ShippingInfo {
  fullName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}

export interface Order {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  items: OrderItem[];
  totalAmount: number;
  total?: number;
  subtotal?: number;
  shippingFee?: number;
  shipping?: ShippingInfo;
  placedAt?: string;
  createdAt?: string;
}

export interface Address {
  _id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  street?: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface AddressFormData {
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface StatusConfig {
  color: string;
  bg: string;
  border: string;
  icon: ElementType;
}

export interface OrdersResponse {
  data?: { orders?: Order[]; pagination?: PaginationData };
  orders?: Order[];
  pagination?: PaginationData;
}

export interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FiltersState {
  status: string;
  dateFrom: string;
  dateTo: string;
}

export interface NotificationSettings {
  orderUpdates: boolean;
  promotions: boolean;
  newArrivals: boolean;
  newsletter: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
}

// ── Wallet ────────────────────────────────────────────────────────────────────
export interface WalletSummary {
  credited: number;
  debited: number;
  net: number;
  count?: number;
  lastActivityAt: string | null;
}

export interface WalletTransaction {
  _id: string;
  type: 'credit' | 'debit' | 'refund' | 'adjustment';
  amount: number;
  balanceAfter: number;
  source: string;
  reason: string;
  reference?: string;
  redeemedAtTenant?: string | { _id: string; name: string; slug: string } | null;
  relatedOrder?: string;
  createdAt: string;
}

export interface WalletData {
  balance: number;
  currency: string;
  summary: WalletSummary;
  recent: WalletTransaction[];
}

// ── Gift cards ─────────────────────────────────────────────────────────────────
export interface GiftCardRecipient {
  email?: string;
  name?: string;
  message?: string;
  sendAt?: string;
}

export interface GiftCardItem {
  _id: string;
  code: string | null;
  initialAmount: number;
  balance: number;
  currency: string;
  status: 'pending_payment' | 'active' | 'redeemed' | 'expired' | 'disabled';
  recipient?: GiftCardRecipient;
  design?: { templateId?: string; theme?: string };
  expiresAt?: string;
  createdAt: string;
}

export interface GiftCardTransaction {
  _id: string;
  type: 'issue' | 'redeem' | 'refund' | 'adjustment';
  amount: number;
  balanceAfter: number;
  redeemedAtTenant?: string | { _id: string; name: string; slug: string } | null;
  relatedOrder?: string;
  reference?: string;
  createdAt: string;
}

// ── Loyalty ("Corks & Points") ─────────────────────────────────────────────────
export type LoyaltyTier = 'cork' | 'barrel' | 'cellar' | 'vault';

export interface LoyaltySummary {
  earned: number;
  redeemed: number;
  expired: number;
  referralBonus: number;
  count?: number;
  lastActivityAt: string | null;
}

export interface LoyaltyTransaction {
  _id: string;
  type: 'earn' | 'redeem' | 'adjustment' | 'bonus' | 'expiry' | 'referral';
  points: number;
  balanceAfter: number;
  reason: string;
  reference?: string;
  relatedOrder?: string;
  redeemedAtTenant?: string | { _id: string; name: string; slug: string } | null;
  createdAt: string;
}

export interface LoyaltyData {
  points: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierName: string;
  earnMultiplier: number;
  nextTier: LoyaltyTier | null;
  nextThreshold: number | null;
  progress: number;
  redeemRateNgnPerPoint: number;
  minRedeemPoints: number;
  redeemStepPoints: number;
  referralCode: string | null;
  referralBonusEarned: number;
  referredBy?: string;
  summary: LoyaltySummary;
  recent: LoyaltyTransaction[];
}
