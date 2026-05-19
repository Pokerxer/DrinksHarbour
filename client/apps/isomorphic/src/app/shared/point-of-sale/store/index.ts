'use client';

import { atom, useAtom, useAtomValue } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { POSCartItem, POSBundleDeal, POSStaff, POSTenant } from '@/app/shared/point-of-sale/types';
import { findBestPricelistRule, findMatchingPricelistRules, applyRuleTransform } from '@/app/shared/point-of-sale/utils';
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

// ─── Terminal-scoped storage ───────────────────────────────────────────────────
// Retail and wholesale each have their own cart, active cart ID, and pricelist
// selection so they operate as independent closed systems.

function termAtoms<T>(baseKey: string, fallback: T) {
  return {
    retail:    atomWithStorage<T>(`${baseKey}-retail`, fallback),
    wholesale: atomWithStorage<T>(`${baseKey}-wholesale`, fallback),
  };
}

// ─── Multi-cart atoms (persisted, terminal-scoped) ────────────────────────────

const cartsAtoms          = termAtoms<CartData[]>('dh-pos-carts', [INITIAL_CART]);
const activeCartIdAtoms   = termAtoms<string>('dh-pos-active-cart', INITIAL_CART_ID);

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
 * Applies ALL matching pricelist price rules to an item's raw price sequentially.
 * Uses the item's actual quantity so volume tiers snap in real-time as the cashier changes qty.
 * e.g. base ₦5000 → -10% (discount rule) → -5% (qty 6+ rule) → ₦4275
 */
export function computeItemPriceWithPricelist(item: POSCartItem, pricelist: any): number {
  if (!pricelist?.rules?.length) return item.price;

  const rules = findMatchingPricelistRules(pricelist.rules, item.subProductId, item.quantity, 'price');
  if (!rules.length) return item.price;

  let price = item.price;
  const cost = Number(item.costPrice) || 0;
  for (const rule of rules) {
    price = applyRuleTransform(price, rule, cost);
  }
  return price;
}

/**
 * Returns the full price chain for cart breakdown display.
 * Each step shows what rule reduced the price and by how much.
 */
export function computeItemPriceChain(
  item: POSCartItem,
  pricelist: any,
): { finalPrice: number; steps: Array<{ label: string; saving: number; toPrice: number }> } {
  const steps: Array<{ label: string; saving: number; toPrice: number }> = [];
  if (!pricelist?.rules?.length) return { finalPrice: item.price, steps };

  const rules = findMatchingPricelistRules(pricelist.rules, item.subProductId, item.quantity, 'price');
  let price = item.price;
  const cost = Number(item.costPrice) || 0;

  for (const rule of rules) {
    const before = price;
    price = applyRuleTransform(price, rule, cost);
    const saving = before - price;
    if (Math.abs(saving) > 0.001) {
      let label = '';
      if (rule.priceType === 'fixed')           label = `Fixed price`;
      else if (rule.priceType === 'formula')    label = `Cost +${rule.markupPercentage}% markup`;
      else if (rule.priceType === 'flash_sale') label = `⚡ ${rule.flashSalePercentage}% flash`;
      else if (rule.priceType === 'discount') {
        label = rule.discountType === 'fixed'
          ? `-₦${rule.discountAmount} off`
          : `-${rule.discountPercentage}%${rule.minQuantity > 0 ? ` (qty ${rule.minQuantity}+)` : ''}`;
      }
      steps.push({ label, saving, toPrice: price });
    }
  }

  return { finalPrice: price, steps };
}

/**
 * Returns the best qualifying bundle considering both the item's stored DB
 * bundles AND any bundle rules in the currently selected pricelist.
 */
export function getBestBundleForItem(item: POSCartItem, pricelist: any): POSBundleDeal | null {
  // When a pricelist with price rules (formula/fixed/discount/flash_sale) is active,
  // suppress DB bundles — the pricelist is the authoritative pricing policy.
  const hasPriceRules = pricelist?.rules?.some((r: any) => r.priceType !== 'bundle');
  const dbBundles: POSBundleDeal[] = (hasPriceRules ? [] : item.activeBundles) || [];

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

/** @deprecated Use getBestBundleForItem(item, null) — canonical implementation. */
export function getBestBundle(item: POSCartItem): POSBundleDeal | null {
  return getBestBundleForItem(item, null);
}

/** @deprecated Use getEffectiveBundlePriceForItem(item, null) — canonical implementation. */
export function getEffectiveBundlePrice(item: POSCartItem): { price: number; overrides: boolean } {
  return getEffectiveBundlePriceForItem(item, null);
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
  const { terminal } = usePOSAuth();
  const cartAtom         = terminal === 'wholesale' ? cartsAtoms.wholesale        : cartsAtoms.retail;
  const activeCartAtom   = terminal === 'wholesale' ? activeCartIdAtoms.wholesale : activeCartIdAtoms.retail;
  const pricelistAtom    = terminal === 'wholesale' ? posSelectedPricelistAtoms.wholesale : posSelectedPricelistAtoms.retail;

  const [carts, setCarts] = useAtom(cartAtom);
  const [activeCartId, setActiveCartId] = useAtom(activeCartAtom);

  // Always resolve to a valid cart
  const activeCart = useMemo(
    () => carts.find((c) => c.id === activeCartId) ?? carts[0] ?? INITIAL_CART,
    [carts, activeCartId]
  );

  const { items, customer, discountType, discountValue, note, ref } = activeCart;

  // Pricelist is applied dynamically so the total stays live as selection changes
  const [selectedPricelist] = useAtom(pricelistAtom);

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
              return {
                ...i,
                quantity: i.quantity + item.quantity,
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
            ? { ...i, quantity: Math.max(1, Math.round(quantity)) }
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

const posSelectedPricelistAtoms = termAtoms<any | null>('dh-pos-pricelist', null);

// Cached list of available pricelists (fetched once per session, shared by PricelistPicker + PricelistModal)
const posAvailablePricelistsAtom   = atomWithStorage<any[]>('dh-pos-available-pricelists', []);
const posAvailablePricelistsLoadedAtom = atom<boolean>(false);

export const usePOSPricelist = () => {
  const { terminal } = usePOSAuth();
  const pricelistAtom = terminal === 'wholesale' ? posSelectedPricelistAtoms.wholesale : posSelectedPricelistAtoms.retail;
  const [selectedPricelist, setSelectedPricelist] = useAtom(pricelistAtom);
  return { selectedPricelist, setSelectedPricelist };
};

/** Shared cache of selectable pricelists — avoids duplicate fetches from PricelistPicker and PricelistModal */
export const usePOSAvailablePricelists = () => {
  const { terminal } = usePOSAuth();
  const pricelistAtom = terminal === 'wholesale' ? posSelectedPricelistAtoms.wholesale : posSelectedPricelistAtoms.retail;
  const [pricelists, setPricelists]   = useAtom(posAvailablePricelistsAtom);
  const [loaded,     setLoaded]       = useAtom(posAvailablePricelistsLoadedAtom);
  const [selectedPricelist, setSelectedPricelist] = useAtom(pricelistAtom);

  const load = useCallback(
    async (token: string) => {
      if (loaded) return;
      try {
        const { posApi } = await import('@/app/shared/point-of-sale/api');
        const data = await posApi.getPricelists(token);
        const fresh = data.pricelists || [];
        setPricelists(fresh);
        setLoaded(true);
        // Sync: if a pricelist is selected from a previous session, replace it
        // with the freshly fetched version so rule changes in admin take effect.
        if (selectedPricelist?._id) {
          const updated = fresh.find((p: any) => p._id === selectedPricelist._id);
          if (updated) setSelectedPricelist(updated);
        }
      } catch { /* silent — picker shows empty gracefully */ }
    },
    [loaded, setPricelists, setLoaded, selectedPricelist, setSelectedPricelist],
  );

  const invalidate = useCallback(() => setLoaded(false), [setLoaded]);

  return { pricelists, loaded, load, invalidate };
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
