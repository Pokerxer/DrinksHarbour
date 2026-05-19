export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function getImageUrl(product: any): string | undefined {
  if (product?.product?.images?.length) {
    const img = product.product.images[0];
    return img.thumbnail || img.url;
  }
  if (product?.image) return product.image;
  return undefined;
}

export function getProductDisplayName(product: any): string {
  return product?.product?.name || product?.name || 'Unknown Product';
}

export function getStockStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'in_stock':
      return { label: 'In Stock', color: 'text-green-600' };
    case 'low_stock':
      return { label: 'Low Stock', color: 'text-orange-500' };
    case 'out_of_stock':
      return { label: 'Out of Stock', color: 'text-red-500' };
    default:
      return { label: status, color: 'text-gray-500' };
  }
}

export function calculateChange(amountTendered: number, total: number): number {
  return Math.max(0, amountTendered - total);
}

// ── Pricelist price application ───────────────────────────────────────────────

export function applyRuleTransform(price: number, rule: any, costPrice = 0): number {
  if (price <= 0) return price;
  switch (rule.priceType) {
    case 'fixed': {
      const fp = Number(rule.fixedPrice);
      return fp > 0 ? fp : price;
    }
    case 'formula': {
      const cost   = Number(costPrice);
      const markup = Number(rule.markupPercentage);
      if (cost <= 0 || markup <= 0) return price;
      return Math.round(cost * (1 + markup / 100) * 100) / 100;
    }
    case 'discount': {
      if (rule.discountType === 'fixed') {
        const amt = Number(rule.discountAmount || 0);
        return amt > 0 ? Math.max(0, price - amt) : price;
      }
      const pct = Number(rule.discountPercentage || 0);
      return pct > 0 ? Math.max(0, price * (1 - pct / 100)) : price;
    }
    case 'flash_sale': {
      const pct = Number(rule.flashSalePercentage || 0);
      return pct > 0 ? Math.max(0, price * (1 - pct / 100)) : price;
    }
    default:
      return price;
  }
}

/**
 * Returns ALL matching pricelist rules for a product at a given quantity,
 * sorted by priority (ascending sequence, then descending minQuantity for volume tiers).
 *
 * filterType controls which rule categories are included:
 *   'price'  → fixed, formula, discount, flash_sale only (excludes bundle)
 *   'bundle' → bundle only
 *   'all'    → all types (default)
 *
 * Specificity: product-specific rules shadow all-products rules.
 * Volume tiers: multiple rules of different minQuantity can all qualify and
 * are applied sequentially so they stack (e.g. -10% base + -5% volume qty 6+).
 */
export function findMatchingPricelistRules(
  rules: any[],
  productId: string,
  qty: number,
  filterType: 'price' | 'bundle' | 'all' = 'all',
): any[] {
  if (!rules?.length) return [];

  const now = new Date();
  const pid = String(productId);

  const eligible = rules.filter((r: any) => {
    const isBundle = r.priceType === 'bundle';
    if (filterType === 'price'  &&  isBundle) return false;
    if (filterType === 'bundle' && !isBundle) return false;
    if (r.endDate   && new Date(r.endDate)   < now) return false;
    if (r.startDate && new Date(r.startDate) > now) return false;
    return (Number(r.minQuantity) || 0) <= qty;
  });
  if (!eligible.length) return [];

  const specific = eligible.filter((r: any) => {
    const rid = r.subProduct?._id
      ? String(r.subProduct._id)
      : r.subProduct ? String(r.subProduct) : null;
    return rid && rid === pid;
  });

  // Product-specific rules shadow all-products rules (Odoo specificity)
  const pool = specific.length > 0 ? specific : eligible.filter((r: any) => !r.subProduct);
  if (!pool.length) return [];

  // Lower sequence = higher priority; higher minQuantity = better volume tier
  return pool.sort((a: any, b: any) => {
    const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    if (seqDiff !== 0) return seqDiff;
    return (Number(b.minQuantity) || 0) - (Number(a.minQuantity) || 0);
  });
}

/**
 * Backward-compatible: returns the single best matching rule.
 * Use findMatchingPricelistRules for sequential multi-rule application.
 */
export function findBestPricelistRule(rules: any[], productId: string, qty: number): any | null {
  return findMatchingPricelistRules(rules, productId, qty, 'all')[0] ?? null;
}

/**
 * Applies all matching pricelist rules to a product for display on the grid.
 *
 * Fixes two bugs from the previous single-rule approach:
 *   1. Bundle + price rules both apply — no more early-return after bundle injection.
 *   2. Multiple price rules apply sequentially: base → rule1 → rule2 → ...
 *      e.g. fixed price rule → then 10% discount rule → then 5% volume tier.
 *
 * qty=1 for card display (base tier pricing).
 * Cart uses actual item.quantity via computeItemPriceWithPricelist in the store.
 */
export function applyPricelistToProduct(product: any, pricelist: any): any {
  if (!pricelist?.rules?.length) return product;

  const productCost = Number(product.costPrice) || 0;
  let result = { ...product };

  // ── 1. Apply all price rules sequentially ────────────────────────────────────
  const priceRules = findMatchingPricelistRules(pricelist.rules, product._id, 1, 'price');

  if (priceRules.length > 0) {
    const oldBase = Number(product.baseSellingPrice) || 0;
    let   newBase = oldBase;

    const appliedSteps: any[] = [];
    for (const rule of priceRules) {
      const before = newBase;
      newBase = applyRuleTransform(newBase, rule, productCost);
      if (Math.abs(newBase - before) > 0.001) {
        appliedSteps.push({ rule, fromPrice: before, toPrice: newBase, saving: before - newBase });
      }
    }

    const baseChanged = Math.abs(newBase - oldBase) > 0.001;
    const lastRule    = priceRules[priceRules.length - 1];

    const newSizes = product.sizes?.map((s: any) => {
      const sizeCost = Number(s.costPrice) > 0 ? Number(s.costPrice) : productCost;
      let   sizePrice = Number(s.sellingPrice) || 0;
      for (const rule of priceRules) {
        sizePrice = applyRuleTransform(sizePrice, rule, sizeCost);
      }
      const sizeChanged = Math.abs(sizePrice - Number(s.sellingPrice)) > 0.001;
      return {
        ...s,
        sellingPrice:          sizePrice,
        _priceBeforePricelist: Number(s.sellingPrice) || 0,
        originalPrice: sizeChanged
          ? (s.originalPrice != null ? s.originalPrice : Number(s.sellingPrice))
          : s.originalPrice,
      };
    });

    result = {
      ...result,
      baseSellingPrice:       newBase,
      _priceBeforePricelist:  oldBase,
      _appliedPricelistSteps: appliedSteps,
      _appliedPricelist:      { _id: pricelist._id, name: pricelist.name },
      originalPrice: baseChanged
        ? (product.originalPrice != null ? product.originalPrice : oldBase)
        : product.originalPrice,
      isOnSale:    baseChanged && newBase < oldBase ? true : product.isOnSale,
      isFlashSale: lastRule?.priceType === 'flash_sale'  ? true : product.isFlashSale,
      sizes: newSizes || product.sizes,
    };
  }

  // ── 2. Inject ALL matching bundle rules into activeBundles for card hints ────
  const bundleRules = findMatchingPricelistRules(pricelist.rules, product._id, 1, 'bundle');

  if (bundleRules.length > 0) {
    const dbBundles: any[] = (result.activeBundles || []).filter((b: any) => !b.fromPricelist);

    const plEntries = bundleRules.map((rule: any) => {
      const qty  = Math.max(2, Number(rule.bundleQuantity) || 2);
      const disc = Number(rule.bundleDiscount) || 0;
      const dt   = rule.bundleDiscountType || 'percentage';
      if (dt !== 'no_discount' && !disc) return null;

      const name = rule.bundleName || (
        dt === 'markup_on_cost' ? `Buy ${qty}+ · Cost +${disc}% markup`
        : dt === 'no_discount'  ? `Buy ${qty}+ · No discount`
        : dt === 'fixed'        ? `Buy ${qty}+ · ₦${disc} off`
        : `Buy ${qty}+ · ${disc}% off`
      );
      return {
        name,
        quantity:      qty,
        discount:      dt === 'no_discount' ? 0 : disc,
        discountType:  dt as any,
        active:        true,
        validUntil:    rule.endDate ?? null,
        fromPricelist: true,
      };
    }).filter(Boolean);

    const merged = [
      ...plEntries,
      ...dbBundles.filter((b: any) => !plEntries.some((e: any) => e?.name === b.name)),
    ].sort((a: any, b: any) => (b.discount || 0) - (a.discount || 0));

    result = { ...result, activeBundles: merged };
  }

  return result;
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: '💰' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
  { value: 'split', label: 'Split Payment', icon: '🔀' },
];
