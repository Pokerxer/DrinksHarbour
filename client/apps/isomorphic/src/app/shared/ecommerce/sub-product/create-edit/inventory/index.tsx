// @ts-nocheck
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from 'rizzui';
import { motion } from 'framer-motion';
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
  PiArrowUUpLeft,
  PiSpinner,
} from 'react-icons/pi';

import { containerVariants } from '../animations';
import { inventoryService, type InventoryMovement, type InventorySummary } from '@/services/inventory.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
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

  // Server Data State
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [serverMovements, setServerMovements] = useState<InventoryMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  // Locations State - fetch from server
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryQuants, setInventoryQuants] = useState<InventoryQuant[]>([]);

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

  // Fetch warehouses for locations
  const fetchWarehouses = useCallback(async () => {
    if (!session?.user?.token) return;
    
    setIsLoadingWarehouses(true);
    try {
      const response = await warehouseService.getWarehouses(session.user.token, { 
        limit: 100,
        subProductId: subProductId 
      });
      
      if (response.success) {
        const warehouseData = response.data || [];
        setWarehouses(warehouseData);
        
        // Convert warehouses to inventory quants
        const quants: InventoryQuant[] = warehouseData.map((wh: Warehouse) => ({
          id: wh._id,
          locationId: wh._id,
          locationName: wh.location,
          locationType: wh.locationType as any,
          quantity: wh.currentQuantity || 0,
          reservedQuantity: wh.reservedQuantity || 0,
          availableQuantity: Math.max(0, (wh.currentQuantity || 0) - (wh.reservedQuantity || 0)),
          isActive: wh.isActive,
        }));
        setInventoryQuants(quants);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
      // Fall back to default locations
      setInventoryQuants([
        { id: '1', locationId: 'stock_location', locationName: 'Stock Location', locationType: 'internal' as any, quantity: totalStock || 0, reservedQuantity: 0, availableQuantity: totalStock || 0, isActive: true },
        { id: '2', locationId: 'store_front', locationName: 'Store Front', locationType: 'internal' as any, quantity: 0, reservedQuantity: 0, availableQuantity: 0, isActive: true },
      ]);
    } finally {
      setIsLoadingWarehouses(false);
    }
  }, [session?.user?.token, subProductId, totalStock]);

  // Fetch data when tab changes
  useEffect(() => {
    if (!session?.user?.token || !subProductId) return;
    
    if (activeTab === 'history' || activeTab === 'overview') {
      fetchInventoryData();
    }
    if (activeTab === 'locations') {
      fetchWarehouses();
    }
  }, [subProductId, session?.user?.token, activeTab, fetchInventoryData, fetchWarehouses]);

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
        const result = await inventoryService.recordReceived(subProductId, quantity, session.user.token, {
          reason,
          notes,
        });
        console.log('✅ Movement recorded (received):', result);
      } else if (type === 'remove' && quantity > 0) {
        const result = await inventoryService.adjustInventory(subProductId, -quantity, reason, session.user.token, notes);
        console.log('✅ Movement recorded (adjustment out):', result);
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

    // Try to do server-side transfer if we have subProductId
    if (subProductId && session?.user?.token) {
      try {
        await warehouseService.transferStock({
          subProductId,
          sourceWarehouseId: transferFromWarehouse,
          destinationWarehouseId: transferToWarehouse,
          quantity: transferQuantity,
          notes: transferNotes,
        }, session.user.token);
        
        // Refresh data
        await fetchInventoryData();
        await fetchWarehouses();
        
        toast.success('Transfer completed successfully');
      } catch (error: any) {
        console.error('Server transfer failed:', error);
        toast.error(error.message || 'Server transfer failed, recording locally');
        // Fall back to local recording
      }
    }

    // Always record locally
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

  const handleServerAdjustment = async () => {
    if (!subProductId || !session?.user?.token) return;
    if (serverAdjustmentQuantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      let adjustment = 0;
      
      if (serverAdjustmentType === 'received') {
        adjustment = serverAdjustmentQuantity;
        await inventoryService.recordReceived(subProductId, serverAdjustmentQuantity, session.user.token, {
          reason: serverAdjustmentReason,
          notes: serverAdjustmentNotes,
        });
      } else {
        adjustment = serverAdjustmentType === 'adjustment_in' ? serverAdjustmentQuantity : -serverAdjustmentQuantity;
        await inventoryService.adjustInventory(subProductId, adjustment, serverAdjustmentReason, session.user.token, serverAdjustmentNotes);
      }

      // Calculate new totals and update SubProduct
      const newTotal = Math.max(0, (totalStock || 0) + adjustment);
      const newAvailable = Math.max(0, newTotal - (reservedStock || 0));
      
      // Update local form state
      setValue?.('subProductData.totalStock', newTotal);
      setValue?.('subProductData.availableStock', newAvailable);
      setValue?.('subProductData.stockStatus', newTotal === 0 ? 'out_of_stock' : newTotal <= lowStockThreshold ? 'low_stock' : 'in_stock');
      
      // Also update SubProduct directly on server
      await subproductService.updateSubProduct(subProductId, {
        totalStock: newTotal,
        availableStock: newAvailable,
        stockStatus: newTotal === 0 ? 'out_of_stock' : newTotal <= lowStockThreshold ? 'low_stock' : 'in_stock',
      }, session.user.token);
      
      // Add to local history
      addToHistory(
        serverAdjustmentType === 'received' ? 'add' : adjustment > 0 ? 'add' : 'remove',
        serverAdjustmentQuantity,
        totalStock,
        newTotal,
        serverAdjustmentReason || `Server ${serverAdjustmentType}`,
        serverAdjustmentNotes
      );

      await fetchInventoryData();
      setShowServerAdjustmentModal(false);
      setServerAdjustmentQuantity(0);
      setServerAdjustmentReason('');
      setServerAdjustmentNotes('');
      
      toast.success('Inventory adjusted successfully');
    } catch (error: any) {
      console.error('Server adjustment failed:', error);
      toast.error(error.message || 'Failed to process adjustment');
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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
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
          autoCalculateAvailable={autoCalculateAvailable}
          stockAdjustAmount={stockAdjustAmount}
          onStockAdjust={handleStockAdjust}
          onReservedAdjust={handleReservedAdjust}
          onStockAdjustAmountChange={setStockAdjustAmount}
          onSelectSize={setSelectedSize}
          onOpenAdjustmentModal={openAdjustmentModal}
          onTransferClick={() => setShowTransferModal(true)}
          onBatchClick={() => setShowBatchModal(true)}
          onAddStock={handleAddStock}
          onSetOutOfStock={handleSetOutOfStock}
          onSetPreOrder={handleSetPreOrder}
          onDiscontinue={handleDiscontinue}
          onAutoCalculateChange={setAutoCalculateAvailable}
          onLowStockThresholdChange={(v) => setValue?.('subProductData.lowStockThreshold', v)}
          onReorderPointChange={(v) => setValue?.('subProductData.reorderPoint', v)}
          onReorderQuantityChange={(v) => setValue?.('subProductData.reorderQuantity', v)}
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
          onRecordStock={() => setShowServerAdjustmentModal(true)}
          filteredHistory={filteredHistory}
          paginatedHistory={paginatedHistory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          historyFilter={historyFilter}
          onHistoryFilterChange={setHistoryFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateRange={historyDateRange}
          onDateRangeChange={setHistoryDateRange}
          sizeFilter={sizeFilter}
          onSizeFilterChange={setSizeFilter}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(count) => { setItemsPerPage(count); setCurrentPage(1); }}
          selectedItems={selectedItems}
          onToggleSelect={(id) => setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
          onSelectAll={() => setSelectedItems(prev => prev.length === paginatedHistory.length ? [] : paginatedHistory.map(h => h.id))}
          onClearSelection={() => setSelectedItems([])}
          onItemClick={setSelectedHistoryItem}
          hasSizeVariants={hasSizeVariants}
          sizes={sizes}
          onExportCSV={handleExportCSV}
        />
      )}

      {activeTab === 'locations' && (
        <LocationsTab
          inventoryQuants={inventoryQuants}
          totalStock={totalStock}
          totalReserved={totalReserved}
          totalAvailable={totalAvailable}
          hasSizeVariants={hasSizeVariants}
          sizes={sizes}
          sizeStockMap={sizeStockMap}
          isLoading={isLoadingWarehouses}
          warehouses={warehouses}
          onAddLocation={async () => {
            // TODO: Open modal to add new warehouse
            toast.success('Add warehouse feature coming soon');
          }}
          onEditLocation={(quant) => {
            // TODO: Open modal to edit warehouse
            toast.success('Edit warehouse feature coming soon');
          }}
          onAdjustLocation={(quant) => {
            // Open transfer modal for this location
            setTransferFromWarehouse(quant.id);
            setShowTransferModal(true);
          }}
          onRefresh={fetchWarehouses}
          onExport={handleExportJSON}
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
          onNewMove={() => setShowServerAdjustmentModal(true)}
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
          lowStockThreshold={lowStockThreshold}
          reorderPoint={reorderPoint}
          daysUntilStockout={daysUntilStockout}
          recommendedOrderQty={recommendedOrderQty}
          dailySalesRate={dailySalesRate}
          onDailySalesRateChange={setDailySalesRate}
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
          onToggleRoute={toggleRoute}
          onStandardPriceChange={(v) => setValue?.('subProductData.standardPrice', v)}
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
        adjustmentType={serverAdjustmentType}
        onTypeChange={setServerAdjustmentType}
        quantity={serverAdjustmentQuantity}
        onQuantityChange={setServerAdjustmentQuantity}
        reason={serverAdjustmentReason}
        onReasonChange={setServerAdjustmentReason}
        notes={serverAdjustmentNotes}
        onNotesChange={setServerAdjustmentNotes}
        onSubmit={handleServerAdjustment}
      />
    </motion.div>
  );
}
