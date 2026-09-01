// client/apps/admin/src/app/shared/inventory/inventory-stock-search.ts
//
// Every search, filter, sort and group decision the stock browser makes, as
// pure functions over StockRow. Nothing here touches React or the DOM, because
// the admin vitest runs `environment: 'node'` — logic that stays inside a
// component is logic that cannot be tested, and the search this replaces had
// four wrong answers hiding in exactly that blind spot.
//
// The filter model is the one the /sales list uses (`FilterValue` from
// shared/advanced-search), so the two modules speak the same language and share
// the same panel UI. The difference is where the filters run: sales sends them
// to the server as wire params, stock evaluates them here, in memory, because
// `warehouseStockService.getAllStock` already returned every row.

import type { StockRow } from '@/services/warehouseStock.service';
import type {
  FilterConfig,
  FilterValue,
  GroupByOption,
} from '../advanced-search/advanced-search-types';

// ── Status ───────────────────────────────────────────────────────────────────

export type StatusKey = 'ok' | 'low' | 'out' | 'expiry' | 'over';

export const STATUS_BADGE: Record<StatusKey, { label: string; cls: string }> = {
  ok: { label: 'In stock', cls: 'bg-emerald-50 text-emerald-600' },
  low: { label: 'Low stock', cls: 'bg-amber-50 text-amber-600' },
  out: { label: 'Out of stock', cls: 'bg-red-50 text-red-600' },
  expiry: { label: 'Near expiry', cls: 'bg-orange-50 text-orange-600' },
  over: { label: 'Overstocked', cls: 'bg-blue-50 text-blue-600' },
};

export const STATUS_KEYS: StatusKey[] = ['ok', 'low', 'out', 'expiry', 'over'];

/**
 * The server computes these flags from the tenant's warehouseSettings; the
 * quantity check is the fallback for a row that predates them. Precedence is
 * severity order — a line that is both out of stock and overstocked is out.
 */
export function statusOf(r: StockRow): StatusKey {
  const f = r.flags;
  if (f?.outOfStock || r.currentQuantity <= 0) return 'out';
  if (f?.lowStock) return 'low';
  if (f?.nearExpiry) return 'expiry';
  if (f?.overstocked) return 'over';
  return 'ok';
}

/**
 * Empty set means "all" — not "none". The stock browser drives its exclusive
 * tab row and the panel's multi-select checkboxes off this single set, so the
 * two controls cannot disagree about what is selected.
 */
export function matchesStatusSet(r: StockRow, sel: Set<StatusKey>): boolean {
  if (sel.size === 0) return true;
  return sel.has(statusOf(r));
}

// ── Money helpers ────────────────────────────────────────────────────────────

export function lineValue(r: StockRow): number {
  return r.currentQuantity * (r.costPrice || 0);
}
export function lineRetail(r: StockRow): number {
  return r.currentQuantity * (r.sellingPrice || 0);
}
export function availableOf(r: StockRow): number {
  return r.currentQuantity - r.reservedQuantity;
}
export function categoryOf(r: StockRow): string {
  return r.categoryName || 'Uncategorized';
}

// ── Query parsing ────────────────────────────────────────────────────────────
//
// The text box takes two kinds of input, combined freely:
//   1. Free-text terms — space separated, or "quoted as one phrase". A row must
//      match EVERY term (AND) across its searchable text.
//   2. Field shorthand — `field:value` narrows to one field:
//        sku:  SKU              wh:   warehouse name or id
//        cat:  category         size: size name
//      `warehouse:` and `category:` are accepted as aliases.
//
// Anything that looks like `word:value` but names no known field is kept as a
// literal term AND reported in `unknownFields`, so a query that returns nothing
// can say why instead of looking like an empty result set.

/** The searchable surface. Keep `fieldTextFor` and this list in step. */
const SHORTHAND: { key: string; text: (r: StockRow) => string }[] = [
  { key: 'sku', text: (r) => r.sku || '' },
  { key: 'wh', text: (r) => `${r.warehouseName} ${r.warehouseId}` },
  { key: 'cat', text: (r) => categoryOf(r) },
  { key: 'size', text: (r) => r.sizeName || '' },
];

const SHORTHAND_ALIASES: Record<string, string> = {
  warehouse: 'wh',
  category: 'cat',
};

export interface QueryShorthand {
  field: string;
  value: string;
}

export interface ParsedQuery {
  /** Free-text terms, lowercased, field shorthand already removed. */
  terms: string[];
  filters: QueryShorthand[];
  /** Prefixes that looked like a field but name none — surfaced, not swallowed. */
  unknownFields: string[];
  hasFilters: boolean;
  hasQuery: boolean;
}

/** Split on whitespace but keep "quoted phrases" whole. */
function tokenize(raw: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const tok = m[1] !== undefined ? m[1] : m[2];
    if (tok && tok.trim()) out.push(tok.trim());
  }
  return out;
}

export function parseStockQuery(raw: string): ParsedQuery {
  const terms: string[] = [];
  const filters: QueryShorthand[] = [];
  const unknownFields: string[] = [];

  // Pull `field:"quoted value"` out first — the generic tokenizer would split
  // the prefix away from its own quoted value.
  const rest = raw.replace(
    /([A-Za-z_]+):"([^"]*)"/g,
    (whole, rawField: string, value: string) => {
      const field =
        SHORTHAND_ALIASES[rawField.toLowerCase()] ?? rawField.toLowerCase();
      if (value.trim() && SHORTHAND.some((s) => s.key === field)) {
        filters.push({ field, value: value.trim().toLowerCase() });
        return ' ';
      }
      unknownFields.push(rawField.toLowerCase());
      return whole;
    }
  );

  for (const token of tokenize(rest)) {
    const lower = token.toLowerCase();
    const colon = lower.indexOf(':');
    // `colon > 0` — a leading colon is not a field prefix, it is punctuation.
    if (colon > 0) {
      const rawField = lower.slice(0, colon);
      const field = SHORTHAND_ALIASES[rawField] ?? rawField;
      const value = lower.slice(colon + 1).trim();
      if (value && SHORTHAND.some((s) => s.key === field)) {
        filters.push({ field, value });
        continue;
      }
      // Looks like a field, names none. Keep it searchable, but say so.
      if (
        value &&
        /^[a-z_]+$/.test(rawField) &&
        !unknownFields.includes(rawField)
      ) {
        unknownFields.push(rawField);
      }
    }
    terms.push(lower);
  }

  return {
    terms,
    filters,
    unknownFields,
    hasFilters: filters.length > 0,
    hasQuery: terms.length > 0 || filters.length > 0,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * The concatenated text a free-text term is matched against. This is the whole
 * searchable surface — there is no zone, aisle or barcode on StockRow, whatever
 * an older comment on this page used to claim.
 */
export function fieldTextFor(r: StockRow): string {
  return [
    r.productName,
    r.sku,
    r.sizeName,
    r.warehouseName,
    categoryOf(r),
    r.valuationMethod,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** True when `term` sits at a word boundary inside `text`. */
function hasBoundaryHit(text: string, term: string): boolean {
  let idx = text.indexOf(term);
  while (idx !== -1) {
    if (idx === 0 || /[\s\-/._:(]/.test(text[idx - 1])) return true;
    idx = text.indexOf(term, idx + 1);
  }
  return false;
}

/**
 * Weight of a term hit in one field. Identity fields (product, SKU) outrank
 * contextual ones, and a word-boundary hit outranks a hit buried mid-token.
 *
 * The bonus is decided per field, against that field's OWN text. The previous
 * implementation tested the concatenated row text once and paid the boundary
 * bonus to every field that contained the term at all, which made the field
 * weighting decorative: a term prefixing the product name silently promoted the
 * SKU, size, warehouse and category buckets too.
 */
const FIELD_WEIGHTS: {
  text: (r: StockRow) => string;
  boundary: number;
  loose: number;
}[] = [
  { text: (r) => (r.productName || '').toLowerCase(), boundary: 30, loose: 20 },
  { text: (r) => (r.sku || '').toLowerCase(), boundary: 18, loose: 8 },
  { text: (r) => (r.sizeName || '').toLowerCase(), boundary: 8, loose: 4 },
  { text: (r) => (r.warehouseName || '').toLowerCase(), boundary: 6, loose: 3 },
  { text: (r) => categoryOf(r).toLowerCase(), boundary: 6, loose: 3 },
];

/**
 * Rank a row against a parsed query. Returns 0 when the row does NOT match;
 * higher is better. Every free-text term must be present (AND) and every field
 * shorthand must be satisfied, so `sku:HN red` means both, not either.
 */
export function scoreStockRow(r: StockRow, q: ParsedQuery): number {
  if (!q.hasQuery) return 1;
  let score = 0;

  for (const f of q.filters) {
    const def = SHORTHAND.find((s) => s.key === f.field);
    const hay = (def ? def.text(r) : '').toLowerCase();
    if (!hay.includes(f.value)) return 0;
    score += 40;
  }

  const text = fieldTextFor(r);
  for (const term of q.terms) {
    if (!text.includes(term)) return 0;
    for (const w of FIELD_WEIGHTS) {
      const t = w.text(r);
      if (!t.includes(term)) continue;
      score += hasBoundaryHit(t, term) ? w.boundary : w.loose;
    }
  }

  return score;
}

// ── Approximate matching ─────────────────────────────────────────────────────

/**
 * Bounded Levenshtein. Bails out as soon as the whole row exceeds `max`, so a
 * long non-match costs a row of the matrix rather than the whole matrix.
 */
function editDistanceWithin(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const d = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      cur.push(d);
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return null;
    prev = cur;
  }
  const d = prev[b.length];
  return d <= max ? d : null;
}

/** One typo on a short term, two on a long one. Anything looser matches noise. */
function fuzzyBudget(term: string): number {
  if (term.length <= 3) return 0;
  return term.length <= 5 ? 1 : 2;
}

/** Best (lowest) distance from `term` to any word in `text`, or null. */
function nearestWordDistance(text: string, term: string): number | null {
  const budget = fuzzyBudget(term);
  if (budget === 0) return null;
  let best: number | null = null;
  for (const word of text.split(/[\s\-/._:(),]+/)) {
    if (!word) continue;
    const d = editDistanceWithin(word, term, budget);
    if (d !== null && (best === null || d < best)) best = d;
  }
  return best;
}

export interface StockSearchResult {
  rows: StockRow[];
  /** Score per row id — the input to a relevance sort. */
  scores: Map<string, number>;
  /** True when nothing matched exactly and these are near-misses. */
  approximate: boolean;
}

/** Total edit distance from a query's terms to the nearest words, or null. */
function fuzzyDistance(text: string, q: ParsedQuery): number | null {
  let total = 0;
  for (const term of q.terms) {
    if (text.includes(term)) continue;
    const d = nearestWordDistance(text, term);
    if (d === null) return null;
    total += d;
  }
  return total;
}

// ── Multi-item search ────────────────────────────────────────────────────────
//
// Each Enter in the search box commits what was typed as one chip. Chips OR:
// "hennessy" then "jameson" is a request for BOTH products. Terms inside a
// single chip keep their AND, so one chip can still narrow ("red wine") — the
// two rules do different jobs and neither can express the other.

export interface StockQuerySet {
  /** One parsed query per non-blank chip. */
  queries: ParsedQuery[];
  hasQuery: boolean;
  hasFilters: boolean;
  /** Union of every chip's unrecognised field prefixes, in first-seen order. */
  unknownFields: string[];
}

export function parseStockQuerySet(inputs: string[]): StockQuerySet {
  const queries: ParsedQuery[] = [];
  const unknownFields: string[] = [];
  for (const raw of inputs) {
    // A blank chip has no opinion; keeping it would OR in "match everything".
    if (!raw || !raw.trim()) continue;
    const q = parseStockQuery(raw);
    if (!q.hasQuery) continue;
    queries.push(q);
    for (const f of q.unknownFields) {
      if (!unknownFields.includes(f)) unknownFields.push(f);
    }
  }
  return {
    queries,
    hasQuery: queries.length > 0,
    hasFilters: queries.some((q) => q.hasFilters),
    unknownFields,
  };
}

/**
 * Union the chips. A row is kept when ANY chip matches it, and scored by its
 * BEST chip — so adding a second product to the search cannot demote the first.
 *
 * Exact matching is authoritative across the whole set: the approximate pass
 * runs only when no chip matched anything, and only over chips that are pure
 * free text. A chip carrying field shorthand (`sku:XXXX`) is a precise
 * question, and answering it with a near-miss would be a wrong answer.
 */
export function searchStockRowSet(
  rows: StockRow[],
  set: StockQuerySet
): StockSearchResult {
  const scores = new Map<string, number>();
  if (!set.hasQuery) return { rows: [...rows], scores, approximate: false };

  const exact: StockRow[] = [];
  for (const r of rows) {
    let best = 0;
    for (const q of set.queries) {
      const s = scoreStockRow(r, q);
      if (s > best) best = s;
    }
    if (best > 0) {
      scores.set(r._id, best);
      exact.push(r);
    }
  }
  if (exact.length > 0) return { rows: exact, scores, approximate: false };

  const fuzzyable = set.queries.filter(
    (q) => !q.hasFilters && q.terms.length > 0
  );
  if (fuzzyable.length === 0) return { rows: [], scores, approximate: false };

  const near: StockRow[] = [];
  for (const r of rows) {
    const text = fieldTextFor(r);
    let best = 0;
    for (const q of fuzzyable) {
      const d = fuzzyDistance(text, q);
      if (d === null) continue;
      // Closer near-misses rank higher. The ceiling keeps them below any exact
      // score, which is moot here — this branch only runs when there are none.
      best = Math.max(best, Math.max(1, 20 - d));
    }
    if (best > 0) {
      scores.set(r._id, best);
      near.push(r);
    }
  }
  return { rows: near, scores, approximate: near.length > 0 };
}

/**
 * Exact AND matching is authoritative. Only when it returns nothing does a
 * bounded edit-distance pass run, and the caller is told so it can label the
 * result — approximate rows that arrive unannounced are worse than no rows.
 *
 * The fallback never runs for a field shorthand: `sku:XXXX` is a precise
 * question, and answering it with something else would be a wrong answer.
 */
/**
 * The one-chip case. Kept because a single query is still the common shape, and
 * because it is the seam most of the tests exercise; the union logic lives in
 * `searchStockRowSet` so there is only one implementation to be wrong.
 */
export function searchStockRows(
  rows: StockRow[],
  q: ParsedQuery
): StockSearchResult {
  return searchStockRowSet(rows, {
    queries: q.hasQuery ? [q] : [],
    hasQuery: q.hasQuery,
    hasFilters: q.hasFilters,
    unknownFields: q.unknownFields,
  });
}

// ── Filter configs ───────────────────────────────────────────────────────────
//
// Every entry MUST resolve to a real extractor in STOCK_FIELD_VALUES. The sales
// config file warns that a config naming a field the schema does not have is "a
// control that silently does nothing"; the same rule binds here, and a test
// enforces it.

export const STOCK_FILTER_CONFIGS: FilterConfig[] = [
  // ── Identity ───────────────────────────────────────────────────────────
  {
    id: 'product',
    label: 'Product',
    field: 'productName',
    type: 'text',
    category: 'general',
  },
  { id: 'sku', label: 'SKU', field: 'sku', type: 'text', category: 'general' },
  {
    id: 'size',
    label: 'Size',
    field: 'sizeName',
    type: 'text',
    category: 'general',
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    field: 'warehouseName',
    type: 'text',
    category: 'delivery',
  },
  {
    id: 'category',
    label: 'Category',
    field: 'categoryName',
    type: 'text',
    category: 'general',
  },

  // ── Quantities ─────────────────────────────────────────────────────────
  {
    id: 'onhand',
    label: 'On Hand',
    field: 'currentQuantity',
    type: 'number-range',
    category: 'status',
  },
  {
    id: 'reserved',
    label: 'Reserved',
    field: 'reservedQuantity',
    type: 'number-range',
    category: 'status',
  },
  // Derived, not stored: currentQuantity - reservedQuantity.
  {
    id: 'available',
    label: 'Available',
    field: 'available',
    type: 'number-range',
    category: 'status',
  },
  {
    id: 'min_stock',
    label: 'Min Stock Level',
    field: 'minStockLevel',
    type: 'number-range',
    category: 'status',
  },

  // ── Money ──────────────────────────────────────────────────────────────
  {
    id: 'cost',
    label: 'Unit Cost',
    field: 'costPrice',
    type: 'number-range',
    category: 'pricing',
  },
  {
    id: 'selling',
    label: 'Selling Price',
    field: 'sellingPrice',
    type: 'number-range',
    category: 'pricing',
  },
  // Derived, not stored: currentQuantity * costPrice.
  {
    id: 'line_value',
    label: 'Line Value',
    field: 'lineValue',
    type: 'number-range',
    category: 'pricing',
  },

  // ── Classification ─────────────────────────────────────────────────────
  {
    id: 'status',
    label: 'Status',
    field: 'status',
    type: 'multi-select',
    category: 'status',
    options: STATUS_KEYS.map((k) => ({
      label: STATUS_BADGE[k].label,
      value: k,
    })),
  },
  {
    id: 'valuation',
    label: 'Valuation Method',
    field: 'valuationMethod',
    type: 'select',
    category: 'other',
    options: [
      { label: 'FIFO', value: 'fifo' },
      { label: 'Average', value: 'average' },
      { label: 'Standard', value: 'standard' },
    ],
  },
  {
    id: 'expiry',
    label: 'Earliest Expiry',
    field: 'earliestExpiry',
    type: 'date-range',
    category: 'dates',
  },
];

const CONFIG_BY_ID = new Map(STOCK_FILTER_CONFIGS.map((c) => [c.id, c]));

/** The one extractor table. A filter id absent here cannot be evaluated. */
const STOCK_FIELD_VALUES: Record<
  string,
  (r: StockRow) => string | number | null
> = {
  product: (r) => r.productName ?? '',
  sku: (r) => r.sku ?? '',
  size: (r) => r.sizeName ?? '',
  warehouse: (r) => r.warehouseName ?? '',
  category: (r) => categoryOf(r),
  onhand: (r) => r.currentQuantity,
  reserved: (r) => r.reservedQuantity,
  available: (r) => availableOf(r),
  min_stock: (r) => r.minStockLevel ?? 0,
  cost: (r) => r.costPrice ?? 0,
  selling: (r) => r.sellingPrice ?? 0,
  line_value: (r) => lineValue(r),
  status: (r) => statusOf(r),
  valuation: (r) => r.valuationMethod ?? '',
  expiry: (r) => r.earliestExpiry ?? '',
};

export function stockFieldValue(
  r: StockRow,
  fieldId: string
): string | number | null {
  const get = STOCK_FIELD_VALUES[fieldId];
  return get ? get(r) : null;
}

export const STOCK_GROUP_OPTIONS: GroupByOption[] = [
  { id: 'warehouse', label: 'Warehouse', field: 'warehouseName' },
  { id: 'product', label: 'Product', field: 'productName' },
  { id: 'category', label: 'Category', field: 'categoryName' },
  { id: 'status', label: 'Status', field: 'status' },
  { id: 'size', label: 'Size', field: 'sizeName' },
  { id: 'valuation', label: 'Valuation Method', field: 'valuationMethod' },
];

// ── Filter evaluation ────────────────────────────────────────────────────────

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toTime(v: unknown): number | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function asPair(v: FilterValue['value']): [unknown, unknown] | null {
  return Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : null;
}

function matchesNumber(
  actual: number,
  op: FilterValue['operator'],
  value: FilterValue['value']
): boolean {
  if (op === 'between') {
    const pair = asPair(value);
    const lo = pair ? toNumber(pair[0]) : null;
    const hi = pair ? toNumber(pair[1]) : null;
    if (lo === null || hi === null) return true;
    return actual >= Math.min(lo, hi) && actual <= Math.max(lo, hi);
  }
  if (op === 'in') {
    if (!Array.isArray(value)) return true;
    return value.some((v) => toNumber(v) === actual);
  }
  const n = toNumber(value);
  if (n === null) return true;
  switch (op) {
    case 'equals':
      return actual === n;
    case 'not_equals':
      return actual !== n;
    case 'gt':
      return actual > n;
    case 'gte':
      return actual >= n;
    case 'lt':
      return actual < n;
    case 'lte':
      return actual <= n;
    default:
      return true;
  }
}

function matchesText(
  actual: string,
  op: FilterValue['operator'],
  value: FilterValue['value']
): boolean {
  const a = actual.toLowerCase();
  if (op === 'in') {
    if (!Array.isArray(value)) return true;
    return value.some((v) => String(v).toLowerCase() === a);
  }
  if (op === 'between') return true;
  const v = String(value ?? '').toLowerCase();
  switch (op) {
    case 'equals':
      return a === v;
    case 'not_equals':
      return a !== v;
    case 'contains':
      return a.includes(v);
    case 'gt':
      return a > v;
    case 'gte':
      return a >= v;
    case 'lt':
      return a < v;
    case 'lte':
      return a <= v;
    default:
      return true;
  }
}

function matchesDate(
  actual: string,
  op: FilterValue['operator'],
  value: FilterValue['value']
): boolean {
  const t = toTime(actual);
  if (t === null) return false;
  if (op === 'between') {
    const pair = asPair(value);
    const lo = pair ? toTime(String(pair[0])) : null;
    const hi = pair ? toTime(String(pair[1])) : null;
    if (lo === null || hi === null) return true;
    // A bare `YYYY-MM-DD` end date parses to midnight; a row expiring that day
    // must still be inside the range.
    const hiEnd = /T/.test(String(pair?.[1])) ? hi : hi + 86_399_999;
    return t >= lo && t <= hiEnd;
  }
  const v = toTime(String(value));
  if (v === null) return true;
  switch (op) {
    case 'equals':
      return t === v;
    case 'not_equals':
      return t !== v;
    case 'gt':
      return t > v;
    case 'gte':
      return t >= v;
    case 'lt':
      return t < v;
    case 'lte':
      return t <= v;
    default:
      return true;
  }
}

/**
 * Evaluate one FilterValue against one row.
 *
 * A filter this module cannot resolve returns `true` — it does not narrow.
 * Silently deleting every row because a saved search named a field that no
 * longer exists would be a wrong answer wearing the shape of a right one;
 * `resolveStockFilters` is the seam that reports those instead.
 */
export function matchesFilter(r: StockRow, fv: FilterValue): boolean {
  const config = CONFIG_BY_ID.get(fv.fieldId);
  if (!config) return true;
  const actual = stockFieldValue(r, fv.fieldId);
  if (actual === null) return true;

  if (fv.operator === 'is_set') {
    const want = fv.value === false ? false : true;
    const isSet = typeof actual === 'number' ? true : actual !== '';
    return isSet === want;
  }

  switch (config.type) {
    case 'number':
    case 'number-range':
      return matchesNumber(Number(actual), fv.operator, fv.value);
    case 'date':
    case 'date-range':
      return matchesDate(String(actual), fv.operator, fv.value);
    default:
      return matchesText(String(actual), fv.operator, fv.value);
  }
}

export function applyStockFilters(
  rows: StockRow[],
  filters: FilterValue[]
): StockRow[] {
  if (filters.length === 0) return [...rows];
  return rows.filter((r) => filters.every((f) => matchesFilter(r, f)));
}

/**
 * Split filters into the ones this module can evaluate and the field ids it
 * cannot. Saved searches written before a config changed are the common source
 * — the UI keeps the rest and tells the user what it dropped.
 */
export function resolveStockFilters(filters: FilterValue[]): {
  valid: FilterValue[];
  dropped: string[];
} {
  const valid: FilterValue[] = [];
  const dropped: string[] = [];
  for (const f of filters) {
    if (CONFIG_BY_ID.has(f.fieldId)) valid.push(f);
    else if (!dropped.includes(f.fieldId)) dropped.push(f.fieldId);
  }
  return { valid, dropped };
}

// ── Expiry presets ───────────────────────────────────────────────────────────
//
// StockRow has no createdAt — its only date is earliestExpiry — so the sales
// panel's "Create Date" slot becomes "Expiry" here. `now` is a parameter, not a
// call to the wall clock, so the ranges are testable on any day.

export const EXPIRY_PRESET_IDS = [
  'expired',
  'next7',
  'next30',
  'next90',
  'custom',
] as const;

export type ExpiryPresetId = (typeof EXPIRY_PRESET_IDS)[number];

export const EXPIRY_PRESET_LABELS: Record<ExpiryPresetId, string> = {
  expired: 'Already Expired',
  next7: 'Next 7 Days',
  next30: 'Next 30 Days',
  next90: 'Next 90 Days',
  custom: 'Custom Range',
};

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function expiryRange(
  presetId: string,
  now: Date = new Date()
): [Date, Date] | null {
  const start = startOfDay(now);
  const forward = (days: number): [Date, Date] => [
    start,
    new Date(start.getTime() + days * 86_400_000),
  ];
  switch (presetId) {
    case 'expired':
      return [new Date(0), new Date(now)];
    case 'next7':
      return forward(7);
    case 'next30':
      return forward(30);
    case 'next90':
      return forward(90);
    default:
      return null;
  }
}

/**
 * A row with no expiry is excluded while a range is active. A null expiry is
 * not "expires today", and counting it as a hit would make a "next 7 days"
 * answer wrong.
 */
export function matchesExpiryRange(
  r: StockRow,
  range: [Date, Date] | null
): boolean {
  if (!range) return true;
  const t = toTime(r.earliestExpiry ?? '');
  if (t === null) return false;
  return t >= range[0].getTime() && t <= range[1].getTime();
}

// ── Sorting ──────────────────────────────────────────────────────────────────

export type SortCol =
  | 'relevance'
  | 'product'
  | 'size'
  | 'warehouse'
  | 'onhand'
  | 'reserved'
  | 'available'
  | 'cost'
  | 'value'
  | 'status';

export type SortDir = 'asc' | 'desc';

/**
 * Returns a new array; the caller's is left alone.
 *
 * The `relevance` column owns its own fallback. It used to have no case in the
 * comparator at all, so clearing the search — which left the column pinned to
 * `relevance` — produced a comparator that returned 0 for every pair and a
 * table in arbitrary order that looked deliberate.
 */
export function sortStockRows(
  rows: StockRow[],
  col: SortCol,
  dir: SortDir,
  scores?: Map<string, number>
): StockRow[] {
  const byName = (a: StockRow, b: StockRow) =>
    (a.productName || '').localeCompare(b.productName || '');

  const out = [...rows];
  if (col === 'relevance') {
    if (!scores || scores.size === 0) return out.sort(byName);
    return out.sort((a, b) => {
      const d = (scores.get(b._id) ?? 0) - (scores.get(a._id) ?? 0);
      return d !== 0 ? d : byName(a, b);
    });
  }

  out.sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case 'product':
        cmp = byName(a, b);
        break;
      case 'size':
        cmp = (a.sizeName || '').localeCompare(b.sizeName || '');
        break;
      case 'warehouse':
        cmp = (a.warehouseName || '').localeCompare(b.warehouseName || '');
        break;
      case 'onhand':
        cmp = a.currentQuantity - b.currentQuantity;
        break;
      case 'reserved':
        cmp = a.reservedQuantity - b.reservedQuantity;
        break;
      case 'available':
        cmp = availableOf(a) - availableOf(b);
        break;
      case 'cost':
        cmp = (a.costPrice || 0) - (b.costPrice || 0);
        break;
      case 'value':
        cmp = lineValue(a) - lineValue(b);
        break;
      case 'status':
        cmp = statusOf(a).localeCompare(statusOf(b));
        break;
    }
    // A stable tiebreak keeps equal rows in a repeatable order between renders.
    if (cmp === 0) cmp = byName(a, b);
    return dir === 'asc' ? cmp : -cmp;
  });
  return out;
}

// ── Grouping ─────────────────────────────────────────────────────────────────

export type GroupKey =
  | 'warehouse'
  | 'product'
  | 'category'
  | 'status'
  | 'size'
  | 'valuation';

const GROUP_LABEL_OF: Record<GroupKey, (r: StockRow) => string> = {
  warehouse: (r) => r.warehouseName || '—',
  product: (r) => r.productName || '—',
  category: (r) => categoryOf(r),
  status: (r) => STATUS_BADGE[statusOf(r)].label,
  size: (r) => r.sizeName || '—',
  valuation: (r) => (r.valuationMethod || 'standard').toUpperCase(),
};

export function groupStockRows(
  rows: StockRow[],
  key: string
): [string, StockRow[]][] {
  const label = GROUP_LABEL_OF[key as GroupKey];
  if (!label) return [];
  const map = new Map<string, StockRow[]>();
  for (const r of rows) {
    const k = label(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  return Array.from(map.entries());
}
