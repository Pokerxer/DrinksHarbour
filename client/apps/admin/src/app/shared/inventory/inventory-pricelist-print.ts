import type { StockRow } from '@/services/warehouseStock.service';
import {
  findMatchingPricelistRules,
  applyRuleTransform,
} from '@/app/shared/point-of-sale/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

/** One customer-facing line: a stock row deduped per subProduct+size. */
export interface PricelistPrintRow {
  productName: string;
  sku: string;
  sizeName: string;
  categoryName: string;
  sellingPrice: number;
  costPrice: number;
  subProductId: string;
  sizeId: string;
  currentQuantity: number;
}

export interface PricelistLite {
  _id: string;
  name: string;
  currency?: string;
  rules?: Array<Record<string, unknown>>;
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
  /** Ad-hoc wholesale discount % applied after the chosen price source. */
  discountPercent?: number;
}

export interface PricedLine extends PricelistPrintRow {
  price: number;
  changed: boolean;
  was: number | null;
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
>;

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
  if (pricelist?.rules?.length) {
    // qty=1 → base-tier pricing, matching POS product-card display.
    const rules = findMatchingPricelistRules(
      pricelist.rules as never,
      r.subProductId,
      1,
      'price'
    );
    for (const rule of rules) {
      price = applyRuleTransform(price, rule, Number(r.costPrice) || 0);
    }
  }
  const pct = Number(discountPercent) || 0;
  if (pct > 0 && price > 0) price = Math.max(0, price * (1 - pct / 100));

  price = Math.round(price * 100) / 100;
  const changed = Math.abs(price - base) > 0.001;
  return { price, changed, was: changed ? base : null };
}

/** Collapse warehouse-duplicated lines to one row per subProduct+size. */
export function dedupeRowsForPricelist(rows: PricableStockLine[]): PricelistPrintRow[] {
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
    }
  }
  return Array.from(map.values());
}

export function priceAndSortLines(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  discountPercent = 0
): PricedLine[] {
  return dedupeRowsForPricelist(rows)
    .map((r) => ({
      ...r,
      ...effectivePriceForRow(r, pricelist, discountPercent),
    }))
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
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Deterministic short date — bare YYYY-MM-DD parsed as a local calendar day. */
function fmtDay(iso?: string): string {
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

function lineHtml(l: PricedLine, o: PricelistPrintOptions, currency: string) {
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
  return `<tr>
    <td><strong>${escapeHtml(l.productName)}</strong>${skuCell}</td>
    <td class="muted">${escapeHtml(l.sizeName)}</td>${availCell}
    <td class="num"><span class="price">${fmtMoney(l.price, currency)}</span>${wasCell}</td>
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
        <thead><tr><th>Product</th><th>Size</th>${availTh}<th class="num">Unit Price</th></tr></thead>
        <tbody>${catLines.map((l) => lineHtml(l, o, currency)).join('')}</tbody>
      </table>`
      ).join('')
    : `<table>
        <thead><tr><th>Product</th><th>Size</th>${availTh}<th class="num">Unit Price</th></tr></thead>
        <tbody>${lines.map((l) => lineHtml(l, o, currency)).join('')}</tbody>
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

export interface PricelistOrigin {
  /** Display name: the single source warehouse, else the tenant name. */
  name?: string;
  /** Distinct warehouses represented in the rows (0 when unknown). */
  warehouseCount: number;
}

/**
 * Who the pricelist is issued from: when every line sits in one warehouse the
 * invoice carries that warehouse's name; once lines mix warehouses (or carry
 * none, e.g. catalogue-resolved lines) it falls back to the tenant name.
 */
export function resolvePricelistOrigin(
  rows: Array<{ warehouseName?: string | null }>,
  tenantName?: string | null
): PricelistOrigin {
  const names = new Set<string>();
  for (const r of rows) {
    const n = typeof r.warehouseName === 'string' ? r.warehouseName.trim() : '';
    if (n) names.add(n);
  }
  if (names.size === 1) {
    return { name: names.values().next().value, warehouseCount: 1 };
  }
  const tenant = tenantName?.trim();
  return { name: tenant || undefined, warehouseCount: names.size };
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
    count(subCategories, catalogFacetLabel(p, 'subCategory') || 'Uncategorized');
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

/** Open the price list in a print window (browser dialog saves it as PDF). */
export function printCustomerPricelist(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): boolean {
  if (rows.length === 0) return false;
  const html = buildCustomerPricelistHtml(rows, pricelist, options);
  const win = window.open('', '_blank', 'width=900,height=720');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
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
  const lines = priceAndSortLines(rows, pricelist, options.discountPercent ?? 0);
  const headers = [
    'Category',
    'Product',
    'SKU',
    'Size',
    ...(options.showAvailability ? ['Available'] : []),
    'Unit Price',
    'Was Price',
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
