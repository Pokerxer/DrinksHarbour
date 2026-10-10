import type { InventoryMovement } from '@/services/inventory.service';
import { isTransferReturn } from './inventory-dashboard-analysis';
import { internalDirection } from './inventory-internal-view';
import { receiptKind } from './inventory-receipt-view';
import { adjustmentDirection, isAdjustment } from './inventory-adjustment-view';

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
  historyTitle?: string;
  individualDocument?: boolean;
  showSource?: boolean;
  showRoute?: boolean;
  showReason?: boolean;
  scope?: 'internal' | 'adjustments';
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
    sub: 'Purchase receipts, returns and imported stock into your warehouses',
    docTitle: 'Goods Receipt Note',
    historyTitle: 'Goods receipt history',
    individualDocument: true,
    csvPrefix: 'inventory-receipts',
    savedKey: 'dh-inventory-receipt-searches',
    category: 'in',
    tabs: [
      { key: 'all', label: 'All' },
      ...(['purchase', 'received', 'return', 'opening', 'other'] as const).map((key) => ({
        key,
        label: {
          purchase: 'Purchases',
          received: 'Manual receipts',
          return: 'Returns',
          opening: 'Imports',
          other: 'Other',
        }[key],
        match: (m: InventoryMovement) => receiptKind(m) === key,
      })),
    ],
    showSupplier: true,
    unitsLabel: 'Units Received',
    emptyNoun: 'receipts',
  },
  deliveries: {
    title: 'Deliveries',
    sub: 'Stock issued for sales and shipments',
    docTitle: 'Delivery Note',
    historyTitle: 'Delivery history',
    individualDocument: true,
    showSource: true,
    csvPrefix: 'inventory-deliveries',
    savedKey: 'dh-inventory-delivery-searches',
    category: 'out',
    types: ['sold', 'shipped'],
    tabs: [{ key: 'all', label: 'All' }, typeTab('sold', 'Sold'), typeTab('shipped', 'Shipped')],
    showSupplier: false,
    unitsLabel: 'Units Issued',
    emptyNoun: 'deliveries',
  },
  internal: {
    title: 'Internal',
    sub: 'Moves between your warehouses and locations',
    docTitle: 'Internal Transfer Note',
    historyTitle: 'Internal transfer history',
    individualDocument: true,
    showRoute: true,
    scope: 'internal',
    csvPrefix: 'inventory-internal',
    savedKey: 'dh-inventory-internal-searches',
    tabs: [
      { key: 'all', label: 'All' },
      {
        key: 'transfer_in',
        label: 'Transfers In',
        match: (m) => m.type === 'transfer_in' && !isTransferReturn(m),
      },
      {
        key: 'transfer_out',
        label: 'Transfers Out',
        match: (m) => m.type === 'transfer_out' && !isTransferReturn(m),
      },
      {
        key: 'return_in',
        label: 'Returns in',
        match: (m) => isTransferReturn(m) && internalDirection(m) === 'in',
      },
      {
        key: 'return_out',
        label: 'Returns out',
        match: (m) => isTransferReturn(m) && internalDirection(m) === 'out',
      },
    ],
    showSupplier: false,
    unitsLabel: 'Units Moved',
    emptyNoun: 'internal moves',
  },
  adjustments: {
    title: 'Adjustments',
    sub: 'Stock corrections outside normal operations',
    docTitle: 'Stock Adjustment Report',
    historyTitle: 'Stock adjustment history',
    individualDocument: true,
    showSource: true,
    showReason: true,
    csvPrefix: 'inventory-adjustments',
    savedKey: 'dh-inventory-adjustment-searches',
    scope: 'adjustments',
    tabs: [
      { key: 'all', label: 'All' },
      { key: 'adjustment_in', label: 'Increases', match: (m) => adjustmentDirection(m) === 'in' },
      { key: 'adjustment_out', label: 'Decreases', match: (m) => adjustmentDirection(m) === 'out' },
      {
        key: 'unchanged',
        label: 'Unchanged',
        match: (m) => adjustmentDirection(m) === 'unchanged',
      },
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
      { key: 'adjustment', label: 'Adjustment', match: isAdjustment },
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
  return Number.isFinite(m.totalCost)
    ? m.totalCost!
    : Number.isFinite(m.unitCost) && Number.isFinite(m.quantity)
      ? m.unitCost! * Math.abs(m.quantity)
      : 0;
}
