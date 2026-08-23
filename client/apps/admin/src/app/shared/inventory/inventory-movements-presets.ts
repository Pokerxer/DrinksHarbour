import type { InventoryMovement } from '@/services/inventory.service';

export type MovesPresetKey =
  | 'receipts'
  | 'deliveries'
  | 'internal'
  | 'adjustments'
  | 'scrap'
  | 'moves';

interface Tab {
  key: string;
  label: string;
  /** undefined = "all" tab */
  match?: (m: InventoryMovement) => boolean;
}

export interface Preset {
  title: string;
  sub: string;
  docTitle: string;
  csvPrefix: string;
  savedKey: string;
  /** Server-side movement filters */
  category?: string;
  types?: string[];
  tabs: Tab[];
  showSupplier: boolean;
  unitsLabel: string;
  emptyNoun: string;
}

const typeTab = (key: string, label: string): Tab => ({
  key,
  label,
  match: (m) => m.type === key,
});
const catTab = (key: string, label: string): Tab => ({
  key,
  label,
  match: (m) => m.category === key,
});

export const PRESETS: Record<MovesPresetKey, Preset> = {
  receipts: {
    title: 'Receipts',
    sub: 'Incoming stock into your warehouses',
    docTitle: 'Goods Receipt Note',
    csvPrefix: 'inventory-receipts',
    savedKey: 'dh-inventory-receipt-searches',
    category: 'in',
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('received', 'Received'),
      typeTab('purchase', 'Purchases'),
      typeTab('return', 'Returns'),
      {
        key: 'other',
        label: 'Other',
        match: (m) => !['received', 'purchase', 'return'].includes(m.type),
      },
    ],
    showSupplier: true,
    unitsLabel: 'Units Received',
    emptyNoun: 'receipts',
  },
  deliveries: {
    title: 'Deliveries',
    sub: 'Outgoing stock — sales and shipments',
    docTitle: 'Delivery Note',
    csvPrefix: 'inventory-deliveries',
    savedKey: 'dh-inventory-delivery-searches',
    category: 'out',
    types: ['sold', 'shipped'],
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('sold', 'Sold'),
      typeTab('shipped', 'Shipped'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Issued',
    emptyNoun: 'deliveries',
  },
  internal: {
    title: 'Internal',
    sub: 'Moves between your warehouses and locations',
    docTitle: 'Internal Transfer Note',
    csvPrefix: 'inventory-internal',
    savedKey: 'dh-inventory-internal-searches',
    category: 'transfer',
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('transfer_in', 'Transfers In'),
      typeTab('transfer_out', 'Transfers Out'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Moved',
    emptyNoun: 'internal moves',
  },
  adjustments: {
    title: 'Adjustments',
    sub: 'Stock corrections outside normal operations',
    docTitle: 'Stock Adjustment Report',
    csvPrefix: 'inventory-adjustments',
    savedKey: 'dh-inventory-adjustment-searches',
    category: 'adjustment',
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('adjustment_in', 'Increases'),
      typeTab('adjustment_out', 'Decreases'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Adjusted',
    emptyNoun: 'adjustments',
  },
  scrap: {
    title: 'Scrap',
    sub: 'Stock removed as damaged, expired, stolen or written off',
    docTitle: 'Scrap Report',
    csvPrefix: 'inventory-scrap',
    savedKey: 'dh-inventory-scrap-searches',
    types: ['damaged', 'expired', 'theft', 'written_off'],
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('damaged', 'Damaged'),
      typeTab('expired', 'Expired'),
      typeTab('theft', 'Theft'),
      typeTab('written_off', 'Written off'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Scrapped',
    emptyNoun: 'scrapped stock',
  },
  moves: {
    title: 'Moves History',
    sub: 'Every stock move across your warehouses',
    docTitle: 'Stock Moves Report',
    csvPrefix: 'inventory-moves',
    savedKey: 'dh-inventory-moves-searches',
    tabs: [
      { key: 'all', label: 'All' },
      catTab('in', 'In'),
      catTab('out', 'Out'),
      catTab('transfer', 'Transfer'),
      catTab('adjustment', 'Adjustment'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Moved',
    emptyNoun: 'stock moves',
  },
};

export const STATUS_CLS: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-amber-50 text-amber-600',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-50 text-red-600',
};

export function lineCost(m: InventoryMovement) {
  return m.totalCost ?? (m.unitCost ?? 0) * Math.abs(m.quantity);
}
