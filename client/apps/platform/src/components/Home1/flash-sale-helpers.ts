import type { SaleProduct, SizeDiscount, ProductSize, AvailableAt } from "./flash-sale-types";
export function getBestSale(product: SaleProduct) {
  const allAt = product.availableAt || [];

  let bestDiscount: SizeDiscount | null = null;
  let bestSize: ProductSize | null = null;
  let bestAt: AvailableAt | null = null;

  for (const at of allAt) {
    for (const size of at.sizes || []) {
      const d = size.discount;
      if (!d?.hasDiscount) continue;
      if (!bestDiscount || (d.savings ?? 0) > (bestDiscount.savings ?? 0)) {
        bestDiscount = d;
        bestSize = size;
        bestAt = at;
      }
    }
  }

  if (!bestDiscount || !bestSize || !bestAt) {
    const firstAt = allAt[0];
    const firstSize = firstAt?.sizes?.[0];
    const pricing = firstSize?.pricing || {};
    const current = pricing.websitePrice || product.priceRange?.min || 0;
    const productDiscount = product.discount;
    const original = pricing.originalWebsitePrice || productDiscount?.originalPrice || current;
    const savings = original - current;
    return {
      currentPrice: current,
      originalPrice: original,
      hasDiscount: Boolean(productDiscount?.hasDiscount || savings > 0) && current > 0,
      discountPct: productDiscount?.percentage ?? (savings > 0 ? Math.round((savings / original) * 100) : 0),
      saleType: firstAt?.saleType || productDiscount?.type || null,
      saleEndDate: firstAt?.saleEndDate || null,
      stock: firstSize?.stock,
      discountLabel: productDiscount?.label || null,
    };
  }

  return {
    currentPrice: bestSize.pricing?.websitePrice ?? 0,
    originalPrice: bestDiscount.originalPrice ?? bestSize.pricing?.websitePrice ?? 0,
    hasDiscount: true,
    discountPct: bestDiscount.percentage ?? 0,
    saleType: bestAt.saleType || null,
    saleEndDate: bestAt.saleEndDate || null,
    stock: bestSize.stock,
    discountLabel: bestDiscount.label || null,
  };
}

export function getNearestEndTime(products: SaleProduct[]): Date {
  const now = Date.now();
  const times = products
    .flatMap((p) => p.availableAt || [])
    .filter((at) => at.isOnSale && at.saleEndDate)
    .map((at) => new Date(at.saleEndDate!).getTime())
    .filter((t) => t > now);

  times.sort((a, b) => a - b);
  return times.length > 0 ? new Date(times[0]) : new Date(now + 8 * 60 * 60 * 1000);
}

function isActiveDateRange(start?: string, end?: string) {
  const now = Date.now();
  return (!start || new Date(start).getTime() <= now) && (!end || new Date(end).getTime() >= now);
}

export function isSaleProduct(product: SaleProduct) {
  if (product.discount?.hasDiscount || (product.discount?.value ?? 0) > 0) return true;

  return (product.availableAt || []).some((at) => {
    const activeSale = at.isOnSale && isActiveDateRange(at.saleStartDate, at.saleEndDate);
    const hasSaleValue = (at.saleDiscountValue ?? 0) > 0;
    const hasDiscountedSize = (at.sizes || []).some((size) => {
      const discount = size.discount;
      const current = size.pricing?.websitePrice ?? 0;
      const original = size.pricing?.originalWebsitePrice ?? current;
      return discount?.hasDiscount || (discount?.value ?? 0) > 0 || original > current;
    });
    return Boolean((activeSale && hasSaleValue) || hasDiscountedSize);
  });
}

export const isActiveFlashSale = (product: SaleProduct) =>
  (product.availableAt || []).some((at) =>
    at.saleType === "flash_sale" && at.isOnSale && isActiveDateRange(at.saleStartDate, at.saleEndDate)
  );

