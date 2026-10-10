// VAT at the till.
//
// Nigeria levies VAT only above a turnover threshold, so tax is a per-tenant
// decision and the switch is default-off. Charging every tenant 7.5% by default
// would overtax small bars, which is a much worse error than under-charging one.
//
// The rate is server-owned, like the quotation rate: it is read from the tenant
// record, never from the cart. A till that could name its own tax rate would be
// an un-auditable discount mechanism.
//
// This lives in a service so the rule is testable on its own. The controller is
// a 4,000-line file and a rounding mistake here is a real money bug.

/**
 * Whether a tenant is actually collecting tax, and at what rate.
 * An enabled flag with no usable rate reports as off, so the till never believes
 * it is collecting tax when it is not.
 */
function resolveTillTaxSettings(tenantPosSettings) {
  const settings = tenantPosSettings || {};
  if (!settings.taxEnabled) return { enabled: false, rate: 0 };
  const rate = usableRate(settings.taxRate);
  return rate === null
    ? { enabled: false, rate: 0 }
    : { enabled: true, rate };
}

/**
 * The rate for one order line.
 *
 * A loaded quotation's agreed rate always wins, including an explicit zero: a
 * zero-rated quotation is a real instruction, and treating 0 as "absent" would
 * silently tax a supply the tenant deliberately zero-rated.
 */
function resolveLineTaxRate({
  tenantPosSettings,
  quotationTaxRate,
} = {}) {
  if (quotationTaxRate !== undefined && quotationTaxRate !== null) {
    const rate = usableRate(quotationTaxRate);
    return rate === null ? 0 : rate;
  }
  return resolveTillTaxSettings(tenantPosSettings).rate;
}

/** A rate is usable only if it is a finite number within 0–100. */
function usableRate(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

/**
 * Tax on one line, applied to the post-discount amount — the same basis as
 * SalesOrder.lineTaxOf, so a quotation and a tenant-taxed sale agree.
 */
function lineTaxAmount(lineSubtotal, rate) {
  const net = Number(lineSubtotal) || 0;
  return Math.round((net * (Number(rate) || 0)) / 100);
}

module.exports = {
  resolveTillTaxSettings,
  resolveLineTaxRate,
  lineTaxAmount,
};
