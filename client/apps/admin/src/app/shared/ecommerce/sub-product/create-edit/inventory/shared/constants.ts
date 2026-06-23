// Constants for the Inventory management system
import { 
  PiCube, PiWarning, PiArrowCounterClockwise, PiCheckCircle,
  PiArrowsDownUp, PiPencil, PiArrowsLeftRight, PiNumberSquareOne,
  PiNumberSquareTwo, PiStorefront, PiFactory, PiPackage, PiTruck
} from 'react-icons/pi';
import type { StockStatusOption, WarehouseOption } from './types';

export const STOCK_STATUS_OPTIONS: StockStatusOption[] = [
  { value: 'in_stock', label: 'In Stock', icon: PiCheckCircle, color: 'success', bg: 'bg-green-50', border: 'border-green-200' },
  { value: 'low_stock', label: 'Low Stock', icon: PiWarning, color: 'warning', bg: 'bg-amber-50', border: 'border-amber-200' },
  { value: 'out_of_stock', label: 'Out of Stock', icon: PiCube, color: 'danger', bg: 'bg-red-50', border: 'border-red-200' },
  { value: 'pre_order', label: 'Pre-Order', icon: PiArrowCounterClockwise, color: 'info', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'discontinued', label: 'Discontinued', icon: PiCube, color: 'secondary', bg: 'bg-gray-50', border: 'border-gray-200' },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '\u20A6', USD: '$', EUR: '\u20AC', GBP: '\u00A3', ZAR: 'R', KES: 'KSh', GHS: '\u20B5',
};

export const VALUATION_METHODS = [
  { value: 'fifo', label: 'FIFO (First In, First Out)', description: 'Cost follows oldest inventory first' },
  { value: 'avco', label: 'AVCO (Average Cost)', description: 'Weighted average cost' },
  { value: 'standard', label: 'Standard Price', description: 'Fixed cost per unit' },
];

export const TRACKING_OPTIONS = [
  { value: 'none', label: 'No Tracking', iconName: 'cube', description: 'No serial/lot tracking' },
  { value: 'serial', label: 'By Serial Number', iconName: 'number1', description: 'Unique serial number per unit' },
  { value: 'lot', label: 'By Lot', iconName: 'number2', description: 'Group by lot/batch' },
];

export const ROUTE_OPTIONS = [
  { value: 'buy', label: 'Buy', iconName: 'store', description: 'Purchase from vendor' },
  { value: 'mto', label: 'Make to Order', iconName: 'factory', description: 'Manufacture on demand' },
  { value: 'mts', label: 'Make to Stock', iconName: 'package', description: 'Produce for stock' },
  { value: 'dropship', label: 'Drop Ship', iconName: 'truck', description: 'Direct from vendor' },
];

export const getTrackingIcon = (iconName: string) => {
  switch(iconName) {
    case 'number1': return PiNumberSquareOne;
    case 'number2': return PiNumberSquareTwo;
    default: return PiCube;
  }
};

export const getRouteIcon = (iconName: string) => {
  switch(iconName) {
    case 'store': return PiStorefront;
    case 'factory': return PiFactory;
    case 'package': return PiPackage;
    case 'truck': return PiTruck;
    default: return PiPackage;
  }
};

export const STOCK_MOVE_TYPES = [
  { value: 'incoming', label: 'Incoming', color: 'green', iconName: 'incoming' },
  { value: 'outgoing', label: 'Outgoing', color: 'red', iconName: 'outgoing' },
  { value: 'internal', label: 'Internal Transfer', color: 'blue', iconName: 'internal' },
  { value: 'adjustment', label: 'Inventory Adjustment', color: 'amber', iconName: 'adjustment' },
];

export const getMoveIcon = (iconName: string) => {
  switch(iconName) {
    case 'incoming': return PiArrowsDownUp;
    case 'outgoing': return PiArrowsDownUp;
    case 'internal': return PiArrowsLeftRight;
    case 'adjustment': return PiPencil;
    default: return PiArrowsDownUp;
  }
};

export const LOCATION_OPTIONS = [
  { value: 'warehouse_main', label: 'Main Warehouse', type: 'internal' },
  { value: 'warehouse_secondary', label: 'Secondary Warehouse', type: 'internal' },
  { value: 'stock_location', label: 'Stock Location', type: 'internal' },
  { value: 'store_front', label: 'Store Front', type: 'internal' },
  { value: 'production', label: 'Production', type: 'production' },
  { value: 'supplier', label: 'Supplier Location', type: 'supplier' },
  { value: 'customer', label: 'Customer Location', type: 'customer' },
];

export const WAREHOUSE_OPTIONS: WarehouseOption[] = [
  { value: 'warehouse_main', label: 'Main Warehouse', address: '123 Main St, City', isDefault: true },
  { value: 'warehouse_secondary', label: 'Secondary Warehouse', address: '456 Secondary Ave, Town', isDefault: false },
  { value: 'warehouse_distribution', label: 'Distribution Center', address: '789 Distribution Blvd, Metro', isDefault: false },
  { value: 'store_downtown', label: 'Downtown Store', address: '101 Main Street, Downtown', isDefault: false },
  { value: 'store_mall', label: 'Mall Outlet', address: '202 Shopping Mall, Level 2', isDefault: false },
];

export const REASON_OPTIONS = {
  add: [
    { value: 'new_shipment', label: 'New Shipment Received' },
    { value: 'return', label: 'Customer Return' },
    { value: 'transfer_in', label: 'Transfer In' },
    { value: 'inventory_correction', label: 'Inventory Correction' },
    { value: 'damaged_replacement', label: 'Damaged Item Replacement' },
    { value: 'gift', label: 'Gift/Donation' },
    { value: 'other_add', label: 'Other' },
  ],
  remove: [
    { value: 'sale', label: 'Sold' },
    { value: 'damaged', label: 'Damaged/Expired' },
    { value: 'theft', label: 'Theft/Loss' },
    { value: 'transfer_out', label: 'Transfer Out' },
    { value: 'inventory_correction', label: 'Inventory Correction' },
    { value: 'return_to_supplier', label: 'Return to Supplier' },
    { value: 'promotion', label: 'Promotional Use' },
    { value: 'sample', label: 'Sample/Demo' },
    { value: 'other_remove', label: 'Other' },
  ],
  set: [
    { value: 'physical_count', label: 'Physical Inventory Count' },
    { value: 'system_reset', label: 'System Reset' },
    { value: 'import', label: 'Data Import' },
    { value: 'other_set', label: 'Other' },
  ],
};

// Tab configuration
export const INVENTORY_TABS = [
  { id: 'overview', label: 'Overview', iconName: 'package' },
  { id: 'history', label: 'History', iconName: 'list' },
  { id: 'locations', label: 'Locations', iconName: 'map' },
  { id: 'moves', label: 'Stock Moves', iconName: 'arrows' },
  { id: 'rules', label: 'Reordering', iconName: 'recycle' },
  { id: 'alerts', label: 'Alerts', iconName: 'bell' },
  { id: 'settings', label: 'Settings', iconName: 'gear' },
] as const;
