// Pure formatting/description helpers for POS pricelist rules — unit tested.
import { refName, type PricelistRule } from './types';

export const fmt = (n: unknown): string =>
  `₦${Number(n || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

export function buildBundleName(
  quantity: number,
  discountType: string,
  discount: number
): string {
  return `Buy ${quantity}+ · ${
    discountType === 'fixed' ? `₦${discount}` : `${discount}%`
  } off`;
}

export function ruleStatus(
  r: Pick<PricelistRule, 'startDate' | 'endDate'>
): { label: string; cls: string } {
  const now = new Date();
  if (r.endDate && new Date(r.endDate) < now)
    return { label: 'Expired', cls: 'bg-red-50 text-red-500' };
  if (r.startDate && new Date(r.startDate) > now)
    return { label: 'Pending', cls: 'bg-blue-50 text-blue-600' };
  if (r.startDate || r.endDate)
    return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' };
  return { label: 'Always', cls: 'bg-gray-100 text-gray-500' };
}

/** Appends the cross-product target name, avoiding a double "off" when the
 *  description already ends with one (e.g. "20% off"). */
function withBundleTarget(desc: string, rule: PricelistRule): string {
  const t = rule.bundleTargetSubProduct;
  if (!t || typeof t === 'string') return desc;
  const name = refName(t.product) || t.sku || 'another product';
  return desc.endsWith('off') ? `${desc} ${name}` : `${desc} off ${name}`;
}

export function ruleDescription(rule: PricelistRule): string {
  switch (rule.priceType) {
    case 'fixed':
      return `Sets selling price → ${fmt(rule.fixedPrice || 0)}`;
    case 'formula':
      return `Price = cost × (1 + ${rule.markupPercentage || 0}% markup)`;
    case 'discount':
      return rule.discountType === 'fixed'
        ? `-₦${Number(rule.discountAmount || 0).toFixed(2)} off selling price`
        : `${rule.discountPercentage || 0}% off selling price`;
    case 'flash_sale': {
      const qty =
        (rule.flashSaleQty ?? 0) > 0 ? ` · ${rule.flashSaleQty} units` : '';
      return `⚡ ${rule.flashSalePercentage || 0}% flash sale${qty}`;
    }
    case 'bundle': {
      const qty = rule.bundleQuantity || 2;
      let desc: string;
      if (rule.bundleDiscountType === 'markup_on_cost')
        desc = `Buy ${qty}+ → Cost +${rule.bundleDiscount || 0}% markup`;
      else if (rule.bundleDiscountType === 'no_discount')
        desc = `Buy ${qty}+ → No discount (base price)`;
      else if (rule.bundleDiscountType === 'fixed')
        desc = `Buy ${qty}+ → -₦${Number(rule.bundleDiscount || 0).toFixed(0)} per unit`;
      else desc = `Buy ${qty}+ → ${rule.bundleDiscount || 0}% off`;
      return withBundleTarget(desc, rule);
    }
    case 'cart_threshold': {
      const thresh = fmt(rule.thresholdAmount || 0);
      return rule.discountType === 'fixed'
        ? `Spend ${thresh}+ → -₦${Number(rule.discountAmount || 0).toFixed(0)} off cart`
        : `Spend ${thresh}+ → ${rule.discountPercentage || 0}% off cart`;
    }
    default:
      return '—';
  }
}
