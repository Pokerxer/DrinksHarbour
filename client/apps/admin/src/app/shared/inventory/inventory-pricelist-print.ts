import type { StockRow } from '@/services/warehouseStock.service';
import {
  findMatchingPricelistRules,
  applyRuleTransform,
} from '@/app/shared/point-of-sale/utils';
// One head builder for every printed document. `print-shared` is a leaf (it
// imports only doc-model), so this does not close a cycle with
// `utils/print/pricelist-print`, which imports this module.
import {
  warehouseHeadOf,
  type WarehouseHeadSource,
} from '@/utils/print/print-shared';

// ── Types ─────────────────────────────────────────────────────────────────────

/** One customer-facing line: a stock row deduped per subProduct+size. */
export interface PricelistPrintRow {
  productName: string;
  sku: string;
  sizeName: string;
  categoryName: string;
  sellingPrice: number;
  costPrice: number;
  /** Wholesale price for the size — needed when a formula rule has markupBase='wholesale'. */
  wholesalePrice: number;
  /** Units per pack for the size — needed when a bundle rule has bundleUnitsMode='pack'. */
  unitsPerPack: number;
  subProductId: string;
  sizeId: string;
  currentQuantity: number;
  /** Source warehouse, when the row came from stock. Catalogue-resolved rows
   *  carry none — which is what makes the letterhead fall back to the tenant.
   *  Declared here so `resolvePricelistOrigin` can accept either row shape:
   *  its parameter is a weak type (all-optional), and a row type sharing no
   *  property with it is rejected outright. */
  warehouseName?: string | null;
}

/**
 * One pricelist rule as this module reads it — deliberately loose except for
 * `sequence`, which is named because this module *depends* on it. Priority is
 * derived server-side (`services/pricelistPriority.service`) and written to
 * `sequence`; both pricing engines stack rules in that order, and the stored
 * array order is NOT it.
 */
export type PrintableRule = Record<string, unknown> & { sequence?: number };

export interface PricelistLite {
  _id: string;
  name: string;
  currency?: string;
  rules?: PrintableRule[];
  /** Count of rules from a list response that strips the full rules payload. */
  ruleCount?: number;
}

/**
 * The pricelist's rules in the order they are actually applied: ascending
 * `sequence`, ties broken on `_id`. Identical to `rulesInSequenceOrder` on the
 * server and `sortRulesBySequence` in the POS panel.
 *
 * Every path in this module that reads `pricelist.rules` goes through here.
 * `GET /api/pricelists/:id` happens to ship rules pre-sorted today, so the raw
 * loops below used to see priority order *by luck of the endpoint* — nothing in
 * this file asserted it, and `sequence` was not even in the rule type. Drop the
 * server sort, or hand this module a document read straight from Mongo (the
 * stored array is never reordered — `resequenceRules` only rewrites `sequence`),
 * and printed prices would shift with no type error and no failing test.
 * Sorting here makes the dependency this module's own.
 */
export function rulesInPriorityOrder(
  pricelist: PricelistLite | null | undefined
): PrintableRule[] {
  const rules = pricelist?.rules;
  if (!Array.isArray(rules)) return [];
  return [...rules].sort((a, b) => {
    const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    if (seqDiff !== 0) return seqDiff;
    return String(a._id ?? '').localeCompare(String(b._id ?? ''));
  });
}

/**
 * Number of rules a pricelist applies, normalising the two payload shapes:
 * full documents carry `rules`; the list endpoint strips `rules` in favour of
 * a lightweight `ruleCount`. Falls back to 0 when neither is present.
 */
export function pricelistRuleCount(p: PricelistLite): number {
  const n = Number(p?.ruleCount);
  if (Number.isFinite(n) && n >= 0) return n;
  return p?.rules?.length ?? 0;
}

export interface PricelistPrintOptions {
  title: string;
  validUntil?: string;
  groupByCategory: boolean;
  showSku: boolean;
  showAvailability: boolean;
  /** Optional trading name shown on the letterhead above the brand line. */
  businessName?: string;
  /**
   * Issuer line on the masthead — the source warehouse, or the tenant when
   * lines are drawn from more than one warehouse. Resolved via
   * `resolvePricelistOrigin`.
   */
  originName?: string;
  /**
   * Distinct warehouses behind the lines (from `resolvePricelistOrigin`).
   * >1 renders a "{n} warehouses" provenance stamp on the letterhead.
   */
  originWarehouseCount?: number;
  /**
   * The issuing warehouse's own address/contact (from `resolvePricelistOrigin`).
   * Replaces the platform contact block on both sheets. Absent for mixed or
   * catalogue-scoped lists, which correctly keep the platform defaults.
   */
  originHead?: PricelistOriginHead;
  /** Ad-hoc wholesale discount % applied after the chosen price source. */
  discountPercent?: number;
}

export interface PricedLine extends PricelistPrintRow {
  price: number;
  changed: boolean;
  was: number | null;
  /** Best same-product bundle price per unit (stacked on top of `price`), null when no bundle applies. */
  bundlePrice: number | null;
  /** Minimum quantity for the bundle price, null when no bundle applies. */
  bundleQuantity: number | null;
  /**
   * What the whole pack/bundle costs: `bundlePrice × bundleQuantity`. This is
   * the figure the sheet leads with — a customer buying the tier pays this, not
   * the per-unit price. Null when no bundle applies.
   */
  bundleTotal: number | null;
  /** Human-readable bundle label, e.g. "6+". Empty string when no bundle applies. */
  bundleLabel: string;
}

/** Structural input — satisfied by both StockRow and PricelistPrintRow. */
export type PricableStockLine = Pick<
  StockRow,
  | 'productName'
  | 'sku'
  | 'sizeName'
  | 'categoryName'
  | 'sellingPrice'
  | 'costPrice'
  | 'subProductId'
  | 'sizeId'
  | 'currentQuantity'
> &
  Partial<Pick<StockRow, 'wholesalePrice' | 'unitsPerPack'>>;

// ── Pricing (same engine the POS uses) ────────────────────────────────────────

/**
 * Effective customer price for one line: retail base → pricelist rules
 * (POS engine, qty=1 base tier) → optional ad-hoc wholesale discount %.
 * `was` always anchors to the retail price so savings read consistently.
 */
export function effectivePriceForRow(
  r: PricelistPrintRow,
  pricelist: PricelistLite | null,
  discountPercent = 0
): { price: number; changed: boolean; was: number | null } {
  const base = Number(r.sellingPrice) || 0;
  if (base <= 0) return { price: base, changed: false, was: null };

  let price = base;
  const ordered = rulesInPriorityOrder(pricelist);
  if (ordered.length) {
    // qty=1 → base-tier pricing, matching POS product-card display.
    const rules = findMatchingPricelistRules(
      ordered as never,
      r.subProductId,
      1,
      'price'
    );
    for (const rule of rules) {
      price = applyRuleTransform(
        price,
        rule,
        Number(r.costPrice) || 0,
        Number(r.wholesalePrice) || 0
      );
    }
  }
  const pct = Number(discountPercent) || 0;
  if (pct > 0 && price > 0) price = Math.max(0, price * (1 - pct / 100));

  price = Math.round(price * 100) / 100;
  const changed = Math.abs(price - base) > 0.001;
  return { price, changed, was: changed ? base : null };
}

// ── Bundle pricing ──────────────────────────────────────────────────────────

/**
 * Best same-product bundle price for a line, stacked on top of the
 * already-discounted per-line price. `perLinePrice` is the price after all
 * per-line rules (fixed/discount/formula/flash_sale) have been applied — the
 * bundle discount stacks on top of this, not the raw retail price.
 * Returns null when no eligible same-product bundle rule exists.
 *
 * Two figures come back, and the sheet needs both: `bundlePrice` is the PER
 * UNIT price (what checkout charges each bottle at, and the only figure that
 * can be compared against the Unit Price column), while `bundleTotal` is what
 * the customer actually hands over for the tier. The tier is a THRESHOLD, not
 * a fixed pack — `pickBestBundle` qualifies at `quantity >= bundleQuantity` —
 * so someone buying 7 of a "6+" tier pays 7 × `bundlePrice`, not
 * `bundleTotal` + one unit at retail.
 */
export function resolveBundlePriceForRow(
  r: PricelistPrintRow,
  pricelist: PricelistLite | null,
  perLinePrice: number
): {
  bundlePrice: number | null;
  bundleQuantity: number | null;
  bundleTotal: number | null;
  bundleLabel: string;
} {
  const ordered = rulesInPriorityOrder(pricelist);
  if (!ordered.length || perLinePrice <= 0)
    return {
      bundlePrice: null,
      bundleQuantity: null,
      bundleTotal: null,
      bundleLabel: '',
    };

  const pid = String(r.subProductId);
  const costPrice = Number(r.costPrice) || 0;
  const wholesalePrice = Number(r.wholesalePrice) || 0;
  const unitsPerPack = Number(r.unitsPerPack) || 1;
  const now = new Date();

  // Split by how specifically each rule targets this line. Mirrors the server's
  // pickBestBundle: a rule aimed at THIS product shadows one aimed at
  // everything, and savings never enter the choice.
  const specific: Array<{ price: number; qty: number }> = [];
  const allProducts: Array<{ price: number; qty: number }> = [];

  for (const rule of ordered) {
    if (rule.priceType !== 'bundle') continue;
    // The server skips any bundle rule without a bundleQuantity — including in
    // 'pack' mode — so a rule it ignores must never reach a printed sheet.
    if (!rule.bundleQuantity) continue;
    // Cross-product bundles are cart-scoped: they discount a DIFFERENT product
    // once this one triggers them, so they have no per-unit price to quote.
    if (rule.bundleTargetSubProduct) continue;
    if (rule.endDate && new Date(rule.endDate as string) < now) continue;
    if (rule.startDate && new Date(rule.startDate as string) > now) continue;

    const dt = (rule.bundleDiscountType as string) || 'percentage';
    const disc = Number(rule.bundleDiscount) || 0;
    if (dt === 'no_discount' || !disc) continue;

    // Product-specific or all-products — which pool this rule lands in.
    const subRef = rule.subProduct as
      | Record<string, unknown>
      | string
      | undefined;
    const ruleSp =
      subRef && typeof subRef === 'object' && subRef._id
        ? String(subRef._id)
        : subRef
          ? String(subRef)
          : null;
    if (ruleSp && ruleSp !== pid) continue;

    // 'pack' mode takes the trigger quantity from the size's unitsPerPack.
    const qty = Math.max(
      1,
      rule.bundleUnitsMode === 'pack'
        ? unitsPerPack
        : Number(rule.bundleQuantity) || 0
    );
    // A one-unit tier is not a bundle — it would print the unit price again
    // under a "1+" label. Happens when a 'pack' rule meets a size with no
    // real pack size.
    if (qty < 2) continue;
    // minQuantity gates on the quantity the customer actually buys to earn the
    // bundle — the sheet quotes that tier, not a single unit.
    if ((Number(rule.minQuantity) || 0) > qty) continue;

    let unitPrice: number;
    if (dt === 'markup_on_cost') {
      const basis =
        rule.bundleMarkupBase === 'wholesale' ? wholesalePrice : costPrice;
      // No basis = the server leaves the price alone, so there is nothing to quote.
      if (basis <= 0) continue;
      // roundUpTo100 — the server rounds a markup override UP to the nearest
      // ₦100, so quoting the unrounded figure would undercut checkout.
      unitPrice = Math.ceil((basis * (1 + disc / 100)) / 100) * 100;
    } else if (dt === 'fixed') {
      unitPrice = Math.max(0, perLinePrice - disc);
    } else {
      unitPrice = Math.max(0, perLinePrice * (1 - Math.min(100, disc) / 100));
    }
    unitPrice = Math.round(unitPrice * 100) / 100;

    // NO savings filter here, deliberately. `pickBestBundle` has none either:
    // once a rule qualifies on quantity it is applied, whether or not it beats
    // the per-line price. Dropping an "unprofitable" rule here used to let a
    // product-specific rule fall through to the all-products pool — the sheet
    // then quoted a bundle the customer would never be charged. A
    // markup_on_cost rule can legitimately price ABOVE the per-line price (its
    // basis is cost/wholesale, not the retail path), and that is exactly the
    // case this used to get wrong.
    (ruleSp ? specific : allProducts).push({ price: unitPrice, qty });
  }

  // Specificity, not savings — a rule aimed at THIS product outranks one aimed
  // at everything, exactly as `findMatchingPricelistRules` already shadows
  // whole pools for per-line rules. `ordered` is sequence order, so within a
  // pool the winner is the highest-priority rule: the same tie-break the panel
  // shows and the server's `pickBestBundle` applies.
  const pool = specific.length > 0 ? specific : allProducts;
  const best = pool[0] ?? null;

  if (!best)
    return {
      bundlePrice: null,
      bundleQuantity: null,
      bundleTotal: null,
      bundleLabel: '',
    };
  return {
    bundlePrice: best.price,
    bundleQuantity: best.qty,
    bundleTotal: Math.round(best.price * best.qty * 100) / 100,
    bundleLabel: `${best.qty}+`,
  };
}

/**
 * True when a pricelist carries at least one same-product bundle rule
 * (cross-product bundles are cart-scoped and never shown on a price list).
 *
 * Coarse pre-check only — it cannot know a row's pack size, cost or wholesale
 * basis. Whether the Bundle column actually renders is decided by
 * `linesHaveBundlePrices`, which reads the resolved prices.
 */
export function hasBundleRules(pricelist: PricelistLite | null): boolean {
  return rulesInPriorityOrder(pricelist).some(
    (r) =>
      r.priceType === 'bundle' &&
      !r.bundleTargetSubProduct &&
      r.bundleDiscountType !== 'no_discount' &&
      // Truthy, not >= 2: a 'pack' rule carries its tier in the size's
      // unitsPerPack, so its own bundleQuantity may legitimately be 1.
      Number(r.bundleQuantity) > 0
  );
}

/**
 * Whether a rendered sheet shows the Bundle column. The resolved lines are the
 * only honest signal: a pricelist can carry bundle rules that no printed row
 * qualifies for (wrong product, no pack size, no cost basis).
 */
export function linesHaveBundlePrices(lines: PricedLine[]): boolean {
  return lines.some((l) => l.bundlePrice != null);
}

/** Collapse warehouse-duplicated lines to one row per subProduct+size. */
export function dedupeRowsForPricelist(
  rows: PricableStockLine[]
): PricelistPrintRow[] {
  const map = new Map<string, PricelistPrintRow>();
  for (const r of rows) {
    const key = `${r.subProductId}|${r.sizeId}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        productName: r.productName,
        sku: r.sku,
        sizeName: r.sizeName,
        categoryName: r.categoryName || 'Uncategorized',
        sellingPrice: Number(r.sellingPrice) || 0,
        costPrice: Number(r.costPrice) || 0,
        wholesalePrice: Number(r.wholesalePrice) || 0,
        unitsPerPack: Number(r.unitsPerPack) || 1,
        subProductId: r.subProductId,
        sizeId: r.sizeId,
        currentQuantity: Math.max(0, r.currentQuantity),
      });
    } else {
      cur.currentQuantity += Math.max(0, r.currentQuantity);
      // Warehouses share pricing, but keep the highest non-zero to be safe.
      const sp = Number(r.sellingPrice) || 0;
      if (sp > cur.sellingPrice) cur.sellingPrice = sp;
      const cp = Number(r.costPrice) || 0;
      if (cp > cur.costPrice) cur.costPrice = cp;
      const wp = Number(r.wholesalePrice) || 0;
      if (wp > cur.wholesalePrice) cur.wholesalePrice = wp;
      const up = Number(r.unitsPerPack) || 1;
      if (up > cur.unitsPerPack) cur.unitsPerPack = up;
    }
  }
  return Array.from(map.values());
}

// ── Coverage diagnostics ──────────────────────────────────────────────────────

/** One rule that could not move a single price on this sheet, and why. */
export interface InertRule {
  /** The rule's own name when it has one, else a type-derived label. */
  label: string;
  /** Plain-English reason, written for the person printing the sheet. */
  reason: string;
}

export interface PricelistCoverage {
  lines: number;
  /** Lines whose unit price the rules actually moved. */
  repriced: number;
  /** Lines that earned a bundle tier. */
  bundled: number;
  /** Rules that fired on nothing, each with the reason it could not. */
  inert: InertRule[];
}

function ruleLabel(rule: Record<string, unknown>): string {
  // `bundleName` only names a bundle rule. Non-bundle rules keep vestigial
  // bundle fields from the shared rule form, so a formula rule would otherwise
  // be labelled with a leftover name like "Buy 2+ · 0% off".
  const name =
    rule.priceType === 'bundle' ? String(rule.bundleName || '').trim() : '';
  if (name) return name;
  const t = String(rule.priceType || 'rule');
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') + ' rule';
}

/**
 * Explains what a pricelist actually did to a sheet.
 *
 * A rule can be perfectly valid, match every line, and still change nothing —
 * most often because it prices off a basis the lines do not carry. A formula
 * rule with `markupBase: 'wholesale'` is inert on any line whose size has no
 * wholesale price, and so is a `markup_on_cost` bundle with
 * `bundleMarkupBase: 'wholesale'`. Both engines (this one and the server's)
 * correctly leave such a line at retail — but the sheet then looks identical
 * to "no pricelist selected", which reads as a bug.
 *
 * This reports that silence so the modal can show it. It never changes a price.
 */
export function explainPricelistCoverage(
  lines: PricedLine[],
  pricelist: PricelistLite | null
): PricelistCoverage {
  const repriced = lines.filter((l) => l.changed).length;
  const bundled = lines.filter((l) => l.bundlePrice != null).length;
  const base: PricelistCoverage = {
    lines: lines.length,
    repriced,
    bundled,
    inert: [],
  };
  // Priority order, so the reasons list reads in the same order the sheet
  // prices in — an explanation that disagrees with the sheet about which rule
  // comes first is worse than no explanation.
  const rules = rulesInPriorityOrder(pricelist);
  // No rules loaded, or nothing to price — there is no silence to explain.
  if (!rules.length || !lines.length) return base;

  const withWholesale = lines.filter(
    (l) => Number(l.wholesalePrice) > 0
  ).length;
  const withCost = lines.filter((l) => Number(l.costPrice) > 0).length;
  const withPack = lines.filter((l) => Number(l.unitsPerPack) > 1).length;
  const onSheet = new Set(lines.map((l) => String(l.subProductId)));
  const missingWholesale = lines.length - withWholesale;

  const inert: InertRule[] = [];
  for (const rule of rules) {
    const label = ruleLabel(rule);
    const type = String(rule.priceType || '');

    // Product-specific rules that target nothing on this sheet.
    const subRef = rule.subProduct as
      | Record<string, unknown>
      | string
      | undefined;
    const ruleSp =
      subRef && typeof subRef === 'object' && subRef._id
        ? String(subRef._id)
        : subRef
          ? String(subRef)
          : null;
    if (ruleSp && !onSheet.has(ruleSp)) {
      inert.push({
        label,
        reason: 'targets a product that is not on this list',
      });
      continue;
    }

    if (type === 'cart_threshold') {
      inert.push({
        label,
        reason:
          'applies to a whole cart at checkout, so it has no unit price to print',
      });
      continue;
    }

    if (type === 'bundle') {
      if (rule.bundleTargetSubProduct) {
        inert.push({
          label,
          reason:
            'discounts a different product once this one is bought — a cart rule, not a unit price',
        });
        continue;
      }
      const dt = String(rule.bundleDiscountType || 'percentage');
      if (dt === 'no_discount' || !Number(rule.bundleDiscount)) {
        inert.push({ label, reason: 'carries no bundle discount' });
        continue;
      }
      if (!Number(rule.bundleQuantity)) {
        inert.push({ label, reason: 'has no bundle quantity set' });
        continue;
      }
      if (rule.bundleUnitsMode === 'pack' && withPack === 0) {
        inert.push({
          label,
          reason: 'prices per pack, but no line on this list has a pack size',
        });
        continue;
      }
      if (dt === 'markup_on_cost') {
        const wholesaleBased = rule.bundleMarkupBase === 'wholesale';
        if (wholesaleBased && withWholesale === 0) {
          inert.push({
            label,
            reason: `marks up the wholesale price, but none of these ${lines.length} lines has one`,
          });
          continue;
        }
        if (!wholesaleBased && withCost === 0) {
          inert.push({
            label,
            reason: 'marks up the cost price, but no line on this list has one',
          });
          continue;
        }
      }
      if (bundled === 0)
        inert.push({ label, reason: 'no line on this list qualifies for it' });
      continue;
    }

    if (type === 'formula') {
      const wholesaleBased = rule.markupBase === 'wholesale';
      if (wholesaleBased && withWholesale === 0) {
        inert.push({
          label,
          reason: `marks up the wholesale price, but none of these ${lines.length} lines has one`,
        });
        continue;
      }
      if (!wholesaleBased && withCost === 0) {
        inert.push({
          label,
          reason: 'marks up the cost price, but no line on this list has one',
        });
        continue;
      }
    }

    // Volume tiers quote a price the sheet's unit column never reaches.
    if (Number(rule.minQuantity) > 1) {
      inert.push({
        label,
        reason: `only applies from ${Number(rule.minQuantity)} units, so it does not change the unit price`,
      });
    }
  }

  // A wholesale-based rule that IS live on some lines but dead on most is the
  // single most confusing case — call the gap out explicitly.
  const wholesaleRuleLive =
    withWholesale > 0 &&
    missingWholesale > 0 &&
    rules.some(
      (r) =>
        (r.priceType === 'formula' && r.markupBase === 'wholesale') ||
        (r.priceType === 'bundle' &&
          r.bundleDiscountType === 'markup_on_cost' &&
          r.bundleMarkupBase === 'wholesale')
    );
  if (wholesaleRuleLive) {
    inert.push({
      label: 'Wholesale pricing',
      reason: `${missingWholesale} of ${lines.length} lines have no wholesale price, so they print at retail`,
    });
  }

  return { ...base, inert };
}

export function priceAndSortLines(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  discountPercent = 0
): PricedLine[] {
  return dedupeRowsForPricelist(rows)
    .map((r) => {
      const base = effectivePriceForRow(r, pricelist, discountPercent);
      const bundle = resolveBundlePriceForRow(r, pricelist, base.price);
      return {
        ...r,
        ...base,
        ...bundle,
      };
    })
    .sort(
      (a, b) =>
        a.categoryName.localeCompare(b.categoryName) ||
        a.productName.localeCompare(b.productName) ||
        a.sizeName.localeCompare(b.sizeName)
    );
}

// ── HTML rendering ────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `\u20a6${v.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }
}

const MONTHS_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Deterministic short date — bare YYYY-MM-DD parsed as a local calendar day. */
export function fmtDay(iso?: string): string {
  if (!iso) return '';
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(iso);
  }
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

function lineHtml(
  l: PricedLine,
  o: PricelistPrintOptions,
  currency: string,
  showBundle: boolean
) {
  const skuCell = o.showSku
    ? `<span class="sku">${escapeHtml(l.sku)}</span>`
    : '';
  const availCell = !o.showAvailability
    ? ''
    : l.currentQuantity > 0
      ? `<td class="num">${l.currentQuantity}</td>`
      : '<td class="num zero">\u2014</td>';
  const wasCell =
    l.was != null
      ? `<span class="was">${fmtMoney(l.was, currency)}</span>`
      : '';
  const bundleCell = !showBundle
    ? ''
    : l.bundleTotal != null
      ? // Lead with what the customer pays for the tier; keep the per-unit
        // price underneath, since that is the figure the Unit Price column can
        // be compared against — and the one that applies past the threshold.
        `<td class="num"><span class="price bundle">${fmtMoney(l.bundleTotal, currency)}</span><span class="bundle-label">${escapeHtml(l.bundleLabel)} · ${fmtMoney(l.bundlePrice ?? 0, currency)} each</span></td>`
      : '<td class="num muted">\u2014</td>';
  return `<tr>
    <td><strong>${escapeHtml(l.productName)}</strong>${skuCell}</td>
    <td class="muted">${escapeHtml(l.sizeName)}</td>${availCell}
    <td class="num"><span class="price">${fmtMoney(l.price, currency)}</span>${wasCell}</td>${bundleCell}
  </tr>`;
}

/**
 * Branded, print-ready customer price list. Pure — returns the full HTML
 * document string; `printCustomerPricelist` opens it in a print window.
 *
 * Letterhead hierarchy: the issuer (business name, else resolved warehouse/
 * tenant origin) is the hero; DrinksHarbour sits in the footer as the platform
 * mark. A red provenance stamp names the source warehouse — or counts mixed
 * warehouses — only when it adds information beyond the issuer.
 */
export function buildCustomerPricelistHtml(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): string {
  const currency = pricelist?.currency || 'NGN';
  const lines = priceAndSortLines(
    rows,
    pricelist,
    options.discountPercent ?? 0
  );
  const o = options;

  // Bundle column: only when the pricelist carries same-product bundle rules
  const showBundle = linesHaveBundlePrices(lines);
  const bundleTh = showBundle
    ? // No tier suffix on the header: it used to be read off whichever line
      // happened to sort first, which is wrong the moment two lines carry
      // different tiers. Each cell now states its own quantity.
      `<th class="num">Bundle Price</th>`
    : '';
  const availTh = o.showAvailability ? '<th class="num">Available</th>' : '';

  const body = o.groupByCategory
    ? Array.from(
        lines.reduce((map, l) => {
          const list = map.get(l.categoryName) ?? [];
          list.push(l);
          map.set(l.categoryName, list);
          return map;
        }, new Map<string, PricedLine[]>()),
        ([category, catLines]) => `
      <h2><span class="cat">${escapeHtml(category)}</span><span class="rule"></span><span class="count">${catLines.length}</span></h2>
      <table>
        <thead><tr><th>Product</th><th>Size</th>${availTh}<th class="num">Unit Price</th>${bundleTh}</tr></thead>
        <tbody>${catLines.map((l) => lineHtml(l, o, currency, showBundle)).join('')}</tbody>
      </table>`
      ).join('')
    : `<table>
        <thead><tr><th>Product</th><th>Size</th>${availTh}<th class="num">Unit Price</th>${bundleTh}</tr></thead>
        <tbody>${lines.map((l) => lineHtml(l, o, currency, showBundle)).join('')}</tbody>
      </table>`;

  // ── Letterhead identity ──
  const issuerName =
    o.businessName?.trim() || o.originName?.trim() || 'DrinksHarbour';
  const whCount = o.originWarehouseCount ?? 0;
  let stampText = '';
  if (whCount > 1) stampText = `${whCount} warehouses`;
  else if (whCount === 1 && o.originName?.trim() !== issuerName)
    stampText = o.originName!.trim();
  const stamp = stampText
    ? `<span class="stamp">${escapeHtml(stampText)}</span>`
    : '';

  // Issuer contact band, directly under the issuer name. Present only when the
  // origin resolved to a single warehouse that carries details — the same
  // condition under which the PDF swaps its COMPANY block for `head`, so the
  // two sheets state the same facts. When it is absent the PDF falls back to
  // the platform block and this sheet keeps DrinksHarbour in its footer mark;
  // both still identify the platform, each in its own idiom.
  const headLines = [
    o.originHead?.address,
    o.originHead?.city,
    [o.originHead?.email, o.originHead?.phone].filter(Boolean).join(' · '),
  ].filter((s): s is string => !!s && !!s.trim());
  const issuerContact = headLines.length
    ? `<p class="issuer-contact">${headLines.map(escapeHtml).join(' · ')}</p>`
    : '';

  // ── Meta strip ──
  const categories = new Set(lines.map((l) => l.categoryName)).size;
  const stat = (label: string, value: string) =>
    `<div class="stat"><span class="meta-label">${label}</span><span class="meta-value">${value}</span></div>`;
  const generated = fmtDay(new Date().toISOString()) || '—';
  const validUntil = o.validUntil ? fmtDay(o.validUntil) : '';

  // ── Footer notes ──
  const notes: string[] = [];
  if (pricelist?.name) notes.push(escapeHtml(pricelist.name));
  if (Number(o.discountPercent) > 0)
    notes.push(`incl. ${o.discountPercent}% trade discount`);
  const footLeft =
    notes.join(' \u00b7 ') || 'Prices subject to stock availability';

  return `<!doctype html><html><head><title>${escapeHtml(issuerName)} \u2014 ${escapeHtml(o.title)}</title><style>
    :root { --ink:#141210; --red:#b20202; --paper:#ffffff; --hairline:#e7e2da; --muted:#8a8378; }
    * { box-sizing:border-box; }
    body { margin:32px; color:var(--ink); font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif; font-size:12.5px; line-height:1.45; background:var(--paper); }
    .issuer { font-family:Didot,'Bodoni MT','Playfair Display','Times New Roman',serif; }

    /* Masthead — thick+thin double rule, issuer hero, provenance stamp */
    .masthead { border-top:3px solid var(--red); padding-top:6px; }
    .masthead::before { content:''; display:block; border-top:1px solid var(--red); margin-bottom:22px; }
    .issuer-row { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; margin-bottom:18px; }
    .eyebrow { margin:0 0 6px; font-size:10px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--red); }
    .issuer { margin:0; font-size:30px; line-height:1.05; font-weight:500; letter-spacing:.01em; color:var(--ink); }
    .issuer-contact { margin:7px 0 0; font-size:10.5px; color:var(--muted); letter-spacing:.02em; }
    .stamp { flex-shrink:0; border:1.5px solid var(--red); color:var(--red); border-radius:3px; padding:5px 12px; font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; transform:rotate(-2deg); transform-origin:center; max-width:200px; text-align:center; }

    /* Labelled stat strip */
    .meta { display:flex; gap:0; border-top:1px solid var(--hairline); border-bottom:1px solid var(--hairline); padding:12px 0; margin-bottom:26px; }
    .stat { flex:1; min-width:0; padding:0 18px; border-left:1px solid var(--hairline); }
    .stat:first-child { padding-left:0; border-left:none; }
    .meta-label { display:block; font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:2px; }
    .meta-value { display:block; font-size:13px; font-weight:600; font-variant-numeric:tabular-nums lining-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* Category sections */
    h2 { display:flex; align-items:center; gap:12px; margin:30px 0 10px; break-after:avoid; page-break-after:avoid; }
    h2:first-of-type { margin-top:4px; }
    h2 .cat { font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--ink); }
    h2 .rule { flex:1; border-top:1px solid var(--hairline); }
    h2 .count { min-width:26px; text-align:center; background:var(--paper); border:1px solid var(--hairline); color:var(--muted); border-radius:99px; padding:1px 8px; font-size:10px; font-weight:600; font-variant-numeric:tabular-nums; }

    /* Line-item table */
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    thead { display:table-header-group; }
    th { text-align:left; font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); border-bottom:1.5px solid var(--ink); padding:7px 10px; }
    td { border-bottom:1px solid var(--hairline); padding:11px 10px; vertical-align:middle; }
    tbody tr:last-child td { border-bottom:1.5px solid var(--hairline); }
    tr { page-break-inside:avoid; break-inside:avoid; }
    td strong { font-weight:600; letter-spacing:-.005em; }
    td.num, th.num { text-align:right; font-variant-numeric:tabular-nums lining-nums; white-space:nowrap; }
    .price { font-weight:800; font-size:13.5px; }
    .was { margin-left:8px; color:var(--muted); text-decoration:line-through; font-size:11px; font-weight:400; }
    .sku { display:block; color:var(--muted); font-family:'SF Mono',Menlo,Consolas,monospace; font-size:9.5px; margin-top:3px; letter-spacing:.02em; }
    .muted { color:var(--muted); }
    td.zero { color:var(--muted); }

    /* Bundle price column */
    .bundle { color:#166534; }
    /* Tier + per-unit price. Not tracked caps: it carries a currency figure,
       which uppercasing and .12em letter-spacing render unreadable. */
    .bundle-label { display:block; font-size:9.5px; font-weight:600; color:#166534; margin-top:2px; opacity:.85; }

    /* Footer */
    .foot { margin-top:34px; padding-top:12px; border-top:2px solid var(--ink); position:relative; display:flex; justify-content:space-between; gap:16px; font-size:10px; color:var(--muted); }
    .foot::before { content:''; position:absolute; top:-2px; left:0; width:64px; border-top:2px solid var(--red); }
    .foot .mark { font-weight:700; letter-spacing:.12em; color:var(--ink); }

    @page { size:A4; margin:14mm; }
    @media print { body { margin:0; } }
  </style></head><body>
    <header class="masthead">
      <div class="issuer-row">
        <div>
          <p class="eyebrow">${escapeHtml(o.title)}</p>
          <p class="issuer">${escapeHtml(issuerName)}</p>
          ${issuerContact}
        </div>
        ${stamp}
      </div>
      <div class="meta">
        ${stat('Items', String(lines.length))}
        ${stat('Categories', `${categories} categor${categories === 1 ? 'y' : 'ies'}`)}
        ${stat('Generated', escapeHtml(generated))}
        ${stat('Valid until', validUntil ? escapeHtml(validUntil) : '\u2014')}
      </div>
    </header>
    ${body}
    <footer class="foot">
      <span>${footLeft}</span>
      <span><span class="mark">DRINKSHARBOUR</span> \u00b7 drinksharbour.com</span>
    </footer>
  </body></html>`;
}

// ── Letterhead origin (warehouse vs tenant) ───────────────────────────────────

/**
 * The four contact facts a letterhead prints. Structurally identical to
 * `DocHead` in `utils/print/doc-model`, declared here rather than imported
 * because `utils/print/pricelist-print` imports *from* this module — the
 * option type must not point back at its own consumer.
 */
export interface PricelistOriginHead {
  /** Street line(s), e.g. "9 Close C Sungold Estate, Galadimawa". */
  address?: string;
  /** Locality line, e.g. "Abuja, FCT, Nigeria". */
  city?: string;
  email?: string;
  phone?: string;
}

/** One entry of the warehouse directory `resolvePricelistOrigin` looks into. */
export type PricelistOriginWarehouse = WarehouseHeadSource & {
  name?: string | null;
};

export interface PricelistOrigin {
  /** Display name: the single source warehouse, else the tenant name. */
  name?: string;
  /** Distinct warehouses represented in the rows (0 when unknown). */
  warehouseCount: number;
  /**
   * The single source warehouse's own address/contact, when a directory was
   * supplied and the warehouse carries details. Undefined for a mixed or
   * catalogue-scoped sheet — a sheet drawn from several places must not claim
   * one warehouse's contact details — and undefined for a detail-less record,
   * which correctly leaves the platform defaults on the page.
   */
  head?: PricelistOriginHead;
}

/**
 * Who the pricelist is issued from: when every line sits in one warehouse the
 * invoice carries that warehouse's name; once lines mix warehouses (or carry
 * none, e.g. catalogue-resolved lines) it falls back to the tenant name.
 *
 * `warehouses` is an optional directory (the tenant's warehouse records). When
 * a single origin resolves and that name matches exactly one record, the
 * record's own address/contact come back as `head` — this is what puts the
 * warehouse's letterhead on the sheet instead of the platform's. Name matching
 * is case-insensitive on trimmed names because the rows carry a denormalised
 * label, not an id; an ambiguous name yields no head rather than a guess.
 */
export function resolvePricelistOrigin(
  rows: Array<{ warehouseName?: string | null }>,
  tenantName?: string | null,
  warehouses?: readonly PricelistOriginWarehouse[] | null
): PricelistOrigin {
  const names = new Set<string>();
  for (const r of rows) {
    const n = typeof r.warehouseName === 'string' ? r.warehouseName.trim() : '';
    if (n) names.add(n);
  }
  if (names.size === 1) {
    const name = names.values().next().value as string;
    return {
      name,
      warehouseCount: 1,
      head: headForWarehouse(name, warehouses),
    };
  }
  const tenant = tenantName?.trim();
  return { name: tenant || undefined, warehouseCount: names.size };
}

/** The head of the one directory record called `name`, else undefined. */
function headForWarehouse(
  name: string,
  warehouses?: readonly PricelistOriginWarehouse[] | null
): PricelistOriginHead | undefined {
  if (!Array.isArray(warehouses)) return undefined;
  const key = name.trim().toLowerCase();
  const matches = warehouses.filter(
    (w) =>
      String(w?.name ?? '')
        .trim()
        .toLowerCase() === key
  );
  // Warehouse names are not uniquely indexed — only `code` is. Printing one
  // namesake's address on the other's stock would be worse than falling back.
  if (matches.length !== 1) return undefined;
  return warehouseHeadOf(matches[0]);
}

// ── Catalog-driven scope resolution ───────────────────────────────────────────

/** Minimal catalog product accepted by the scope resolver (defensive shapes). */
export interface CatalogProduct {
  _id: string;
  name?: string;
  productName?: string;
  sku?: string;
  brand?: unknown;
  category?: unknown;
  subCategory?: unknown;
  /** List endpoint nests the central Product: facets + display name live here. */
  product?: {
    name?: string;
    brand?: unknown;
    category?: unknown;
    subCategory?: unknown;
  };
  baseSellingPrice?: number;
  sellingPrice?: number;
  costPrice?: number;
  sizes?: Array<{
    _id: string;
    sizeName?: string;
    displayName?: string;
    size?: string;
    sellingPrice?: number;
    costPrice?: number;
    wholesalePrice?: number;
    unitsPerPack?: number;
  }>;
  sellWithoutSizeVariants?: boolean;
}

export interface ScopeSelection {
  categories: string[];
  subCategories: string[];
  brands: string[];
  productIds: string[];
}

export const EMPTY_SCOPE: ScopeSelection = {
  categories: [],
  subCategories: [],
  brands: [],
  productIds: [],
};

export function scopeIsEmpty(s: ScopeSelection): boolean {
  return (
    s.categories.length === 0 &&
    s.subCategories.length === 0 &&
    s.brands.length === 0 &&
    s.productIds.length === 0
  );
}

function facetLabel(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const o = v as { name?: string };
  return o.name ?? '';
}

/**
 * Facet value for a catalog product, checking the flat field first and the
 * nested central Product second (the list endpoint populates
 * `product.category` / `product.subCategory` / `product.brand`).
 */
export function catalogFacetLabel(
  p: CatalogProduct,
  field: 'category' | 'subCategory' | 'brand'
): string {
  return (
    facetLabel(p[field]) ||
    facetLabel((p.product as Record<string, unknown> | undefined)?.[field])
  );
}

/** Display name: flat field, then the nested central Product name. */
export function catalogProductName(p: CatalogProduct): string {
  return (
    p.productName ||
    p.name ||
    p.product?.name ||
    `Product ${String(p._id).slice(-6)}`
  );
}

export function catalogFacets(catalog: CatalogProduct[]): {
  categories: Map<string, number>;
  subCategories: Map<string, number>;
  brands: Map<string, number>;
} {
  const count = (m: Map<string, number>, k: string) =>
    m.set(k, (m.get(k) ?? 0) + 1);
  const categories = new Map<string, number>();
  const subCategories = new Map<string, number>();
  const brands = new Map<string, number>();
  for (const p of catalog) {
    count(categories, catalogFacetLabel(p, 'category') || 'Uncategorized');
    count(
      subCategories,
      catalogFacetLabel(p, 'subCategory') || 'Uncategorized'
    );
    count(brands, catalogFacetLabel(p, 'brand') || 'No brand');
  }
  return { categories, subCategories, brands };
}

/**
 * Resolve a scope selection to printable lines. Facet selections UNION:
 * a product is included when it matches any selected category, sub-category,
 * brand or explicit product id.
 */
export function resolveCatalogLines(
  catalog: CatalogProduct[],
  selection: ScopeSelection
): PricelistPrintRow[] {
  if (scopeIsEmpty(selection)) return [];
  const selCat = new Set(selection.categories);
  const selSub = new Set(selection.subCategories);
  const selBrand = new Set(selection.brands);
  const selProd = new Set(selection.productIds);

  const out: PricelistPrintRow[] = [];
  for (const p of catalog) {
    const cat = catalogFacetLabel(p, 'category') || 'Uncategorized';
    const sub = catalogFacetLabel(p, 'subCategory') || 'Uncategorized';
    const brand = catalogFacetLabel(p, 'brand') || 'No brand';
    const matches =
      selProd.has(String(p._id)) ||
      selCat.has(cat) ||
      selSub.has(sub) ||
      selBrand.has(brand);
    if (!matches) continue;

    const name = catalogProductName(p);
    const sku = p.sku ?? '';
    const productCost = Number(p.costPrice) || 0;

    if (p.sizes?.length && !p.sellWithoutSizeVariants) {
      for (const s of p.sizes) {
        out.push({
          productName: name,
          sku,
          sizeName: s.displayName || s.sizeName || s.size || 'Standard',
          categoryName: cat,
          sellingPrice: Number(s.sellingPrice ?? p.sellingPrice) || 0,
          costPrice: Number(s.costPrice) || productCost,
          wholesalePrice: Number(s.wholesalePrice) || 0,
          unitsPerPack: Number(s.unitsPerPack) || 1,
          subProductId: String(p._id),
          sizeId: String(s._id),
          currentQuantity: 0,
        });
      }
    } else {
      out.push({
        productName: name,
        sku,
        sizeName: 'Standard',
        categoryName: cat,
        sellingPrice: Number(p.baseSellingPrice ?? p.sellingPrice) || 0,
        costPrice: productCost,
        wholesalePrice: 0,
        unitsPerPack: 1,
        subProductId: String(p._id),
        sizeId: `base-${p._id}`,
        currentQuantity: 0,
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.categoryName.localeCompare(b.categoryName) ||
      a.productName.localeCompare(b.productName) ||
      a.sizeName.localeCompare(b.sizeName)
  );
}

/**
 * Fill availability on resolved lines from the browser's stock rows by
 * subProductId+sizeId. Unmatched lines keep quantity 0 (renders as "—").
 */
export function applyAvailabilityFromStock<
  T extends { subProductId: string; sizeId: string; currentQuantity: number },
>(lines: T[], stockRows: StockRow[]): T[] {
  if (stockRows.length === 0) return lines;
  const map = new Map<string, number>();
  for (const r of stockRows) {
    const key = `${r.subProductId}|${r.sizeId}`;
    map.set(key, (map.get(key) ?? 0) + Math.max(0, r.currentQuantity));
  }
  return lines.map((l) => {
    const q = map.get(`${l.subProductId}|${l.sizeId}`);
    return q == null ? l : { ...l, currentQuantity: q };
  });
}

/**
 * Print the price list via a hidden iframe — same document as
 * `buildCustomerPricelistHtml`, but immune to popup blockers (unlike the old
 * `window.open` approach). Returns false only when there is nothing to print.
 */
export function printCustomerPricelist(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): boolean {
  if (rows.length === 0 || typeof document === 'undefined') return false;
  const html = buildCustomerPricelistHtml(rows, pricelist, options);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.opacity = '0';
  frame.style.border = '0';
  frame.srcdoc = html;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Spool headroom before the frame (and its print job) is dropped.
      setTimeout(() => frame.remove(), 60_000);
    }
  };
  document.body.appendChild(frame);
  return true;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Build the priced list as CSV (same pricing pipeline as the PDF). */
export function buildPricelistCsv(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): string {
  const currency = pricelist?.currency || 'NGN';
  const lines = priceAndSortLines(
    rows,
    pricelist,
    options.discountPercent ?? 0
  );
  const showBundle = linesHaveBundlePrices(lines);
  const headers = [
    'Category',
    'Product',
    'SKU',
    'Size',
    ...(options.showAvailability ? ['Available'] : []),
    'Unit Price',
    'Was Price',
    // Explicit headers: "Bundle Price" alone is ambiguous now that the sheet
    // leads with the tier total.
    ...(showBundle ? ['Bundle Unit Price', 'Bundle Qty', 'Bundle Total'] : []),
    'Currency',
  ];
  const body = lines.map((l) =>
    [
      csvCell(l.categoryName),
      csvCell(l.productName),
      csvCell(l.sku),
      csvCell(l.sizeName),
      ...(options.showAvailability ? [l.currentQuantity] : []),
      l.price.toFixed(2),
      l.was != null ? l.was.toFixed(2) : '',
      ...(showBundle
        ? [
            l.bundlePrice?.toFixed(2) ?? '',
            l.bundleQuantity ?? '',
            l.bundleTotal?.toFixed(2) ?? '',
          ]
        : []),
      currency,
    ].join(',')
  );
  return [headers.join(','), ...body].join('\n');
}

/** Trigger a browser download of the priced list CSV. */
export function downloadPricelistCsv(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): void {
  const csv = buildPricelistCsv(rows, pricelist, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (options.title || 'pricelist')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.download = `${slug || 'pricelist'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
