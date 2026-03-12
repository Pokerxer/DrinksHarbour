// Shared types for the Inventory management system

export interface StockAdjustment {
  id: string;
  type: 'add' | 'remove' | 'reserve' | 'unreserve' | 'set' | 'transfer' | 'return';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  notes?: string;
  timestamp: Date;
  canUndo: boolean;
  reference?: string;
  productName?: string;
  lotNumber?: string;
  serialNumber?: string;
  fromLocation?: string;
  toLocation?: string;
  unit?: string;
  status: 'done' | 'draft' | 'cancel' | 'pending' | 'ready' | 'waiting' | 'returned';
  operationType?: 'receipt' | 'delivery' | 'transfer' | 'adjustment' | 'return' | 'pos_order';
  sourceDocument?: string;
  scheduledDate?: Date;
  effectiveDate?: Date;
  deliveryAddress?: string;
  partnerName?: string;
  packaging?: string;
  demand?: number;
  picked?: number;
  // Size variant fields
  sizeVariant?: string;
  sizeLabel?: string;
  // Transfer-specific fields
  transferId?: string;
  transferReference?: string;
  fromLocationName?: string;
  toLocationName?: string;
  transferNotes?: string;
  // Return-specific fields
  returnedById?: string;
  returnedByReference?: string;
  returnedDate?: Date;
  returnReason?: string;
}

export interface StockOperation {
  type: 'add' | 'remove';
  quantity: number;
  reason: string;
  notes?: string;
}

export interface StockMove {
  id: string;
  type: 'incoming' | 'outgoing' | 'internal' | 'adjustment';
  quantity: number;
  locationFrom?: string;
  locationTo?: string;
  warehouseFrom?: string;
  warehouseTo?: string;
  date: Date;
  reference: string;
  status: 'draft' | 'done' | 'cancel';
  notes?: string;
  sourceDocument?: string;
  scheduledDate?: Date;
  effectiveDate?: Date;
  sizeVariant?: string;
  sizeLabel?: string;
  productName?: string;
  demand?: number;
  picked?: number;
}

export interface InventoryQuant {
  id: string;
  locationId: string;
  locationName: string;
  locationType: 'internal' | 'production' | 'supplier' | 'customer';
  address?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  isActive: boolean;
}

export interface LocationStock {
  [locationId: string]: {
    total: number;
    bySize?: {
      [sizeVariant: string]: number;
    };
  };
}

export interface ReorderingRule {
  id: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  minQuantity: number;
  maxQuantity: number;
  quantityMultiple: number;
  leadTime: number;
  active: boolean;
}

export interface AlertSettings {
  lowStockEnabled: boolean;
  lowStockThreshold: number;
  outOfStockEnabled: boolean;
  reorderEnabled: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  alertFrequency: string;
  notifyEmails: string;
}

export interface StockStatusOption {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}

export interface WarehouseOption {
  value: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export interface SizeVariant {
  size: string;
  label?: string;
  stockQuantity?: number;
}

// Form context values commonly used
export interface InventoryFormValues {
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  costPrice: number;
  standardPrice: number;
  baseSellingPrice: number;
  currency: string;
  stockStatus: string;
  tracking: string;
  valuation: string;
  routes: string[];
  sizes: SizeVariant[];
  sellWithoutSizeVariants: boolean;
}

// Tab types
export type InventoryTab = 'overview' | 'history' | 'locations' | 'moves' | 'rules' | 'alerts' | 'settings';

// History filter types
export type HistoryFilter = 'all' | 'add' | 'remove' | 'reserve' | 'set' | 'transfer';
export type StatusFilter = 'all' | 'done' | 'ready' | 'waiting' | 'pending' | 'draft' | 'cancel' | 'returned';
export type DateRangeFilter = 'all' | 'today' | 'week' | 'month';
