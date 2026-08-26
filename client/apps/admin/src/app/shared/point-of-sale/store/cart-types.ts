'use client';

import {
  CartTableBinding,
  POSApplicableItems,
  POSCartItem,
} from '@/app/shared/point-of-sale/types';

// CartTableBinding lives in ../types with the other POS interfaces; it is
// re-exported here because it is part of the persisted cart shape.
export type { CartTableBinding };

// ─── Cart types ───────────────────────────────────────────────────────────────

export type CartCustomer = {
  customerId?: string; // POSCustomer._id — set when a DB customer is selected
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  loyaltyPoints?: number; // live balance fetched from DB on customer selection
  walletBalance?: number; // live store-credit balance fetched from DB on customer selection
  pricelistId?: string; // customer-assigned pricelist id — auto-picked on selection
  pricelistName?: string; // its label, for the "from customer" badge on the selector
};

/** A reward/discount the cashier has explicitly applied to the current cart. */
export type CartAppliedReward = {
  id: string; // unique key: _id for promos/bxgy, code for codes, name for discount programs
  kind:
    | 'discount_program'
    | 'coupon'
    | 'discount_code'
    | 'promotion'
    | 'bxgy'
    | 'loyalty';
  name: string;
  color?: string;
  detail?: string; // human-readable label, e.g. "10% off order"
  // Discount rule — used to recompute as cart changes
  discType?: 'pct' | 'fixed';
  discValue?: number;
  applyOn?: 'order' | 'cheapest' | 'most_expensive';
  maxDiscount?: number;
  // Code fields
  code?: string;
  // BuyXGetY fields
  buyQty?: number;
  getQty?: number;
  getDiscountPct?: number;
  buyProducts?: string[];
  getProducts?: string[];
  /** Odoo-style rules/rewards: which products/categories/brands are scoped */
  applyTo?: POSApplicableItems;
  rewardApplyTo?: POSApplicableItems;
};

// Keep CartPendingCode as an alias — payment modal imports it
export type CartPendingCode = CartAppliedReward & {
  kind: 'coupon' | 'discount_code';
  code: string;
};

export type CartData = {
  id: string;
  ref: string;
  items: POSCartItem[];
  customer: CartCustomer;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  note: string;
  appliedRewards: CartAppliedReward[];
  linkedSalesOrderId?: string | null;
  /**
   * Venue tab binding — set by bindTable while a table's tab is open, cleared
   * by unbindTable on settle/recall. Optional so carts persisted before this
   * field existed load from localStorage unchanged.
   */
  table?: CartTableBinding | null;
};

export const DEFAULT_CUSTOMER: CartCustomer = {
  firstName: 'Walk-in',
  lastName: 'Customer',
  email: 'walkin@pos.local',
  phone: '',
};

export const INITIAL_CART_ID = 'cart-0';

export const INITIAL_CART: CartData = {
  id: INITIAL_CART_ID,
  ref: '001',
  items: [],
  customer: DEFAULT_CUSTOMER,
  discountType: 'percent',
  discountValue: 0,
  note: '',
  appliedRewards: [],
  table: null,
};
