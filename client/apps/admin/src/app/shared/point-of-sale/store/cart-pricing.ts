'use client';

import {
  POSApplicableItems,
  POSBundleDeal,
  POSCartItem,
} from '@/app/shared/point-of-sale/types';
import {
  findMatchingPricelistRules,
  applyRuleTransform,
  applyCartBundleAdjustments,
  findCartThresholdRules,
  computeCartThresholdDiscount,
  PER_LINE_PRICE_TYPES,
} from '@/app/shared/point-of-sale/utils';
import { CartAppliedReward } from './cart-types';

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
  const hasPriceRules = pricelist?.rules?.some((r: any) =>
    PER_LINE_PRICE_TYPES.includes(r.priceType)
  );
  const dbBundles: POSBundleDeal[] =
    (hasPriceRules ? [] : item.activeBundles) || [];

  const plBundles: POSBundleDeal[] = [];
  if (pricelist?.rules?.length) {
    const now = new Date();
    for (const r of pricelist.rules as any[]) {
      if (r.priceType !== 'bundle') continue;
      // Cross-product bundles (buy X of trigger → discount target) are applied
      // by the cart-wide pass in computeSubtotal, never as a same-product deal.
      if (r.bundleTargetSubProduct) continue;
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

export function computeSubtotal(items: POSCartItem[], pricelist?: any) {
  // ── Per-line pass: pricelist price rules + same-product bundles ────────────
  const lineNets: number[] = [];
  const effectiveLines = items.map((item, i) => {
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

    lineNets[i] = lineGross - Math.min(lineGross, itemDiscAmt + bundleDiscAmt);
    return {
      subProductId: item.subProductId,
      quantity: item.quantity,
      price: effectivePrice,
      costPrice: Number(item.costPrice) || 0,
      originalPrice: Number(item.originalPrice) || 0,
    };
  });

  // ── Cart-wide pass: cross-product Buy-X-Get-Y bundle rules ────────────────
  // Mirrors the server exactly: overridePrice types re-price the target line;
  // percentage/fixed types come off the target line's net.
  if (pricelist?.rules?.length) {
    for (const adj of applyCartBundleAdjustments(
      effectiveLines,
      pricelist.rules
    )) {
      const item = items[adj.lineIndex];
      if (!item) continue;
      if (adj.overridePrice != null && adj.overridePrice > 0) {
        const lineGross = adj.overridePrice * item.quantity;
        const itemDiscAmt =
          (lineGross * Math.max(0, Math.min(100, item.discount))) / 100;
        lineNets[adj.lineIndex] = lineGross - Math.min(lineGross, itemDiscAmt);
      } else if ((adj.discountAmount ?? 0) > 0) {
        lineNets[adj.lineIndex] = Math.max(
          0,
          lineNets[adj.lineIndex] - (adj.discountAmount ?? 0)
        );
      }
    }
  }

  return lineNets.reduce((s, n) => s + n, 0);
}

/** Cart spend-threshold discount (cart_threshold pricelist rules) for a subtotal. */
export function computeThresholdDiscount(subtotal: number, pricelist?: any) {
  if (!pricelist?.rules?.length || subtotal <= 0) return 0;
  const rules = findCartThresholdRules(pricelist.rules, subtotal);
  return parseFloat(computeCartThresholdDiscount(rules, subtotal).toFixed(2));
}

export function computeDiscountAmount(
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
