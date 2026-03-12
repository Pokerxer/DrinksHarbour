'use client';

import { OverviewHeader } from './OverviewHeader';
import { QuickAddRemoveBar } from './QuickAddRemoveBar';
import { SizeVariantSelector } from './SizeVariantSelector';
import { StockSummaryCards } from './StockSummaryCards';
import { QuickActions } from './QuickActions';
import { InventoryValueCards } from './InventoryValueCards';
import { StockSettings } from './StockSettings';
import { StockLevelIndicator } from './StockLevelIndicator';
import type { SizeVariant } from '../shared/types';

interface OverviewTabProps {
  // Stock data
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  stockStatus: string;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  daysUntilStockout: number;
  
  // Pricing data
  costPrice: number;
  baseSellingPrice: number;
  currencySymbol: string;
  
  // Size variants
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  selectedSize: string;
  sizeStockMap: Record<string, number>;
  currentSizeStock: number;
  
  // Settings
  autoCalculateAvailable: boolean;
  stockAdjustAmount: number;
  
  // Callbacks
  onStockAdjust: (delta: number) => void;
  onReservedAdjust: (delta: number) => void;
  onStockAdjustAmountChange: (amount: number) => void;
  onSelectSize: (size: string) => void;
  onOpenAdjustmentModal: (type: 'add' | 'remove' | 'set') => void;
  onTransferClick: () => void;
  onBatchClick: () => void;
  onAddStock: (amount: number) => void;
  onSetOutOfStock: () => void;
  onSetPreOrder: () => void;
  onDiscontinue: () => void;
  onAutoCalculateChange: (checked: boolean) => void;
  onLowStockThresholdChange: (value: number) => void;
  onReorderPointChange: (value: number) => void;
  onReorderQuantityChange: (value: number) => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
}

export function OverviewTab({
  totalStock,
  availableStock,
  reservedStock,
  stockStatus,
  lowStockThreshold,
  reorderPoint,
  reorderQuantity,
  daysUntilStockout,
  costPrice,
  baseSellingPrice,
  currencySymbol,
  hasSizeVariants,
  sizes,
  selectedSize,
  sizeStockMap,
  autoCalculateAvailable,
  stockAdjustAmount,
  onStockAdjust,
  onReservedAdjust,
  onStockAdjustAmountChange,
  onSelectSize,
  onOpenAdjustmentModal,
  onTransferClick,
  onBatchClick,
  onAddStock,
  onSetOutOfStock,
  onSetPreOrder,
  onDiscontinue,
  onAutoCalculateChange,
  onLowStockThresholdChange,
  onReorderPointChange,
  onReorderQuantityChange,
  onExportJSON,
  onExportCSV,
}: OverviewTabProps) {
  // Calculate derived values
  const inventoryValue = costPrice * totalStock;
  const potentialRevenue = baseSellingPrice * totalStock;
  const profitMargin =
    totalStock > 0 ? ((potentialRevenue - inventoryValue) / potentialRevenue) * 100 : 0;

  return (
    <>
      {/* Header with actions */}
      <OverviewHeader
        onTransferClick={onTransferClick}
        onBatchClick={onBatchClick}
        onExportJSON={onExportJSON}
        onExportCSV={onExportCSV}
      />

      {/* Quick Add/Remove Bar */}
      <QuickAddRemoveBar
        stockAdjustAmount={stockAdjustAmount}
        onStockAdjustAmountChange={onStockAdjustAmountChange}
        onStockAdjust={onStockAdjust}
        totalStock={totalStock}
        onOpenAdjustmentModal={onOpenAdjustmentModal}
      />

      {/* Size Variant Selector (if applicable) */}
      {hasSizeVariants && (
        <SizeVariantSelector
          sizes={sizes}
          selectedSize={selectedSize}
          sizeStockMap={sizeStockMap}
          onSelectSize={onSelectSize}
        />
      )}

      {/* Stock Summary Cards */}
      <StockSummaryCards
        totalStock={totalStock}
        availableStock={availableStock}
        reservedStock={reservedStock}
        stockStatus={stockStatus}
        daysUntilStockout={daysUntilStockout}
        onReservedAdjust={onReservedAdjust}
      />

      {/* Quick Actions */}
      <QuickActions
        onAddStock={onAddStock}
        onSetOutOfStock={onSetOutOfStock}
        onSetPreOrder={onSetPreOrder}
        onDiscontinue={onDiscontinue}
      />

      {/* Inventory Value Cards */}
      <InventoryValueCards
        inventoryValue={inventoryValue}
        potentialRevenue={potentialRevenue}
        profitMargin={profitMargin}
        currencySymbol={currencySymbol}
      />

      {/* Stock Settings */}
      <StockSettings
        autoCalculateAvailable={autoCalculateAvailable}
        onAutoCalculateChange={onAutoCalculateChange}
        lowStockThreshold={lowStockThreshold}
        onLowStockThresholdChange={onLowStockThresholdChange}
        reorderPoint={reorderPoint}
        onReorderPointChange={onReorderPointChange}
        reorderQuantity={reorderQuantity}
        onReorderQuantityChange={onReorderQuantityChange}
      />

      {/* Stock Level Indicator */}
      <StockLevelIndicator
        availableStock={availableStock}
        lowStockThreshold={lowStockThreshold}
        stockStatus={stockStatus}
      />
    </>
  );
}

// Re-export components for individual use
export { OverviewHeader } from './OverviewHeader';
export { QuickAddRemoveBar } from './QuickAddRemoveBar';
export { SizeVariantSelector } from './SizeVariantSelector';
export { StockSummaryCards } from './StockSummaryCards';
export { QuickActions } from './QuickActions';
export { InventoryValueCards } from './InventoryValueCards';
export { StockSettings } from './StockSettings';
export { StockLevelIndicator } from './StockLevelIndicator';
