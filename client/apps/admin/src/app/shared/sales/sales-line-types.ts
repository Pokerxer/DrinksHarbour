export type LineType = 'product' | 'section' | 'note';

export interface DraftLine {
  key: string;
  lineType: LineType;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  /** Units per pack. Quantity stays in units; this drives the Packs breakdown. */
  packSize: number;
  /** Packaging UOM noun ('Cases', 'Cartons'…) shown with the pack label. */
  uom?: string;
  baseUnitPrice: number;
  discount: number;
  /** 'fixed' = flat ₦ off the whole line; 'percentage' = % of each unit. */
  discountType: 'fixed' | 'percentage';
  taxRate: number;
  promoDiscount?: number;
  promoName?: string;
  costPrice: number;
  wholesalePrice?: number;
  /** True once the operator has typed a manual unit price for this line — it
   * then ignores the live pricelist/bundle computation and the server trusts
   * it verbatim. Reset to false whenever a new product/size is picked. */
  priceOverridden: boolean;
  /** True when baseUnitPrice came from the server's authoritative pricing
   * engine (price-lines endpoint or a stored order line). Engine prices are
   * final — pricelist/bundle rules are already folded in — so the client
   * displays them verbatim instead of re-running its own pricelist math. */
  enginePriced?: boolean;
  availableStock?: number;
  /** Operator-entered per-line note (newline of the line; shown under the product). */
  description?: string;
  activeBundles?: unknown;
  originalPrice?: number;
}

export interface PricedLine extends DraftLine {
  unitPrice: number;
  lineTotal: number;
  taxAmount: number;
}

export interface SalesLineTableProps {
  token: string;
  lines: PricedLine[];
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
  onAdd: () => void;
  onAddSection: () => void;
  onAddNote: () => void;
  onOpenCatalog: () => void;
  onOpenScan: () => void;
  onRemove: (key: string) => void;
  /** Reorder lines by drag-and-drop. Receives the dragged key + the target key. */
  onReorder: (activeKey: string, overKey: string) => void;
  warehouseId?: string;
  /** Display name of the selected warehouse (for the stock tooltip). */
  warehouseName?: string;
}
