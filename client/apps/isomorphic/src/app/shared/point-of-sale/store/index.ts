'use client';

import { atom, useAtom, useAtomValue } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { POSCartItem, POSBundleDeal, POSStaff, POSTenant } from '@/app/shared/point-of-sale/types';
import { findBestPricelistRule } from '@/app/shared/point-of-sale/utils';
import { useCallback, useMemo } from 'react';

// ─── Auth (persisted) ────────────────────────────────────────────────────────

const posTokenAtom    = atomWithStorage<string | null>('dh-pos-token', null);
const posStaffAtom    = atomWithStorage<POSStaff | null>('dh-pos-staff', null);
const posTenantAtom   = atomWithStorage<POSTenant | null>('dh-pos-tenant', null);
const posTerminalAtom = atomWithStorage<'retail' | 'wholesale' | null>('dh-pos-terminal', null);

export const usePOSAuth = () => {
  const [token, setToken]       = useAtom(posTokenAtom);
  const [staff, setStaff]       = useAtom(posStaffAtom);
  const [tenant, setTenant]     = useAtom(posTenantAtom);
  const [terminal, setTerminal] = useAtom(posTerminalAtom);

  const setAuth = useCallback(
    (newToken: string, newStaff: POSStaff, newTenant: POSTenant) => {
      setToken(newToken);
      setStaff(newStaff);
      setTenant(newTenant);
    },
    [setToken, setStaff, setTenant]
  );

  const logout = useCallback(() => {
    setToken(null);
    setStaff(null);
    setTenant(null);
    setTerminal(null);
  }, [setToken, setStaff, setTenant, setTerminal]);

  const isAuthenticated = useCallback(() => !!token, [token]);

  return { token, staff, tenant, terminal, setAuth, setTerminal, logout, isAuthenticated };
};

// ─── Cart types ───────────────────────────────────────────────────────────────

type CartCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type CartData = {
  id: string;
  ref: string;
  items: POSCartItem[];
  customer: CartCustomer;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  note: string;
};

const DEFAULT_CUSTOMER: CartCustomer = {
  firstName: 'Walk-in',
  lastName: 'Customer',
  email: 'walkin@pos.local',
  phone: '',
};

const INITIAL_CART_ID = 'cart-0';

const INITIAL_CART: CartData = {
  id: INITIAL_CART_ID,
  ref: '001',
  items: [],
  customer: DEFAULT_CUSTOMER,
  discountType: 'percent',
  discountValue: 0,
  note: '',
};

// ─── Multi-cart atoms (persisted) ─────────────────────────────────────────────

const cartsAtom       = atomWithStorage<CartData[]>('dh-pos-carts', [INITIAL_CART]);
const activeCartIdAtom = atomWithStorage<string>('dh-pos-active-cart', INITIAL_CART_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getItemKey(subProductId: string, sizeId?: string) {
  return sizeId ? `${subProductId}_${sizeId}` : subProductId;
}

function makeCartId() {
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeCartRef(existingCount: number) {
  return String(existingCount + 1).padStart(3, '0');
}

// ── Pricelist-aware helpers ───────────────────────────────────────────────────

/**
 * Apply a pricelist's matching rule to an item's raw price.
 * Uses the item's actual quantity so volume/tiered pricing snaps in real time
 * as the cashier changes qty (e.g., buy 10+ → 20% off kicks in automatically).
 */
export function computeItemPriceWithPricelist(item: POSCartItem, pricelist: any): number {
  if (!pricelist?.rules?.length) return item.price;

  // findBestPricelistRule handles: date check, minQuantity threshold, specificity priority,
  // and highest-qualifying-tier selection — matching Odoo's rule resolution order.
  const rule = findBestPricelistRule(pricelist.rules, item.subProductId, item.quantity);
  if (!rule || rule.priceType === 'bundle') return item.price;

  const p    = item.price;
  const cost = Number(item.costPrice) || 0;
  switch (rule.priceType) {
    case 'fixed': {
      const fp = Number(rule.fixedPrice);
      return fp > 0 ? fp : p;
    }
    case 'formula': {
      if (!cost || !rule.markupPercentage) return p;
      return Math.round(cost * (1 + Number(rule.markupPercentage) / 100) * 100) / 100;
    }
    case 'discount': {
      // Stack on the item's current price (which already includes any product-level
      // promotions). The pricelist gives an additional discount on top.
      if (rule.discountType === 'fixed') {
        const amt = Number(rule.discountAmount || 0);
        return amt > 0 ? Math.max(0, p - amt) : p;
      }
      const pct = Number(rule.discountPercentage || 0);
      return pct > 0 ? Math.max(0, p * (1 - pct / 100)) : p;
    }
    case 'flash_sale': {
      const pct = Number(rule.flashSalePercentage || 0);
      return pct > 0 ? Math.max(0, p * (1 - pct / 100)) : p;
    }
    default: return p;
  }
}

/**
 * Returns the best qualifying bundle considering both the item's stored DB
 * bundles AND any bundle rules in the currently selected pricelist.
 */
export function getBestBundleForItem(item: POSCartItem, pricelist: any): POSBundleDeal | null {
  const dbBundles: POSBundleDeal[] = item.activeBundles || [];

  const plBundles: POSBundleDeal[] = [];
  if (pricelist?.rules?.length) {
    const now = new Date();
    for (const r of pricelist.rules as any[]) {
      if (r.priceType !== 'bundle') continue;
      if (r.endDate   && new Date(r.endDate)   < now) continue;
      if (r.startDate && new Date(r.startDate) > now) continue;
      if (!r.bundleQuantity) continue;
      if (r.bundleDiscountType !== 'no_discount' && !r.bundleDiscount) continue;
      // minQuantity is the rule's overall activation threshold (separate from bundleQuantity)
      if ((Number(r.minQuantity) || 0) > item.quantity) continue;
      const pid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
      if (pid && pid !== String(item.subProductId)) continue;
      plBundles.push({
        name:          r.bundleName || `Buy ${r.bundleQuantity}+`,
        quantity:      r.bundleQuantity || 2,
        discount:      r.bundleDiscount || 0,
        discountType:  r.bundleDiscountType || 'percentage',
        active:        true,
        validUntil:    r.endDate ?? null,
        fromPricelist: true,
      });
    }
  }

  const allBundles = [...dbBundles, ...plBundles];
  if (!allBundles.length) return null;

  const now = new Date();
  const qualifying = allBundles.filter(b =>
    b.active !== false &&
    (!b.validUntil || new Date(b.validUntil) >= now) &&
    item.quantity >= (b.quantity ?? 2)
  );
  if (!qualifying.length) return null;

  const p   = item.price;
  const qty = item.quantity;
  return qualifying.sort((a, b) => {
    const savings = (bd: POSBundleDeal) => {
      const dt = bd.discountType ?? 'percentage';
      if (dt === 'fixed')          return (bd.discount ?? 0) * qty;
      if (dt === 'markup_on_cost') return Math.max(0, p - (Number(item.costPrice) || 0) * (1 + (bd.discount ?? 0) / 100)) * qty;
      if (dt === 'no_discount')    return 0;
      return p * qty * Math.min(100, bd.discount ?? 0) / 100;
    };
    return savings(b) - savings(a);
  })[0];
}

/** Effective unit price for a cart item including pricelist overrides (markup_on_cost / no_discount). */
export function getEffectiveBundlePriceForItem(
  item: POSCartItem,
  pricelist: any,
): { price: number; overrides: boolean } {
  const best      = getBestBundleForItem(item, pricelist);
  const basePrice = computeItemPriceWithPricelist(item, pricelist);

  if (best?.discountType === 'markup_on_cost') {
    const cost   = Number(item.costPrice) || 0;
    const markup = best.discount ?? 0;
    if (cost > 0) return { price: Math.round(cost * (1 + markup / 100) * 100) / 100, overrides: true };
  }
  if (best?.discountType === 'no_discount') {
    const orig = item.originalPrice;
    if (orig && orig > basePrice) return { price: orig, overrides: true };
  }
  return { price: basePrice, overrides: false };
}

// ─────────────────────────────────────────────────────────────────────────────

/** Returns the best qualifying bundle deal for a cart item at its current quantity. */
export function getBestBundle(item: POSCartItem): POSBundleDeal | null {
  if (!item.activeBundles?.length) return null;
  const now = new Date();
  const qualifying = item.activeBundles.filter(b =>
    b.active !== false &&
    (!b.validUntil || new Date(b.validUntil) >= now) &&
    item.quantity >= (b.quantity ?? 2)
  );
  if (!qualifying.length) return null;
  // Pick the deal with the most absolute savings at current qty × price
  return qualifying.sort((a, b) => {
    const savings = (bd: POSBundleDeal) => {
      const dt = bd.discountType ?? 'percentage';
      const lineGross = item.price * item.quantity;
      if (dt === 'fixed')          return (bd.discount ?? 0) * item.quantity;
      if (dt === 'markup_on_cost') return Math.max(0, item.price - (item.costPrice ?? 0) * (1 + (bd.discount ?? 0) / 100)) * item.quantity;
      if (dt === 'no_discount')    return 0;
      return lineGross * Math.min(100, bd.discount ?? 0) / 100;
    };
    return savings(b) - savings(a);
  })[0];
}

/**
 * Returns the effective unit price after a price-override bundle (markup_on_cost or no_discount).
 * For discount-type bundles (percentage/fixed) the unit price is unchanged — the discount is
 * applied as a separate deduction.
 */
export function getEffectiveBundlePrice(item: POSCartItem): { price: number; overrides: boolean } {
  const best = getBestBundle(item);
  if (!best) return { price: item.price, overrides: false };

  if (best.discountType === 'markup_on_cost') {
    const cost   = item.costPrice ?? 0;
    const markup = best.discount  ?? 0;
    if (cost > 0) {
      return { price: Math.round(cost * (1 + markup / 100) * 100) / 100, overrides: true };
    }
  }

  if (best.discountType === 'no_discount') {
    const orig = item.originalPrice;
    if (orig && orig > item.price) {
      return { price: orig, overrides: true };
    }
  }

  return { price: item.price, overrides: false };
}

function computeSubtotal(items: POSCartItem[], pricelist?: any) {
  return items.reduce((sum, item) => {
    const best = pricelist ? getBestBundleForItem(item, pricelist) : getBestBundle(item);
    const { price: effectivePrice, overrides } = pricelist
      ? getEffectiveBundlePriceForItem(item, pricelist)
      : getEffectiveBundlePrice(item);

    const lineGross   = effectivePrice * item.quantity;
    const itemDiscAmt = lineGross * Math.max(0, Math.min(100, item.discount)) / 100;

    let bundleDiscAmt = 0;
    if (best && !overrides) {
      const dt = best.discountType ?? 'percentage';
      bundleDiscAmt = dt === 'fixed'
        ? Math.min((best.discount ?? 0) * item.quantity, lineGross - itemDiscAmt)
        : lineGross * Math.min(100, best.discount ?? 0) / 100;
      bundleDiscAmt = Math.max(0, bundleDiscAmt);
    }

    return sum + lineGross - Math.min(lineGross, itemDiscAmt + bundleDiscAmt);
  }, 0);
}

function computeDiscountAmount(subtotal: number, type: 'percent' | 'fixed', value: number) {
  if (value <= 0) return 0;
  return type === 'fixed' ? Math.min(value, subtotal) : subtotal * (value / 100);
}

// ─── usePOSCart ───────────────────────────────────────────────────────────────

export const usePOSCart = () => {
  const [carts, setCarts] = useAtom(cartsAtom);
  const [activeCartId, setActiveCartId] = useAtom(activeCartIdAtom);

  // Always resolve to a valid cart
  const activeCart = useMemo(
    () => carts.find((c) => c.id === activeCartId) ?? carts[0] ?? INITIAL_CART,
    [carts, activeCartId]
  );

  const { items, customer, discountType, discountValue, note, ref } = activeCart;

  // Pricelist is applied dynamically so the total stays live as selection changes
  const [selectedPricelist] = useAtom(posSelectedPricelistAtom);

  // Derived values
  const subtotal = useMemo(
    () => computeSubtotal(items, selectedPricelist ?? undefined),
    [items, selectedPricelist],
  );
  const discountAmount = useMemo(
    () => computeDiscountAmount(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue]
  );
  const total     = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // ── Update helper ──────────────────────────────────────────────────────────
  const patchActive = useCallback(
    (patch: Partial<CartData>) => {
      setCarts((prev) =>
        prev.map((c) => (c.id === activeCart.id ? { ...c, ...patch } : c))
      );
    },
    [activeCart.id, setCarts]
  );

  // ── Multi-cart ops ─────────────────────────────────────────────────────────
  const addCart = useCallback(() => {
    const nc: CartData = {
      id: makeCartId(),
      ref: makeCartRef(carts.length),
      items: [],
      customer: DEFAULT_CUSTOMER,
      discountType: 'percent',
      discountValue: 0,
      note: '',
    };
    setCarts((prev) => [...prev, nc]);
    setActiveCartId(nc.id);
  }, [carts.length, setCarts, setActiveCartId]);

  const switchCart = useCallback(
    (id: string) => setActiveCartId(id),
    [setActiveCartId]
  );

  const removeCart = useCallback(
    (id: string) => {
      setCarts((prev) => {
        if (prev.length <= 1) {
          // Reset the only cart instead of removing
          return [{ ...INITIAL_CART, id: prev[0].id, ref: prev[0].ref }];
        }
        return prev.filter((c) => c.id !== id);
      });
      // If we're removing the active cart, switch to the first remaining one
      if (id === activeCartId) {
        const remaining = carts.filter((c) => c.id !== id);
        if (remaining.length > 0) setActiveCartId(remaining[0].id);
      }
    },
    [carts, activeCartId, setCarts, setActiveCartId]
  );

  // ── Item ops ───────────────────────────────────────────────────────────────
  const addItem = useCallback(
    (item: POSCartItem) => {
      patchActive({
        items: (() => {
          const key = getItemKey(item.subProductId, item.sizeId);
          const existing = activeCart.items.find(
            (i) => getItemKey(i.subProductId, i.sizeId) === key
          );
          if (existing) {
            return activeCart.items.map((i) => {
              if (getItemKey(i.subProductId, i.sizeId) !== key) return i;
              const newQty = Math.min(i.quantity + item.quantity, i.stock);
              return {
                ...i,
                quantity: newQty,
                // Always refresh activeBundles so pricelist changes and DB updates are picked up
                activeBundles: item.activeBundles ?? i.activeBundles,
              };
            });
          }
          return [...activeCart.items, item];
        })(),
      });
    },
    [activeCart.items, patchActive]
  );

  const removeItem = useCallback(
    (subProductId: string, sizeId?: string) => {
      patchActive({
        items: activeCart.items.filter(
          (i) => getItemKey(i.subProductId, i.sizeId) !== getItemKey(subProductId, sizeId)
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateQuantity = useCallback(
    (subProductId: string, quantity: number, sizeId?: string) => {
      patchActive({
        items: activeCart.items.map((i) =>
          getItemKey(i.subProductId, i.sizeId) === getItemKey(subProductId, sizeId)
            ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateItemDiscount = useCallback(
    (subProductId: string, discount: number, sizeId?: string) => {
      patchActive({
        items: activeCart.items.map((i) =>
          getItemKey(i.subProductId, i.sizeId) === getItemKey(subProductId, sizeId)
            ? { ...i, discount: Math.max(0, Math.min(100, discount)) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateItemPrice = useCallback(
    (subProductId: string, price: number, sizeId?: string) => {
      patchActive({
        items: activeCart.items.map((i) =>
          getItemKey(i.subProductId, i.sizeId) === getItemKey(subProductId, sizeId)
            ? { ...i, price: Math.max(0, price) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const clearCart = useCallback(() => {
    patchActive({
      items: [],
      customer: DEFAULT_CUSTOMER,
      discountType: 'percent',
      discountValue: 0,
      note: '',
    });
  }, [patchActive]);

  const setCustomer = useCallback(
    (c: CartCustomer) => patchActive({ customer: c }),
    [patchActive]
  );

  const setDiscount = useCallback(
    (type: 'percent' | 'fixed', value: number) =>
      patchActive({ discountType: type, discountValue: value }),
    [patchActive]
  );

  const setNote = useCallback(
    (n: string) => patchActive({ note: n }),
    [patchActive]
  );

  return useMemo(
    () => ({
      // Multi-cart
      carts,
      activeCartId,
      activeCartRef: ref,
      addCart,
      switchCart,
      removeCart,
      // Active cart data
      items,
      customer,
      discountType,
      discountValue,
      note,
      subtotal,
      discountAmount,
      total,
      itemCount,
      // Item ops
      addItem,
      removeItem,
      updateQuantity,
      updateItemDiscount,
      updateItemPrice,
      clearCart,
      setCustomer,
      setDiscount,
      setNote,
    }),
    [
      carts, activeCartId, ref,
      addCart, switchCart, removeCart,
      items, customer, discountType, discountValue, note,
      subtotal, discountAmount, total, itemCount,
      addItem, removeItem, updateQuantity, updateItemDiscount, updateItemPrice,
      clearCart, setCustomer, setDiscount, setNote,
    ]
  );
};

// ─── Permissions helper ───────────────────────────────────────────────────────

export const usePOSPermissions = () => {
  const { staff } = usePOSAuth();
  const perms: string[] = staff?.posPermissions ?? [];
  return {
    canSell:        perms.includes('pos:sell')     || perms.length === 0,
    canRefund:      perms.includes('pos:refund'),
    canVoid:        perms.includes('pos:void'),
    canDiscount:    perms.includes('pos:discount'),
    canPriceOverride: perms.includes('pos:price_override'),
    has: (p: string) => perms.includes(p),
  };
};

// ─── Pricelist (persisted — survives page refresh) ────────────────────────────

const posSelectedPricelistAtom = atomWithStorage<any | null>('dh-pos-pricelist', null);

export const usePOSPricelist = () => {
  const [selectedPricelist, setSelectedPricelist] = useAtom(posSelectedPricelistAtom);
  return { selectedPricelist, setSelectedPricelist };
};

// ─── Sale refresh signal ──────────────────────────────────────────────────────
// Increment this after every successful order to trigger session + product refreshes.
const posSaleCounterAtom = atom(0);

export const usePOSSaleSignal = () => {
  const [saleCounter, setSaleCounter] = useAtom(posSaleCounterAtom);
  const notifySale = useCallback(() => setSaleCounter((n) => n + 1), [setSaleCounter]);
  return { saleCounter, notifySale };
};

// ─── UI State ────────────────────────────────────────────────────────────────

const posActiveViewAtom      = atom<'sell' | 'payment' | 'receipt'>('sell');
const posPaymentMethodAtom   = atom('cash');
const posAmountTenderedAtom  = atom(0);
const posSplitPaymentsAtom   = atom<{ method: string; amount: number }[]>([]);
const posSearchQueryAtom     = atom('');
const posSelectedCategoryAtom = atom('');

export const usePOSUI = () => {
  const [activeView, setActiveView]         = useAtom(posActiveViewAtom);
  const [paymentMethod, setPaymentMethod]   = useAtom(posPaymentMethodAtom);
  const [amountTendered, setAmountTendered] = useAtom(posAmountTenderedAtom);
  const [splitPayments, setSplitPayments]   = useAtom(posSplitPaymentsAtom);
  const [searchQuery, setSearchQuery]       = useAtom(posSearchQueryAtom);
  const [selectedCategory, setSelectedCategory] = useAtom(posSelectedCategoryAtom);

  const resetPayment = useCallback(() => {
    setPaymentMethod('cash');
    setAmountTendered(0);
    setSplitPayments([]);
  }, [setPaymentMethod, setAmountTendered, setSplitPayments]);

  return useMemo(
    () => ({
      activeView, setActiveView,
      paymentMethod, setPaymentMethod,
      amountTendered, setAmountTendered,
      splitPayments, setSplitPayments,
      searchQuery, setSearchQuery,
      selectedCategory, setSelectedCategory,
      resetPayment,
    }),
    [
      activeView, paymentMethod, amountTendered, splitPayments,
      searchQuery, selectedCategory,
      setActiveView, setPaymentMethod, setAmountTendered,
      setSplitPayments, setSearchQuery, setSelectedCategory,
      resetPayment,
    ]
  );
};
