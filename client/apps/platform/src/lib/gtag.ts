'use client';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type GTagParams = Record<string, string | number | boolean | object | undefined | null>;

type GTagItem = {
  item_id?: string;
  item_name?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  index?: number;
  coupon?: string;
  discount?: number;
};

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

/**
 * Send a GA4 event.
 *
 * Events are always sent. Storage/identity is governed by Google Consent Mode
 * v2, which components/Analytics/GoogleAnalytics.tsx initialises with all
 * categories `denied` and updates when the visitor opts in. Until then GA
 * receives cookieless pings — no identifiers are stored on the device, and GA4
 * still reports (modelled) traffic and conversions.
 */
export function gtagEvent(action: string, params: GTagParams = {}): void {
  gtag('event', action, params);
}

export function purchaseEvent(params: {
  transaction_id: string;
  value: number;
  currency?: string;
  tax?: number;
  shipping?: number;
  coupon?: string;
  items: GTagItem[];
}): void {
  gtagEvent('purchase', {
    transaction_id: params.transaction_id,
    value: params.value,
    currency: params.currency || 'NGN',
    tax: params.tax,
    shipping: params.shipping,
    coupon: params.coupon,
    items: params.items,
  });
}

export function addToCartEvent(params: {
  currency?: string;
  value?: number;
  items: GTagItem[];
}): void {
  gtagEvent('add_to_cart', {
    currency: params.currency || 'NGN',
    value: params.value,
    items: params.items,
  });
}

export function removeFromCartEvent(params: {
  currency?: string;
  value?: number;
  items: GTagItem[];
}): void {
  gtagEvent('remove_from_cart', {
    currency: params.currency || 'NGN',
    value: params.value,
    items: params.items,
  });
}

export function beginCheckoutEvent(params: {
  currency?: string;
  value?: number;
  coupon?: string;
  items: GTagItem[];
}): void {
  gtagEvent('begin_checkout', {
    currency: params.currency || 'NGN',
    value: params.value,
    coupon: params.coupon,
    items: params.items,
  });
}

export function viewItemEvent(params: {
  currency?: string;
  value?: number;
  items: GTagItem[];
}): void {
  gtagEvent('view_item', {
    currency: params.currency || 'NGN',
    value: params.value,
    items: params.items,
  });
}

export function viewItemListEvent(params: {
  item_list_id?: string;
  item_list_name?: string;
  items: GTagItem[];
}): void {
  gtagEvent('view_item_list', {
    item_list_id: params.item_list_id,
    item_list_name: params.item_list_name,
    items: params.items,
  });
}

export type { GTagItem };
