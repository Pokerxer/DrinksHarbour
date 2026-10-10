import type { POSCartItem } from '../types';

/**
 * The tenant's VAT position, mirrored from `tenant.posSettings`.
 * `{ enabled: false }` means the tenant is not registered for VAT — which is the
 * default, and the common case: Nigeria levies VAT only above a turnover
 * threshold, so charging every tenant by default would overtax small bars.
 */
export interface TenantTaxSetting {
  enabled: boolean;
  rate: number;
}

export const NO_TENANT_TAX: TenantTaxSetting = { enabled: false, rate: 0 };

/** A usable rate is finite and within 0–100. Anything else charges nothing. */
function usableRate(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 0;
  return n;
}

/**
 * The tax rate for one cart line, mirroring `resolveLineTaxRate` on the server.
 *
 * A loaded quotation's agreed rate always wins, including an explicit zero — a
 * zero-rated quotation is a real instruction, and falling through to the tenant
 * default would tax a supply the tenant deliberately zero-rated.
 */
export function lineTaxRate(
  item: POSCartItem,
  tenantTax: TenantTaxSetting = NO_TENANT_TAX
): number {
  if (item.quotationLine) return usableRate(item.taxRate);
  return tenantTax.enabled ? usableRate(tenantTax.rate) : 0;
}

/** Post-discount line value — the same base the server taxes. */
function taxableBase(item: POSCartItem): number {
  const gross = item.price * item.quantity;
  const discount = Number(
    (gross * Math.max(0, Math.min(100, item.discount || 0)) / 100).toFixed(2)
  );
  return Number(Math.max(0, gross - discount).toFixed(2));
}

/**
 * Tax for the whole cart.
 *
 * This MUST agree with `posTax.service.js` on the server. The till sends a
 * tax-inclusive total, and the server rejects the receipt with a 409 if the
 * figures disagree — so a mismatch here does not produce a small error, it
 * refuses the sale.
 */
export function computeCartTax(
  items: POSCartItem[],
  tenantTax: TenantTaxSetting = NO_TENANT_TAX
): number {
  return items.reduce((sum, item) => {
    const rate = lineTaxRate(item, tenantTax);
    if (rate <= 0) return sum;
    return sum + Math.round((taxableBase(item) * rate) / 100);
  }, 0);
}

/** Quotation tax only. Kept for the call sites that price a single quoted line. */
export function computeQuotationTax(items: POSCartItem[]): number {
  return computeCartTax(items, NO_TENANT_TAX);
}
