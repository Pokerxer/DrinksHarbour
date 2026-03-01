// @ts-nocheck
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Textarea, Select } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiCube, PiWarning, PiArrowCounterClockwise, PiCheckCircle, PiPlus, 
  PiMinus, PiCalendar, PiWarehouse, PiPackage, PiTrendUp, PiTrendDown,
  PiArrowsDownUp, PiPencil, PiTrash, PiArrowRight, PiClock,
  PiList, PiX, PiCheck, PiDownload, PiChartLine,
  PiBell, PiWarningCircle, PiArrowsLeftRight,
  PiTimer, PiHandPalm, PiBrain, PiArrowUUpLeft, PiArrowUDownLeft,
  PiStack, PiFlow, PiScan, PiPiggyBank, PiReceipt, PiHandPointing,
  PiCheckSquare, PiLightning, PiTote, PiMapPin, PiFactory, PiStorefront,
  PiTruck, PiRecycle, PiNumberSquareOne, PiNumberSquareTwo, PiGear, PiUpload,
  PiPrinter, PiPath, PiArrowULeft, PiPackageBox, PiTarget, PiArmchair, PiDotsThree,
  PiMagnifyingGlass, PiCaretLeft, PiCaretRight, PiSpinner
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, toggleVariants } from './animations';
import { inventoryService, type InventoryMovement, type InventorySummary } from '@/services/inventory.service';

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock', icon: PiCheckCircle, color: 'success', bg: 'bg-green-50', border: 'border-green-200' },
  { value: 'low_stock', label: 'Low Stock', icon: PiWarning, color: 'warning', bg: 'bg-amber-50', border: 'border-amber-200' },
  { value: 'out_of_stock', label: 'Out of Stock', icon: PiCube, color: 'danger', bg: 'bg-red-50', border: 'border-red-200' },
  { value: 'pre_order', label: 'Pre-Order', icon: PiArrowCounterClockwise, color: 'info', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'discontinued', label: 'Discontinued', icon: PiCube, color: 'secondary', bg: 'bg-gray-50', border: 'border-gray-200' },
];

const currencySymbols: Record<string, string> = {
  NGN: '₦', USD: '$', EUR: '€', GBP: '£', ZAR: 'R', KES: 'KSh', GHS: '₵',
};

const VALUATION_METHODS = [
  { value: 'fifo', label: 'FIFO (First In, First Out)', description: 'Cost follows oldest inventory first' },
  { value: 'avco', label: 'AVCO (Average Cost)', description: 'Weighted average cost' },
  { value: 'standard', label: 'Standard Price', description: 'Fixed cost per unit' },
];

const TRACKING_OPTIONS = [
  { value: 'none', label: 'No Tracking', iconName: 'cube', description: 'No serial/lot tracking' },
  { value: 'serial', label: 'By Serial Number', iconName: 'number1', description: 'Unique serial number per unit' },
  { value: 'lot', label: 'By Lot', iconName: 'number2', description: 'Group by lot/batch' },
];

const ROUTE_OPTIONS = [
  { value: 'buy', label: 'Buy', iconName: 'store', description: 'Purchase from vendor' },
  { value: 'mto', label: 'Make to Order', iconName: 'factory', description: 'Manufacture on demand' },
  { value: 'mts', label: 'Make to Stock', iconName: 'package', description: 'Produce for stock' },
  { value: 'dropship', label: 'Drop Ship', iconName: 'truck', description: 'Direct from vendor' },
];

const getTrackingIcon = (iconName: string) => {
  switch(iconName) {
    case 'number1': return PiNumberSquareOne;
    case 'number2': return PiNumberSquareTwo;
    default: return PiCube;
  }
};

const getRouteIcon = (iconName: string) => {
  switch(iconName) {
    case 'store': return PiStorefront;
    case 'factory': return PiFactory;
    case 'package': return PiPackage;
    case 'truck': return PiTruck;
    default: return PiPackage;
  }
};

const STOCK_MOVE_TYPES = [
  { value: 'incoming', label: 'Incoming', color: 'green', iconName: 'incoming' },
  { value: 'outgoing', label: 'Outgoing', color: 'red', iconName: 'outgoing' },
  { value: 'internal', label: 'Internal Transfer', color: 'blue', iconName: 'internal' },
  { value: 'adjustment', label: 'Inventory Adjustment', color: 'amber', iconName: 'adjustment' },
];

const getMoveIcon = (iconName: string) => {
  switch(iconName) {
    case 'incoming': return PiArrowsDownUp;
    case 'outgoing': return PiArrowsDownUp;
    case 'internal': return PiArrowsLeftRight;
    case 'adjustment': return PiPencil;
    default: return PiArrowsDownUp;
  }
};

const LOCATION_OPTIONS = [
  { value: 'warehouse_main', label: 'Main Warehouse', type: 'internal' },
  { value: 'warehouse_secondary', label: 'Secondary Warehouse', type: 'internal' },
  { value: 'stock_location', label: 'Stock Location', type: 'internal' },
  { value: 'store_front', label: 'Store Front', type: 'internal' },
  { value: 'production', label: 'Production', type: 'production' },
  { value: 'supplier', label: 'Supplier Location', type: 'supplier' },
  { value: 'customer', label: 'Customer Location', type: 'customer' },
];

const WAREHOUSE_OPTIONS = [
  { value: 'warehouse_main', label: 'Main Warehouse', address: '123 Main St, City', isDefault: true },
  { value: 'warehouse_secondary', label: 'Secondary Warehouse', address: '456 Secondary Ave, Town', isDefault: false },
  { value: 'warehouse_distribution', label: 'Distribution Center', address: '789 Distribution Blvd, Metro', isDefault: false },
  { value: 'store_downtown', label: 'Downtown Store', address: '101 Main Street, Downtown', isDefault: false },
  { value: 'store_mall', label: 'Mall Outlet', address: '202 Shopping Mall, Level 2', isDefault: false },
];

const REASON_OPTIONS = {
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

interface StockAdjustment {
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

interface StockOperation {
  type: 'add' | 'remove';
  quantity: number;
  reason: string;
  notes?: string;
}

interface StockMove {
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

interface InventoryQuant {
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

interface LocationStock {
  [locationId: string]: {
    total: number;
    bySize?: {
      [sizeVariant: string]: number;
    };
  };
}

interface ReorderingRule {
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

export default function SubProductInventory() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const totalStock = watch?.('subProductData.totalStock') ?? 0;
  const reservedStock = watch?.('subProductData.reservedStock') ?? 0;
  const availableStock = watch?.('subProductData.availableStock') ?? 0;
  const lowStockThreshold = watch?.('subProductData.lowStockThreshold') ?? 10;
  const reorderPoint = watch?.('subProductData.reorderPoint') ?? 5;
  const reorderQuantity = watch?.('subProductData.reorderQuantity') ?? 50;
  const costPrice = watch?.('subProductData.costPrice') ?? 0;
  const standardPrice = watch?.('subProductData.standardPrice') ?? costPrice;
  const baseSellingPrice = watch?.('subProductData.baseSellingPrice') ?? 0;
  const currency = watch?.('subProductData.currency') || 'NGN';
  const stockStatus = watch?.('subProductData.stockStatus') || 'in_stock';
  const tracking = watch?.('subProductData.tracking') || 'none';
  const valuation = watch?.('subProductData.valuation') || 'fifo';
  const routes = watch?.('subProductData.routes') || [];
  
  const currencySymbol = currencySymbols[currency] || '₦';

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'locations' | 'moves' | 'rules' | 'alerts' | 'settings'>('overview');
  
  // Stock management state
  const [autoCalculateAvailable, setAutoCalculateAvailable] = useState(true);
  const [stockAdjustAmount, setStockAdjustAmount] = useState(1);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [adjustmentHistory, setAdjustmentHistory] = useState<StockAdjustment[]>([]);
  const [pendingOperations, setPendingOperations] = useState<StockOperation[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferQuantity, setTransferQuantity] = useState(0);
  const [transferFromWarehouse, setTransferFromWarehouse] = useState('');
  const [transferToWarehouse, setTransferToWarehouse] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [customTransferLocation, setCustomTransferLocation] = useState('');
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [newWarehouseForm, setNewWarehouseForm] = useState({ label: '', address: '' });
  const [batchOperations, setBatchOperations] = useState<StockOperation[]>([]);
  const [lastAdjustment, setLastAdjustment] = useState<StockAdjustment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [dailySalesRateInput, setDailySalesRateInput] = useState(2);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'add' | 'remove' | 'reserve' | 'set' | 'transfer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'ready' | 'waiting' | 'pending' | 'draft' | 'cancel' | 'returned'>('all');
  const [historyDateRange, setHistoryDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<StockAdjustment | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState<StockAdjustment | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<'all' | string>('all');
  
  // Get sizes from form
  const sizes = watch?.('subProductData.sizes') || [];
  const sellWithoutSizeVariants = watch?.('subProductData.sellWithoutSizeVariants');
  
  const hasSizeVariants = sellWithoutSizeVariants === false && sizes && Array.isArray(sizes) && sizes.length > 0;
  
  // Inventory movement state (server-side)
  const { data: session } = useSession();
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [serverMovements, setServerMovements] = useState<InventoryMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [showServerAdjustmentModal, setShowServerAdjustmentModal] = useState(false);
  const [serverAdjustmentType, setServerAdjustmentType] = useState<'received' | 'adjustment_in' | 'adjustment_out'>('received');
  const [serverAdjustmentQuantity, setServerAdjustmentQuantity] = useState(0);
  const [serverAdjustmentReason, setServerAdjustmentReason] = useState('');
  const [serverAdjustmentNotes, setServerAdjustmentNotes] = useState('');
  
  // Get subProduct ID for API calls (in edit mode)
  const subProductId = watch?.('subProductData._id') || watch?.('subProductData.id');
  
  // Fetch inventory summary and movements from server
  const fetchInventoryData = useCallback(async () => {
    if (!subProductId || !session?.user?.token) return;
    
    setIsLoadingMovements(true);
    try {
      const [summaryRes, movementsRes] = await Promise.all([
        inventoryService.getInventorySummary(subProductId, session.user.token),
        inventoryService.getMovements(session.user.token, { subProductId, limit: 50 })
      ]);
      
      if (summaryRes.success) {
        setInventorySummary(summaryRes.data);
      }
      if (movementsRes.success) {
        setServerMovements(movementsRes.data?.movements || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setIsLoadingMovements(false);
    }
  }, [subProductId, session?.user?.token]);
  
  // Fetch on mount if in edit mode
  useEffect(() => {
    if (subProductId && session?.user?.token) {
      fetchInventoryData();
    }
  }, [subProductId, session?.user?.token, fetchInventoryData]);
  
  // Handle inventory adjustment from server
  const handleServerAdjustment = async () => {
    if (!subProductId || !session?.user?.token) return;
    if (serverAdjustmentQuantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    try {
      if (serverAdjustmentType === 'received') {
        await inventoryService.recordReceived(
          subProductId,
          serverAdjustmentQuantity,
          session.user.token,
          {
            reason: serverAdjustmentReason,
            notes: serverAdjustmentNotes,
          }
        );
        toast.success('Stock received recorded successfully');
      } else {
        const adjustment = serverAdjustmentType === 'adjustment_in' 
          ? serverAdjustmentQuantity 
          : -serverAdjustmentQuantity;
          
        await inventoryService.adjustInventory(
          subProductId,
          adjustment,
          serverAdjustmentReason,
          session.user.token,
          serverAdjustmentNotes
        );
        toast.success('Inventory adjusted successfully');
      }
      
      // Refresh data
      await fetchInventoryData();
      
      // Reset form
      setShowServerAdjustmentModal(false);
      setServerAdjustmentQuantity(0);
      setServerAdjustmentReason('');
      setServerAdjustmentNotes('');
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to process adjustment');
    }
  };
  
  // Get total stock per size variant
  const sizeStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (hasSizeVariants) {
      sizes.forEach((s: any) => {
        if (s?.size) {
          map[s.size] = s?.stockQuantity || 0;
        }
      });
    }
    return map;
  }, [sizes, hasSizeVariants]);
  
  const totalStockBySize = Object.entries(sizeStockMap).map(([size, stock]) => ({
    size,
    stock,
    label: sizes?.find((s: any) => s?.size === size)?.label || size
  }));

  // Set initial selected size if not set
  useEffect(() => {
    if (hasSizeVariants && !selectedSize && sizes.length > 0) {
      setSelectedSize(sizes[0]?.size || '');
    }
  }, [hasSizeVariants, sizes, selectedSize]);

  // Get current size stock
  const currentSizeStock = hasSizeVariants && selectedSize ? sizeStockMap[selectedSize] || 0 : (hasSizeVariants ? 0 : totalStock);
  
  // Alert settings
  const [alertSettings, setAlertSettings] = useState({
    lowStockEnabled: true,
    lowStockThreshold: lowStockThreshold,
    outOfStockEnabled: true,
    reorderEnabled: true,
    emailNotifications: true,
    smsNotifications: false,
    inAppNotifications: true,
    alertFrequency: 'immediate',
    notifyEmails: '',
  });

  // Stock moves state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveForm, setMoveForm] = useState({
    type: 'incoming' as StockMove['type'],
    quantity: 0,
    locationFrom: '',
    locationTo: '',
    warehouseFrom: '',
    warehouseTo: '',
    reference: '',
    notes: '',
    sourceDocument: '',
  });
  const [stockMoves, setStockMoves] = useState<StockMove[]>([
    { id: '1', type: 'incoming', quantity: 50, warehouseFrom: 'warehouse_main', warehouseTo: 'warehouse_main', locationFrom: 'stock_location', locationTo: 'stock_location', date: new Date(), reference: 'PO/2024/001', status: 'done', notes: 'Initial stock receipt', sourceDocument: 'Purchase Order' },
    { id: '2', type: 'outgoing', quantity: 10, warehouseFrom: 'warehouse_main', warehouseTo: '', locationFrom: 'store_front', locationTo: 'customer', date: new Date(Date.now() - 86400000), reference: 'SO/2024/001', status: 'done', notes: 'Sale to customer', sourceDocument: 'Sales Order' },
    { id: '3', type: 'internal', quantity: 20, warehouseFrom: 'warehouse_main', warehouseTo: 'warehouse_secondary', locationFrom: 'stock_location', locationTo: 'stock_location', date: new Date(Date.now() - 172800000), reference: 'INT/2024/001', status: 'done', notes: 'Internal transfer', sourceDocument: 'Internal Request' },
  ]);

  // Location/quant state
  const [inventoryQuants, setInventoryQuants] = useState<InventoryQuant[]>([
    { id: '1', locationId: 'stock_location', locationName: 'Stock Location', locationType: 'internal', quantity: Math.floor((totalStock || 0) * 0.7), reservedQuantity: 0, availableQuantity: Math.floor((totalStock || 0) * 0.7), isActive: true },
    { id: '2', locationId: 'store_front', locationName: 'Store Front', locationType: 'internal', quantity: Math.floor((totalStock || 0) * 0.3), reservedQuantity: 0, availableQuantity: Math.floor((totalStock || 0) * 0.3), isActive: true },
  ]);
  
  // Location management state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<InventoryQuant | null>(null);
  const [locationForm, setLocationForm] = useState({
    locationName: '',
    locationType: 'internal' as 'internal' | 'production' | 'supplier' | 'customer',
    address: '',
  });
  const [showLocationAdjustModal, setShowLocationAdjustModal] = useState(false);
  const [adjustLocationQuant, setAdjustLocationQuant] = useState<InventoryQuant | null>(null);
  const [locationAdjustQty, setLocationAdjustQty] = useState(0);
  const [locationAdjustType, setLocationAdjustType] = useState<'add' | 'remove'>('add');
  const [locationAdjustReason, setLocationAdjustReason] = useState('');

  // Reordering rules state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    warehouseId: 'warehouse_main',
    locationId: 'stock_location',
    minQuantity: 10,
    maxQuantity: 50,
    quantityMultiple: 1,
    leadTime: 7,
  });
  const [reorderingRules, setReorderingRules] = useState<ReorderingRule[]>([
    { id: '1', warehouseId: 'warehouse_main', warehouseName: 'Main Warehouse', locationId: 'stock_location', minQuantity: 10, maxQuantity: 50, quantityMultiple: 1, leadTime: 7, active: true },
  ]);

  // Update alert threshold when lowStockThreshold changes
  useEffect(() => {
    setAlertSettings(prev => ({ ...prev, lowStockThreshold }));
  }, [lowStockThreshold]);

  // Sync quants with total stock
  useEffect(() => {
    if (totalStock > 0) {
      setInventoryQuants([
        { id: '1', locationId: 'stock_location', locationName: 'Stock Location', quantity: Math.floor(totalStock * 0.7), reservedQuantity: 0, availableQuantity: Math.floor(totalStock * 0.7) },
        { id: '2', locationId: 'store_front', locationName: 'Store Front', quantity: Math.floor(totalStock * 0.3), reservedQuantity: 0, availableQuantity: Math.floor(totalStock * 0.3) },
      ]);
    }
  }, [totalStock]);

  const calculatedAvailable = useMemo(() => Math.max(0, totalStock - reservedStock), [totalStock, reservedStock]);
  const finalAvailableStock = autoCalculateAvailable ? calculatedAvailable : availableStock;
  const daysUntilStockout = useMemo(() => {
    if (dailySalesRateInput <= 0 || finalAvailableStock <= 0) return Infinity;
    return Math.floor(finalAvailableStock / dailySalesRateInput);
  }, [finalAvailableStock, dailySalesRateInput]);
  const reorderDate = useMemo(() => {
    const daysUntilReorder = Math.max(0, reorderPoint / dailySalesRateInput);
    const date = new Date();
    date.setDate(date.getDate() + daysUntilReorder);
    return date;
  }, [reorderPoint, dailySalesRateInput]);
  const recommendedOrderQty = useMemo(() => {
    const safetyStock = dailySalesRateInput * 7;
    const targetStock = safetyStock + (dailySalesRateInput * 30);
    return Math.max(0, Math.ceil(targetStock - finalAvailableStock));
  }, [dailySalesRateInput, finalAvailableStock]);

  // Filtered history
  const filteredHistory = useMemo(() => {
    let filtered = adjustmentHistory;
    if (historyFilter !== 'all') {
      filtered = filtered.filter(h => h.type === historyFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(h => h.status === statusFilter);
    }
    if (sizeFilter !== 'all' && hasSizeVariants) {
      filtered = filtered.filter(h => h.sizeVariant === sizeFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(h => 
        h.reference?.toLowerCase().includes(query) ||
        h.productName?.toLowerCase().includes(query) ||
        h.reason?.toLowerCase().includes(query) ||
        h.sourceDocument?.toLowerCase().includes(query)
      );
    }
    const now = new Date();
    if (historyDateRange === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(h => new Date(h.timestamp) >= today);
    } else if (historyDateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(h => new Date(h.timestamp) >= weekAgo);
    } else if (historyDateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(h => new Date(h.timestamp) >= monthAgo);
    }
    return filtered;
  }, [adjustmentHistory, historyFilter, statusFilter, historyDateRange, searchQuery, sizeFilter, hasSizeVariants]);

  // Paginated history
  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [historyFilter, statusFilter, historyDateRange, searchQuery]);

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedHistory.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedHistory.map(h => h.id));
    }
  };

  const totalAvailable = useMemo(() => {
    return inventoryQuants.reduce((sum, q) => sum + q.availableQuantity, 0);
  }, [inventoryQuants]);

  const totalReserved = useMemo(() => {
    return inventoryQuants.reduce((sum, q) => sum + q.reservedQuantity, 0);
  }, [inventoryQuants]);

  // Auto-calculate available stock
  useEffect(() => {
    if (autoCalculateAvailable) {
      setValue?.('subProductData.availableStock', calculatedAvailable);
    }
  }, [calculatedAvailable, autoCalculateAvailable, setValue]);

  // Auto-update stock status
  useEffect(() => {
    if (finalAvailableStock === 0 && stockStatus !== 'pre_order' && stockStatus !== 'discontinued') {
      setValue?.('subProductData.stockStatus', 'out_of_stock');
    } else if (finalAvailableStock > 0 && finalAvailableStock <= lowStockThreshold && stockStatus !== 'pre_order' && stockStatus !== 'discontinued') {
      setValue?.('subProductData.stockStatus', 'low_stock');
    } else if (finalAvailableStock > lowStockThreshold && stockStatus !== 'pre_order' && stockStatus !== 'discontinued') {
      setValue?.('subProductData.stockStatus', 'in_stock');
    }
  }, [finalAvailableStock, lowStockThreshold, stockStatus, setValue]);

  const addToHistory = useCallback((
    type: StockAdjustment['type'], 
    quantity: number, 
    previousStock: number, 
    newStock: number, 
    reason: string,
    notes?: string,
    options?: {
      reference?: string;
      productName?: string;
      lotNumber?: string;
      serialNumber?: string;
      fromLocation?: string;
      toLocation?: string;
      unit?: string;
      sizeVariant?: string;
      sizeLabel?: string;
      // Transfer-specific options
      transferId?: string;
      transferReference?: string;
      fromLocationName?: string;
      toLocationName?: string;
      transferNotes?: string;
    }
  ) => {
    const sizeVariant = options?.sizeVariant || selectedSize;
    const sizeObj = sizes?.find((s: any) => s?.size === sizeVariant);
    const isTransfer = type === 'transfer';
    const adjustment: StockAdjustment = {
      id: Date.now().toString(),
      type,
      quantity,
      previousStock,
      newStock,
      reason,
      notes: isTransfer ? options?.transferNotes : notes,
      timestamp: new Date(),
      canUndo: type !== 'set' && type !== 'transfer',
      reference: options?.reference || options?.transferReference || (isTransfer ? `WH/TRF/${Date.now().toString().slice(-5)}` : `WH/MOV/${Date.now().toString().slice(-5)}`),
      productName: options?.productName || 'SubProduct',
      lotNumber: options?.lotNumber,
      serialNumber: options?.serialNumber,
      fromLocation: options?.fromLocation || (type === 'add' ? 'Vendors' : isTransfer ? '' : 'WH/Stock'),
      toLocation: options?.toLocation || (type === 'remove' ? 'Customers' : isTransfer ? '' : 'WH/Stock'),
      unit: options?.unit || 'units',
      status: 'done',
      operationType: type === 'add' ? 'receipt' : type === 'remove' ? 'delivery' : type === 'transfer' ? 'transfer' : 'adjustment',
      sourceDocument: options?.sourceDocument || (isTransfer ? `Transfer/${Date.now().toString().slice(-3)}` : `Shop/${Date.now().toString().slice(-3)}`),
      scheduledDate: new Date(),
      effectiveDate: new Date(),
      demand: quantity,
      picked: quantity,
      sizeVariant,
      sizeLabel: options?.sizeLabel || sizeObj?.label || sizeVariant,
      // Transfer-specific fields
      transferId: options?.transferId,
      transferReference: options?.transferReference,
      fromLocationName: options?.fromLocationName || options?.fromLocation,
      toLocationName: options?.toLocationName || options?.toLocation,
      transferNotes: options?.transferNotes,
    };
    setAdjustmentHistory(prev => [adjustment, ...prev].slice(0, 50));
    setLastAdjustment(adjustment);
  }, [selectedSize, sizes]);

  const handleStockAdjust = useCallback((delta: number) => {
    if (isProcessing) return;
    
    if (hasSizeVariants && selectedSize) {
      const currentSizeStockVal = sizeStockMap[selectedSize] || 0;
      const newSizeStock = Math.max(0, currentSizeStockVal + delta);
      const newTotal = Math.max(0, (totalStock || 0) + delta);
      
      const updatedSizes = sizes.map((s: any) => 
        s?.size === selectedSize ? { ...s, stockQuantity: newSizeStock } : s
      );
      setValue?.('subProductData.sizes', updatedSizes);
      setValue?.('subProductData.totalStock', newTotal);
      
      if (delta > 0) {
        addToHistory('add', delta, currentSizeStockVal, newSizeStock, 'Quick add', undefined, { sizeVariant: selectedSize, sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label });
      } else if (delta < 0) {
        addToHistory('remove', Math.abs(delta), currentSizeStockVal, newSizeStock, 'Quick remove', undefined, { sizeVariant: selectedSize, sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label });
      }
    } else {
      const newTotal = Math.max(0, (totalStock || 0) + delta);
      setValue?.('subProductData.totalStock', newTotal);
      
      if (delta > 0) {
        addToHistory('add', delta, totalStock, newTotal, 'Quick add');
      } else if (delta < 0) {
        addToHistory('remove', Math.abs(delta), totalStock, newTotal, 'Quick remove');
      }
    }
  }, [totalStock, setValue, addToHistory, isProcessing, hasSizeVariants, selectedSize, sizeStockMap, sizes]);

  const handleReservedAdjust = useCallback((delta: number) => {
    const newReserved = Math.max(0, (reservedStock || 0) + delta);
    setValue?.('subProductData.reservedStock', newReserved);
    
    if (delta > 0) {
      addToHistory('reserve', delta, reservedStock, newReserved, 'Reserved for order');
    } else if (delta < 0) {
      addToHistory('unreserve', Math.abs(delta), reservedStock, newReserved, 'Released reservation');
    }
  }, [reservedStock, setValue, addToHistory]);

  const undoLastAdjustment = useCallback(() => {
    if (!lastAdjustment || !lastAdjustment.canUndo) return;
    const newTotal = lastAdjustment.previousStock;
    setValue?.('subProductData.totalStock', newTotal);
    setAdjustmentHistory(prev => 
      prev.map(h => h.id === lastAdjustment.id ? { ...h, canUndo: false } : h)
    );
    setLastAdjustment(null);
  }, [lastAdjustment, setValue]);

  const openAdjustmentModal = (type: 'add' | 'remove' | 'set') => {
    setAdjustmentType(type);
    setAdjustmentQuantity(0);
    setAdjustmentReason('');
    setAdjustmentNotes('');
    setShowAdjustmentModal(true);
  };

  const submitAdjustment = () => {
    if (adjustmentQuantity <= 0) return;
    
    if (hasSizeVariants && selectedSize) {
      const currentSizeStockVal = sizeStockMap[selectedSize] || 0;
      let newSizeStock = currentSizeStockVal;
      if (adjustmentType === 'add') {
        newSizeStock = currentSizeStockVal + adjustmentQuantity;
      } else if (adjustmentType === 'remove') {
        newSizeStock = Math.max(0, currentSizeStockVal - adjustmentQuantity);
      } else if (adjustmentType === 'set') {
        newSizeStock = Math.max(0, adjustmentQuantity);
      }
      
      const updatedSizes = sizes.map((s: any) => 
        s?.size === selectedSize ? { ...s, stockQuantity: newSizeStock } : s
      );
      const newTotal = Math.max(0, (totalStock || 0) + (newSizeStock - currentSizeStockVal));
      setValue?.('subProductData.sizes', updatedSizes);
      setValue?.('subProductData.totalStock', newTotal);
      
      addToHistory(adjustmentType, adjustmentQuantity, currentSizeStockVal, newSizeStock, adjustmentReason || getDefaultReason(adjustmentType), adjustmentNotes, { sizeVariant: selectedSize, sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label });
    } else {
      let newTotal = totalStock;
      if (adjustmentType === 'add') {
        newTotal = totalStock + adjustmentQuantity;
      } else if (adjustmentType === 'remove') {
        newTotal = Math.max(0, totalStock - adjustmentQuantity);
      } else if (adjustmentType === 'set') {
        newTotal = Math.max(0, adjustmentQuantity);
      }
      const previousStock = totalStock;
      setValue?.('subProductData.totalStock', newTotal);
      addToHistory(adjustmentType, adjustmentQuantity, previousStock, newTotal, adjustmentReason || getDefaultReason(adjustmentType), adjustmentNotes);
    }
    setShowAdjustmentModal(false);
  };

  const getDefaultReason = (type: string) => {
    switch (type) {
      case 'add': return 'Stock added';
      case 'remove': return 'Stock removed';
      case 'set': return 'Stock set';
      default: return 'Adjustment';
    }
  };

  const addBatchOperation = () => {
    setBatchOperations(prev => [...prev, { type: 'add', quantity: 0, reason: '' }]);
  };

  const updateBatchOperation = (index: number, field: keyof StockOperation, value: any) => {
    setBatchOperations(prev => prev.map((op, i) => i === index ? { ...op, [field]: value } : op));
  };

  const removeBatchOperation = (index: number) => {
    setBatchOperations(prev => prev.filter((_, i) => i !== index));
  };

  const processBatchOperations = () => {
    setIsProcessing(true);
    let currentStock = totalStock;
    batchOperations.forEach(op => {
      if (op.quantity > 0 && op.reason) {
        if (op.type === 'add') {
          currentStock += op.quantity;
        } else {
          currentStock = Math.max(0, currentStock - op.quantity);
        }
        addToHistory(op.type, op.quantity, currentStock - (op.type === 'add' ? op.quantity : -op.quantity), currentStock, op.reason, op.notes);
      }
    });
    setValue?.('subProductData.totalStock', currentStock);
    setBatchOperations([]);
    setShowBatchModal(false);
    setIsProcessing(false);
  };

  const handleSetOutOfStock = () => {
    addToHistory('set', 0, totalStock, 0, 'Marked out of stock');
    setValue?.('subProductData.totalStock', 0);
    setValue?.('subProductData.availableStock', 0);
    setValue?.('subProductData.stockStatus', 'out_of_stock');
  };

  const handleSetPreOrder = () => {
    addToHistory('set', 0, totalStock, 0, 'Set to pre-order');
    setValue?.('subProductData.totalStock', 0);
    setValue?.('subProductData.availableStock', 0);
    setValue?.('subProductData.stockStatus', 'pre_order');
  };

  const handleAddStock = (amount: number) => {
    if (hasSizeVariants && selectedSize) {
      const currentSizeStockVal = sizeStockMap[selectedSize] || 0;
      const newSizeStock = currentSizeStockVal + amount;
      const newTotal = totalStock + amount;
      
      const updatedSizes = sizes.map((s: any) => 
        s?.size === selectedSize ? { ...s, stockQuantity: newSizeStock } : s
      );
      setValue?.('subProductData.sizes', updatedSizes);
      setValue?.('subProductData.totalStock', newTotal);
      addToHistory('add', amount, currentSizeStockVal, newSizeStock, `Added ${amount} units`, undefined, { sizeVariant: selectedSize, sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label });
      
      if (newTotal > lowStockThreshold) {
        setValue?.('subProductData.stockStatus', 'in_stock');
      } else if (newTotal > 0) {
        setValue?.('subProductData.stockStatus', 'low_stock');
      }
    } else {
      const newTotal = totalStock + amount;
      addToHistory('add', amount, totalStock, newTotal, `Added ${amount} units`);
      setValue?.('subProductData.totalStock', newTotal);
      if (newTotal > lowStockThreshold) {
        setValue?.('subProductData.stockStatus', 'in_stock');
      } else if (newTotal > 0) {
        setValue?.('subProductData.stockStatus', 'low_stock');
      }
    }
  };

  const handleDiscontinue = () => {
    addToHistory('set', 0, totalStock, 0, 'Product discontinued');
    setValue?.('subProductData.totalStock', 0);
    setValue?.('subProductData.availableStock', 0);
    setValue?.('subProductData.stockStatus', 'discontinued');
  };

  const exportStockReport = () => {
    const report = {
      product: 'SubProduct',
      date: new Date().toISOString(),
      totalStock,
      availableStock: finalAvailableStock,
      reservedStock,
      history: adjustmentHistory,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const exportStockReportCSV = () => {
    const headers = ['Date', 'Type', 'Reference', 'Quantity', 'Previous Stock', 'New Stock', 'From Location', 'To Location', 'Reason', 'Size Variant', 'Notes'];
    const rows = adjustmentHistory.map(h => [
      h.timestamp.toISOString(),
      h.type,
      h.reference || h.transferReference || '',
      h.quantity.toString(),
      h.previousStock.toString(),
      h.newStock.toString(),
      h.fromLocationName || h.fromLocation || '',
      h.toLocationName || h.toLocation || '',
      h.reason,
      h.sizeLabel || h.sizeVariant || '',
      h.transferNotes || h.notes || ''
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleAddStockMove = () => {
    if (moveForm.quantity <= 0) return;
    
    const fromWarehouse = WAREHOUSE_OPTIONS.find(w => w.value === moveForm.warehouseFrom);
    const toWarehouse = WAREHOUSE_OPTIONS.find(w => w.value === moveForm.warehouseTo);
    
    const newMove: StockMove = {
      id: Date.now().toString(),
      ...moveForm,
      warehouseFrom: moveForm.warehouseFrom || (moveForm.type === 'incoming' ? 'warehouse_main' : ''),
      warehouseTo: moveForm.warehouseTo || (moveForm.type === 'outgoing' ? 'customer' : ''),
      date: new Date(),
      scheduledDate: new Date(),
      effectiveDate: new Date(),
      status: 'done',
      productName: 'SubProduct',
      demand: moveForm.quantity,
      picked: moveForm.quantity,
      sizeVariant: selectedSize,
      sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label,
    };
    
    setStockMoves(prev => [newMove, ...prev]);
    
    // Update stock
    if (hasSizeVariants && selectedSize) {
      const currentSizeStockVal = sizeStockMap[selectedSize] || 0;
      let newSizeStock = currentSizeStockVal;
      
      if (moveForm.type === 'incoming') {
        newSizeStock = currentSizeStockVal + moveForm.quantity;
      } else if (moveForm.type === 'outgoing') {
        newSizeStock = Math.max(0, currentSizeStockVal - moveForm.quantity);
      }
      
      const updatedSizes = sizes.map((s: any) => 
        s?.size === selectedSize ? { ...s, stockQuantity: newSizeStock } : s
      );
      setValue?.('subProductData.sizes', updatedSizes);
      setValue?.('subProductData.totalStock', (totalStock || 0) + moveForm.quantity);
    } else {
      if (moveForm.type === 'incoming') {
        setValue?.('subProductData.totalStock', (totalStock || 0) + moveForm.quantity);
      } else if (moveForm.type === 'outgoing') {
        setValue?.('subProductData.totalStock', Math.max(0, (totalStock || 0) - moveForm.quantity));
      }
    }
    
    // Add to history
    const warehouseFromName = fromWarehouse?.label || moveForm.warehouseFrom || (moveForm.type === 'incoming' ? 'External' : '');
    const warehouseToName = toWarehouse?.label || moveForm.warehouseTo || (moveForm.type === 'outgoing' ? 'Customer' : '');
    
    addToHistory(
      moveForm.type === 'incoming' ? 'add' : moveForm.type === 'outgoing' ? 'remove' : 'transfer',
      moveForm.quantity,
      moveForm.type === 'incoming' ? totalStock : totalStock,
      moveForm.type === 'incoming' ? totalStock + moveForm.quantity : totalStock - moveForm.quantity,
      `${moveForm.type === 'incoming' ? 'Receipt' : moveForm.type === 'outgoing' ? 'Delivery' : 'Transfer'}: ${moveForm.reference || newMove.id}`,
      moveForm.notes || `Source: ${moveForm.sourceDocument}`,
      {
        fromLocationName: warehouseFromName,
        toLocationName: warehouseToName,
        sizeVariant: selectedSize,
        sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label,
      }
    );
    
    setShowMoveModal(false);
    setMoveForm({ type: 'incoming', quantity: 0, locationFrom: '', locationTo: '', warehouseFrom: '', warehouseTo: '', reference: '', notes: '', sourceDocument: '' });
  };

  const handleAddRule = () => {
    const warehouse = LOCATION_OPTIONS.find(l => l.value === ruleForm.warehouseId);
    const newRule: ReorderingRule = {
      id: Date.now().toString(),
      ...ruleForm,
      warehouseName: warehouse?.label || 'Warehouse',
      active: true,
    };
    setReorderingRules(prev => [...prev, newRule]);
    setShowRuleModal(false);
    setRuleForm({ warehouseId: 'warehouse_main', locationId: 'stock_location', minQuantity: 10, maxQuantity: 50, quantityMultiple: 1, leadTime: 7 });
  };

  const toggleRoute = (route: string) => {
    const currentRoutes = routes || [];
    if (currentRoutes.includes(route)) {
      setValue?.('subProductData.routes', currentRoutes.filter((r: string) => r !== route));
    } else {
      setValue?.('subProductData.routes', [...currentRoutes, route]);
    }
  };

  const getCurrentStockStatus = () => {
    if (stockStatus === 'pre_order' || stockStatus === 'discontinued') return stockStatus;
    if (finalAvailableStock === 0) return 'out_of_stock';
    if (finalAvailableStock <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
  };

  const currentStatus = getCurrentStockStatus();
  const inventoryValue = costPrice * totalStock;
  const potentialRevenue = baseSellingPrice * totalStock;
  const profitMargin = totalStock > 0 ? ((potentialRevenue - inventoryValue) / potentialRevenue * 100) : 0;
  const StatusIcon = STOCK_STATUS_OPTIONS.find(o => o.value === currentStatus)?.icon || PiCube;
  const statusOption = STOCK_STATUS_OPTIONS.find(o => o.value === currentStatus);
  const TrackingIcon = TRACKING_OPTIONS.find(t => t.value === tracking)?.icon || PiCube;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'overview', label: 'Overview', icon: PiPackage },
          { id: 'history', label: 'History', icon: PiList },
          { id: 'locations', label: 'Locations', icon: PiMapPin },
          { id: 'moves', label: 'Stock Moves', icon: PiArrowsDownUp },
          { id: 'rules', label: 'Reordering', icon: PiRecycle },
          { id: 'alerts', label: 'Alerts', icon: PiBell },
          { id: 'settings', label: 'Settings', icon: PiGear },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
        
        {lastAdjustment && lastAdjustment.canUndo && (
          <button
            type="button"
            onClick={undoLastAdjustment}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50"
          >
            <PiArrowUUpLeft className="h-4 w-4" />
            Undo
          </button>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <motion.div variants={fieldStaggerVariants} custom={0}>
            <div className="flex items-center justify-between">
              <div>
                <Text className="mb-1 text-lg font-semibold">Stock Management</Text>
                <Text className="text-sm text-gray-500">Add, remove, or adjust stock levels</Text>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTransferModal(true)}>
                  <PiArrowsLeftRight className="mr-1 h-4 w-4" /> Transfer
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowBatchModal(true)}>
                  <PiStack className="mr-1 h-4 w-4" /> Batch
                </Button>
                <div className="relative group">
                  <Button variant="outline" size="sm">
                    <PiDownload className="mr-1 h-4 w-4" /> Export
                  </Button>
                  <div className="absolute right-0 mt-1 w-40 rounded-lg border border-gray-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button onClick={exportStockReport} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg">
                      Export JSON
                    </button>
                    <button onClick={exportStockReportCSV} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg">
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Add/Remove Bar */}
          <motion.div variants={fieldStaggerVariants} className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStockAdjust(-stockAdjustAmount)}
                    disabled={totalStock <= 0}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
                  >
                    <PiMinus className="h-6 w-6" />
                  </button>
                  <div className="text-center">
                    <Input
                      type="number"
                      min="1"
                      value={stockAdjustAmount}
                      onChange={(e) => setStockAdjustAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStockAdjust(stockAdjustAmount)}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-green-200 bg-green-50 text-green-600 transition-all hover:bg-green-100 hover:border-green-300"
                  >
                    <PiPlus className="h-6 w-6" />
                  </button>
                </div>
                <div className="h-10 w-px bg-gray-300" />
                <div className="flex gap-2">
                  {[1, 5, 10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStockAdjustAmount(amt)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        stockAdjustAmount === amt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ×{amt}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openAdjustmentModal('remove')}>
                  <PiArrowUDownLeft className="mr-1 h-4 w-4" /> Remove
                </Button>
                <Button onClick={() => openAdjustmentModal('add')}>
                  <PiArrowUUpLeft className="mr-1 h-4 w-4" /> Add Stock
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Size Variant Selector */}
          {hasSizeVariants && (
            <motion.div variants={fieldStaggerVariants} className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <PiPackage className="h-5 w-5 text-purple-600" />
                  <Text className="font-medium text-purple-800">Size Variant</Text>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {sizes.map((s: any) => (
                    <button
                      key={s?.size}
                      type="button"
                      onClick={() => setSelectedSize(s?.size)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        selectedSize === s?.size 
                          ? 'bg-purple-600 text-white shadow-md' 
                          : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      {s?.label || s?.size}
                      <span className={`ml-2 ${selectedSize === s?.size ? 'text-purple-200' : 'text-purple-500'}`}>
                        ({sizeStockMap[s?.size] || 0})
                      </span>
                    </button>
                  ))}
                </div>
                {selectedSize && (
                  <div className="ml-auto">
                    <Badge color="primary" variant="flat">
                      Current: {sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize} - {currentSizeStock} units
                    </Badge>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Stock Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <motion.div variants={fieldStaggerVariants} className={`rounded-xl border-2 p-5 ${statusOption?.border || 'border-gray-200'} ${statusOption?.bg || 'bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-gray-600">Total Stock</Text>
                <PiPackage className="h-5 w-5 text-gray-400" />
              </div>
              <Text className="text-4xl font-bold text-gray-900">{totalStock || 0}</Text>
              <Text className="mt-2 text-xs text-gray-500">units in inventory</Text>
            </motion.div>

            <motion.div variants={fieldStaggerVariants} className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-green-700">Available</Text>
                <PiCheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <Text className="text-4xl font-bold text-green-700">{finalAvailableStock}</Text>
              <Text className="mt-2 text-xs text-green-600">ready to sell</Text>
            </motion.div>

            <motion.div variants={fieldStaggerVariants} className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-amber-700">Reserved</Text>
                <PiHandPalm className="h-5 w-5 text-amber-500" />
              </div>
              <Text className="text-4xl font-bold text-amber-700">{reservedStock || 0}</Text>
              <div className="mt-2 flex gap-1">
                <button onClick={() => handleReservedAdjust(-1)} className="rounded bg-amber-200 p-1 hover:bg-amber-300">
                  <PiMinus className="h-3 w-3" />
                </button>
                <button onClick={() => handleReservedAdjust(1)} className="rounded bg-amber-200 p-1 hover:bg-amber-300">
                  <PiPlus className="h-3 w-3" />
                </button>
              </div>
            </motion.div>

            <motion.div variants={fieldStaggerVariants} className={`rounded-xl border-2 p-5 ${statusOption?.border || 'border-gray-200'} ${statusOption?.bg || 'bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-gray-600">Status</Text>
                <StatusIcon className="h-5 w-5 text-gray-400" />
              </div>
              <Badge color={statusOption?.color || 'secondary'} className="text-sm">
                {statusOption?.label || 'Unknown'}
              </Badge>
              {daysUntilStockout < 30 && (
                <Text className="mt-2 text-xs text-amber-600">
                  ~{daysUntilStockout} days left
                </Text>
              )}
            </motion.div>
          </div>

          {/* Quick Action Buttons */}
          <motion.div variants={fieldStaggerVariants}>
            <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '+10', action: () => handleAddStock(10) },
                { label: '+50', action: () => handleAddStock(50) },
                { label: '+100', action: () => handleAddStock(100) },
                { label: '+500', action: () => handleAddStock(500) },
              ].map((btn, i) => (
                <Button key={i} variant="outline" size="sm" onClick={btn.action} className="border-green-300 text-green-700 hover:bg-green-50">
                  {btn.label}
                </Button>
              ))}
              <div className="h-6 w-px bg-gray-300" />
              <Button variant="outline" size="sm" onClick={handleSetOutOfStock} className="border-red-300 text-red-700 hover:bg-red-50">
                <PiCube className="mr-1 h-4 w-4" /> Out of Stock
              </Button>
              <Button variant="outline" size="sm" onClick={handleSetPreOrder} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <PiArrowCounterClockwise className="mr-1 h-4 w-4" /> Pre-Order
              </Button>
              <Button variant="outline" size="sm" onClick={handleDiscontinue} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                <PiTrash className="mr-1 h-4 w-4" /> Discontinue
              </Button>
            </div>
          </motion.div>

          {/* Inventory Value */}
          {(inventoryValue > 0 || potentialRevenue > 0) && (
            <motion.div variants={fieldStaggerVariants} className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiTrendDown className="h-5 w-5 text-amber-600" />
                  <Text className="font-medium text-amber-800">Inventory Value</Text>
                </div>
                <Text className="text-2xl font-bold text-amber-700">{currencySymbol}{inventoryValue.toLocaleString()}</Text>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiTrendUp className="h-5 w-5 text-green-600" />
                  <Text className="font-medium text-green-800">Potential Revenue</Text>
                </div>
                <Text className="text-2xl font-bold text-green-700">{currencySymbol}{potentialRevenue.toLocaleString()}</Text>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiPiggyBank className="h-5 w-5 text-blue-600" />
                  <Text className="font-medium text-blue-800">Profit Margin</Text>
                </div>
                <Text className="text-2xl font-bold text-blue-700">{profitMargin.toFixed(1)}%</Text>
              </div>
            </motion.div>
          )}

          {/* Stock Settings */}
          <motion.div variants={fieldStaggerVariants}>
            <Text className="mb-3 text-sm font-medium text-gray-700">Settings</Text>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <Text className="text-sm font-medium text-gray-700">Auto-calculate</Text>
                  <Text className="text-xs text-gray-500">Total - Reserved</Text>
                </div>
                <Switch checked={autoCalculateAvailable} onChange={(checked) => setAutoCalculateAvailable(checked)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Low Stock Alert</label>
                <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setValue?.('subProductData.lowStockThreshold', parseInt(e.target.value) || 0)} className="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Reorder Point</label>
                <Input type="number" min="0" value={reorderPoint} onChange={(e) => setValue?.('subProductData.reorderPoint', parseInt(e.target.value) || 0)} className="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Reorder Qty</label>
                <Input type="number" min="1" value={reorderQuantity} onChange={(e) => setValue?.('subProductData.reorderQuantity', parseInt(e.target.value) || 50)} className="w-full" />
              </div>
            </div>
          </motion.div>

          {/* Stock Level Indicator */}
          {stockStatus !== 'pre_order' && stockStatus !== 'discontinued' && (
            <motion.div variants={fieldStaggerVariants}>
              <div className="flex items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-700">Stock Level</Text>
                <Text className="text-xs text-gray-500">{finalAvailableStock} / {lowStockThreshold}</Text>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
                <div 
                  className={`h-full transition-all duration-500 ${
                    finalAvailableStock === 0 ? 'bg-red-500' :
                    finalAvailableStock <= lowStockThreshold ? 'bg-amber-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (finalAvailableStock / (lowStockThreshold * 3)) * 100)}%` }}
                />
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <motion.div 
          variants={fieldStaggerVariants} 
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Server-side Inventory Summary */}
          {subProductId && (
            <motion.div 
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Text className="font-semibold text-lg">Inventory Summary</Text>
                  {isLoadingMovements && <PiSpinner className="h-4 w-4 animate-spin text-gray-400" />}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowServerAdjustmentModal(true)}
                >
                  <PiPlus className="mr-1 h-4 w-4" /> Record Stock
                </Button>
              </div>
              
              {inventorySummary ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <Text className="text-xs text-blue-600 font-medium">Current Stock</Text>
                    <Text className="text-2xl font-bold text-blue-700">{inventorySummary.subProduct?.totalStock || 0}</Text>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                    <Text className="text-xs text-green-600 font-medium">Total Received</Text>
                    <Text className="text-2xl font-bold text-green-700">{inventorySummary.totals?.received || 0}</Text>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                    <Text className="text-xs text-red-600 font-medium">Total Sold</Text>
                    <Text className="text-2xl font-bold text-red-700">{inventorySummary.totals?.sold || 0}</Text>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <Text className="text-xs text-amber-600 font-medium">Returned</Text>
                    <Text className="text-2xl font-bold text-amber-700">{inventorySummary.totals?.returned || 0}</Text>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                    <Text className="text-xs text-purple-600 font-medium">Adjusted</Text>
                    <Text className="text-2xl font-bold text-purple-700">{inventorySummary.totals?.adjusted || 0}</Text>
                  </div>
                </div>
              ) : (
                <Text className="text-sm text-gray-500">
                  {!subProductId ? 'Save the product to start tracking inventory.' : 'No inventory data available.'}
                </Text>
              )}
            </motion.div>
          )}

          {/* Recent Server Movements */}
          {serverMovements.length > 0 && (
            <motion.div 
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Text className="font-semibold mb-3">Recent Movements</Text>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {serverMovements.slice(0, 10).map((movement) => (
                  <div key={movement._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                        movement.category === 'in' ? 'bg-green-100 text-green-600' :
                        movement.category === 'out' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {movement.category === 'in' ? <PiPlus className="h-4 w-4" /> :
                         movement.category === 'out' ? <PiMinus className="h-4 w-4" /> :
                         <PiArrowsLeftRight className="h-4 w-4" />}
                      </span>
                      <div>
                        <Text className="text-sm font-medium capitalize">{movement.type?.replace('_', ' ')}</Text>
                        <Text className="text-xs text-gray-500">
                          {movement.reference || movement.reason || 'No reference'} • {new Date(movement.createdAt).toLocaleDateString()}
                        </Text>
                      </div>
                    </div>
                    <Text className={`font-semibold ${
                      movement.category === 'in' ? 'text-green-600' :
                      movement.category === 'out' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {movement.category === 'in' ? '+' : movement.category === 'out' ? '-' : '~'}{movement.quantity}
                    </Text>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Text className="font-semibold text-xl">Stock Moves</Text>
              <Badge color="primary" variant="flat">
                {filteredHistory.length} moves
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportStockReportCSV}>
                <PiDownload className="mr-1 h-4 w-4" /> Export
              </Button>
              <Button size="sm">
                <PiPlus className="mr-1 h-4 w-4" /> New
              </Button>
            </div>
          </div>

          {/* Enhanced Filters */}
          <motion.div 
            className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by reference, product, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>

              <div className="h-6 w-px bg-gray-300" />

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <Text className="text-sm font-medium text-gray-600">Type:</Text>
                <div className="flex gap-1">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'add', label: 'Receipt', color: 'green' },
                    { value: 'remove', label: 'Delivery', color: 'red' },
                    { value: 'transfer', label: 'Transfer', color: 'purple' },
                    { value: 'set', label: 'Adjust', color: 'amber' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setHistoryFilter(type.value as typeof historyFilter)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        historyFilter === type.value
                          ? type.value === 'all' ? 'bg-gray-200 text-gray-700' :
                            type.value === 'add' ? 'bg-green-100 text-green-700' :
                            type.value === 'remove' ? 'bg-red-100 text-red-700' :
                            type.value === 'transfer' ? 'bg-purple-100 text-purple-700' :
                            'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-6 w-px bg-gray-300" />

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Text className="text-sm font-medium text-gray-600">Status:</Text>
                <div className="flex gap-1">
                  {[
                    { value: 'all', label: 'All', color: 'gray' },
                    { value: 'done', label: 'Done', color: 'green' },
                    { value: 'ready', label: 'Ready', color: 'blue' },
                    { value: 'waiting', label: 'Waiting', color: 'amber' },
                    { value: 'pending', label: 'Pending', color: 'purple' },
                    { value: 'draft', label: 'Draft', color: 'gray' },
                    { value: 'returned', label: 'Returned', color: 'amber' },
                    { value: 'cancel', label: 'Cancelled', color: 'red' },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value as typeof statusFilter)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        statusFilter === status.value
                          ? status.color === 'green' ? 'bg-green-100 text-green-700' :
                            status.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                            status.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                            status.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-200 text-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-6 w-px bg-gray-300" />

              {/* Date Filter */}
              <select
                value={historyDateRange}
                onChange={(e) => setHistoryDateRange(e.target.value as typeof historyDateRange)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="all">Any Date</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>

              {/* Size Filter */}
              {hasSizeVariants && (
                <>
                  <div className="h-6 w-px bg-gray-300" />
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="all">All Sizes</option>
                    {sizes.map((s: any) => (
                      <option key={s?.size} value={s?.size}>
                        {s?.label || s?.size}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* Items per page */}
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </motion.div>

          {/* Bulk Actions */}
          {selectedItems.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
            >
              <Text className="text-sm font-medium text-blue-700">
                {selectedItems.length} item(s) selected
              </Text>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-700">
                Mark as Done
              </Button>
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-700">
                Cancel
              </Button>
              <Button variant="text" size="sm" onClick={() => setSelectedItems([])}>
                Clear
              </Button>
            </motion.div>
          )}

          {/* History List - Odoo Style */}
          {filteredHistory.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center"
            >
              <PiPackage className="mx-auto h-16 w-16 text-gray-300" />
              <Text className="mt-4 text-lg font-medium text-gray-500">No stock moves found</Text>
              <Text className="text-sm text-gray-400 mt-1">Try adjusting your filters or create a new stock move</Text>
              <Button className="mt-4">
                <PiPlus className="mr-2 h-4 w-4" /> Create Stock Move
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-3"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
              {paginatedHistory.map((adj, index) => (
                <motion.div
                  key={adj.id}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  className={`rounded-xl border bg-white hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden group ${
                    selectedItems.includes(adj.id) ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedHistoryItem(adj)}
                >
                  {/* Header with gradient */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(adj.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(adj.id);
                        }}
                        className="rounded border-gray-300 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          adj.status === 'done' ? 'bg-green-100 text-green-700 border border-green-200' :
                          adj.status === 'ready' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          adj.status === 'waiting' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          adj.status === 'pending' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                          adj.status === 'cancel' ? 'bg-red-100 text-red-700 border border-red-200' :
                          adj.status === 'returned' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {adj.status === 'done' && <PiCheck className="mr-1 h-3 w-3" />}
                          {adj.status === 'done' && 'Done'}
                          {adj.status === 'ready' && 'Ready'}
                          {adj.status === 'waiting' && 'Waiting'}
                          {adj.status === 'pending' && 'Pending'}
                          {adj.status === 'draft' && 'Draft'}
                          {adj.status === 'cancel' && 'Cancelled'}
                          {adj.status === 'returned' && 'Returned'}
                        </span>
                        {/* Transfer badge */}
                        {adj.type === 'transfer' && (
                          <Badge color="info" variant="flat" className="text-xs">
                            <PiArrowsLeftRight className="mr-1 h-3 w-3" />
                            Transfer
                          </Badge>
                        )}
                        {/* Return badge */}
                        {adj.type === 'return' && (
                          <Badge color="warning" variant="flat" className="text-xs">
                            <PiArrowCounterClockwise className="mr-1 h-3 w-3" />
                            Return
                          </Badge>
                        )}
                      </div>
                      <Text className={`font-mono text-sm font-bold px-2 py-1 rounded ${
                        adj.type === 'transfer' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'
                      }`}>
                        {adj.reference || adj.transferReference || `WH/${adj.operationType?.slice(0,3).toUpperCase() || 'MOV'}/${adj.id.slice(-5)}`}
                      </Text>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {adj.type === 'transfer' && (
                        <Button variant="outline" size="xs" onClick={(e) => e.stopPropagation()}>
                          <PiPackage className="h-3 w-3 mr-1" /> Transfer Slip
                        </Button>
                      )}
                      <Button variant="outline" size="xs" onClick={(e) => e.stopPropagation()}>
                        <PiPrinter className="h-3 w-3 mr-1" /> Print
                      </Button>
                      <Button variant="outline" size="xs" onClick={(e) => e.stopPropagation()}>
                        <PiPencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {/* Main Info */}
                    <div className="p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <PiCalendar className="h-3 w-3 text-gray-400" />
                            <Text className="text-xs text-gray-500 uppercase font-medium">Date</Text>
                          </div>
                          <Text className="font-semibold">{adj.timestamp.toLocaleDateString()}</Text>
                          <Text className="text-xs text-gray-500">{adj.timestamp.toLocaleTimeString()}</Text>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <PiPath className="h-3 w-3 text-gray-400" />
                            <Text className="text-xs text-gray-500 uppercase font-medium">Operation</Text>
                          </div>
                          <div className="flex items-center gap-2">
                            {adj.type === 'add' || adj.operationType === 'receipt' ? (
                              <PiArrowsDownUp className="h-4 w-4 text-green-600 rotate-180" />
                            ) : adj.type === 'remove' || adj.operationType === 'delivery' ? (
                              <PiArrowsDownUp className="h-4 w-4 text-red-600" />
                            ) : adj.operationType === 'transfer' ? (
                              <PiArrowsLeftRight className="h-4 w-4 text-blue-600" />
                            ) : adj.type === 'return' || adj.operationType === 'return' ? (
                              <PiArrowCounterClockwise className="h-4 w-4 text-amber-600" />
                            ) : (
                              <PiPencil className="h-4 w-4 text-amber-600" />
                            )}
                            <Text className="font-semibold text-sm">
                              {adj.operationType === 'receipt' && 'Receipt'}
                              {adj.operationType === 'delivery' && 'Delivery'}
                              {adj.operationType === 'transfer' && 'Transfer'}
                              {adj.operationType === 'pos_order' && 'PoS Order'}
                              {adj.operationType === 'return' && 'Return'}
                              {!adj.operationType && (adj.type === 'add' ? 'Receipt' : adj.type === 'remove' ? 'Delivery' : adj.type === 'transfer' ? 'Transfer' : adj.type === 'return' ? 'Return' : 'Adjustment')}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* From/To */}
                    <div className="p-4">
                      <div className="space-y-3">
                        {adj.type === 'transfer' ? (
                          <>
                            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                              <div className="flex items-center justify-between mb-2">
                                <Text className="text-xs text-purple-600 uppercase font-medium">Transfer Route</Text>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 text-center">
                                  <Text className="text-xs text-gray-500">From</Text>
                                  <Text className="font-semibold text-sm text-purple-700">{adj.fromLocationName || adj.fromLocation || 'WH/Stock'}</Text>
                                </div>
                                <PiArrowRight className="h-4 w-4 text-purple-400" />
                                <div className="flex-1 text-center">
                                  <Text className="text-xs text-gray-500">To</Text>
                                  <Text className="font-semibold text-sm text-purple-700">{adj.toLocationName || adj.toLocation || 'WH/Stock'}</Text>
                                </div>
                              </div>
                              {adj.transferReference && (
                                <Text className="text-xs text-purple-500 mt-2 text-center font-mono">
                                  Ref: {adj.transferReference}
                                </Text>
                              )}
                            </div>
                            {adj.transferNotes && (
                              <div className="mt-2">
                                <Text className="text-xs text-gray-500">Notes</Text>
                                <Text className="text-xs text-gray-700 mt-0.5">{adj.transferNotes}</Text>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <PiArrowRight className="h-3 w-3 text-gray-400 rotate-180" />
                                <Text className="text-xs text-gray-500 uppercase font-medium">From</Text>
                              </div>
                              <Text className="font-semibold text-sm">{adj.fromLocation || (adj.type === 'add' ? 'Vendors' : 'WH/Stock')}</Text>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <PiArrowRight className="h-3 w-3 text-gray-400" />
                                <Text className="text-xs text-gray-500 uppercase font-medium">To</Text>
                              </div>
                              <Text className="font-semibold text-sm">{adj.toLocation || (adj.type === 'remove' ? 'Customers' : 'WH/Stock')}</Text>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Product & Qty */}
                    <div className="p-4 md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PiPackage className="h-4 w-4 text-gray-400" />
                          <Text className="text-xs text-gray-500 uppercase font-medium">Product</Text>
                        </div>
                        <Text className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                          {adj.sourceDocument || `Shop/${adj.id.slice(-3)}`}
                        </Text>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Text className="font-semibold">{adj.productName || 'SubProduct'}</Text>
                          {(adj.lotNumber || adj.serialNumber) && (
                            <Text className="text-xs text-purple-600 mt-0.5">
                              {adj.serialNumber ? `SN: ${adj.serialNumber}` : `Lot: ${adj.lotNumber}`}
                            </Text>
                          )}
                          {(adj.sizeVariant || adj.sizeLabel) && (
                            <Badge color="primary" variant="flat" className="mt-1 text-xs">
                              Size: {adj.sizeLabel || adj.sizeVariant}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <Text className="text-xs text-gray-500">Demand</Text>
                            <Text className="font-bold text-lg">{adj.demand || adj.quantity}</Text>
                          </div>
                          <div className="text-center">
                            <Text className="text-xs text-gray-500">Done</Text>
                            <Text className="font-bold text-lg text-green-600">{adj.picked || adj.quantity}</Text>
                          </div>
                          <div className="text-center">
                            <Text className="text-xs text-gray-500">Unit</Text>
                            <Text className="font-medium text-gray-600">{adj.unit || 'units'}</Text>
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Text className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length} entries
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <PiCaretLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  <PiCaretLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  <PiCaretRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <PiCaretRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Locations Tab */}
      {activeTab === 'locations' && (
        <motion.div variants={fieldStaggerVariants} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Text className="font-semibold text-lg">Stock Locations</Text>
              <Text className="text-sm text-gray-500">Manage inventory across different locations</Text>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowLocationModal(true)}>
                <PiPlus className="mr-1 h-4 w-4" /> Add Location
              </Button>
              <Button variant="outline" size="sm">
                <PiUpload className="mr-1 h-4 w-4" /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={exportStockReport}>
                <PiDownload className="mr-1 h-4 w-4" /> Export
              </Button>
            </div>
          </div>

          {/* Location Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inventoryQuants.filter(q => q.isActive).map((quant) => (
              <div key={quant.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      quant.locationType === 'internal' ? 'bg-blue-100' :
                      quant.locationType === 'production' ? 'bg-purple-100' :
                      quant.locationType === 'supplier' ? 'bg-green-100' :
                      'bg-amber-100'
                    }`}>
                      <PiMapPin className={`h-5 w-5 ${
                        quant.locationType === 'internal' ? 'text-blue-600' :
                        quant.locationType === 'production' ? 'text-purple-600' :
                        quant.locationType === 'supplier' ? 'text-green-600' :
                        'text-amber-600'
                      }`} />
                    </div>
                    <div>
                      <Text className="font-semibold">{quant.locationName}</Text>
                      <Text className="text-xs text-gray-500 capitalize">{quant.locationType}</Text>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingLocation(quant);
                        setLocationForm({
                          locationName: quant.locationName,
                          locationType: quant.locationType,
                          address: quant.address || '',
                        });
                        setShowLocationModal(true);
                      }}
                      className="rounded p-1.5 hover:bg-gray-100"
                    >
                      <PiPencil className="h-4 w-4 text-gray-500" />
                    </button>
                    <button 
                      onClick={() => {
                        setAdjustLocationQuant(quant);
                        setLocationAdjustQty(0);
                        setLocationAdjustType('add');
                        setLocationAdjustReason('');
                        setShowLocationAdjustModal(true);
                      }}
                      className="rounded p-1.5 hover:bg-gray-100"
                    >
                      <PiArrowsDownUp className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Stock Info */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <Text className="text-xs text-gray-500">On Hand</Text>
                    <Text className="text-lg font-bold">{quant.quantity}</Text>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg">
                    <Text className="text-xs text-amber-600">Reserved</Text>
                    <Text className="text-lg font-bold text-amber-600">{quant.reservedQuantity}</Text>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <Text className="text-xs text-green-600">Available</Text>
                    <Text className="text-lg font-bold text-green-600">{quant.availableQuantity}</Text>
                  </div>
                </div>

                {/* Size Variant Stock (if applicable) */}
                {hasSizeVariants && (
                  <div className="border-t border-gray-100 pt-3">
                    <Text className="text-xs text-gray-500 mb-2">Stock by Size</Text>
                    <div className="flex flex-wrap gap-1">
                      {sizes.map((s: any) => (
                        <Badge key={s?.size} color="primary" variant="flat" className="text-xs">
                          {s?.label || s?.size}: {sizeStockMap[s?.size] ? Math.floor((sizeStockMap[s?.size] * quant.quantity) / (totalStock || 1)) : 0}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Capacity</span>
                    <span>{totalStock > 0 ? Math.round((quant.quantity / totalStock) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                      style={{ width: `${totalStock > 0 ? (quant.quantity / totalStock) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <Text className="font-semibold">Location Summary</Text>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">On Hand</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Reserved</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Available</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">%</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryQuants.filter(q => q.isActive).map((quant) => (
                  <tr key={quant.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PiMapPin className="h-4 w-4 text-gray-400" />
                        <Text className="font-medium">{quant.locationName}</Text>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={
                        quant.locationType === 'internal' ? 'primary' :
                        quant.locationType === 'production' ? 'secondary' :
                        quant.locationType === 'supplier' ? 'success' : 'warning'
                      } variant="flat" className="text-xs capitalize">
                        {quant.locationType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{quant.quantity}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{quant.reservedQuantity}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{quant.availableQuantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {totalStock > 0 ? Math.round((quant.quantity / totalStock) * 100) : 0}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => {
                            setAdjustLocationQuant(quant);
                            setLocationAdjustQty(0);
                            setLocationAdjustType('add');
                            setLocationAdjustReason('');
                            setShowLocationAdjustModal(true);
                          }}
                          className="rounded p-1 hover:bg-gray-100 text-green-600" 
                          title="Adjust Stock"
                        >
                          <PiArrowsDownUp className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingLocation(quant);
                            setLocationForm({
                              locationName: quant.locationName,
                              locationType: quant.locationType,
                              address: quant.address || '',
                            });
                            setShowLocationModal(true);
                          }}
                          className="rounded p-1 hover:bg-gray-100" 
                          title="Edit"
                        >
                          <PiPencil className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right">{totalStock || 0}</td>
                  <td className="px-4 py-3 text-right">{totalReserved}</td>
                  <td className="px-4 py-3 text-right">{totalAvailable}</td>
                  <td className="px-4 py-3 text-right">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      )}

      {/* Stock Moves Tab */}
      {activeTab === 'moves' && (
        <motion.div variants={fieldStaggerVariants} className="space-y-6">
          <div className="flex items-center justify-between">
            <Text className="font-semibold">Stock Moves</Text>
            <Button onClick={() => setShowMoveModal(true)}>
              <PiPlus className="mr-1 h-4 w-4" /> New Move
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
{STOCK_MOVE_TYPES.map((type) => {
                const IconComponent = getMoveIcon(type.iconName);
                return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setMoveForm(prev => ({ ...prev, type: type.value as StockMove['type'] }));
                    setShowMoveModal(true);
                  }}
                  className={`rounded-xl border-2 border-${type.color}-200 bg-${type.color}-50 p-4 text-left transition-all hover:border-${type.color}-300 hover:shadow-md`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`h-6 w-6 text-${type.color}-600`} />
                    <Text className={`font-medium text-${type.color}-700`}>{type.label}</Text>
                  </div>
                </button>
                );
              })}
          </div>

          {stockMoves.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
              <PiArrowsDownUp className="mx-auto h-12 w-12 text-gray-400" />
              <Text className="mt-3 text-gray-500">No stock moves yet</Text>
              <Text className="text-sm text-gray-400">Click a move type above to create one</Text>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2">
                    <PiArrowsDownUp className="h-5 w-5 text-green-600 rotate-180" />
                    <Text className="text-sm font-medium text-green-700">Incoming</Text>
                  </div>
                  <Text className="text-2xl font-bold text-green-700 mt-1">
                    {stockMoves.filter(m => m.type === 'incoming').reduce((sum, m) => sum + m.quantity, 0)}
                  </Text>
                  <Text className="text-xs text-green-600">{stockMoves.filter(m => m.type === 'incoming').length} moves</Text>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center gap-2">
                    <PiArrowsDownUp className="h-5 w-5 text-red-600" />
                    <Text className="text-sm font-medium text-red-700">Outgoing</Text>
                  </div>
                  <Text className="text-2xl font-bold text-red-700 mt-1">
                    {stockMoves.filter(m => m.type === 'outgoing').reduce((sum, m) => sum + m.quantity, 0)}
                  </Text>
                  <Text className="text-xs text-red-600">{stockMoves.filter(m => m.type === 'outgoing').length} moves</Text>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-center gap-2">
                    <PiArrowsLeftRight className="h-5 w-5 text-blue-600" />
                    <Text className="text-sm font-medium text-blue-700">Internal</Text>
                  </div>
                  <Text className="text-2xl font-bold text-blue-700 mt-1">
                    {stockMoves.filter(m => m.type === 'internal').reduce((sum, m) => sum + m.quantity, 0)}
                  </Text>
                  <Text className="text-xs text-blue-600">{stockMoves.filter(m => m.type === 'internal').length} moves</Text>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2">
                    <PiPencil className="h-5 w-5 text-amber-600" />
                    <Text className="text-sm font-medium text-amber-700">Adjustments</Text>
                  </div>
                  <Text className="text-2xl font-bold text-amber-700 mt-1">
                    {stockMoves.filter(m => m.type === 'adjustment').reduce((sum, m) => sum + m.quantity, 0)}
                  </Text>
                  <Text className="text-xs text-amber-600">{stockMoves.filter(m => m.type === 'adjustment').length} moves</Text>
                </div>
              </div>

              {/* Moves Table */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reference</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Qty</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">From → To</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Source Doc</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMoves.map((move) => (
                      <tr key={move.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <Text className="font-medium">{move.date.toLocaleDateString()}</Text>
                          <Text className="text-xs text-gray-500">{move.date.toLocaleTimeString()}</Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text className="font-medium font-mono text-blue-600">{move.reference || move.id}</Text>
                          {move.sizeLabel && (
                            <Badge color="primary" variant="flat" className="text-xs mt-1">{move.sizeLabel}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={
                            move.type === 'incoming' ? 'success' :
                            move.type === 'outgoing' ? 'danger' :
                            move.type === 'internal' ? 'info' : 'warning'
                          }>
                            {move.type === 'incoming' ? 'Receipt' : 
                             move.type === 'outgoing' ? 'Delivery' : 
                             move.type === 'internal' ? 'Internal' : 'Adjustment'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{move.quantity}</td>
                        <td className="px-4 py-3 text-sm">
                          {move.warehouseFrom || move.warehouseTo ? (
                            <div className="flex items-center gap-1">
                              <Text>{WAREHOUSE_OPTIONS.find(w => w.value === move.warehouseFrom)?.label || move.warehouseFrom || '-'}</Text>
                              <PiArrowRight className="h-3 w-3 text-gray-400" />
                              <Text>{WAREHOUSE_OPTIONS.find(w => w.value === move.warehouseTo)?.label || move.warehouseTo || '-'}</Text>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{move.sourceDocument || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge color={move.status === 'done' ? 'success' : move.status === 'draft' ? 'secondary' : 'danger'}>
                            {move.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Reordering Rules Tab */}
      {activeTab === 'rules' && (
        <motion.div variants={fieldStaggerVariants} className="space-y-6">
          <div className="flex items-center justify-between">
            <Text className="font-semibold">Reordering Rules</Text>
            <Button onClick={() => setShowRuleModal(true)}>
              <PiPlus className="mr-1 h-4 w-4" /> Add Rule
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Warehouse</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Min Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Max Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Multiple</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Lead Time</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Active</th>
                </tr>
              </thead>
              <tbody>
                {reorderingRules.map((rule) => (
                  <tr key={rule.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 font-medium">{rule.warehouseName}</td>
                    <td className="px-4 py-3 text-sm">{rule.locationId}</td>
                    <td className="px-4 py-3 text-right">{rule.minQuantity}</td>
                    <td className="px-4 py-3 text-right">{rule.maxQuantity}</td>
                    <td className="px-4 py-3 text-right">{rule.quantityMultiple}</td>
                    <td className="px-4 py-3 text-right">{rule.leadTime} days</td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={rule.active ? 'success' : 'secondary'}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <motion.div variants={fieldStaggerVariants} className="space-y-6">
          <Text className="mb-4 text-lg font-semibold">Stock Alerts</Text>
          
          {/* Alert Status Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`rounded-xl border p-5 ${finalAvailableStock <= lowStockThreshold && finalAvailableStock > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${finalAvailableStock <= lowStockThreshold && finalAvailableStock > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <PiWarning className={`h-5 w-5 ${finalAvailableStock <= lowStockThreshold && finalAvailableStock > 0 ? 'text-amber-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <Text className="font-medium">Low Stock Alert</Text>
                  <Text className="text-sm text-gray-500">
                    {finalAvailableStock <= lowStockThreshold && finalAvailableStock > 0 ? `Below threshold (${finalAvailableStock}/${lowStockThreshold})` : 'Stock levels OK'}
                  </Text>
                </div>
              </div>
            </div>
            
            <div className={`rounded-xl border p-5 ${finalAvailableStock === 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${finalAvailableStock === 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <PiCube className={`h-5 w-5 ${finalAvailableStock === 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <Text className="font-medium">Out of Stock</Text>
                  <Text className="text-sm text-gray-500">
                    {finalAvailableStock === 0 ? 'No stock available' : 'Stock available'}
                  </Text>
                </div>
              </div>
            </div>
            
            <div className={`rounded-xl border p-5 ${finalAvailableStock <= reorderPoint ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${finalAvailableStock <= reorderPoint ? 'bg-blue-100' : 'bg-green-100'}`}>
                  <PiArrowCounterClockwise className={`h-5 w-5 ${finalAvailableStock <= reorderPoint ? 'text-blue-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <Text className="font-medium">Reorder Alert</Text>
                  <Text className="text-sm text-gray-500">
                    {finalAvailableStock <= reorderPoint ? `Below reorder point (${reorderPoint})` : 'Reorder level OK'}
                  </Text>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Configuration */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Alert Settings</Text>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">Low Stock Alerts</Text>
                    <Text className="text-xs text-gray-500">Notify when stock falls below threshold</Text>
                  </div>
                  <Switch checked={alertSettings.lowStockEnabled} onChange={(checked) => setAlertSettings(prev => ({ ...prev, lowStockEnabled: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">Out of Stock Alerts</Text>
                    <Text className="text-xs text-gray-500">Notify when stock reaches zero</Text>
                  </div>
                  <Switch checked={alertSettings.outOfStockEnabled} onChange={(checked) => setAlertSettings(prev => ({ ...prev, outOfStockEnabled: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">Reorder Point Alerts</Text>
                    <Text className="text-xs text-gray-500">Notify when reorder point is reached</Text>
                  </div>
                  <Switch checked={alertSettings.reorderEnabled} onChange={(checked) => setAlertSettings(prev => ({ ...prev, reorderEnabled: checked }))} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">Email Notifications</Text>
                    <Text className="text-xs text-gray-500">Receive alerts via email</Text>
                  </div>
                  <Switch checked={alertSettings.emailNotifications} onChange={(checked) => setAlertSettings(prev => ({ ...prev, emailNotifications: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">In-App Notifications</Text>
                    <Text className="text-xs text-gray-500">Show alerts in the dashboard</Text>
                  </div>
                  <Switch checked={alertSettings.inAppNotifications} onChange={(checked) => setAlertSettings(prev => ({ ...prev, inAppNotifications: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">SMS Notifications</Text>
                    <Text className="text-xs text-gray-500">Receive alerts via SMS</Text>
                  </div>
                  <Switch checked={alertSettings.smsNotifications} onChange={(checked) => setAlertSettings(prev => ({ ...prev, smsNotifications: checked }))} />
                </div>
              </div>
            </div>
            {alertSettings.emailNotifications && (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notification Emails</label>
                <Input placeholder="email@example.com, another@example.com" value={alertSettings.notifyEmails} onChange={(e) => setAlertSettings(prev => ({ ...prev, notifyEmails: e.target.value }))} className="w-full md:w-96" />
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Alert Frequency</label>
              <select value={alertSettings.alertFrequency} onChange={(e) => setAlertSettings(prev => ({ ...prev, alertFrequency: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 md:w-64">
                <option value="immediate">Immediate</option>
                <option value="hourly">Hourly Digest</option>
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Summary</option>
              </select>
            </div>
          </div>

          {/* Forecast Settings */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Stock Forecasting</Text>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Estimated Daily Sales Rate</label>
                <Input type="number" min="0" value={dailySalesRateInput} onChange={(e) => setDailySalesRateInput(parseInt(e.target.value) || 0)} className="w-full md:w-48" />
                <Text className="mt-1 text-xs text-gray-500">Average units sold per day</Text>
              </div>
              <div className="flex-1">
                <Text className="mb-1.5 block text-sm font-medium text-gray-700">Days Until Stockout</Text>
                <Text className={`text-lg font-bold ${daysUntilStockout < 7 ? 'text-red-600' : daysUntilStockout < 30 ? 'text-amber-600' : 'text-green-600'}`}>
                  {daysUntilStockout === Infinity ? '∞' : daysUntilStockout} days
                </Text>
              </div>
              <div className="flex-1">
                <Text className="mb-1.5 block text-sm font-medium text-gray-700">Recommended Order</Text>
                <Text className="text-lg font-bold text-blue-600">{recommendedOrderQty} units</Text>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <motion.div variants={fieldStaggerVariants} className="space-y-6">
          {/* Inventory Tracking */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Inventory Tracking</Text>
            <Controller
              name="subProductData.tracking"
              control={control}
              render={({ field: { onChange, value } }) => (
                <div className="grid gap-4 md:grid-cols-3">
                  {TRACKING_OPTIONS.map((option) => {
                    const IconComponent = getTrackingIcon(option.iconName);
                    return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChange(option.value)}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${value === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className={`h-6 w-6 ${value === option.value ? 'text-blue-600' : 'text-gray-500'}`} />
                        <Text className="font-medium">{option.label}</Text>
                      </div>
                      <Text className="mt-1 text-xs text-gray-500">{option.description}</Text>
                    </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* Product Routes */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Product Routes</Text>
            <div className="grid gap-4 md:grid-cols-2">
              {ROUTE_OPTIONS.map((route) => {
                  const IconComponent = getRouteIcon(route.iconName);
                  return (
                  <button
                    key={route.value}
                    type="button"
                    onClick={() => toggleRoute(route.value)}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${(routes || []).includes(route.value) ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={`h-6 w-6 ${(routes || []).includes(route.value) ? 'text-green-600' : 'text-gray-500'}`} />
                      <Text className="font-medium">{route.label}</Text>
                    </div>
                    <Text className="mt-1 text-xs text-gray-500">{route.description}</Text>
                  </button>
                  );
                })}
            </div>
          </div>

          {/* Valuation */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Inventory Valuation</Text>
            <Controller
              name="subProductData.valuation"
              control={control}
              render={({ field: { onChange, value } }) => (
                <div className="grid gap-4 md:grid-cols-3">
                  {VALUATION_METHODS.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => onChange(method.value)}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${value === method.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <Text className="font-medium">{method.label}</Text>
                      <Text className="mt-1 text-xs text-gray-500">{method.description}</Text>
                    </button>
                  ))}
                </div>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <Input type="number" label="Standard Price" value={standardPrice || costPrice} onChange={(e) => setValue?.('subProductData.standardPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" />
              <Input type="text" label="Costing Method" value={valuation?.toUpperCase() || 'FIFO'} disabled />
            </div>
          </div>
        </motion.div>
      )}

      {/* Stock Adjustment Modal */}
      <AnimatePresence>
        {showAdjustmentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdjustmentModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${adjustmentType === 'add' ? 'bg-green-100' : adjustmentType === 'remove' ? 'bg-red-100' : 'bg-blue-100'}`}>
                    {adjustmentType === 'add' && <PiPlus className="h-6 w-6 text-green-600" />}
                    {adjustmentType === 'remove' && <PiMinus className="h-6 w-6 text-red-600" />}
                    {adjustmentType === 'set' && <PiPencil className="h-6 w-6 text-blue-600" />}
                  </div>
                  <div>
                    <Text className="text-xl font-bold">
                      {adjustmentType === 'add' && 'Add Stock'}
                      {adjustmentType === 'remove' && 'Remove Stock'}
                      {adjustmentType === 'set' && 'Set Stock'}
                    </Text>
                    {hasSizeVariants && selectedSize ? (
                      <Text className="text-sm text-gray-500">
                        {sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize}: {currentSizeStock} units
                      </Text>
                    ) : (
                      <Text className="text-sm text-gray-500">Current: {totalStock} units</Text>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setShowAdjustmentModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Size Variant Selector */}
                {hasSizeVariants && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Size Variant</label>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s: any) => (
                        <button
                          key={s?.size}
                          type="button"
                          onClick={() => setSelectedSize(s?.size)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            selectedSize === s?.size 
                              ? 'bg-purple-600 text-white shadow-md' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {s?.label || s?.size} ({sizeStockMap[s?.size] || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {adjustmentType === 'set' ? 'New Stock Level' : 'Quantity'}
                    {hasSizeVariants && selectedSize && <span className="ml-1 text-purple-600">({sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize})</span>}
                  </label>
                  <Input 
                    type="number" 
                    min="0" 
                    max={adjustmentType === 'remove' ? currentSizeStock : undefined}
                    value={adjustmentQuantity} 
                    onChange={(e) => setAdjustmentQuantity(parseInt(e.target.value) || 0)} 
                    placeholder="Enter quantity" 
                    className="text-lg" 
                    autoFocus 
                  />
                  {adjustmentQuantity > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Text className="text-sm text-gray-500">
                        New stock: 
                      </Text>
                      <Badge color={adjustmentType === 'add' ? 'success' : adjustmentType === 'remove' ? 'warning' : 'info'}>
                        {adjustmentType === 'add' ? currentSizeStock + adjustmentQuantity : adjustmentType === 'remove' ? Math.max(0, currentSizeStock - adjustmentQuantity) : adjustmentQuantity} units
                      </Badge>
                      {hasSizeVariants && (
                        <Text className="text-xs text-gray-400">
                          (Total: {adjustmentType === 'add' ? totalStock + adjustmentQuantity : adjustmentType === 'remove' ? Math.max(0, totalStock - adjustmentQuantity) : adjustmentQuantity})
                        </Text>
                      )}
                    </div>
                  )}
                  {adjustmentType === 'remove' && adjustmentQuantity > currentSizeStock && (
                    <Text className="mt-1 text-xs text-red-500">Cannot remove more than current stock ({currentSizeStock})</Text>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Reason *</label>
                  <select value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" required>
                    <option value="">Select a reason...</option>
                    {REASON_OPTIONS[adjustmentType].map((opt) => (<option key={opt.value} value={opt.label}>{opt.label}</option>))}
                  </select>
                </div>

                {/* Quick Quantity Buttons */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Quick Select</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAdjustmentQuantity(amt)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          adjustmentQuantity === amt 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <Textarea value={adjustmentNotes} onChange={(e) => setAdjustmentNotes(e.target.value)} placeholder="Additional details..." rows={2} />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowAdjustmentModal(false)} className="flex-1">Cancel</Button>
                <Button 
                  type="button" 
                  onClick={submitAdjustment} 
                  disabled={adjustmentQuantity <= 0 || !adjustmentReason || (adjustmentType === 'remove' && adjustmentQuantity > currentSizeStock)} 
                  className="flex-1"
                >
                  Confirm {adjustmentType === 'add' ? 'Add' : adjustmentType === 'remove' ? 'Remove' : 'Set'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server-side Inventory Adjustment Modal */}
      <AnimatePresence>
        {showServerAdjustmentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowServerAdjustmentModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <Text className="text-xl font-bold">Record Stock Movement</Text>
                  <Text className="text-sm text-gray-500">Record inventory changes in the system</Text>
                </div>
                <button type="button" onClick={() => setShowServerAdjustmentModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><PiX className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                {/* Movement Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Movement Type</label>
                  <select
                    value={serverAdjustmentType}
                    onChange={(e) => setServerAdjustmentType(e.target.value as typeof serverAdjustmentType)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  >
                    <option value="received">Received (Stock In)</option>
                    <option value="adjustment_in">Adjustment In</option>
                    <option value="adjustment_out">Adjustment Out</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Quantity</label>
                  <Input
                    type="number"
                    min={1}
                    value={serverAdjustmentQuantity}
                    onChange={(e) => setServerAdjustmentQuantity(Number(e.target.value))}
                    placeholder="Enter quantity"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Reason</label>
                  <Input
                    value={serverAdjustmentReason}
                    onChange={(e) => setServerAdjustmentReason(e.target.value)}
                    placeholder="e.g., Restock, Damaged, Inventory count"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <Textarea
                    value={serverAdjustmentNotes}
                    onChange={(e) => setServerAdjustmentNotes(e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowServerAdjustmentModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={handleServerAdjustment} 
                  disabled={serverAdjustmentQuantity <= 0 || !serverAdjustmentReason}
                  className="flex-1"
                >
                  Record Movement
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Modal */}
      <AnimatePresence>
        {showBatchModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBatchModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <Text className="text-xl font-bold">Batch Stock Operations</Text>
                  <Text className="text-sm text-gray-500">Process multiple stock adjustments at once</Text>
                </div>
                <button type="button" onClick={() => setShowBatchModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><PiX className="h-5 w-5" /></button>
              </div>

              {/* Size Variant Selector for Batch */}
              {hasSizeVariants && (
                <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                  <label className="mb-2 block text-sm font-medium text-purple-700">Apply to Size</label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s: any) => (
                      <button
                        key={s?.size}
                        type="button"
                        onClick={() => setSelectedSize(s?.size)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                          selectedSize === s?.size 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        {s?.label || s?.size} ({sizeStockMap[s?.size] || 0})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 mb-2 px-3 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-6">Reason</div>
                <div className="col-span-2">Actions</div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {batchOperations.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">No operations added. Click "Add Operation" to begin.</div>
                ) : (
                  batchOperations.map((op, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <div className="col-span-2">
                        <select 
                          value={op.type} 
                          onChange={(e) => updateBatchOperation(index, 'type', e.target.value)} 
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="add">Add</option>
                          <option value="remove">Remove</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="Qty" 
                          value={op.quantity} 
                          onChange={(e) => updateBatchOperation(index, 'quantity', parseInt(e.target.value) || 0)} 
                          className="w-full"
                        />
                      </div>
                      <div className="col-span-6">
                        <input 
                          type="text" 
                          placeholder="Reason" 
                          value={op.reason} 
                          onChange={(e) => updateBatchOperation(index, 'reason', e.target.value)} 
                          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" 
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button 
                          type="button" 
                          onClick={() => removeBatchOperation(index)} 
                          className="text-red-500 hover:bg-red-50 p-2 rounded"
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={addBatchOperation}>
                  <PiPlus className="mr-1 h-4 w-4" /> Add Operation
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    const qty = hasSizeVariants && selectedSize ? (sizeStockMap[selectedSize] || 0) : totalStock;
                    setBatchOperations([...batchOperations, { type: 'add', quantity: qty, reason: 'New Shipment Received' }]);
                  }}
                >
                  <PiArrowCounterClockwise className="mr-1 h-4 w-4" /> Fill Current Stock
                </Button>
              </div>

              {/* Summary */}
              {batchOperations.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <Text className="text-sm font-medium text-blue-700">Operations Summary:</Text>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Adds:</span>{' '}
                      <span className="font-bold text-green-600">
                        {batchOperations.filter(o => o.type === 'add').reduce((sum, o) => sum + (o.quantity || 0), 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Removes:</span>{' '}
                      <span className="font-bold text-red-600">
                        {batchOperations.filter(o => o.type === 'remove').reduce((sum, o) => sum + (o.quantity || 0), 0)}
                      </span>
                    </div>
                    {hasSizeVariants && selectedSize && (
                      <div>
                        <span className="text-gray-600">Target Size:</span>{' '}
                        <span className="font-bold text-purple-600">
                          {sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowBatchModal(false)} className="flex-1">Cancel</Button>
                <Button 
                  type="button" 
                  onClick={processBatchOperations} 
                  disabled={batchOperations.length === 0 || batchOperations.every(o => !o.quantity || !o.reason)} 
                  className="flex-1"
                >
                  Process All ({batchOperations.length})
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTransferModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                    <PiArrowsLeftRight className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <Text className="text-xl font-bold">Transfer Stock</Text>
                    <Text className="text-sm text-gray-500">Move stock between locations</Text>
                  </div>
                </div>
                <button type="button" onClick={() => setShowTransferModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><PiX className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                {/* Size Variant Selector for Transfer */}
                {hasSizeVariants && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Size Variant</label>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s: any) => (
                        <button
                          key={s?.size}
                          type="button"
                          onClick={() => setSelectedSize(s?.size)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            selectedSize === s?.size 
                              ? 'bg-purple-600 text-white shadow-md' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {s?.label || s?.size} ({sizeStockMap[s?.size] || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Transfer Quantity *
                    {hasSizeVariants && selectedSize && <span className="ml-1 text-purple-600">({sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize})</span>}
                  </label>
                  <Input 
                    type="number" 
                    min="1" 
                    max={hasSizeVariants && selectedSize ? currentSizeStock : finalAvailableStock} 
                    value={transferQuantity} 
                    onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 0)} 
                    placeholder="Enter quantity to transfer" 
                    className="text-lg" 
                  />
                  <Text className="mt-1 text-xs text-gray-500">
                    Available: {hasSizeVariants && selectedSize ? currentSizeStock : finalAvailableStock} units
                  </Text>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">From Warehouse *</label>
                    <div className="space-y-2">
                      <select value={transferFromWarehouse} onChange={(e) => setTransferFromWarehouse(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
                        <option value="">Select source warehouse...</option>
                        {WAREHOUSE_OPTIONS.map(wh => (
                          <option key={wh.value} value={wh.value}>
                            {wh.label} {wh.isDefault && '(Default)'}
                          </option>
                        ))}
                      </select>
                      {transferFromWarehouse && (
                        <Text className="text-xs text-gray-500">
                          {WAREHOUSE_OPTIONS.find(w => w.value === transferFromWarehouse)?.address}
                        </Text>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">To Warehouse *</label>
                    <div className="space-y-2">
                      <select value={transferToWarehouse} onChange={(e) => setTransferToWarehouse(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
                        <option value="">Select destination warehouse...</option>
                        {WAREHOUSE_OPTIONS.map(wh => (
                          <option key={wh.value} value={wh.value} disabled={wh.value === transferFromWarehouse}>
                            {wh.label} {wh.isDefault && '(Default)'}
                          </option>
                        ))}
                      </select>
                      {transferToWarehouse && (
                        <Text className="text-xs text-gray-500">
                          {WAREHOUSE_OPTIONS.find(w => w.value === transferToWarehouse)?.address}
                        </Text>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <Textarea value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} placeholder="Transfer notes..." rows={2} />
                </div>

                {/* Transfer Preview */}
                <div className="rounded-lg bg-purple-50 p-4 border border-purple-200">
                  <Text className="text-sm font-medium text-purple-700 mb-2">Transfer Preview</Text>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <Text className="text-xs text-gray-500">From</Text>
                      <Text className="font-medium">{WAREHOUSE_OPTIONS.find(w => w.value === transferFromWarehouse)?.label || '-'}</Text>
                      <Text className="text-xs text-purple-500">{WAREHOUSE_OPTIONS.find(w => w.value === transferFromWarehouse)?.address}</Text>
                    </div>
                    <div className="flex items-center justify-center">
                      <PiArrowRight className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-center">
                      <Text className="text-xs text-gray-500">To</Text>
                      <Text className="font-medium">{WAREHOUSE_OPTIONS.find(w => w.value === transferToWarehouse)?.label || '-'}</Text>
                      <Text className="text-xs text-purple-500">{WAREHOUSE_OPTIONS.find(w => w.value === transferToWarehouse)?.address}</Text>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-purple-200 text-center">
                    <Text className="text-purple-700">
                      <strong>{transferQuantity || 0}</strong> units
                      {hasSizeVariants && selectedSize && (
                        <span className="text-purple-500"> ({sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize})</span>
                      )}
                    </Text>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)} className="flex-1">Cancel</Button>
                <Button type="button" onClick={() => {
                  const qty = transferQuantity;
                  const fromWarehouse = WAREHOUSE_OPTIONS.find(w => w.value === transferFromWarehouse);
                  const toWarehouse = WAREHOUSE_OPTIONS.find(w => w.value === transferToWarehouse);
                  const fromLocName = fromWarehouse?.label || transferFromWarehouse;
                  const toLocName = toWarehouse?.label || transferToWarehouse;
                  const transferRef = `TRF/${Date.now().toString().slice(-6)}`;
                  
                  if (qty > 0 && transferFromWarehouse && transferToWarehouse && transferFromWarehouse !== transferToWarehouse) {
                    if (hasSizeVariants && selectedSize) {
                      const currentSizeStockVal = sizeStockMap[selectedSize] || 0;
                      const newSizeStock = Math.max(0, currentSizeStockVal - qty);
                      const newTotal = Math.max(0, totalStock - qty);
                      
                      const updatedSizes = sizes.map((s: any) => 
                        s?.size === selectedSize ? { ...s, stockQuantity: newSizeStock } : s
                      );
                      setValue?.('subProductData.sizes', updatedSizes);
                      setValue?.('subProductData.totalStock', newTotal);
                      
                      addToHistory('transfer', qty, currentSizeStockVal, newSizeStock, 
                        `Transfer: ${fromLocName} → ${toLocName}`, 
                        transferNotes || `Transferred ${qty} units from ${fromLocName} to ${toLocName}`, 
                        { 
                          transferId: Date.now().toString(),
                          transferReference: transferRef,
                          fromLocationName: fromLocName,
                          toLocationName: toLocName,
                          transferNotes: transferNotes,
                          sizeVariant: selectedSize, 
                          sizeLabel: sizes.find((s: any) => s?.size === selectedSize)?.label 
                        }
                      );
                    } else {
                      const newTotal = Math.max(0, totalStock - qty);
                      setValue?.('subProductData.totalStock', newTotal);
                      
                      addToHistory('transfer', qty, totalStock, newTotal, 
                        `Transfer: ${fromLocName} → ${toLocName}`, 
                        transferNotes || `Transferred ${qty} units from ${fromLocName} to ${toLocName}`, 
                        { 
                          transferId: Date.now().toString(),
                          transferReference: transferRef,
                          fromLocationName: fromLocName,
                          toLocationName: toLocName,
                          transferNotes: transferNotes,
                        }
                      );
                    }
                    setShowTransferModal(false);
                    setTransferQuantity(0);
                    setTransferFromWarehouse('');
                    setTransferToWarehouse('');
                    setTransferNotes('');
                  }
                }} disabled={transferQuantity <= 0 || !transferFromWarehouse || !transferToWarehouse || transferFromWarehouse === transferToWarehouse} className="flex-1">Confirm Transfer</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Move Modal */}
      <AnimatePresence>
        {showMoveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowMoveModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${moveForm.type === 'incoming' ? 'bg-green-100' : moveForm.type === 'outgoing' ? 'bg-red-100' : moveForm.type === 'internal' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                    {moveForm.type === 'incoming' && <PiArrowsDownUp className="h-6 w-6 text-green-600 rotate-180" />}
                    {moveForm.type === 'outgoing' && <PiArrowsDownUp className="h-6 w-6 text-red-600" />}
                    {moveForm.type === 'internal' && <PiArrowsLeftRight className="h-6 w-6 text-blue-600" />}
                    {moveForm.type === 'adjustment' && <PiPencil className="h-6 w-6 text-amber-600" />}
                  </div>
                  <div>
                    <Text className="text-xl font-bold">New {moveForm.type === 'incoming' ? 'Receipt' : moveForm.type === 'outgoing' ? 'Delivery' : moveForm.type === 'internal' ? 'Transfer' : 'Adjustment'}</Text>
                    <Text className="text-sm text-gray-500">Current stock: {totalStock}</Text>
                  </div>
                </div>
                <button type="button" onClick={() => setShowMoveModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><PiX className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                {/* Size Variant Selector */}
                {hasSizeVariants && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Size Variant</label>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s: any) => (
                        <button
                          key={s?.size}
                          type="button"
                          onClick={() => setSelectedSize(s?.size)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            selectedSize === s?.size 
                              ? 'bg-purple-600 text-white shadow-md' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {s?.label || s?.size} ({sizeStockMap[s?.size] || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Move Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {STOCK_MOVE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setMoveForm(prev => ({ ...prev, type: type.value as StockMove['type'] }))}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          moveForm.type === type.value
                            ? type.value === 'incoming' ? 'bg-green-100 text-green-700 border-2 border-green-300' :
                              type.value === 'outgoing' ? 'bg-red-100 text-red-700 border-2 border-red-300' :
                              type.value === 'internal' ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' :
                              'bg-amber-100 text-amber-700 border-2 border-amber-300'
                            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Quantity 
                    {hasSizeVariants && selectedSize && <span className="ml-1 text-purple-600">({sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize})</span>}
                  </label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={moveForm.quantity} 
                    onChange={(e) => setMoveForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} 
                    placeholder="Enter quantity" 
                    className="text-lg" 
                  />
                </div>

                {/* Source Warehouse */}
                {(moveForm.type === 'incoming' || moveForm.type === 'internal') && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Source Warehouse</label>
                    <select 
                      value={moveForm.warehouseFrom} 
                      onChange={(e) => setMoveForm(prev => ({ ...prev, warehouseFrom: e.target.value }))} 
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      <option value="">Select source warehouse...</option>
                      {WAREHOUSE_OPTIONS.map(wh => (
                        <option key={wh.value} value={wh.value}>
                          {wh.label} {wh.isDefault && '(Default)'}
                        </option>
                      ))}
                    </select>
                    {moveForm.warehouseFrom && (
                      <Text className="text-xs text-gray-500 mt-1">
                        {WAREHOUSE_OPTIONS.find(w => w.value === moveForm.warehouseFrom)?.address}
                      </Text>
                    )}
                  </div>
                )}

                {/* Destination Warehouse */}
                {(moveForm.type === 'outgoing' || moveForm.type === 'internal') && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Destination Warehouse</label>
                    <select 
                      value={moveForm.warehouseTo} 
                      onChange={(e) => setMoveForm(prev => ({ ...prev, warehouseTo: e.target.value }))} 
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      <option value="">Select destination warehouse...</option>
                      {WAREHOUSE_OPTIONS.map(wh => (
                        <option key={wh.value} value={wh.value} disabled={wh.value === moveForm.warehouseFrom}>
                          {wh.label} {wh.isDefault && '(Default)'}
                        </option>
                      ))}
                    </select>
                    {moveForm.warehouseTo && (
                      <Text className="text-xs text-gray-500 mt-1">
                        {WAREHOUSE_OPTIONS.find(w => w.value === moveForm.warehouseTo)?.address}
                      </Text>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Reference</label>
                    <Input 
                      value={moveForm.reference} 
                      onChange={(e) => setMoveForm(prev => ({ ...prev, reference: e.target.value }))} 
                      placeholder="e.g., PO/2024/001" 
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Source Document</label>
                    <Input 
                      value={moveForm.sourceDocument} 
                      onChange={(e) => setMoveForm(prev => ({ ...prev, sourceDocument: e.target.value }))} 
                      placeholder="e.g., Purchase Order" 
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Notes</label>
                  <Textarea 
                    value={moveForm.notes} 
                    onChange={(e) => setMoveForm(prev => ({ ...prev, notes: e.target.value }))} 
                    placeholder="Additional notes..." 
                    rows={2} 
                  />
                </div>

                {/* Preview */}
                {moveForm.quantity > 0 && (
                  <div className={`p-4 rounded-xl ${
                    moveForm.type === 'incoming' ? 'bg-green-50 border border-green-200' :
                    moveForm.type === 'outgoing' ? 'bg-red-50 border border-red-200' :
                    moveForm.type === 'internal' ? 'bg-blue-50 border border-blue-200' :
                    'bg-amber-50 border border-amber-200'
                  }`}>
                    <Text className={`text-sm font-medium ${
                      moveForm.type === 'incoming' ? 'text-green-700' :
                      moveForm.type === 'outgoing' ? 'text-red-700' :
                      moveForm.type === 'internal' ? 'text-blue-700' :
                      'text-amber-700'
                    }`}>
                      {moveForm.type === 'incoming' && `Receipt: +${moveForm.quantity} units`}
                      {moveForm.type === 'outgoing' && `Delivery: -${moveForm.quantity} units`}
                      {moveForm.type === 'internal' && `Transfer: ${moveForm.quantity} units`}
                      {moveForm.type === 'adjustment' && `Adjustment: ${moveForm.quantity} units`}
                      {hasSizeVariants && selectedSize && <span className="ml-1">({sizes.find((s: any) => s?.size === selectedSize)?.label || selectedSize})</span>}
                    </Text>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowMoveModal(false)} className="flex-1">Cancel</Button>
                <Button type="button" onClick={handleAddStockMove} disabled={moveForm.quantity <= 0} className="flex-1">Confirm Move</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reordering Rule Modal */}
      <AnimatePresence>
        {showRuleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRuleModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                    <PiRecycle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <Text className="text-xl font-bold">New Reordering Rule</Text>
                    <Text className="text-sm text-gray-500">Configure automatic replenishment</Text>
                  </div>
                </div>
                <button type="button" onClick={() => setShowRuleModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><PiX className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Warehouse</label>
                    <select value={ruleForm.warehouseId} onChange={(e) => setRuleForm(prev => ({ ...prev, warehouseId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
                      {LOCATION_OPTIONS.filter(l => l.type === 'internal').map(loc => (<option key={loc.value} value={loc.value}>{loc.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Location</label>
                    <select value={ruleForm.locationId} onChange={(e) => setRuleForm(prev => ({ ...prev, locationId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
                      {LOCATION_OPTIONS.map(loc => (<option key={loc.value} value={loc.value}>{loc.label}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Min Quantity</label>
                    <Input type="number" min="0" value={ruleForm.minQuantity} onChange={(e) => setRuleForm(prev => ({ ...prev, minQuantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Max Quantity</label>
                    <Input type="number" min="0" value={ruleForm.maxQuantity} onChange={(e) => setRuleForm(prev => ({ ...prev, maxQuantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Qty Multiple</label>
                    <Input type="number" min="1" value={ruleForm.quantityMultiple} onChange={(e) => setRuleForm(prev => ({ ...prev, quantityMultiple: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Lead Time (days)</label>
                    <Input type="number" min="1" value={ruleForm.leadTime} onChange={(e) => setRuleForm(prev => ({ ...prev, leadTime: parseInt(e.target.value) || 1 }))} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowRuleModal(false)} className="flex-1">Cancel</Button>
                <Button type="button" onClick={handleAddRule} disabled={ruleForm.minQuantity >= ruleForm.maxQuantity} className="flex-1">Create Rule</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Detail Modal - Odoo Style */}
      <AnimatePresence>
        {selectedHistoryItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedHistoryItem(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    selectedHistoryItem.status === 'done' ? 'bg-green-100 text-green-700' :
                    selectedHistoryItem.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                    selectedHistoryItem.status === 'waiting' ? 'bg-amber-100 text-amber-700' :
                    selectedHistoryItem.status === 'pending' ? 'bg-purple-100 text-purple-700' :
                    selectedHistoryItem.status === 'cancel' ? 'bg-red-100 text-red-700' :
                    selectedHistoryItem.status === 'returned' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedHistoryItem.status === 'done' && <PiCheck className="mr-1 h-4 w-4" />}
                    {selectedHistoryItem.status === 'done' && 'Done'}
                    {selectedHistoryItem.status === 'ready' && 'Ready'}
                    {selectedHistoryItem.status === 'waiting' && 'Waiting'}
                    {selectedHistoryItem.status === 'pending' && 'Pending'}
                    {selectedHistoryItem.status === 'draft' && 'Draft'}
                    {selectedHistoryItem.status === 'cancel' && 'Cancelled'}
                    {selectedHistoryItem.status === 'returned' && 'Returned'}
                  </span>
                  <Text className="text-xl font-bold font-mono text-blue-600">
                    {selectedHistoryItem.reference || `WH/${selectedHistoryItem.operationType?.slice(0,3).toUpperCase() || 'MOV'}/${selectedHistoryItem.id.slice(-5)}`}
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <PiPrinter className="mr-1 h-4 w-4" /> Print
                  </Button>
                  <button type="button" onClick={() => setSelectedHistoryItem(null)} className="rounded-lg p-2 hover:bg-gray-200">
                    <PiX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Main Info */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Operation Info */}
                    <div className="rounded-xl border border-gray-200 p-4">
                      <Text className="font-semibold mb-4">Operation</Text>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Text className="text-xs text-gray-500 uppercase">Date</Text>
                          <Text className="font-medium">{selectedHistoryItem.timestamp.toLocaleDateString()}</Text>
                          <Text className="text-sm text-gray-500">{selectedHistoryItem.timestamp.toLocaleTimeString()}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500 uppercase">Operation Type</Text>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedHistoryItem.type === 'add' || selectedHistoryItem.operationType === 'receipt' ? (
                              <PiArrowsDownUp className="h-5 w-5 text-green-600 rotate-180" />
                            ) : selectedHistoryItem.type === 'remove' || selectedHistoryItem.operationType === 'delivery' ? (
                              <PiArrowsDownUp className="h-5 w-5 text-red-600" />
                            ) : selectedHistoryItem.operationType === 'transfer' ? (
                              <PiArrowsLeftRight className="h-5 w-5 text-blue-600" />
                            ) : (
                              <PiPencil className="h-5 w-5 text-amber-600" />
                            )}
                            <Text className="font-medium">
                              {selectedHistoryItem.operationType === 'receipt' && 'Receipt'}
                              {selectedHistoryItem.operationType === 'delivery' && 'Delivery'}
                              {selectedHistoryItem.operationType === 'transfer' && 'Internal Transfer'}
                              {selectedHistoryItem.operationType === 'adjustment' && 'Inventory Adjustment'}
                              {selectedHistoryItem.operationType === 'return' && 'Return'}
                              {selectedHistoryItem.operationType === 'pos_order' && 'PoS Order'}
                              {!selectedHistoryItem.operationType && (selectedHistoryItem.type === 'add' ? 'Receipt' : selectedHistoryItem.type === 'remove' ? 'Delivery' : selectedHistoryItem.type === 'transfer' ? 'Internal Transfer' : 'Adjustment')}
                            </Text>
                          </div>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500 uppercase">Source Document</Text>
                          <Text className="font-medium text-blue-600">{selectedHistoryItem.sourceDocument || `Shop/${selectedHistoryItem.id.slice(-3)}`}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500 uppercase">Partner</Text>
                          <Text className="font-medium">{selectedHistoryItem.partnerName || '-'}</Text>
                        </div>
                      </div>
                    </div>

                    {/* From/To Locations */}
                    <div className="rounded-xl border border-gray-200 p-4">
                      <Text className="font-semibold mb-4">Locations</Text>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="rounded-lg bg-gray-50 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <PiArrowRight className="h-4 w-4 text-gray-400 rotate-180" />
                            <Text className="text-sm font-medium text-gray-600">Source Location</Text>
                          </div>
                          <Text className="font-medium">{selectedHistoryItem.fromLocation || (selectedHistoryItem.type === 'add' ? 'Vendors' : 'WH/Stock')}</Text>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <PiArrowRight className="h-4 w-4 text-gray-400" />
                            <Text className="text-sm font-medium text-gray-600">Destination</Text>
                          </div>
                          <Text className="font-medium">{selectedHistoryItem.toLocation || (selectedHistoryItem.type === 'remove' ? 'Customers' : 'WH/Stock')}</Text>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <Text className="font-semibold">Products</Text>
                      </div>
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Demand</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Done</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <PiPackage className="h-4 w-4 text-gray-400" />
                                <Text className="font-medium">{selectedHistoryItem.productName || 'SubProduct'}</Text>
                              </div>
                              {selectedHistoryItem.lotNumber && (
                                <Text className="text-xs text-purple-600">Lot: {selectedHistoryItem.lotNumber}</Text>
                              )}
                              {selectedHistoryItem.serialNumber && (
                                <Text className="text-xs text-blue-600">SN: {selectedHistoryItem.serialNumber}</Text>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{selectedHistoryItem.demand || selectedHistoryItem.quantity}</td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">{selectedHistoryItem.picked || selectedHistoryItem.quantity}</td>
                            <td className="px-4 py-3 text-gray-500">{selectedHistoryItem.unit || 'units'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column - Sidebar */}
                  <div className="space-y-4">
                    {/* Stock Info */}
                    <div className="rounded-xl border border-gray-200 p-4">
                      <Text className="font-semibold mb-4">Stock</Text>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Text className="text-sm text-gray-500">Previous</Text>
                          <Text className="font-medium">{selectedHistoryItem.previousStock}</Text>
                        </div>
                        <div className="flex justify-between">
                          <Text className="text-sm text-gray-500">Change</Text>
                          <Text className={`font-medium ${selectedHistoryItem.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedHistoryItem.type === 'add' ? '+' : '-'}{selectedHistoryItem.quantity}
                          </Text>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <Text className="text-sm font-medium">New</Text>
                          <Text className="font-bold">{selectedHistoryItem.newStock}</Text>
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="rounded-xl border border-gray-200 p-4">
                      <Text className="font-semibold mb-4">Dates</Text>
                      <div className="space-y-3">
                        <div>
                          <Text className="text-xs text-gray-500">Scheduled Date</Text>
                          <Text className="text-sm">{selectedHistoryItem.scheduledDate?.toLocaleDateString() || selectedHistoryItem.timestamp.toLocaleDateString()}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500">Effective Date</Text>
                          <Text className="text-sm">{selectedHistoryItem.effectiveDate?.toLocaleDateString() || selectedHistoryItem.timestamp.toLocaleDateString()}</Text>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="rounded-xl border border-gray-200 p-4">
                      <Text className="font-semibold mb-4">Additional Info</Text>
                      <div className="space-y-3">
                        <div>
                          <Text className="text-xs text-gray-500">Reason</Text>
                          <Text className="text-sm">{selectedHistoryItem.reason}</Text>
                        </div>
                        {selectedHistoryItem.notes && (
                          <div>
                            <Text className="text-xs text-gray-500">Notes</Text>
                            <Text className="text-sm">{selectedHistoryItem.notes}</Text>
                          </div>
                        )}
                        {selectedHistoryItem.packaging && (
                          <div>
                            <Text className="text-xs text-gray-500">Packaging</Text>
                            <Text className="text-sm">{selectedHistoryItem.packaging}</Text>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {selectedHistoryItem.canUndo && selectedHistoryItem.type !== 'set' && selectedHistoryItem.status !== 'cancel' && (
                      <Button 
                        variant="outline" 
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => {
                          if (selectedHistoryItem) {
                            setReturnItem(selectedHistoryItem);
                            setReturnReason('');
                            setReturnNotes('');
                            setShowReturnModal(true);
                          }
                        }}
                      >
                        <PiArrowCounterClockwise className="mr-2 h-4 w-4" /> Return / Undo
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm">
                    <PiPrinter className="mr-1 h-4 w-4" /> Print
                  </Button>
                  <Button variant="outline" size="sm">
                    <PiDownload className="mr-1 h-4 w-4" /> Export
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedHistoryItem(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return/Undo Confirmation Modal */}
      <AnimatePresence>
        {showReturnModal && returnItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowReturnModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                    <PiArrowCounterClockwise className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <Text className="text-xl font-bold">Return Stock</Text>
                    <Text className="text-sm text-gray-500">Undo this stock operation</Text>
                  </div>
                </div>
                <button type="button" onClick={() => setShowReturnModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              {/* Original Operation Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <Text className="text-sm font-medium text-gray-500 mb-3">Original Operation</Text>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Text className="text-gray-500">Reference</Text>
                    <Text className="font-medium font-mono text-blue-600">{returnItem.reference || returnItem.transferReference || '-'}</Text>
                  </div>
                  <div>
                    <Text className="text-gray-500">Type</Text>
                    <Text className="font-medium">
                      {returnItem.type === 'add' && 'Receipt'}
                      {returnItem.type === 'remove' && 'Delivery'}
                      {returnItem.type === 'transfer' && 'Transfer'}
                      {returnItem.type === 'set' && 'Adjustment'}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-gray-500">Quantity</Text>
                    <Text className="font-medium">{returnItem.quantity} units</Text>
                  </div>
                  <div>
                    <Text className="text-gray-500">Date</Text>
                    <Text className="font-medium">{returnItem.timestamp.toLocaleDateString()}</Text>
                  </div>
                  {returnItem.sizeVariant && (
                    <div>
                      <Text className="text-gray-500">Size</Text>
                      <Text className="font-medium">{returnItem.sizeLabel || returnItem.sizeVariant}</Text>
                    </div>
                  )}
                </div>
              </div>

              {/* Return Form */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Return Reason *</label>
                  <select 
                    value={returnReason} 
                    onChange={(e) => setReturnReason(e.target.value)} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    required
                  >
                    <option value="">Select a reason...</option>
                    <option value="Duplicate entry">Duplicate entry</option>
                    <option value="Wrong quantity">Wrong quantity</option>
                    <option value="Wrong product">Wrong product</option>
                    <option value="Wrong location">Wrong location</option>
                    <option value="Cancelled order">Cancelled order</option>
                    <option value="Customer return">Customer return</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <Textarea 
                    value={returnNotes} 
                    onChange={(e) => setReturnNotes(e.target.value)} 
                    placeholder="Additional details about this return..." 
                    rows={2} 
                  />
                </div>

                {/* Return Preview */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <Text className="text-sm font-medium text-amber-700 mb-2">Return Summary</Text>
                  <div className="flex items-center justify-between text-sm">
                    <Text className="text-gray-600">
                      {returnItem.type === 'add' ? 'Remove from stock:' : 
                       returnItem.type === 'remove' ? 'Add back to stock:' :
                       returnItem.type === 'transfer' ? 'Reverse transfer:' : 'Adjust stock:'}
                    </Text>
                    <Badge color="warning" className="font-bold">
                      {returnItem.quantity} units
                    </Badge>
                  </div>
                  {returnItem.sizeVariant && (
                    <Text className="text-xs text-amber-600 mt-1">Size: {returnItem.sizeLabel || returnItem.sizeVariant}</Text>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowReturnModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (!returnReason) return;
                    
                    const returnRef = `RTN/${Date.now().toString().slice(-6)}`;
                    const isAdd = returnItem.type === 'add';
                    const isRemove = returnItem.type === 'remove';
                    const isTransfer = returnItem.type === 'transfer';
                    
                    // Calculate new stock
                    let newTotal = totalStock;
                    let newSizeStock = returnItem.previousStock;
                    
                    if (returnItem.sizeVariant && hasSizeVariants) {
                      const currentSizeStockVal = sizeStockMap[returnItem.sizeVariant] || 0;
                      if (isAdd) {
                        newSizeStock = Math.max(0, currentSizeStockVal - returnItem.quantity);
                        newTotal = Math.max(0, totalStock - returnItem.quantity);
                      } else if (isRemove) {
                        newSizeStock = currentSizeStockVal + returnItem.quantity;
                        newTotal = totalStock + returnItem.quantity;
                      } else if (isTransfer) {
                        // For transfer, we reverse the transfer
                        newSizeStock = currentSizeStockVal + returnItem.quantity;
                        newTotal = totalStock + returnItem.quantity;
                      }
                      
                      const updatedSizes = sizes.map((s: any) => 
                        s?.size === returnItem.sizeVariant ? { ...s, stockQuantity: newSizeStock } : s
                      );
                      setValue?.('subProductData.sizes', updatedSizes);
                    } else {
                      if (isAdd) {
                        newTotal = Math.max(0, totalStock - returnItem.quantity);
                      } else if (isRemove) {
                        newTotal = totalStock + returnItem.quantity;
                      } else if (isTransfer) {
                        newTotal = totalStock + returnItem.quantity;
                      }
                    }
                    
                    setValue?.('subProductData.totalStock', newTotal);
                    
                    // Create return history entry
                    const returnAdjustment: StockAdjustment = {
                      id: Date.now().toString(),
                      type: 'return',
                      quantity: returnItem.quantity,
                      previousStock: isAdd ? returnItem.newStock : returnItem.previousStock,
                      newStock: isAdd ? returnItem.previousStock : returnItem.newStock,
                      reason: returnReason,
                      notes: returnNotes || `Returned from: ${returnItem.reference || returnItem.transferReference || 'N/A'}`,
                      timestamp: new Date(),
                      canUndo: false,
                      reference: returnRef,
                      productName: returnItem.productName || 'SubProduct',
                      fromLocation: returnItem.toLocation,
                      toLocation: returnItem.fromLocation,
                      unit: returnItem.unit || 'units',
                      status: 'returned',
                      operationType: 'return',
                      sourceDocument: `Return of ${returnItem.reference || returnItem.transferReference || returnItem.id}`,
                      scheduledDate: new Date(),
                      effectiveDate: new Date(),
                      demand: returnItem.quantity,
                      picked: returnItem.quantity,
                      sizeVariant: returnItem.sizeVariant,
                      sizeLabel: returnItem.sizeLabel,
                      // Return-specific fields
                      returnedById: returnItem.id,
                      returnedByReference: returnItem.reference || returnItem.transferReference,
                      returnedDate: new Date(),
                      returnReason: returnReason,
                    };
                    
                    setAdjustmentHistory(prev => [returnAdjustment, ...prev]);
                    
                    // Mark original as cancelled/returned
                    setAdjustmentHistory(prev => 
                      prev.map(h => h.id === returnItem.id ? { 
                        ...h, 
                        canUndo: false,
                        status: 'cancel' as const
                      } : h)
                    );
                    
                    setShowReturnModal(false);
                    setReturnItem(null);
                    setReturnReason('');
                    setReturnNotes('');
                    setSelectedHistoryItem(null);
                  }} 
                  disabled={!returnReason}
                  className="flex-1"
                >
                  Confirm Return
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Modal - Add/Edit */}
      <AnimatePresence>
        {showLocationModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowLocationModal(false); setEditingLocation(null); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <PiMapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <Text className="text-xl font-bold">{editingLocation ? 'Edit Location' : 'Add Location'}</Text>
                    <Text className="text-sm text-gray-500">{editingLocation ? 'Update location details' : 'Create a new stock location'}</Text>
                  </div>
                </div>
                <button type="button" onClick={() => { setShowLocationModal(false); setEditingLocation(null); }} className="rounded-lg p-2 hover:bg-gray-100">
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Location Name *</label>
                  <Input 
                    value={locationForm.locationName} 
                    onChange={(e) => setLocationForm(prev => ({ ...prev, locationName: e.target.value }))}
                    placeholder="e.g., Main Warehouse, Store Front" 
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Location Type *</label>
                  <select 
                    value={locationForm.locationType}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, locationType: e.target.value as any }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  >
                    <option value="internal">Internal (Warehouse/Store)</option>
                    <option value="production">Production</option>
                    <option value="supplier">Supplier</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Address (Optional)</label>
                  <Textarea 
                    value={locationForm.address} 
                    onChange={(e) => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Location address..." 
                    rows={2}
                  />
                </div>

                {!editingLocation && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Initial Stock</label>
                    <Input 
                      type="number"
                      min="0"
                      value={0}
                      placeholder="0"
                      disabled
                      className="bg-gray-50"
                    />
                    <Text className="text-xs text-gray-500 mt-1">Stock can be adjusted after creation</Text>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowLocationModal(false); setEditingLocation(null); }} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (!locationForm.locationName) return;
                    
                    if (editingLocation) {
                      // Update existing location
                      setInventoryQuants(prev => prev.map(q => 
                        q.id === editingLocation.id 
                          ? { ...q, locationName: locationForm.locationName, locationType: locationForm.locationType, address: locationForm.address }
                          : q
                      ));
                    } else {
                      // Add new location
                      const newLocation: InventoryQuant = {
                        id: Date.now().toString(),
                        locationId: locationForm.locationName.toLowerCase().replace(/\s+/g, '_'),
                        locationName: locationForm.locationName,
                        locationType: locationForm.locationType,
                        address: locationForm.address,
                        quantity: 0,
                        reservedQuantity: 0,
                        availableQuantity: 0,
                        isActive: true,
                      };
                      setInventoryQuants(prev => [...prev, newLocation]);
                    }
                    
                    setShowLocationModal(false);
                    setEditingLocation(null);
                    setLocationForm({ locationName: '', locationType: 'internal', address: '' });
                  }}
                  disabled={!locationForm.locationName}
                  className="flex-1"
                >
                  {editingLocation ? 'Update' : 'Create'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Stock Adjustment Modal */}
      <AnimatePresence>
        {showLocationAdjustModal && adjustLocationQuant && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLocationAdjustModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${locationAdjustType === 'add' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {locationAdjustType === 'add' ? <PiPlus className="h-6 w-6 text-green-600" /> : <PiMinus className="h-6 w-6 text-red-600" />}
                  </div>
                  <div>
                    <Text className="text-xl font-bold">Adjust Stock</Text>
                    <Text className="text-sm text-gray-500">{adjustLocationQuant.locationName}</Text>
                  </div>
                </div>
                <button type="button" onClick={() => setShowLocationAdjustModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              {/* Current Stock */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Text className="text-xs text-gray-500">On Hand</Text>
                    <Text className="text-xl font-bold">{adjustLocationQuant.quantity}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-amber-600">Reserved</Text>
                    <Text className="text-xl font-bold text-amber-600">{adjustLocationQuant.reservedQuantity}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-green-600">Available</Text>
                    <Text className="text-xl font-bold text-green-600">{adjustLocationQuant.availableQuantity}</Text>
                  </div>
                </div>
              </div>

              {/* Size Variant Selector */}
              {hasSizeVariants && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Size Variant</label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s: any) => (
                      <button
                        key={s?.size}
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        {s?.label || s?.size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Operation</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLocationAdjustType('add')}
                      className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                        locationAdjustType === 'add' 
                          ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <PiPlus className="inline mr-1 h-4 w-4" /> Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationAdjustType('remove')}
                      className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                        locationAdjustType === 'remove' 
                          ? 'bg-red-100 text-red-700 border-2 border-red-300' 
                          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <PiMinus className="inline mr-1 h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Quantity *</label>
                  <Input 
                    type="number"
                    min="0"
                    max={locationAdjustType === 'remove' ? adjustLocationQuant.availableQuantity : undefined}
                    value={locationAdjustQty}
                    onChange={(e) => setLocationAdjustQty(parseInt(e.target.value) || 0)}
                    placeholder="Enter quantity"
                    className="text-lg"
                  />
                  {locationAdjustType === 'remove' && locationAdjustQty > adjustLocationQuant.availableQuantity && (
                    <Text className="text-xs text-red-500 mt-1">Cannot remove more than available ({adjustLocationQuant.availableQuantity})</Text>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Reason</label>
                  <select 
                    value={locationAdjustReason}
                    onChange={(e) => setLocationAdjustReason(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  >
                    <option value="">Select a reason...</option>
                    {locationAdjustType === 'add' ? (
                      <>
                        <option value="New Shipment Received">New Shipment Received</option>
                        <option value="Transfer In">Transfer In</option>
                        <option value="Customer Return">Customer Return</option>
                        <option value="Inventory Correction">Inventory Correction</option>
                      </>
                    ) : (
                      <>
                        <option value="Sale">Sale</option>
                        <option value="Transfer Out">Transfer Out</option>
                        <option value="Damaged/Expired">Damaged/Expired</option>
                        <option value="Inventory Correction">Inventory Correction</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Preview */}
                <div className={`p-4 rounded-xl ${locationAdjustType === 'add' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <Text className={`text-sm font-medium ${locationAdjustType === 'add' ? 'text-green-700' : 'text-red-700'}`}>
                    New stock: {locationAdjustType === 'add' 
                      ? adjustLocationQuant.quantity + locationAdjustQty 
                      : Math.max(0, adjustLocationQuant.quantity - locationAdjustQty)} units
                  </Text>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowLocationAdjustModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (locationAdjustQty <= 0 || !locationAdjustReason) return;
                    
                    const newQty = locationAdjustType === 'add' 
                      ? adjustLocationQuant.quantity + locationAdjustQty 
                      : Math.max(0, adjustLocationQuant.quantity - locationAdjustQty);
                    
                    // Update location stock
                    setInventoryQuants(prev => prev.map(q => 
                      q.id === adjustLocationQuant.id 
                        ? { 
                            ...q, 
                            quantity: newQty,
                            availableQuantity: q.availableQuantity + (locationAdjustType === 'add' ? locationAdjustQty : -locationAdjustQty)
                          }
                        : q
                    ));
                    
                    // Update total stock
                    const stockDiff = locationAdjustType === 'add' ? locationAdjustQty : -locationAdjustQty;
                    setValue?.('subProductData.totalStock', Math.max(0, (totalStock || 0) + stockDiff));
                    
                    // Add to history
                    addToHistory(
                      locationAdjustType === 'add' ? 'add' : 'remove',
                      locationAdjustQty,
                      adjustLocationQuant.quantity,
                      newQty,
                      locationAdjustReason,
                      `Location: ${adjustLocationQuant.locationName}`,
                      { fromLocation: locationAdjustType === 'add' ? 'External' : adjustLocationQuant.locationName }
                    );
                    
                    setShowLocationAdjustModal(false);
                    setAdjustLocationQuant(null);
                    setLocationAdjustQty(0);
                    setLocationAdjustType('add');
                    setLocationAdjustReason('');
                  }}
                  disabled={locationAdjustQty <= 0 || !locationAdjustReason || (locationAdjustType === 'remove' && locationAdjustQty > adjustLocationQuant.availableQuantity)}
                  className="flex-1"
                >
                  Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
