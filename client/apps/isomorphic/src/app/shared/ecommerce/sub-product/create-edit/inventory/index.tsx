// @ts-nocheck
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiPackage,
  PiList,
  PiMapPin,
  PiArrowsDownUp,
  PiRecycle,
  PiBell,
  PiGear,
  PiPlus,
} from 'react-icons/pi';
import { inventoryService, type InventoryMovement, type InventorySummary } from '@/services/inventory.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { warehouseStockService } from '@/services/warehouseStock.service';
import { subproductService } from '@/services/subproduct.service';

// Tab Components
import { OverviewTab } from './OverviewTab';
import { HistoryTab } from './HistoryTab';
import { LocationsTab } from './LocationsTab';
import { MovesTab } from './MovesTab';
import { RulesTab } from './RulesTab';
import { AlertsTab } from './AlertsTab';
import { SettingsTab } from './SettingsTab';

// Modals
import { AdjustmentModal, TransferModal, ServerAdjustmentModal } from './modals';

// Shared utilities
import {
  type StockAdjustment,
  type StockMove,
  type InventoryQuant,
  type ReorderingRule,
  type AlertSettings,
  type InventoryTab,
  type HistoryFilter,
  type StatusFilter,
  type DateRangeFilter,
  CURRENCY_SYMBOLS,
  WAREHOUSE_OPTIONS,
  calculateSizeStockMap,
  filterHistory,
  paginateArray,
  calculateDaysUntilStockout,
  calculateRecommendedOrderQty,
  getCurrentStockStatus,
  exportStockReportJSON,
  exportStockReportCSV,
  getDefaultReason,
} from './shared';

const TABS = [
  { id: 'overview', label: 'Overview', icon: PiPackage },
  { id: 'history', label: 'History', icon: PiList },
  { id: 'locations', label: 'Locations', icon: PiMapPin },
  { id: 'moves', label: 'Stock Moves', icon: PiArrowsDownUp },
  { id: 'rules', label: 'Reordering', icon: PiRecycle },
  { id: 'alerts', label: 'Alerts', icon: PiBell },
  { id: 'settings', label: 'Settings', icon: PiGear },
] as const;

export default function SubProductInventory() {
  const methods = useFormContext();
  const { watch, setValue, control } = methods || {};
  const { data: session } = useSession();

  // Watch form values
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
  const sizes = watch?.('subProductData.sizes') || [];
  const sellWithoutSizeVariants = watch?.('subProductData.sellWithoutSizeVariants');
  const subProductId = watch?.('subProductData._id') || watch?.('subProductData.id');

  const currencySymbol = CURRENCY_SYMBOLS[currency] || '\u20A6';
  const hasSizeVariants = sellWithoutSizeVariants === false && sizes?.length > 0;

  // UI State
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [autoCalculateAvailable, setAutoCalculateAvailable] = useState(true);
  const [stockAdjustAmount, setStockAdjustAmount] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [dailySalesRate, setDailySalesRate] = useState(2);

  // Adjustment Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferQuantity, setTransferQuantity] = useState(0);
  const [transferFromWarehouse, setTransferFromWarehouse] = useState('');
  const [transferToWarehouse, setTransferToWarehouse] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Server Adjustment Modal State
  const [showServerAdjustmentModal, setShowServerAdjustmentModal] = useState(false);
  const [serverAdjustmentInitialType, setServerAdjustmentInitialType] = useState<string>('received');
  const [serverAdjustmentType, setServerAdjustmentType] = useState<'received' | 'adjustment_in' | 'adjustment_out'>('received');
  const [serverAdjustmentQuantity, setServerAdjustmentQuantity] = useState(0);
  const [serverAdjustmentReason, setServerAdjustmentReason] = useState('');
  const [serverAdjustmentNotes, setServerAdjustmentNotes] = useState('');

  // Batch Modal State (simplified - would need full implementation)
  const [showBatchModal, setShowBatchModal] = useState(false);

  // History State
  const [adjustmentHistory, setAdjustmentHistory] = useState<StockAdjustment[]>([]);
  const [lastAdjustment, setLastAdjustment] = useState<StockAdjustment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [historyDateRange, setHistoryDateRange] = useState<DateRangeFilter>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<StockAdjustment | null>(null);

  // Processing state for modals
  const [isProcessing, setIsProcessing] = useState(false);

  // Server Data State
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [serverMovements, setServerMovements] = useState<InventoryMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  // Locations State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryQuants, setInventoryQuants] = useState<InventoryQuant[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Stock Moves State
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);

  // Reordering Rules State
  const [reorderingRules, setReorderingRules] = useState<ReorderingRule[]>([
    { id: '1', warehouseId: 'warehouse_main', warehouseName: 'Main Warehouse', locationId: 'stock_location', minQuantity: 10, maxQuantity: 50, quantityMultiple: 1, leadTime: 7, active: true },
  ]);

  // Alert Settings State
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
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

  // Computed Values
  const sizeStockMap = useMemo(() => calculateSizeStockMap(sizes), [sizes]);
  const currentSizeStock = hasSizeVariants && selectedSize ? sizeStockMap[selectedSize] || 0 : totalStock;
  const calculatedAvailable = useMemo(() => Math.max(0, totalStock - reservedStock), [totalStock, reservedStock]);
  const finalAvailableStock = autoCalculateAvailable ? calculatedAvailable : availableStock;
  const daysUntilStockout = calculateDaysUntilStockout(finalAvailableStock, dailySalesRate);
  const recommendedOrderQty = calculateRecommendedOrderQty(dailySalesRate, finalAvailableStock);

  const totalAvailable = useMemo(() => inventoryQuants.reduce((sum, q) => sum + q.availableQuantity, 0), [inventoryQuants]);
  const totalReserved = useMemo(() => inventoryQuants.reduce((sum, q) => sum + q.reservedQuantity, 0), [inventoryQuants]);

  // Filter history
  const filteredHistory = useMemo(() => filterHistory(adjustmentHistory, {
    historyFilter,
    statusFilter,
    sizeFilter,
    searchQuery,
    dateRange: historyDateRange,
    hasSizeVariants,
  }), [adjustmentHistory, historyFilter, statusFilter, sizeFilter, searchQuery, historyDateRange, hasSizeVariants]);

  const paginatedHistory = useMemo(() => paginateArray(filteredHistory, currentPage, itemsPerPage), [filteredHistory, currentPage, itemsPerPage]);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  // Set initial selected size
  useEffect(() => {
    if (hasSizeVariants && !selectedSize && sizes.length > 0) {
      setSelectedSize(sizes[0]?.size || '');
    }
  }, [hasSizeVariants, sizes, selectedSize]);

  // Auto-calculate available stock
  useEffect(() => {
    if (autoCalculateAvailable) {
      setValue?.('subProductData.availableStock', calculatedAvailable);
    }
  }, [calculatedAvailable, autoCalculateAvailable, setValue]);

  // Sync form values from server inventory summary after fetch
  useEffect(() => {
    if (inventorySummary?.subProduct) {
      const sp = inventorySummary.subProduct;
      if (sp.totalStock !== undefined) setValue('subProductData.totalStock', sp.totalStock);
      if (sp.availableStock !== undefined) setValue('subProductData.availableStock', sp.availableStock);
      if (sp.reservedStock !== undefined) setValue('subProductData.reservedStock', sp.reservedStock);
      if (sp.stockStatus) setValue('subProductData.stockStatus', sp.stockStatus);
    }
  }, [inventorySummary]);

  // Fetch server inventory data
  const fetchInventoryData = useCallback(async () => {
    if (!subProductId || !session?.user?.token) return;
    
    setIsLoadingMovements(true);
    try {
      const [summaryRes, movementsRes] = await Promise.all([
        inventoryService.getInventorySummary(subProductId, session.user.token),
        inventoryService.getMovements(session.user.token, { subProductId, limit: 50 })
      ]);
      
      if (summaryRes.success) setInventorySummary(summaryRes.data);
      if (movementsRes.success) setServerMovements(movementsRes.data?.movements || []);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setIsLoadingMovements(false);
    }
  }, [subProductId, session?.user?.token]);

  // Fetch warehouses (global places) — used by the New Move transfer pickers.
  const fetchWarehouses = useCallback(async () => {
    if (!session?.user?.token) return;

    setIsLoadingWarehouses(true);
    try {
      const response = await warehouseService.getWarehouses(session.user.token, { isActive: true });
      setWarehouses(response.data || []);
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
      setWarehouses([]);
    } finally {
      setIsLoadingWarehouses(false);
    }
  }, [session?.user?.token]);

  // Load the warehouse places once (used by the New Move transfer pickers).
  useEffect(() => {
    if (!session?.user?.token) return;
    fetchWarehouses();
  }, [session?.user?.token, fetchWarehouses]);

  // Fetch data when tab changes
  useEffect(() => {
    if (!session?.user?.token || !subProductId) return;

    if (activeTab === 'history' || activeTab === 'overview' || activeTab === 'moves') {
      fetchInventoryData();
    }
  }, [subProductId, session?.user?.token, activeTab, fetchInventoryData]);

  // History helper
  const addToHistory = useCallback((
    type: StockAdjustment['type'],
    quantity: number,
    previousStock: number,
    newStock: number,
    reason: string,
    notes?: string,
    options?: Partial<StockAdjustment>
  ) => {
    const sizeVariant = options?.sizeVariant || selectedSize;
    const sizeObj = sizes?.find((s: any) => s?.size === sizeVariant);

    const adjustment: StockAdjustment = {
      id: Date.now().toString(),
      type,
      quantity,
      previousStock,
      newStock,
      reason,
      notes,
      timestamp: new Date(),
      canUndo: type !== 'set' && type !== 'transfer',
      reference: options?.reference || `WH/MOV/${Date.now().toString().slice(-5)}`,
      productName: options?.productName || 'SubProduct',
      fromLocation: options?.fromLocation || (type === 'add' ? 'Vendors' : 'WH/Stock'),
      toLocation: options?.toLocation || (type === 'remove' ? 'Customers' : 'WH/Stock'),
      unit: options?.unit || 'units',
      status: 'done',
      operationType: type === 'add' ? 'receipt' : type === 'remove' ? 'delivery' : type === 'transfer' ? 'transfer' : 'adjustment',
      sourceDocument: options?.sourceDocument || `Shop/${Date.now().toString().slice(-3)}`,
      demand: quantity,
      picked: quantity,
      sizeVariant,
      sizeLabel: options?.sizeLabel || sizeObj?.label || sizeVariant,
      ...options,
    };

    setAdjustmentHistory(prev => [adjustment, ...prev].slice(0, 50));
    setLastAdjustment(adjustment);
  }, [selectedSize, sizes]);

  // Helper function to record inventory movement on server
  const recordInventoryMovement = useCallback(async (
    quantity: number,
    type: 'add' | 'remove' | 'set',
    reason: string,
    notes?: string
  ): Promise<boolean> => {
    if (!subProductId || !session?.user?.token) {
      console.warn('⚠️ Cannot record movement: missing subProductId or token');
      return false;
    }

    try {
      console.log('📦 Recording inventory movement:', { subProductId, quantity, type, reason });
      
      if (type === 'add' && quantity > 0) {
        // Quick-add is a manual adjustment, NOT a supplier receipt.
        // Using recordReceived would create type:'received' and inflate the "Received" total.
        const result = await inventoryService.adjustInventory(subProductId, quantity, reason, session.user.token, notes);
        console.log('✅ Movement recorded (adjustment_in):', result);
      } else if (type === 'remove' && quantity > 0) {
        const result = await inventoryService.adjustInventory(subProductId, -quantity, reason, session.user.token, notes);
        console.log('✅ Movement recorded (adjustment_out):', result);
      } else if (type === 'set') {
        // For set, we need current stock to calculate delta
        const delta = quantity - (totalStock || 0);
        if (delta !== 0) {
          const result = await inventoryService.adjustInventory(
            subProductId,
            delta,
            reason,
            session.user.token,
            notes
          );
          console.log('✅ Movement recorded (set adjustment):', result);
        }
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to record movement:', error);
      return false;
    }
  }, [subProductId, session?.user?.token, totalStock]);

  // Stock adjustment handlers - saves immediately to server
  const handleStockAdjust = useCallback(async (delta: number) => {
    console.log('🎯 handleStockAdjust CALLED:', { delta, subProductId, hasToken: !!session?.user?.token });
    
    if (!delta || delta === 0) return;
    
    const currentVal = hasSizeVariants && selectedSize ? sizeStockMap[selectedSize] || 0 : totalStock;
    const newVal = Math.max(0, currentVal + delta);
    const newTotal = Math.max(0, (totalStock || 0) + delta);

    // 1. FIRST: Record inventory movement on server (this is the history!)
    const movementRecorded = await recordInventoryMovement(
      Math.abs(delta),
      delta > 0 ? 'add' : 'remove',
      delta > 0 ? 'Quick add' : 'Quick remove'
    );

    if (!movementRecorded) {
      toast.error('Failed to record stock movement');
      return; // Don't update local state if server failed
    }

    // 2. Update local form state
    if (hasSizeVariants && selectedSize) {
      const updatedSizes = sizes.map((s: any) =>
        s?.size === selectedSize ? { ...s, stockQuantity: newVal } : s
      );
      setValue?.('subProductData.sizes', updatedSizes);
      setValue?.('subProductData.totalStock', newTotal);
    } else {
      setValue?.('subProductData.totalStock', newTotal);
    }
    setValue?.('subProductData.availableStock', Math.max(0, newTotal - (reservedStock || 0)));

    // 3. Add to local history display
    addToHistory(delta > 0 ? 'add' : 'remove', Math.abs(delta), currentVal, newVal, delta > 0 ? 'Quick add' : 'Quick remove');

    // 4. Refresh data from server
    await fetchInventoryData();
    
    toast.success(`Stock ${delta > 0 ? 'added' : 'removed'}: ${Math.abs(delta)} units`);
  }, [totalStock, reservedStock, setValue, addToHistory, hasSizeVariants, selectedSize, sizeStockMap, sizes, subProductId, session?.user?.token, fetchInventoryData, recordInventoryMovement]);

  const handleReservedAdjust = useCallback((delta: number) => {
    const newReserved = Math.max(0, (reservedStock || 0) + delta);
    setValue?.('subProductData.reservedStock', newReserved);
    addToHistory(delta > 0 ? 'reserve' : 'unreserve', Math.abs(delta), reservedStock, newReserved, delta > 0 ? 'Reserved for order' : 'Released reservation');
  }, [reservedStock, setValue, addToHistory]);

  const undoLastAdjustment = useCallback(() => {
    if (!lastAdjustment || !lastAdjustment.canUndo) return;
    setValue?.('subProductData.totalStock', lastAdjustment.previousStock);
    setAdjustmentHistory(prev => prev.map(h => h.id === lastAdjustment.id ? { ...h, canUndo: false } : h));
    setLastAdjustment(null);
  }, [lastAdjustment, setValue]);

  // Modal handlers
  const openAdjustmentModal = (type: 'add' | 'remove' | 'set') => {
    setAdjustmentType(type);
    setAdjustmentQuantity(0);
    setAdjustmentReason('');
    setAdjustmentNotes('');
    setShowAdjustmentModal(true);
  };

  const submitAdjustment = async () => {
    if (adjustmentQuantity <= 0) return;

    console.log('🎯 submitAdjustment CALLED:', { adjustmentType, adjustmentQuantity, subProductId });

    const currentVal = hasSizeVariants && selectedSize ? sizeStockMap[selectedSize] || 0 : totalStock;
    let newVal = currentVal;
    let newTotal = totalStock;

    if (adjustmentType === 'add') {
      newVal = currentVal + adjustmentQuantity;
      newTotal = totalStock + adjustmentQuantity;
    } else if (adjustmentType === 'remove') {
      newVal = Math.max(0, currentVal - adjustmentQuantity);
      newTotal = Math.max(0, totalStock - adjustmentQuantity);
    } else if (adjustmentType === 'set') {
      newVal = adjustmentQuantity;
      newTotal = hasSizeVariants ? Math.max(0, totalStock + (newVal - currentVal)) : adjustmentQuantity;
    }

    const reason = adjustmentReason || getDefaultReason(adjustmentType);

    // 1. FIRST: Record inventory movement on server
    const movementRecorded = await recordInventoryMovement(
      adjustmentType === 'set' ? Math.abs(newVal - currentVal) : adjustmentQuantity,
      adjustmentType === 'set' ? (newVal > currentVal ? 'add' : 'remove') : adjustmentType,
      reason,
      adjustmentNotes
    );

    if (!movementRecorded && subProductId) {
      toast.error('Failed to record stock movement');
      setShowAdjustmentModal(false);
      return;
    }

    // 2. Update local state
    if (hasSizeVariants && selectedSize) {
      const updatedSizes = sizes.map((s: any) =>
        s?.size === selectedSize ? { ...s, stockQuantity: newVal } : s
      );
      setValue?.('subProductData.sizes', updatedSizes);
    }
    setValue?.('subProductData.totalStock', newTotal);
    setValue?.('subProductData.availableStock', Math.max(0, newTotal - (reservedStock || 0)));

    // 3. Add to local history display
    addToHistory(adjustmentType, adjustmentQuantity, currentVal, newVal, reason, adjustmentNotes);
    
    // 4. Close modal
    setShowAdjustmentModal(false);

    // 5. Refresh data from server
    await fetchInventoryData();
    
    toast.success(`Stock ${adjustmentType}: ${adjustmentQuantity} units`);
  };

  const submitTransfer = async () => {
    if (transferQuantity <= 0 || !transferFromWarehouse || !transferToWarehouse) return;

    const fromLabel = WAREHOUSE_OPTIONS.find(w => w.value === transferFromWarehouse)?.label || transferFromWarehouse;
    const toLabel = WAREHOUSE_OPTIONS.find(w => w.value === transferToWarehouse)?.label || transferToWarehouse;

    // Per-warehouse/size transfers now run through the Locations tab (real warehouse
    // places + size). This legacy modal only records a local history note.
    addToHistory('transfer', transferQuantity, totalStock, totalStock, `Transfer from ${fromLabel} to ${toLabel}`, transferNotes, {
      fromLocationName: fromLabel,
      toLocationName: toLabel,
      transferReference: `WH/TRF/${Date.now().toString().slice(-5)}`,
    });

    setShowTransferModal(false);
    setTransferQuantity(0);
    setTransferFromWarehouse('');
    setTransferToWarehouse('');
    setTransferNotes('');
  };

  const handleServerAdjustment = async (data: {
    type: string; quantity: number; reason: string; notes: string;
    sizeId?: string; sizeName?: string; reference?: string;
    unitCost?: number; supplierName?: string;
    sourceWarehouseId?: string; destinationWarehouseId?: string;
  }) => {
    if (!subProductId || !session?.user?.token) return;
    setIsProcessing(true);
    try {
      const token = session.user.token;

      switch (data.type) {
        case 'received':
          await inventoryService.recordReceived(subProductId, data.quantity, token, {
            reason: data.reason,
            notes: data.notes,
            reference: data.reference,
            unitCost: data.unitCost,
            supplierName: data.supplierName,
            sizeId: data.sizeId,
            sizeName: data.sizeName,
          });
          break;

        case 'adjustment_in':
          await inventoryService.adjustInventory(subProductId, data.quantity, data.reason, token, data.notes, data.reference);
          break;

        case 'adjustment_out':
          await inventoryService.adjustInventory(subProductId, -data.quantity, data.reason, token, data.notes, data.reference);
          break;

        case 'return':
          await inventoryService.recordReturn(subProductId, data.quantity, token, {
            reason: data.reason,
            notes: data.notes,
            reference: data.reference,
          });
          break;

        case 'transfer':
          if (!data.sourceWarehouseId || !data.destinationWarehouseId) {
            toast.error('Please select both source and destination warehouses');
            return;
          }
          if (!data.sizeId) {
            toast.error('Select a size to transfer (stock is tracked per size)');
            return;
          }
          await warehouseStockService.transferStock({
            subProduct: subProductId,
            size: data.sizeId,
            fromWarehouse: data.sourceWarehouseId,
            toWarehouse: data.destinationWarehouseId,
            quantity: data.quantity,
            notes: data.notes,
          }, token);
          break;

        case 'shipped':
          await inventoryService.adjustInventory(subProductId, -data.quantity, data.reason || 'Shipped', token, data.notes, data.reference);
          break;

        case 'damaged':
        case 'expired':
        case 'written_off':
          await inventoryService.createMovement({
            subProduct: subProductId,
            type: data.type,
            category: 'out',
            quantity: data.quantity,
            reason: data.reason,
            notes: data.notes,
            reference: data.reference,
            source: 'manual',
            status: 'confirmed',
          }, token);
          break;

        default:
          // Generic adjustment fallback
          await inventoryService.adjustInventory(subProductId, data.quantity, data.reason, token, data.notes, data.reference);
      }

      await fetchInventoryData();
      toast.success('Stock movement recorded');
      setShowServerAdjustmentModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to record movement');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick action handlers - these now save immediately to server
  const handleAddStock = async (amount: number) => {
    // Use the main handler which saves to server
    await handleStockAdjust(amount);
  };

  const handleSetOutOfStock = async () => {
    const currentStock = totalStock || 0;
    
    // Update local state
    addToHistory('set', 0, currentStock, 0, 'Marked out of stock');
    setValue?.('subProductData.totalStock', 0);
    setValue?.('subProductData.availableStock', 0);
    setValue?.('subProductData.stockStatus', 'out_of_stock');

    // IMMEDIATELY save to server
    if (subProductId && session?.user?.token && currentStock > 0) {
      try {
        console.log('📤 Setting out of stock on server...');
        
        // Record the adjustment
        await inventoryService.adjustInventory(subProductId, -currentStock, 'Marked out of stock', session.user.token);
        
        // Update SubProduct
        await subproductService.updateSubProduct(subProductId, {
          totalStock: 0,
          availableStock: 0,
          stockStatus: 'out_of_stock',
        }, session.user.token);
        
        await fetchInventoryData();
        toast.success('Product marked as out of stock');
      } catch (error: any) {
        console.error('Failed to update server:', error);
        toast.error(error.message || 'Failed to save');
      }
    }
  };

  const handleSetPreOrder = async () => {
    const currentStock = totalStock || 0;
    
    addToHistory('set', 0, currentStock, 0, 'Set to pre-order');
    setValue?.('subProductData.totalStock', 0);
    setValue?.('subProductData.availableStock', 0);
    setValue?.('subProductData.stockStatus', 'pre_order');

    // Save to server
    if (subProductId && session?.user?.token) {
      try {
        await subproductService.updateSubProduct(subProductId, {
          totalStock: 0,
          availableStock: 0,
          stockStatus: 'pre_order',
        }, session.user.token);
        toast.success('Product set to pre-order');
      } catch (error: any) {
        console.error('Failed to update server:', error);
        toast.error(error.message || 'Failed to save');
      }
    }
  };

  const handleDiscontinue = async () => {
    const currentStock = totalStock || 0;
    
    addToHistory('set', 0, currentStock, 0, 'Product discontinued');
    setValue?.('subProductData.totalStock', 0);
    setValue?.('subProductData.availableStock', 0);
    setValue?.('subProductData.stockStatus', 'discontinued');

    // Save to server
    if (subProductId && session?.user?.token) {
      try {
        await subproductService.updateSubProduct(subProductId, {
          totalStock: 0,
          availableStock: 0,
          stockStatus: 'discontinued',
          status: 'discontinued',
        }, session.user.token);
        toast.success('Product discontinued');
      } catch (error: any) {
        console.error('Failed to update server:', error);
        toast.error(error.message || 'Failed to save');
      }
    }
  };

  const toggleRoute = (route: string) => {
    const currentRoutes = routes || [];
    if (currentRoutes.includes(route)) {
      setValue?.('subProductData.routes', currentRoutes.filter((r: string) => r !== route));
    } else {
      setValue?.('subProductData.routes', [...currentRoutes, route]);
    }
  };

  // Export handlers
  const handleExportJSON = () => exportStockReportJSON(totalStock, finalAvailableStock, reservedStock, adjustmentHistory);
  const handleExportCSV = () => exportStockReportCSV(adjustmentHistory);

  // Stock status for header badge
  const currentStatus = getCurrentStockStatus(stockStatus, finalAvailableStock, lowStockThreshold);
  const statusMeta: Record<string, { label: string; cls: string }> = {
    in_stock:     { label: 'In Stock',     cls: 'bg-green-100 text-green-700' },
    low_stock:    { label: 'Low Stock',    cls: 'bg-amber-100 text-amber-700' },
    out_of_stock: { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' },
    pre_order:    { label: 'Pre-Order',    cls: 'bg-blue-100 text-blue-700' },
    discontinued: { label: 'Discontinued', cls: 'bg-gray-100 text-gray-500' },
  };
  const sm = statusMeta[currentStatus] || statusMeta.out_of_stock;

  return (
    <div className="space-y-0">
      {/* ── Inventory header ── */}
      <div className="rounded-t-2xl border border-gray-200 bg-white overflow-hidden">

        {/* Stock status strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</span>
              <span className="text-sm font-black tabular-nums text-gray-900">{totalStock || 0}</span>
            </div>
            <div className="h-3 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Available</span>
              <span className="text-sm font-black tabular-nums text-green-600">{finalAvailableStock}</span>
            </div>
            <div className="h-3 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reserved</span>
              <span className="text-sm font-black tabular-nums text-amber-600">{reservedStock || 0}</span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${sm.cls}`}>
              {sm.label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setServerAdjustmentInitialType('received');
              setShowServerAdjustmentModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            <PiPlus className="h-3.5 w-3.5" />
            New Move
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto px-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="rounded-b-2xl border border-t-0 border-gray-200 bg-white p-5">

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          totalStock={totalStock}
          availableStock={finalAvailableStock}
          reservedStock={reservedStock}
          stockStatus={getCurrentStockStatus(stockStatus, finalAvailableStock, lowStockThreshold)}
          lowStockThreshold={lowStockThreshold}
          reorderPoint={reorderPoint}
          reorderQuantity={reorderQuantity}
          daysUntilStockout={daysUntilStockout}
          costPrice={costPrice}
          baseSellingPrice={baseSellingPrice}
          currencySymbol={currencySymbol}
          hasSizeVariants={hasSizeVariants}
          sizes={sizes}
          selectedSize={selectedSize}
          sizeStockMap={sizeStockMap}
          currentSizeStock={currentSizeStock}
          onSelectSize={setSelectedSize}
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          subProductId={subProductId}
          inventorySummary={inventorySummary}
          serverMovements={serverMovements}
          isLoadingMovements={isLoadingMovements}
          onRefreshMovements={fetchInventoryData}
          onCancelMovement={async (id) => {
            await inventoryService.cancelMovement(id, session?.user?.token || '', 'Manual cancel');
            await fetchInventoryData();
          }}
          onRecordStock={() => setShowServerAdjustmentModal(true)}
        />
      )}

      {activeTab === 'locations' && (
        <LocationsTab
          subProductId={subProductId}
          token={session?.user?.token}
          onRefresh={fetchInventoryData}
        />
      )}

      {activeTab === 'moves' && (
        <MovesTab
          stockMoves={stockMoves}
          serverMovements={serverMovements}
          hasSizeVariants={hasSizeVariants}
          sizes={sizes}
          selectedSize={selectedSize}
          isLoading={isLoadingMovements}
          onRefresh={fetchInventoryData}
          onNewMove={(type) => {
            setServerAdjustmentInitialType(type || 'received');
            setShowServerAdjustmentModal(true);
          }}
        />
      )}

      {activeTab === 'rules' && (
        <RulesTab
          subProductId={subProductId}
          totalStock={totalStock}
          reorderPoint={reorderPoint}
          reorderQuantity={reorderQuantity}
          lowStockThreshold={lowStockThreshold}
        />
      )}

      {activeTab === 'alerts' && (
        <AlertsTab
          availableStock={finalAvailableStock}
          totalStock={totalStock}
          lowStockThreshold={lowStockThreshold}
          reorderPoint={reorderPoint}
          daysUntilStockout={daysUntilStockout}
          recommendedOrderQty={recommendedOrderQty}
          dailySalesRate={dailySalesRate}
          onDailySalesRateChange={setDailySalesRate}
          onLowStockThresholdChange={v => setValue?.('subProductData.lowStockThreshold', v)}
          onReorderPointChange={v => setValue?.('subProductData.reorderPoint', v)}
          alertSettings={alertSettings}
          onAlertSettingsChange={setAlertSettings}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          tracking={tracking}
          valuation={valuation}
          routes={routes}
          standardPrice={standardPrice}
          costPrice={costPrice}
          lowStockThreshold={lowStockThreshold}
          reorderPoint={reorderPoint}
          reorderQuantity={reorderQuantity}
          currency={currency}
          onToggleRoute={toggleRoute}
          onStandardPriceChange={(v) => setValue?.('subProductData.standardPrice', v)}
          onLowStockThresholdChange={(v) => setValue?.('subProductData.lowStockThreshold', v)}
          onReorderPointChange={(v) => setValue?.('subProductData.reorderPoint', v)}
          onReorderQuantityChange={(v) => setValue?.('subProductData.reorderQuantity', v)}
        />
      )}

      {/* Modals */}
      <AdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        adjustmentType={adjustmentType}
        adjustmentQuantity={adjustmentQuantity}
        onQuantityChange={setAdjustmentQuantity}
        adjustmentReason={adjustmentReason}
        onReasonChange={setAdjustmentReason}
        adjustmentNotes={adjustmentNotes}
        onNotesChange={setAdjustmentNotes}
        onSubmit={submitAdjustment}
        hasSizeVariants={hasSizeVariants}
        sizes={sizes}
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
        sizeStockMap={sizeStockMap}
        currentSizeStock={currentSizeStock}
        totalStock={totalStock}
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        transferQuantity={transferQuantity}
        onQuantityChange={setTransferQuantity}
        transferFromWarehouse={transferFromWarehouse}
        onFromWarehouseChange={setTransferFromWarehouse}
        transferToWarehouse={transferToWarehouse}
        onToWarehouseChange={setTransferToWarehouse}
        transferNotes={transferNotes}
        onNotesChange={setTransferNotes}
        onSubmit={submitTransfer}
        hasSizeVariants={hasSizeVariants}
        sizes={sizes}
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
        sizeStockMap={sizeStockMap}
        currentSizeStock={currentSizeStock}
        availableStock={finalAvailableStock}
      />

      <ServerAdjustmentModal
        isOpen={showServerAdjustmentModal}
        onClose={() => setShowServerAdjustmentModal(false)}
        onSubmit={handleServerAdjustment}
        isSubmitting={isProcessing}
        sizes={hasSizeVariants ? sizes : []}
        hasSizes={hasSizeVariants}
        initialType={serverAdjustmentInitialType}
        warehouses={warehouses}
      />

      </div>
    </div>
  );
}
