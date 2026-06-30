'use client';

import { atom, useAtom, useAtomValue } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import {
  POSCartItem,
  POSBundleDeal,
  POSStaff,
  POSTenant,
  POSCombo,
  POSApplicableItems,
  POSProduct,
  POSShop,
  POSNotification,
} from '@/app/shared/point-of-sale/types';
import {
  findBestPricelistRule,
  findMatchingPricelistRules,
  applyRuleTransform,
} from '@/app/shared/point-of-sale/utils';
import { useCallback, useEffect, useMemo, useRef } from 'react';

// ─── Auth (persisted) ────────────────────────────────────────────────────────

const posTokenAtom = atomWithStorage<string | null>('dh-pos-token', null);
const posStaffAtom = atomWithStorage<POSStaff | null>('dh-pos-staff', null);
const posTenantAtom = atomWithStorage<POSTenant | null>('dh-pos-tenant', null);
const posTerminalAtom = atomWithStorage<'retail' | 'wholesale' | null>(
  'dh-pos-terminal',
  null
);

export const usePOSAuth = () => {
  const [token, setToken] = useAtom(posTokenAtom);
  const [staff, setStaff] = useAtom(posStaffAtom);
  const [tenant, setTenant] = useAtom(posTenantAtom);
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

  return {
    token,
    staff,
    tenant,
    terminal,
    setAuth,
    setTerminal,
    logout,
    isAuthenticated,
  };
};

// ─── POS Shops ────────────────────────────────────────────────────────────────

const posShopsAtom = atomWithStorage<POSShop[]>('dh-pos-shops', []);

export const usePOSShops = () => {
  const [shops, setShops] = useAtom(posShopsAtom);
  return { shops, setShops };
};

const posActiveShopIdAtom = atomWithStorage<string | null>('dh-pos-shop', null);

export const usePOSActiveShop = () => {
  const [activeShopId, setActiveShopId] = useAtom(posActiveShopIdAtom);
  const { shops } = usePOSShops();
  const activeShop = useMemo(
    () => shops.find((s) => s._id === activeShopId) ?? null,
    [shops, activeShopId]
  );
  return { activeShopId, setActiveShopId, activeShop };
};

// ─── Notifications ────────────────────────────────────────────────────────────

type StoredNotification = POSNotification & { seen: boolean };

const posNotificationsAtom = atomWithStorage<StoredNotification[]>(
  'dh-pos-notifications',
  []
);

export const usePOSNotifications = () => {
  const [notifications, setNotifications] = useAtom(posNotificationsAtom);
  const unreadCount = notifications.filter((n) => !n.seen).length;

  const markAllSeen = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, seen: true }))),
    [setNotifications]
  );

  const addNotifications = useCallback(
    (incoming: POSNotification[]) => {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n._id));
        const newOnes = incoming
          .filter((n) => !existingIds.has(n._id))
          .map((n) => ({ ...n, seen: false }));
        return newOnes.length ? [...newOnes, ...prev].slice(0, 100) : prev;
      });
    },
    [setNotifications]
  );

  return { notifications, unreadCount, markAllSeen, addNotifications };
};

// ─── Active combos (shared between grid and cart) ─────────────────────────────

const posActiveCombosAtom = atom<POSCombo[]>([]);

export const usePOSCombos = () => {
  const [combos, setCombos] = useAtom(posActiveCombosAtom);
  return { combos, setCombos };
};

// ─── Product catalog (shared between grid and cart) ──────────────────────────

const posProductsAtom = atom<POSProduct[]>([]);

export const usePOSProducts = () => {
  const [products, setProducts] = useAtom(posProductsAtom);
  return { products, setProducts };
};

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
  appliedRewards: [],
};

// ─── Terminal-scoped storage ───────────────────────────────────────────────────
// Retail and wholesale each have their own cart, active cart ID, and pricelist
// selection so they operate as independent closed systems.

function termAtoms<T>(baseKey: string, fallback: T) {
  return {
    retail: atomWithStorage<T>(`${baseKey}-retail`, fallback),
    wholesale: atomWithStorage<T>(`${baseKey}-wholesale`, fallback),
  };
}

// ─── Multi-cart atoms (persisted, terminal-scoped) ────────────────────────────

const cartsAtoms = termAtoms<CartData[]>('dh-pos-carts', [INITIAL_CART]);
const activeCartIdAtoms = termAtoms<string>(
  'dh-pos-active-cart',
  INITIAL_CART_ID
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getItemKey(
  subProductId: string,
  sizeId?: string,
  comboInstanceId?: string
) {
  const base = sizeId ? `${subProductId}_${sizeId}` : subProductId;
  return comboInstanceId ? `${base}__ci_${comboInstanceId}` : base;
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
export function computeItemPriceWithPricelist(
  item: POSCartItem,
  pricelist: any
): number {
  if (!pricelist?.rules?.length) return item.price;

  const rules = findMatchingPricelistRules(
    pricelist.rules,
    item.subProductId,
    item.quantity,
    'price'
  );
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
  pricelist: any
): {
  finalPrice: number;
  steps: Array<{ label: string; saving: number; toPrice: number }>;
} {
  const steps: Array<{ label: string; saving: number; toPrice: number }> = [];
  if (!pricelist?.rules?.length) return { finalPrice: item.price, steps };

  const rules = findMatchingPricelistRules(
    pricelist.rules,
    item.subProductId,
    item.quantity,
    'price'
  );
  let price = item.price;
  const cost = Number(item.costPrice) || 0;

  for (const rule of rules) {
    const before = price;
    price = applyRuleTransform(price, rule, cost);
    const saving = before - price;
    if (Math.abs(saving) > 0.001) {
      let label = '';
      if (rule.priceType === 'fixed') label = `Fixed price`;
      else if (rule.priceType === 'formula')
        label = `Cost +${rule.markupPercentage}% markup`;
      else if (rule.priceType === 'flash_sale')
        label = `⚡ ${rule.flashSalePercentage}% flash`;
      else if (rule.priceType === 'discount') {
        label =
          rule.discountType === 'fixed'
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
export function getBestBundleForItem(
  item: POSCartItem,
  pricelist: any
): POSBundleDeal | null {
  // When a pricelist with price rules (formula/fixed/discount/flash_sale) is active,
  // suppress DB bundles — the pricelist is the authoritative pricing policy.
  const hasPriceRules = pricelist?.rules?.some(
    (r: any) => r.priceType !== 'bundle'
  );
  const dbBundles: POSBundleDeal[] =
    (hasPriceRules ? [] : item.activeBundles) || [];

  const plBundles: POSBundleDeal[] = [];
  if (pricelist?.rules?.length) {
    const now = new Date();
    for (const r of pricelist.rules as any[]) {
      if (r.priceType !== 'bundle') continue;
      if (r.endDate && new Date(r.endDate) < now) continue;
      if (r.startDate && new Date(r.startDate) > now) continue;
      if (!r.bundleQuantity) continue;
      if (r.bundleDiscountType !== 'no_discount' && !r.bundleDiscount) continue;
      // minQuantity is the rule's overall activation threshold (separate from bundleQuantity)
      if ((Number(r.minQuantity) || 0) > item.quantity) continue;
      const pid = r.subProduct?._id
        ? String(r.subProduct._id)
        : r.subProduct
          ? String(r.subProduct)
          : null;
      if (pid && pid !== String(item.subProductId)) continue;
      plBundles.push({
        name: r.bundleName || `Buy ${r.bundleQuantity}+`,
        quantity: r.bundleQuantity || 2,
        discount: r.bundleDiscount || 0,
        discountType: r.bundleDiscountType || 'percentage',
        active: true,
        validUntil: r.endDate ?? null,
        fromPricelist: true,
      });
    }
  }

  const allBundles = [...dbBundles, ...plBundles];
  if (!allBundles.length) return null;

  const now = new Date();
  const qualifying = allBundles.filter(
    (b) =>
      b.active !== false &&
      (!b.validUntil || new Date(b.validUntil) >= now) &&
      item.quantity >= (b.quantity ?? 2)
  );
  if (!qualifying.length) return null;

  const p = item.price;
  const qty = item.quantity;
  return qualifying.sort((a, b) => {
    const savings = (bd: POSBundleDeal) => {
      const dt = bd.discountType ?? 'percentage';
      if (dt === 'fixed') return (bd.discount ?? 0) * qty;
      if (dt === 'markup_on_cost')
        return (
          Math.max(
            0,
            p - (Number(item.costPrice) || 0) * (1 + (bd.discount ?? 0) / 100)
          ) * qty
        );
      if (dt === 'no_discount') return 0;
      return (p * qty * Math.min(100, bd.discount ?? 0)) / 100;
    };
    return savings(b) - savings(a);
  })[0];
}

/** Effective unit price for a cart item including pricelist overrides (markup_on_cost / no_discount). */
export function getEffectiveBundlePriceForItem(
  item: POSCartItem,
  pricelist: any
): { price: number; overrides: boolean } {
  const best = getBestBundleForItem(item, pricelist);
  const basePrice = computeItemPriceWithPricelist(item, pricelist);

  if (best?.discountType === 'markup_on_cost') {
    const cost = Number(item.costPrice) || 0;
    const markup = best.discount ?? 0;
    if (cost > 0)
      return {
        price: Math.round(cost * (1 + markup / 100) * 100) / 100,
        overrides: true,
      };
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
export function getEffectiveBundlePrice(item: POSCartItem): {
  price: number;
  overrides: boolean;
} {
  return getEffectiveBundlePriceForItem(item, null);
}

function computeSubtotal(items: POSCartItem[], pricelist?: any) {
  return items.reduce((sum, item) => {
    const best = pricelist
      ? getBestBundleForItem(item, pricelist)
      : getBestBundle(item);
    const { price: effectivePrice, overrides } = pricelist
      ? getEffectiveBundlePriceForItem(item, pricelist)
      : getEffectiveBundlePrice(item);

    const lineGross = effectivePrice * item.quantity;
    const itemDiscAmt =
      (lineGross * Math.max(0, Math.min(100, item.discount))) / 100;

    let bundleDiscAmt = 0;
    if (best && !overrides) {
      const dt = best.discountType ?? 'percentage';
      bundleDiscAmt =
        dt === 'fixed'
          ? Math.min(
              (best.discount ?? 0) * item.quantity,
              lineGross - itemDiscAmt
            )
          : (lineGross * Math.min(100, best.discount ?? 0)) / 100;
      bundleDiscAmt = Math.max(0, bundleDiscAmt);
    }

    return sum + lineGross - Math.min(lineGross, itemDiscAmt + bundleDiscAmt);
  }, 0);
}

function computeDiscountAmount(
  subtotal: number,
  type: 'percent' | 'fixed',
  value: number
) {
  if (value <= 0) return 0;
  return type === 'fixed'
    ? Math.min(value, subtotal)
    : subtotal * (value / 100);
}

/** Which units of a specific cart item are discounted by a BuyXGetY reward. */
export type BxgyItemDiscount = {
  subProductId: string;
  sizeId?: string;
  qty: number;
  discPct: number; // 100 = free, 50 = half-price
  role: 'buy' | 'get';
};

/** Check whether a cart item matches a POSApplicableItems filter. */
export function itemMatchesApplicableItems(
  item: POSCartItem,
  applicable: POSApplicableItems | undefined
): boolean {
  if (!applicable) return true;
  if (
    (applicable.products ?? []).length === 0 &&
    (applicable.categories ?? []).length === 0 &&
    (applicable.brands ?? []).length === 0
  )
    return true;
  if ((applicable.products ?? []).includes(item.productId)) return true;
  if (
    item.categoryId &&
    (applicable.categories ?? []).includes(item.categoryId)
  )
    return true;
  if (item.brandId && (applicable.brands ?? []).includes(item.brandId))
    return true;
  return false;
}

/**
 * Returns the per-item breakdown of a BuyXGetY reward: which units are "buy" items
 * (paid at full price) and which are "get" items (discounted/free).
 * Used by addReward to inject get items, and by computeRewardDiscount to compute
 * the total discount.
 *
 * Same-pool vs cross-pool:
 *   – Cross-pool: buy and get pools are different products (getProducts / rewardApplyTo set).
 *     sets = floor(buyPool.total / buyQty)
 *   – Same-pool: both pools are the same product set (no explicit getProducts).
 *     sets = floor(pool.total / (buyQty + getQty))
 *     This prevents awarding more free items than makes sense (e.g. B1G1 on 3 items → 1 free, not 3).
 */
export function computeBxgyGroupItems(
  reward: CartAppliedReward,
  items: POSCartItem[]
): BxgyItemDiscount[] {
  if (reward.kind !== 'bxgy') return [];
  const buyQty = reward.buyQty ?? 1;
  const getQty = reward.getQty ?? 1;
  const discPct = reward.getDiscountPct ?? 100;

  const baseItems = items.filter((i) => !i.bxgyRef);

  // Determine buy pool
  const buyPool = reward.applyTo
    ? baseItems.filter((i) => itemMatchesApplicableItems(i, reward.applyTo))
    : (reward.buyProducts?.length ?? 0) > 0
      ? baseItems.filter((i) => reward.buyProducts!.includes(i.productId))
      : baseItems;
  const totalBuy = buyPool.reduce((s, i) => s + i.quantity, 0);

  // Determine get pool and whether it's the same as the buy pool
  const hasExplicitGetPool =
    !!reward.rewardApplyTo || (reward.getProducts?.length ?? 0) > 0;
  const getPool = reward.rewardApplyTo
    ? baseItems.filter((i) =>
        itemMatchesApplicableItems(i, reward.rewardApplyTo)
      )
    : (reward.getProducts?.length ?? 0) > 0
      ? baseItems.filter((i) => reward.getProducts!.includes(i.productId))
      : buyPool;

  // Same-pool: each set consumes buyQty + getQty items from the same pool.
  const sets = hasExplicitGetPool
    ? Math.floor(totalBuy / buyQty)
    : Math.floor(totalBuy / (buyQty + getQty));
  if (sets === 0) return [];

  // Allocate BUY units (cheapest first — maximises perceived value for customer)
  const buyAlloc: BxgyItemDiscount[] = [];
  const sortedBuy = [...buyPool].sort(
    (a, b) =>
      getEffectiveBundlePrice(a).price - getEffectiveBundlePrice(b).price
  );
  let needBuy = sets * buyQty;
  for (const it of sortedBuy) {
    if (needBuy <= 0) break;
    const take = Math.min(needBuy, it.quantity);
    buyAlloc.push({
      subProductId: it.subProductId,
      sizeId: it.sizeId,
      qty: take,
      discPct: 0,
      role: 'buy',
    });
    needBuy -= take;
  }

  // Allocate GET units (cheapest from getPool receive the discount)
  const getAlloc: BxgyItemDiscount[] = [];
  const sortedGet = [...getPool].sort(
    (a, b) =>
      getEffectiveBundlePrice(a).price - getEffectiveBundlePrice(b).price
  );
  let needGet = sets * getQty;
  for (const it of sortedGet) {
    if (needGet <= 0) break;
    const take = Math.min(needGet, it.quantity);
    getAlloc.push({
      subProductId: it.subProductId,
      sizeId: it.sizeId,
      qty: take,
      discPct,
      role: 'get',
    });
    needGet -= take;
  }

  return [...buyAlloc, ...getAlloc];
}

/** Compute the ₦ discount for a single applied reward against the current cart. */
export function computeRewardDiscount(
  reward: CartAppliedReward,
  items: POSCartItem[],
  base: number
): number {
  if (reward.kind === 'bxgy') {
    // Compute discount from BXGY get-items already in the cart, or from scratch
    // if the group hasn't been built yet (e.g., in the rewards modal preview).
    const inCartDisc = items
      .filter(
        (i) => i.bxgyRef?.rewardId === reward.id && i.bxgyRef?.role === 'get'
      )
      .reduce(
        (s, i) =>
          s +
          i.bxgyRef!.originalPrice * i.quantity * (i.bxgyRef!.discPct / 100),
        0
      );
    if (inCartDisc > 0) return Math.round(Math.max(0, inCartDisc) * 100) / 100;

    // Fallback: compute from scratch (used before the group is added to the cart)
    const groupItems = computeBxgyGroupItems(reward, items);
    const disc = groupItems
      .filter((gi) => gi.role === 'get')
      .reduce((s, gi) => {
        const item = items.find(
          (i) => i.subProductId === gi.subProductId && i.sizeId === gi.sizeId
        );
        if (!item) return s;
        const effPrice = getEffectiveBundlePrice(item).price;
        return s + effPrice * gi.qty * (gi.discPct / 100);
      }, 0);
    return Math.round(Math.max(0, disc) * 100) / 100;
  }
  const discType = reward.discType ?? 'pct';
  const discValue = reward.discValue ?? 0;
  if (discValue <= 0) return 0;
  // Exclude BXGY "get" items — their price already reflects the BXGY discount
  // and would give a wrong baseline for the cheapest/most_expensive selection.
  const nonBxgyItems = items.filter((i) => i.bxgyRef?.role !== 'get');
  let applyBase = base;
  if (reward.applyOn === 'cheapest' && nonBxgyItems.length)
    applyBase = Math.min(...nonBxgyItems.map((i) => i.price));
  else if (reward.applyOn === 'most_expensive' && nonBxgyItems.length)
    applyBase = Math.max(...nonBxgyItems.map((i) => i.price));
  const raw =
    discType === 'pct'
      ? Math.round(((applyBase * discValue) / 100) * 100) / 100
      : Math.min(discValue, applyBase);
  const capped =
    (reward.maxDiscount ?? 0) > 0 ? Math.min(raw, reward.maxDiscount!) : raw;
  return Math.max(0, capped);
}

// ─── usePOSCart ───────────────────────────────────────────────────────────────

export const usePOSCart = () => {
  const { terminal } = usePOSAuth();
  const cartAtom =
    terminal === 'wholesale' ? cartsAtoms.wholesale : cartsAtoms.retail;
  const activeCartAtom =
    terminal === 'wholesale'
      ? activeCartIdAtoms.wholesale
      : activeCartIdAtoms.retail;
  const allPOSProducts = useAtomValue(posProductsAtom);
  // Pricelist is shop-effective (resolved-or-override) so cart totals match the grid.
  const { selectedPricelist } = usePOSPricelist();

  const [carts, setCarts] = useAtom(cartAtom);
  const [activeCartId, setActiveCartId] = useAtom(activeCartAtom);

  // Always resolve to a valid cart
  const activeCart = useMemo(
    () => carts.find((c) => c.id === activeCartId) ?? carts[0] ?? INITIAL_CART,
    [carts, activeCartId]
  );

  const { items, customer, discountType, discountValue, note, ref } =
    activeCart;
  const appliedRewards: CartAppliedReward[] = activeCart.appliedRewards ?? [];

  // Derived values
  const subtotal = useMemo(
    () => computeSubtotal(items, selectedPricelist ?? undefined),
    [items, selectedPricelist]
  );
  const discountAmount = useMemo(
    () => computeDiscountAmount(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue]
  );
  const rewardsDiscountTotal = useMemo(() => {
    const afterCartDisc = Math.max(0, subtotal - discountAmount);
    return appliedRewards.reduce(
      (sum, r) => sum + computeRewardDiscount(r, items, afterCartDisc),
      0
    );
  }, [appliedRewards, items, subtotal, discountAmount]);
  const total = useMemo(
    () => Math.max(0, subtotal - discountAmount - rewardsDiscountTotal),
    [subtotal, discountAmount, rewardsDiscountTotal]
  );
  const itemCount = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );

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
      appliedRewards: [],
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

  // Full unique key for a cart item — combo items include their instanceId so
  // they never merge with regular items or other combo instances.
  function fullKey(i: {
    subProductId: string;
    sizeId?: string;
    comboRef?: { instanceId: string };
    bxgyRef?: { rewardId: string; role: string };
  }) {
    const base = i.sizeId ? `${i.subProductId}_${i.sizeId}` : i.subProductId;
    if (i.comboRef?.instanceId) return `${base}__ci_${i.comboRef.instanceId}`;
    if (i.bxgyRef?.rewardId)
      return `${base}__bxgy_${i.bxgyRef.rewardId}_${i.bxgyRef.role}`;
    return base;
  }

  const addItem = useCallback(
    (item: POSCartItem) => {
      // Use functional setCarts so rapid successive calls (e.g. adding all combo
      // items in a forEach) each receive the latest state rather than the stale
      // activeCart.items closure — without this, only the last item survives.
      setCarts((prev) =>
        prev.map((c) => {
          if (c.id !== activeCartId) return c;
          const key = fullKey(item);
          const existing = c.items.find((i) => fullKey(i) === key);
          if (existing) {
            return {
              ...c,
              items: c.items.map((i) =>
                fullKey(i) === key
                  ? {
                      ...i,
                      quantity: i.quantity + item.quantity,
                      price: item.price,
                      costPrice: item.costPrice,
                      originalPrice: item.originalPrice,
                      stock: item.stock,
                      name: item.name,
                      variant: item.variant,
                      sku: item.sku,
                      image: item.image ?? i.image,
                      categoryId: item.categoryId ?? i.categoryId,
                      brandId: item.brandId ?? i.brandId,
                      activeBundles: item.activeBundles ?? i.activeBundles,
                    }
                  : i
              ),
            };
          }
          return { ...c, items: [...c.items, item] };
        })
      );
    },
    [activeCartId, setCarts]
  );

  const removeItem = useCallback(
    (subProductId: string, sizeId?: string, comboInstanceId?: string) => {
      const key = getItemKey(subProductId, sizeId, comboInstanceId);
      patchActive({
        items: activeCart.items.filter((i) => fullKey(i) !== key),
      });
    },
    [activeCart.items, patchActive]
  );

  const removeComboGroup = useCallback(
    (instanceId: string) => {
      patchActive({
        items: activeCart.items.filter(
          (i) => i.comboRef?.instanceId !== instanceId
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const setComboGroupQty = useCallback(
    (instanceId: string, qty: number) => {
      if (qty < 1) {
        patchActive({
          items: activeCart.items.filter(
            (i) => i.comboRef?.instanceId !== instanceId
          ),
        });
      } else {
        patchActive({
          items: activeCart.items.map((i) =>
            i.comboRef?.instanceId === instanceId
              ? { ...i, quantity: Math.round(qty) }
              : i
          ),
        });
      }
    },
    [activeCart.items, patchActive]
  );

  const replaceComboGroup = useCallback(
    (instanceId: string, newItems: POSCartItem[]) => {
      setCarts((prev) =>
        prev.map((c) => {
          if (c.id !== activeCartId) return c;
          // Walk items: at first encounter of the old combo insert new items, then skip rest
          const result: POSCartItem[] = [];
          let inserted = false;
          for (const item of c.items) {
            if (item.comboRef?.instanceId === instanceId) {
              if (!inserted) {
                result.push(...newItems);
                inserted = true;
              }
            } else {
              result.push(item);
            }
          }
          if (!inserted) result.push(...newItems);
          return { ...c, items: result };
        })
      );
    },
    [activeCartId, setCarts]
  );

  const updateQuantity = useCallback(
    (
      subProductId: string,
      quantity: number,
      sizeId?: string,
      comboInstanceId?: string
    ) => {
      const key = getItemKey(subProductId, sizeId, comboInstanceId);
      patchActive({
        items: activeCart.items.map((i) =>
          fullKey(i) === key
            ? { ...i, quantity: Math.max(1, Math.round(quantity)) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateItemDiscount = useCallback(
    (
      subProductId: string,
      discount: number,
      sizeId?: string,
      comboInstanceId?: string
    ) => {
      const key = getItemKey(subProductId, sizeId, comboInstanceId);
      patchActive({
        items: activeCart.items.map((i) =>
          fullKey(i) === key
            ? { ...i, discount: Math.max(0, Math.min(100, discount)) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateItemPrice = useCallback(
    (
      subProductId: string,
      price: number,
      sizeId?: string,
      comboInstanceId?: string
    ) => {
      const key = getItemKey(subProductId, sizeId, comboInstanceId);
      patchActive({
        items: activeCart.items.map((i) =>
          fullKey(i) === key ? { ...i, price: Math.max(0, price) } : i
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
      appliedRewards: [],
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

  const setAppliedRewards = useCallback(
    (rewards: CartAppliedReward[]) => patchActive({ appliedRewards: rewards }),
    [patchActive]
  );

  const addReward = useCallback(
    (r: CartAppliedReward) => {
      if (r.kind === 'bxgy') {
        // Strip any existing injected get items for this reward, then recompute.
        // Buy items are NEVER split out — they remain as regular cart items.
        const cartWithout = activeCart.items.filter(
          (i) => i.bxgyRef?.rewardId !== r.id
        );
        const groupItems = computeBxgyGroupItems(r, cartWithout);
        const getGroups = groupItems.filter((gi) => gi.role === 'get');
        if (getGroups.length === 0) {
          // No longer qualifies — if already applied, remove the reward and stale items
          if (appliedRewards.some((x) => x.id === r.id)) {
            patchActive({
              appliedRewards: appliedRewards.filter((x) => x.id !== r.id),
              items: cartWithout,
            });
          }
          return;
        }

        // origLookup: find a matching cart item to clone for the get role
        const origLookup = new Map(
          cartWithout.map((i) => [
            getItemKey(i.subProductId, i.sizeId, i.comboRef?.instanceId),
            i,
          ])
        );
        // catLookup: fall back to catalog for get items not yet in the cart
        const catLookup = new Map(allPOSProducts.map((p) => [p._id, p]));

        // Build the "get" items to inject alongside the unchanged cart items
        const getItems: POSCartItem[] = [];
        for (const gi of getGroups) {
          const key = getItemKey(gi.subProductId, gi.sizeId);
          const original = origLookup.get(key);

          if (original) {
            // The get product is already in the cart — clone it with bxgyRef
            const effPrice = getEffectiveBundlePrice(original).price;
            getItems.push({
              ...original,
              quantity: gi.qty,
              price: effPrice,
              discount: 0,
              bxgyRef: {
                rewardId: r.id,
                role: 'get',
                discPct: gi.discPct,
                originalPrice: effPrice,
                rewardName: r.name,
                rewardColor: r.color,
              },
              comboRef: undefined,
              activeBundles: [],
            });
          } else {
            // Get product is not in the cart — create it from the product catalog
            const cat = catLookup.get(gi.subProductId);
            if (!cat) continue;
            const size = gi.sizeId
              ? cat.sizes?.find((s: { _id: string }) => s._id === gi.sizeId)
              : undefined;
            const effPrice = size?.sellingPrice ?? cat.baseSellingPrice ?? 0;
            getItems.push({
              subProductId: cat._id,
              productId: cat.product?._id || cat._id,
              sizeId: size?._id,
              name: cat.product?.name || 'Product',
              variant: size?.displayName || '',
              sku: size?.sku || cat.sku,
              image:
                cat.product?.images?.[0]?.thumbnail ||
                cat.product?.images?.[0]?.url,
              price: effPrice,
              quantity: gi.qty,
              discount: 0,
              stock: size?.availableStock ?? cat.availableStock,
              costPrice: cat.costPrice,
              originalPrice: cat.originalPrice ?? undefined,
              categoryId: cat.product?.category?._id,
              brandId: cat.product?.brand?._id,
              activeBundles: [],
              bxgyRef: {
                rewardId: r.id,
                role: 'get',
                discPct: gi.discPct,
                originalPrice: effPrice,
                rewardName: r.name,
                rewardColor: r.color,
              },
            });
          }
        }

        patchActive({
          appliedRewards: [...appliedRewards.filter((x) => x.id !== r.id), r],
          items: [...cartWithout, ...getItems],
        });
        return;
      }

      // Non-BXGY rewards: just add to appliedRewards
      patchActive({
        appliedRewards: [...appliedRewards.filter((x) => x.id !== r.id), r],
      });
    },
    [appliedRewards, activeCart.items, patchActive, allPOSProducts]
  );

  const removeReward = useCallback(
    (id: string) => {
      // For BXGY rewards: just drop the injected get items; buy items were never moved.
      // For all other reward types: no items to remove, only the reward entry.
      patchActive({
        appliedRewards: appliedRewards.filter((x) => x.id !== id),
        items: activeCart.items.filter((i) => i.bxgyRef?.rewardId !== id),
      });
    },
    [appliedRewards, activeCart.items, patchActive]
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
      rewardsDiscountTotal,
      total,
      itemCount,
      // Applied rewards
      appliedRewards,
      setAppliedRewards,
      addReward,
      removeReward,
      // Item ops
      addItem,
      removeItem,
      removeComboGroup,
      setComboGroupQty,
      replaceComboGroup,
      updateQuantity,
      updateItemDiscount,
      updateItemPrice,
      clearCart,
      setCustomer,
      setDiscount,
      setNote,
    }),
    [
      carts,
      activeCartId,
      ref,
      addCart,
      switchCart,
      removeCart,
      items,
      customer,
      discountType,
      discountValue,
      note,
      subtotal,
      discountAmount,
      rewardsDiscountTotal,
      total,
      itemCount,
      appliedRewards,
      setAppliedRewards,
      addReward,
      removeReward,
      addItem,
      removeItem,
      removeComboGroup,
      setComboGroupQty,
      replaceComboGroup,
      updateQuantity,
      updateItemDiscount,
      updateItemPrice,
      clearCart,
      setCustomer,
      setDiscount,
      setNote,
    ]
  );
};

// ─── Permissions helper ───────────────────────────────────────────────────────

export const usePOSPermissions = () => {
  const { staff } = usePOSAuth();
  const perms: string[] = staff?.posPermissions ?? [];
  return {
    canSell: perms.includes('pos:sell') || perms.length === 0,
    canRefund: perms.includes('pos:refund'),
    canVoid: perms.includes('pos:void'),
    canDiscount: perms.includes('pos:discount'),
    canPriceOverride: perms.includes('pos:price_override'),
    has: (p: string) => perms.includes(p),
  };
};

// ─── Pricelist (shop-effective) ───────────────────────────────────────────────
// The effective pricelist = manual override for the active shop (if any) else
// the server-resolved pricelist. Overrides are keyed by shop id and persisted;
// switching shops re-resolves (the new shop has no override → its resolved one
// shows). Carts stay terminal-keyed; only the pricelist dimension is shop-keyed.

// shopId → pricelistId ('' = explicit "no pricelist"; key absent = use resolved)
const posPricelistOverrideAtom = atomWithStorage<Record<string, string>>(
  'dh-pos-pricelist-override',
  {}
);
// Allowed set (with rules) for the active shop — fetched from the server.
const posAllowedPricelistsAtom = atom<any[]>([]);
// Auto-resolved pricelist id for the active shop.
const posResolvedPricelistIdAtom = atom<string | null>(null);
// Tracks which shop the current allowed/resolved data was fetched for.
const posPricelistLoadedShopAtom = atom<string | null>(null);

function effectiveShopKey(activeShopId: string | null) {
  return activeShopId ?? 'retail';
}

export const usePOSPricelist = () => {
  const { activeShopId } = usePOSActiveShop();
  const shopKey = effectiveShopKey(activeShopId);
  const [overrides, setOverrides] = useAtom(posPricelistOverrideAtom);
  const [allowed] = useAtom(posAllowedPricelistsAtom);
  const [resolvedId] = useAtom(posResolvedPricelistIdAtom);

  const hasOverride = Object.prototype.hasOwnProperty.call(overrides, shopKey);
  const selectedPricelist = useMemo(() => {
    if (hasOverride) {
      const ov = overrides[shopKey];
      if (!ov) return null; // explicit "no pricelist"
      return allowed.find((p) => p._id === ov) ?? null;
    }
    if (resolvedId) return allowed.find((p) => p._id === resolvedId) ?? null;
    return null;
  }, [hasOverride, overrides, shopKey, allowed, resolvedId]);

  const isManualOverride = hasOverride;

  // Sets a manual override for the active shop. null = explicit "no pricelist".
  const setSelectedPricelist = useCallback(
    (pl: any | null) => {
      setOverrides((prev) => ({ ...prev, [shopKey]: pl?._id ?? '' }));
    },
    [setOverrides, shopKey]
  );

  // Clears the override → falls back to the auto-resolved pricelist.
  const clearOverride = useCallback(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[shopKey];
      return next;
    });
  }, [setOverrides, shopKey]);

  return {
    selectedPricelist,
    setSelectedPricelist,
    clearOverride,
    isManualOverride,
    // The effective shop key the allowed/resolved pricelists were fetched under.
    // Checkout MUST send this as shopId so the server resolves the SAME pricelist
    // (built-in terminals have no custom shop _id, so activeShop?._id is undefined
    // and would otherwise drop a shop-scoped pricelist server-side).
    shopKey,
  };
};

/** The active terminal's selected-customer id ('' for a walk-in / no DB customer). */
function useActiveCartCustomer(): CartCustomer {
  const { terminal } = usePOSAuth();
  const cartAtom =
    terminal === 'wholesale' ? cartsAtoms.wholesale : cartsAtoms.retail;
  const activeCartAtom =
    terminal === 'wholesale'
      ? activeCartIdAtoms.wholesale
      : activeCartIdAtoms.retail;
  const carts = useAtomValue(cartAtom);
  const activeCartId = useAtomValue(activeCartAtom);
  const activeCart =
    carts.find((c) => c.id === activeCartId) ?? carts[0] ?? INITIAL_CART;
  return activeCart.customer;
}

/**
 * Shop-scoped allowed pricelists + auto-resolved id. Keyed by shop AND the
 * selected customer: a customer with an assigned pricelist changes both the
 * auto-resolved id and the allowed set (their pricelist is folded in, with
 * rules), so selecting/clearing a customer refetches. The customer id is read
 * from the active cart, so every `load(token)` caller stays consistent.
 */
export const usePOSAvailablePricelists = () => {
  const { activeShopId } = usePOSActiveShop();
  const shopKey = effectiveShopKey(activeShopId);
  const customerId = useActiveCartCustomer().customerId ?? '';
  const [pricelists, setPricelists] = useAtom(posAllowedPricelistsAtom);
  const [resolvedId, setResolvedId] = useAtom(posResolvedPricelistIdAtom);
  const [loadedShop, setLoadedShop] = useAtom(posPricelistLoadedShopAtom);

  const load = useCallback(
    async (token: string) => {
      const key = `${shopKey}::${customerId}`;
      if (loadedShop === key) return;
      try {
        const { posApi } = await import('@/app/shared/point-of-sale/api');
        const data = await posApi.getPricelists(
          token,
          shopKey,
          customerId || undefined
        );
        setPricelists(data.pricelists || []);
        setResolvedId(data.resolvedId ?? null);
        setLoadedShop(key);
      } catch {
        /* silent — picker shows empty gracefully */
      }
    },
    [
      loadedShop,
      shopKey,
      customerId,
      setPricelists,
      setResolvedId,
      setLoadedShop,
    ]
  );

  const invalidate = useCallback(() => setLoadedShop(null), [setLoadedShop]);

  return {
    pricelists,
    resolvedId,
    // `loaded` is true once data for the active shop has been fetched (under any
    // customer key), so the picker renders without flicker while a customer
    // selection triggers a background refetch.
    loaded:
      typeof loadedShop === 'string' && loadedShop.startsWith(`${shopKey}::`),
    load,
    invalidate,
  };
};

/**
 * Keeps the active terminal's selected pricelist in sync with the selected
 * customer: when a customer with an assigned pricelist is chosen, that pricelist
 * is actively selected AND applied (it wins over any stale manual override);
 * clearing the customer (or choosing one without a pricelist) reverts to the
 * shop's auto-resolved pricelist. The cashier can still manually pick a different
 * pricelist afterwards — that only re-syncs when the customer next changes, so a
 * deliberate override is never clobbered mid-sale.
 *
 * Mount ONCE on the sell page (POSSell) so exactly one effect drives the sync.
 */
export const usePOSCustomerPricelistSync = (token: string) => {
  const { activeShopId } = usePOSActiveShop();
  const shopKey = effectiveShopKey(activeShopId);
  const customer = useActiveCartCustomer();
  const { load } = usePOSAvailablePricelists();
  const [, setOverrides] = useAtom(posPricelistOverrideAtom);

  // Refetch the allowed/resolved set whenever the shop or customer changes, so
  // the customer's pricelist (with rules) is folded into `allowed` and pricing
  // can resolve it. `load` is keyed by shop+customer and self-deduplicates.
  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  // Apply (or revert) the customer's pricelist — but only on an actual change of
  // the active shop+customer, so we never fight a manual cashier override.
  const lastKeyRef = useRef<string | null>(null);
  const cid = customer.customerId ?? '';
  const plId = customer.pricelistId ?? '';
  useEffect(() => {
    const key = `${shopKey}::${cid}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setOverrides((prev) => {
      if (plId) return { ...prev, [shopKey]: plId };
      // No assigned pricelist → drop the override so Auto (shop) resolves.
      const next = { ...prev };
      delete next[shopKey];
      return next;
    });
  }, [shopKey, cid, plId, setOverrides]);
};

// ─── Sale refresh signal ──────────────────────────────────────────────────────
// Increment this after every successful order to trigger session + product refreshes.
const posSaleCounterAtom = atom(0);

export const usePOSSaleSignal = () => {
  const [saleCounter, setSaleCounter] = useAtom(posSaleCounterAtom);
  const notifySale = useCallback(
    () => setSaleCounter((n) => n + 1),
    [setSaleCounter]
  );
  return { saleCounter, notifySale };
};

// ─── Warehouse ───────────────────────────────────────────────────────────────

export type POSWarehouse = { _id: string; name: string; isDefault?: boolean };

const posWarehouseIdAtom = atomWithStorage<string>('dh-pos-warehouse-id', '');
const posWarehousesAtom = atom<POSWarehouse[]>([]);
const posWarehousesLoadedAtom = atom<boolean>(false);

export const usePOSWarehouse = () => {
  const [warehouseId, setWarehouseId] = useAtom(posWarehouseIdAtom);
  const [warehouses] = useAtom(posWarehousesAtom);
  return { warehouseId, setWarehouseId, warehouses };
};

export const usePOSAvailableWarehouses = () => {
  const [warehouses, setWarehouses] = useAtom(posWarehousesAtom);
  const [loaded, setLoaded] = useAtom(posWarehousesLoadedAtom);
  const [, setWarehouseId] = useAtom(posWarehouseIdAtom);

  const load = useCallback(
    async (token: string) => {
      if (loaded) return;
      try {
        const { posApi } = await import('@/app/shared/point-of-sale/api');
        const data = await posApi.getWarehouses(token);
        const list: POSWarehouse[] = data?.warehouses ?? data ?? [];
        setWarehouses(list);
        const def = list.find((w) => w.isDefault);
        if (def) setWarehouseId(def._id);
        setLoaded(true);
      } catch {
        /* silent — warehouse selector shows empty gracefully */
      }
    },
    [loaded, setWarehouses, setWarehouseId, setLoaded]
  );

  return { warehouses, loaded, load };
};

/** Per-cart linked sales order — read/write on the active cart. */
export const usePOSLinkedSalesOrder = () => {
  const { terminal } = usePOSAuth();
  const cartAtom = terminal === 'wholesale' ? cartsAtoms.wholesale : cartsAtoms.retail;
  const activeCartIdAtom = terminal === 'wholesale' ? activeCartIdAtoms.wholesale : activeCartIdAtoms.retail;
  const [carts, setCarts] = useAtom(cartAtom);
  const activeCartId = useAtomValue(activeCartIdAtom);
  const activeCart = carts.find((c) => c.id === activeCartId) ?? carts[0];
  const linkedSalesOrderId = activeCart?.linkedSalesOrderId ?? null;

  const setLinkedSalesOrderId = useCallback(
    (id: string | null) => {
      setCarts((prev) =>
        prev.map((c) =>
          c.id === (activeCartId ?? prev[0]?.id) ? { ...c, linkedSalesOrderId: id } : c
        )
      );
    },
    [setCarts, activeCartId]
  );

  return { linkedSalesOrderId, setLinkedSalesOrderId };
};

// ─── Currency formatter ───────────────────────────────────────────────────────

export function formatCurrency(
  amount: number,
  symbol: string,
  position: 'before' | 'after',
  decimals: number
): string {
  const formatted = amount
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return position === 'before'
    ? `${symbol}${formatted}`
    : `${formatted}${symbol}`;
}

// ─── usePOSSettings ───────────────────────────────────────────────────────────

export const usePOSSettings = () => {
  const { tenant } = usePOSAuth();
  const s = tenant?.posSettings ?? {};
  return {
    requireCustomer: s.requireCustomer ?? false,
    showLoyaltyBalanceAtCheckout: s.showLoyaltyBalanceAtCheckout ?? true,
    customerPhoneSearch: s.customerPhoneSearch ?? true,
    allowOrderNotes: s.allowOrderNotes ?? true,
    holdOrders: s.holdOrders ?? false,
    splitPayments: s.splitPayments ?? false,
    minimumOrderAmount: s.minimumOrderAmount ?? 0,
    allowRefunds: s.allowRefunds ?? true,
    refundWindowDays: s.refundWindowDays ?? 30,
    requireManagerApprovalForRefund: s.requireManagerApprovalForRefund ?? false,
    defaultRestockOnRefund: s.defaultRestockOnRefund ?? true,
    sessionTimeoutMins: s.sessionTimeoutMins ?? 0,
    requirePINOnUnlock: s.requirePINOnUnlock ?? true,
    requireManagerPINForDiscount: s.requireManagerPINForDiscount ?? false,
    currencySymbol: s.currencySymbol ?? '₦',
    currencyPosition: (s.currencyPosition as 'before' | 'after') ?? 'before',
    decimalPlaces: s.decimalPlaces ?? 2,
    showCashierName: s.showCashierName ?? true,
    showOrderNumber: s.showOrderNumber ?? true,
    receiptNumberPrefix: s.receiptNumberPrefix ?? '',
    autoValidateOrder: s.autoValidateOrder ?? false,
    tipsEnabled: s.tipsEnabled ?? false,
    cashRounding: s.cashRounding ?? false,
    lineDiscounts: s.lineDiscounts ?? true,
    globalDiscounts: s.globalDiscounts ?? false,
    maxDiscountPct: s.maxDiscountPct ?? 100,
    promotionsEnabled: s.promotionsEnabled ?? true,
    flexiblePricelists: s.flexiblePricelists ?? false,
    priceControl: s.priceControl ?? false,
    hidePictures: s.hidePictures ?? false,
    showProductImages: s.showProductImages ?? true,
    largeScrollbars: s.largeScrollbars ?? false,
    allowOverselling: s.allowOverselling ?? false,
    allowShipLater: s.allowShipLater ?? false,
    barcodes: s.barcodes ?? false,
    internalNotes: s.internalNotes ?? false,
    sortCartByCategory: s.sortCartByCategory ?? false,
    requireOpeningCash: s.requireOpeningCash ?? false,
    enabledPaymentMethods: (s.enabledPaymentMethods as string[]) ?? [
      'cash',
      'card',
      'bank_transfer',
      'mobile_money',
    ],
    autoPrintReceipt: s.autoPrintReceipt ?? false,
    basicReceipt: s.basicReceipt ?? false,
    showTaxOnReceipt: s.showTaxOnReceipt ?? false,
    taxRate: s.taxRate ?? 7.5,
    receiptHeader: s.receiptHeader ?? '',
    receiptFooter: s.receiptFooter ?? '',
    isBarRestaurant: s.isBarRestaurant ?? false,
  } as const;
};

// ─── UI State ────────────────────────────────────────────────────────────────

const posActiveViewAtom = atom<'sell' | 'payment' | 'receipt'>('sell');
const posPaymentMethodAtom = atom('cash');
const posAmountTenderedAtom = atom(0);
const posSplitPaymentsAtom = atom<{ method: string; amount: number }[]>([]);
const posSearchQueryAtom = atom('');
const posSelectedCategoryAtom = atom('');

export const usePOSUI = () => {
  const [activeView, setActiveView] = useAtom(posActiveViewAtom);
  const [paymentMethod, setPaymentMethod] = useAtom(posPaymentMethodAtom);
  const [amountTendered, setAmountTendered] = useAtom(posAmountTenderedAtom);
  const [splitPayments, setSplitPayments] = useAtom(posSplitPaymentsAtom);
  const [searchQuery, setSearchQuery] = useAtom(posSearchQueryAtom);
  const [selectedCategory, setSelectedCategory] = useAtom(
    posSelectedCategoryAtom
  );

  const resetPayment = useCallback(() => {
    setPaymentMethod('cash');
    setAmountTendered(0);
    setSplitPayments([]);
  }, [setPaymentMethod, setAmountTendered, setSplitPayments]);

  return useMemo(
    () => ({
      activeView,
      setActiveView,
      paymentMethod,
      setPaymentMethod,
      amountTendered,
      setAmountTendered,
      splitPayments,
      setSplitPayments,
      searchQuery,
      setSearchQuery,
      selectedCategory,
      setSelectedCategory,
      resetPayment,
    }),
    [
      activeView,
      paymentMethod,
      amountTendered,
      splitPayments,
      searchQuery,
      selectedCategory,
      setActiveView,
      setPaymentMethod,
      setAmountTendered,
      setSplitPayments,
      setSearchQuery,
      setSelectedCategory,
      resetPayment,
    ]
  );
};
