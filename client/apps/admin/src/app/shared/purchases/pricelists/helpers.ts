// app/shared/purchases/pricelists/helpers.ts
import type {
  HistoryEntry,
  PricelistItem,
} from '@/services/vendorPricelist.service';

export type EditorLine = PricelistItem & { _key: string };

/** A fresh, empty price line with a stable identity key. */
export function emptyLine(): EditorLine {
  return {
    _key: makeLineKey(),
    subProductId: '',
    subProductName: '',
    productName: '',
    unitPrice: 0,
    discountPercent: 0,
    minQuantity: 1,
    leadTimeDays: 0,
    packagingQty: 1,
    isPreferred: false,
    priceHistory: [],
  };
}

export function makeLineKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `k_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

const clampPct = (v: unknown): number =>
  Math.min(Math.max(Number(v) || 0, 0), 100);

/** Net price after the line discount. */
export function netPrice(line: {
  unitPrice: number;
  discountPercent?: number;
}): number {
  const p = Number(line.unitPrice) || 0;
  return Math.round(p * (1 - clampPct(line.discountPercent) / 100) * 100) / 100;
}

/** Net after the line discount and again after the list-level discount. */
export function effectiveNet(
  line: { unitPrice: number; discountPercent?: number },
  globalDiscountPercent = 0
): number {
  return (
    Math.round(netPrice(line) * (1 - clampPct(globalDiscountPercent) / 100) * 100) /
    100
  );
}

/** A line can be saved when it identifies a product and carries a real price. */
export function lineIsValid(line: EditorLine): boolean {
  const hasIdentity =
    Boolean(line.subProductId) ||
    (line.productName ?? '').trim().length > 0;
  return hasIdentity && Number(line.unitPrice) > 0;
}

/** Keys of lines whose product+size combination appears more than once. */
export function duplicateLineKeys(lines: EditorLine[]): Set<string> {
  const counts = new Map<string, number>();
  for (const l of lines) {
    if (!l.subProductId) continue;
    const k = `${l.subProductId}::${l.sizeId || ''}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return new Set(
    lines
      .filter(
        (l) =>
          l.subProductId &&
          (counts.get(`${l.subProductId}::${l.sizeId || ''}`) ?? 0) > 1
      )
      .map((l) => l._key)
  );
}

/** Strip client-side keys and drop invalid rows before hitting the API. */
export function toPayloadItems(lines: EditorLine[]): PricelistItem[] {
  return lines
    .filter(lineIsValid)
    .map(({ _key, ...rest }) => rest as PricelistItem);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  'productName',
  'sku',
  'vendorProductCode',
  'unitPrice',
  'discountPercent',
  'minQuantity',
  'maxQuantity',
  'leadTimeDays',
  'packaging',
  'notes',
] as const;

function splitCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (row[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNum(raw: string | undefined): number {
  const n = Number((raw ?? '').replace(/[₦,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function csvRowToLine(cells: string[], header: readonly string[]): EditorLine {
  const get = (col: string) => {
    const i = header.indexOf(col.toLowerCase());
    return i >= 0 ? cells[i] : undefined;
  };
  return {
    ...emptyLine(),
    productName: get('productName') || get('sku') || 'Imported line',
    sku: get('sku') || undefined,
    vendorProductCode: get('vendorProductCode') || undefined,
    unitPrice: toNum(get('unitPrice')),
    discountPercent: toNum(get('discountPercent')),
    minQuantity: Math.max(1, toNum(get('minQuantity')) || 1),
    maxQuantity: toNum(get('maxQuantity')) || undefined,
    leadTimeDays: toNum(get('leadTimeDays')),
    packaging: get('packaging') || undefined,
    notes: get('notes') || undefined,
  };
}

/**
 * Parse exported/imported price lines. Rows become manual-name lines; they can
 * be upgraded to catalogue products afterwards via Add Product matching.
 */
export function parsePricelistCsv(text: string): EditorLine[] {
  const rows = text.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (rows.length === 0) return [];
  const header = splitCsvRow(rows[0]!).map((h) => h.toLowerCase());
  const ok =
    header.includes('unitprice') &&
    (header.includes('productname') || header.includes('sku'));
  if (!ok) {
    throw new Error(
      'CSV must start with a header row including productName and unitPrice'
    );
  }
  return rows.slice(1).map((r) => csvRowToLine(splitCsvRow(r), header));
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildPricelistCsv(lines: EditorLine[]): string {
  const head = CSV_COLUMNS.join(',');
  const rows = lines.map((l) =>
    [
      csvEscape(l.productName || l.subProductName),
      csvEscape(l.sku),
      csvEscape(l.vendorProductCode),
      csvEscape(l.unitPrice),
      csvEscape(l.discountPercent),
      csvEscape(l.minQuantity),
      csvEscape(l.maxQuantity ?? ''),
      csvEscape(l.leadTimeDays),
      csvEscape(l.packaging),
      csvEscape(l.notes),
    ].join(',')
  );
  return [head, ...rows].join('\n');
}

// ── Price-change deltas ───────────────────────────────────────────────────────

/** Lines whose latest change magnitude meets/exceeds this are "alerts". */
export const BIG_JUMP_THRESHOLD = 25;

/** Latest signed % change for a line (from history, else previousPrice). */
export function lineDelta(line: PricelistItem): number | null {
  const hist = line.priceHistory;
  if (hist && hist.length > 0) {
    const pct = hist[hist.length - 1]?.changePercent;
    return typeof pct === 'number' ? pct : null;
  }
  if (line.previousPrice && line.previousPrice > 0) {
    return (
      Math.round(
        ((line.unitPrice - line.previousPrice) / line.previousPrice) * 1000
      ) / 10
    );
  }
  return null;
}

export function isBigJump(line: PricelistItem): boolean {
  const d = lineDelta(line);
  return d !== null && Math.abs(d) >= BIG_JUMP_THRESHOLD;
}

export type { HistoryEntry, PricelistItem };
