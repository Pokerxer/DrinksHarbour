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

function applyRuleTransform(price: number, rule: any, costPrice = 0): number {
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
 * Finds the best matching pricelist rule for a product at a given order quantity.
 *
 * Priority (Odoo-style):
 *   1. Product-specific rule  >  "All products" rule
 *   2. Within the same specificity: highest `minQuantity` that still qualifies
 *      (volume tier — e.g., rule for qty≥10 beats rule for qty≥1 when qty=12)
 *   3. Rules outside their active date window are excluded.
 *   4. Rules with `minQuantity > qty` are excluded.
 */
export function findBestPricelistRule(rules: any[], productId: string, qty: number): any | null {
  if (!rules?.length) return null;

  const now = new Date();
  const pid = String(productId);

  // Step 1 — keep only active, quantity-eligible rules
  const eligible = rules.filter((r: any) => {
    if (r.endDate   && new Date(r.endDate)   < now) return false;
    if (r.startDate && new Date(r.startDate) > now) return false;
    return (Number(r.minQuantity) || 0) <= qty;
  });
  if (!eligible.length) return null;

  // Step 2 — prefer product-specific over "all products"
  const specific = eligible.filter((r: any) => {
    const rid = r.subProduct?._id
      ? String(r.subProduct._id)
      : r.subProduct ? String(r.subProduct) : null;
    return rid && rid === pid;
  });

  const pool = specific.length > 0 ? specific : eligible.filter((r: any) => !r.subProduct);
  if (!pool.length) return null;

  // Step 3 — highest minQuantity that still qualifies = best volume tier
  return pool.sort((a: any, b: any) => (Number(b.minQuantity) || 0) - (Number(a.minQuantity) || 0))[0];
}

export function applyPricelistToProduct(product: any, pricelist: any): any {
  if (!pricelist?.rules?.length) return product;

  // Use qty=1 for card display (base tier). Cart uses actual item.quantity.
  const rule = findBestPricelistRule(pricelist.rules, product._id, 1);
  if (!rule) return product;

  // ── Bundle rule: inject into activeBundles for card hint display.
  // Tagged fromPricelist:true so the cart can filter them out and re-apply
  // dynamically when the selected pricelist changes.
  if (rule.priceType === 'bundle') {
    const qty  = Math.max(2, Number(rule.bundleQuantity) || 2);
    const disc = Number(rule.bundleDiscount) || 0;
    const dt   = rule.bundleDiscountType || 'percentage';
    if (dt !== 'no_discount' && !disc) return product;

    const name = rule.bundleName || (
      dt === 'markup_on_cost' ? `Buy ${qty}+ · Cost +${disc}% markup`
      : dt === 'no_discount'  ? `Buy ${qty}+ · No discount`
      : dt === 'fixed'        ? `Buy ${qty}+ · ₦${disc} off`
      : `Buy ${qty}+ · ${disc}% off`
    );

    const entry = {
      name,
      quantity:      qty,
      discount:      dt === 'no_discount' ? 0 : disc,
      discountType:  dt as 'percentage' | 'fixed' | 'markup_on_cost' | 'no_discount',
      active:        true,
      validUntil:    rule.endDate ?? null,
      fromPricelist: true, // filtered out when storing in cart items
    };

    // Keep only non-pricelist (DB) bundles + this new one for display
    const dbBundles: any[] = (product.activeBundles || []).filter((b: any) => !b.fromPricelist);
    const merged = [entry, ...dbBundles.filter((b: any) => b.name !== name)]
      .sort((a: any, b: any) => (b.discount || 0) - (a.discount || 0));

    return { ...product, activeBundles: merged };
  }

  // ── Price-changing rules ────────────────────────────────────────────────────
  const productCost = Number(product.costPrice) || 0;
  const oldBase     = Number(product.baseSellingPrice) || 0;

  // Apply pricelist rule to the product's current effective price (which already
  // includes any direct product promotions — flash sale, regular sale).
  // Stacking is intentional: a "10% off" pricelist on a sale product gives an
  // additional 10% on top of the existing sale, always benefiting the customer.
  // Cross-pricelist creep is prevented separately: Apply no longer writes
  // discount/flash_sale/bundle fields to products.
  const newBase     = applyRuleTransform(oldBase, rule, productCost);
  const baseChanged = Math.abs(newBase - oldBase) > 0.001;

  const newSizes = product.sizes?.map((s: any) => {
    const sizeCost     = Number(s.costPrice) > 0 ? Number(s.costPrice) : productCost;
    const oldSizePrice = Number(s.sellingPrice) || 0;
    const newSizePrice = applyRuleTransform(oldSizePrice, rule, sizeCost);
    const sizeChanged  = Math.abs(newSizePrice - oldSizePrice) > 0.001;
    return {
      ...s,
      sellingPrice:          newSizePrice,
      _priceBeforePricelist: oldSizePrice, // raw server size price for cart storage
      originalPrice: sizeChanged
        ? (s.originalPrice != null ? s.originalPrice : oldSizePrice)
        : s.originalPrice,
    };
  });

  return {
    ...product,
    baseSellingPrice:      newBase,
    _priceBeforePricelist: oldBase, // raw server price before this pricelist adjustment
    originalPrice: baseChanged
      ? (product.originalPrice != null ? product.originalPrice : oldBase)
      : product.originalPrice,
    isOnSale:    baseChanged && newBase < oldBase ? true : product.isOnSale,
    isFlashSale: rule.priceType === 'flash_sale'  ? true : product.isFlashSale,
    sizes: newSizes || product.sizes,
  };
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: '💰' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
  { value: 'split', label: 'Split Payment', icon: '🔀' },
];
