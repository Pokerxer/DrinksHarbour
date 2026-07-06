const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const IMPORT_COLUMNS = [
  'productName',
  'productType',
  'brand',
  'category',
  'subCategory',
  'subProductSku',
  'costPrice',
  'sellingPrice',
  'size',
  'sizeSku',
  'barcode',
  'sizePrice',
  'sizeCostPrice',
  'openingQty',
] as const;

export type ImportRow = Record<string, string | number | undefined>;

// AI-resolved attributes for a brand-new product, reviewed at preview time and
// sent back verbatim on commit so the import saves exactly what was approved.
export interface GroupEnrichment {
  name?: string;
  type?: string;
  brand?: string;
  category?: string;
  subCategory?: string;
  shortDescription?: string;
  description?: string;
}

export interface PreviewResult {
  ok: boolean;
  groups: {
    key: string;
    productName: string;
    action: 'createProduct' | 'linkProduct' | 'updateSubProduct';
    sizeCount: number;
    rowErrors: { rowNum: number; field: string; message: string }[];
    sizeNotes: { rowNum: number; size: string; note: string }[];
    enrichment?: GroupEnrichment;
  }[];
  totals: {
    groups: number;
    sizes: number;
    willCreateProduct: number;
    willLinkProduct: number;
    willUpdateSubProduct: number;
    errorRows: number;
  };
  blocking: string[];
}

export interface CommitResult {
  createdProducts: number;
  createdSubProducts: number;
  createdSizes: number;
  stockApplied: number;
  skipped: number;
  errors: { group: string; message: string }[];
}

export function buildTemplateCsv(): string {
  const header = IMPORT_COLUMNS.join(',');
  const example = [
    'Jack Daniels Old No.7',
    'whiskey',
    'Jack Daniels',
    'Spirits',
    'Whiskey',
    'JD-OLD7',
    '9500',
    '13000',
    '75cl',
    'JD-OLD7-75',
    '',
    '13500',
    '9500',
    '24',
  ].join(',');
  return `${header}\n${example}\n`;
}

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallback);
  }
  return res.json();
}
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const subProductImportService = {
  async preview(
    rows: ImportRow[],
    warehouseId: string | null,
    token: string
  ): Promise<{ success: boolean; data: PreviewResult }> {
    return handle(
      await fetch(`${API_URL}/api/subproducts/import/preview`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify({ rows, warehouseId }),
      }),
      'Failed to preview import'
    );
  },
  async commit(
    rows: ImportRow[],
    warehouseId: string | null,
    token: string,
    enrichments?: Record<string, GroupEnrichment>
  ): Promise<{ success: boolean; data: CommitResult }> {
    return handle(
      await fetch(`${API_URL}/api/subproducts/import/commit`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify({ rows, warehouseId, enrichments }),
      }),
      'Failed to commit import'
    );
  },
};
