// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button, Textarea, Select } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiWarehouse, PiPackage, PiArrowsDownUp, PiArrowsLeftRight, PiPlus, PiMinus,
  PiWarning, PiCheckCircle, PiCube, PiTrendUp, PiTrendDown, PiClock, PiCalendar,
  PiList, PiPencil, PiTrash, PiX, PiDownload, PiUpload, PiMapPin, PiPath,
  PiFactory, PiStorefront, PiTruck, PiRecycle, PiNumberSquareOne, PiNumberSquareTwo,
  PiDotsThree, PiWarningCircle, PiBell, PiChartLine, PiMagnifyingGlass, PiGear
} from 'react-icons/pi';

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
  { value: 'production', label: 'Production', type: 'production' },
  { value: 'supplier', label: 'Supplier Location', type: 'supplier' },
  { value: 'customer', label: 'Customer Location', type: 'customer' },
];

interface StockMove {
  id: string;
  type: 'incoming' | 'outgoing' | 'internal' | 'adjustment';
  quantity: number;
  locationFrom?: string;
  locationTo?: string;
  date: Date;
  reference: string;
  status: 'draft' | 'done' | 'cancel';
  notes?: string;
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

interface InventoryQuant {
  id: string;
  locationId: string;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lotId?: string;
  lotName?: string;
  incomingDate?: Date;
  expiryDate?: Date;
}

export default function ProductInventoryTracking() {
  const { register, control, watch, setValue, getValues } = useFormContext();
  
  const inventoryTracking = watch?.('inventoryTracking') || 'yes';
  const totalStock = watch?.('totalStock') ?? 0;
  const lowStockThreshold = watch?.('lowStockThreshold') ?? 10;
  const reorderPoint = watch?.('reorderPoint') ?? 5;
  const reorderQuantity = watch?.('reorderQuantity') ?? 50;
  const costPrice = watch?.('costPrice') ?? 0;
  const standardPrice = watch?.('standardPrice') ?? 0;
  const currency = watch?.('currency') || 'NGN';
  const tracking = watch?.('tracking') || 'none';
  const valuation = watch?.('valuation') || 'fifo';
  const routes = watch?.('routes') || [];
  
  const currencySymbol = currencySymbols[currency] || '₦';
  
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'moves' | 'rules' | 'settings'>('overview');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [moveForm, setMoveForm] = useState({
    type: 'incoming' as StockMove['type'],
    quantity: 0,
    locationFrom: '',
    locationTo: '',
    reference: '',
    notes: '',
  });
  const [ruleForm, setRuleForm] = useState({
    warehouseId: 'warehouse_main',
    locationId: 'stock_location',
    minQuantity: 10,
    maxQuantity: 50,
    quantityMultiple: 1,
    leadTime: 7,
  });
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [reorderingRules, setReorderingRules] = useState<ReorderingRule[]>([
    { id: '1', warehouseId: 'warehouse_main', warehouseName: 'Main Warehouse', locationId: 'stock_location', minQuantity: 10, maxQuantity: 50, quantityMultiple: 1, leadTime: 7, active: true },
  ]);
  const [inventoryQuants, setInventoryQuants] = useState<InventoryQuant[]>([
    { id: '1', locationId: 'stock_location', locationName: 'Stock Location', quantity: 100, reservedQuantity: 5, availableQuantity: 95 },
    { id: '2', locationId: 'warehouse_main', locationName: 'Main Warehouse', quantity: 50, reservedQuantity: 0, availableQuantity: 50 },
  ]);

  const totalAvailable = useMemo(() => {
    return inventoryQuants.reduce((sum, q) => sum + q.availableQuantity, 0);
  }, [inventoryQuants]);

  const totalReserved = useMemo(() => {
    return inventoryQuants.reduce((sum, q) => sum + q.reservedQuantity, 0);
  }, [inventoryQuants]);

  const inventoryValue = totalStock * standardPrice;

  const handleAddStockMove = () => {
    if (moveForm.quantity <= 0) return;
    
    const newMove: StockMove = {
      id: Date.now().toString(),
      ...moveForm,
      date: new Date(),
      status: 'done',
    };
    
    setStockMoves(prev => [newMove, ...prev]);
    
    if (moveForm.type === 'incoming') {
      const qty = moveForm.quantity;
      setValue?.('totalStock', (totalStock || 0) + qty);
    } else if (moveForm.type === 'outgoing') {
      const qty = moveForm.quantity;
      setValue?.('totalStock', Math.max(0, (totalStock || 0) - qty));
    }
    
    setShowMoveModal(false);
    setMoveForm({ type: 'incoming', quantity: 0, locationFrom: '', locationTo: '', reference: '', notes: '' });
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
      setValue?.('routes', currentRoutes.filter((r: string) => r !== route));
    } else {
      setValue?.('routes', [...currentRoutes, route]);
    }
  };

  const exportInventoryReport = () => {
    const report = {
      product: getValues?.('name') || 'Product',
      date: new Date().toISOString(),
      totalStock,
      availableStock: totalAvailable,
      reservedStock: totalReserved,
      inventoryValue,
      quants: inventoryQuants,
      moves: stockMoves,
      rules: reorderingRules,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const TrackingIcon = TRACKING_OPTIONS.find(t => t.value === tracking)?.icon || PiCube;

  return (
    <motion.div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'overview', label: 'Overview', icon: PiPackage },
          { id: 'locations', label: 'Locations', icon: PiMapPin },
          { id: 'moves', label: 'Stock Moves', icon: PiArrowsDownUp },
          { id: 'rules', label: 'Reordering', icon: PiRecycle },
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
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-blue-700">Total Stock</Text>
                <PiPackage className="h-5 w-5 text-blue-500" />
              </div>
              <Text className="text-3xl font-bold text-blue-700">{totalStock || 0}</Text>
              <Text className="mt-1 text-xs text-blue-600">units</Text>
            </div>
            
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-green-700">Available</Text>
                <PiCheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <Text className="text-3xl font-bold text-green-700">{totalAvailable}</Text>
              <Text className="mt-1 text-xs text-green-600">ready to sell</Text>
            </div>
            
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-amber-700">Reserved</Text>
                <PiClock className="h-5 w-5 text-amber-500" />
              </div>
              <Text className="text-3xl font-bold text-amber-700">{totalReserved}</Text>
              <Text className="mt-1 text-xs text-amber-600">pending orders</Text>
            </div>
            
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium text-purple-700">Inventory Value</Text>
                <PiTrendDown className="h-5 w-5 text-purple-500" />
              </div>
              <Text className="text-3xl font-bold text-purple-700">{currencySymbol}{inventoryValue.toLocaleString()}</Text>
              <Text className="mt-1 text-xs text-purple-600">at standard cost</Text>
            </div>
          </div>

          {/* Current Stock Card */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Current Stock</Text>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                type="number"
                label="Total Quantity"
                {...register('totalStock')}
                placeholder="0"
              />
              <Input
                type="number"
                label="Low Stock Alert Threshold"
                {...register('lowStockThreshold')}
                placeholder="10"
              />
              <Input
                type="number"
                label="Safety Stock"
                {...register('safetyStock')}
                placeholder="0"
              />
            </div>
          </div>

          {/* Forecast */}
          <div className="rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <Text className="font-semibold">Inventory Forecast</Text>
              <Button variant="outline" size="sm" onClick={exportInventoryReport}>
                <PiDownload className="mr-1 h-4 w-4" /> Export
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <Text className="text-sm text-gray-500">Reorder Point</Text>
                <Input
                  type="number"
                  {...register('reorderPoint')}
                  placeholder="5"
                  className="mt-1"
                />
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <Text className="text-sm text-gray-500">Reorder Quantity</Text>
                <Input
                  type="number"
                  {...register('reorderQuantity')}
                  placeholder="50"
                  className="mt-1"
                />
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <Text className="text-sm text-gray-500">Daily Sales Forecast</Text>
                <Input
                  type="number"
                  {...register('dailySalesForecast')}
                  placeholder="5"
                  className="mt-1"
                />
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <Text className="text-sm text-gray-500">Days Until Stockout</Text>
                <Text className="mt-2 text-xl font-bold text-gray-700">
                  {totalAvailable > 0 ? Math.floor(totalAvailable / 5) : '∞'}
                </Text>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Locations Tab */}
      {activeTab === 'locations' && (
        <motion.div className="space-y-6">
          <div className="flex items-center justify-between">
            <Text className="font-semibold">Stock by Location (Quants)</Text>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <PiUpload className="mr-1 h-4 w-4" /> Import
              </Button>
              <Button variant="outline" size="sm">
                <PiDownload className="mr-1 h-4 w-4" /> Export
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">On Hand</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Reserved</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Available</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryQuants.map((quant) => (
                  <tr key={quant.id} className="border-t border-gray-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PiMapPin className="h-4 w-4 text-gray-400" />
                        <Text className="font-medium">{quant.locationName}</Text>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{quant.quantity}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{quant.reservedQuantity}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{quant.availableQuantity}</td>
                    <td className="px-4 py-3 text-center">
                      <button className="rounded p-1 hover:bg-gray-100">
                        <PiPencil className="h-4 w-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{totalStock || 0}</td>
                  <td className="px-4 py-3 text-right">{totalReserved}</td>
                  <td className="px-4 py-3 text-right">{totalAvailable}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Location Breakdown</Text>
            <div className="space-y-3">
              {inventoryQuants.map((quant) => (
                <div key={quant.id} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <Text className="text-sm font-medium">{quant.locationName}</Text>
                      <Text className="text-sm text-gray-500">{quant.availableQuantity} / {quant.quantity}</Text>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div 
                        className="h-full bg-blue-500"
                        style={{ width: `${totalStock > 0 ? (quant.quantity / totalStock) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stock Moves Tab */}
      {activeTab === 'moves' && (
        <motion.div className="space-y-6">
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
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reference</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Quantity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">From → To</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMoves.map((move) => (
                    <tr key={move.id} className="border-t border-gray-200">
                      <td className="px-4 py-3 text-sm">{move.date.toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm font-medium">{move.reference || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge color={
                          move.type === 'incoming' ? 'success' :
                          move.type === 'outgoing' ? 'danger' :
                          move.type === 'internal' ? 'info' : 'warning'
                        }>
                          {move.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{move.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        {move.locationFrom && move.locationTo 
                          ? `${move.locationFrom} → ${move.locationTo}`
                          : move.type === 'incoming' ? 'Vendor → Stock'
                          : move.type === 'outgoing' ? 'Stock → Customer'
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color="success">{move.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Reordering Rules Tab */}
      {activeTab === 'rules' && (
        <motion.div className="space-y-6">
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

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <motion.div className="space-y-6">
          {/* Inventory Tracking */}
          <div className="rounded-xl border border-gray-200 p-6">
            <Text className="mb-4 font-semibold">Inventory Tracking</Text>
            <Controller
              name="inventoryTracking"
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
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        value === option.value 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
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
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    (routes || []).includes(route.value)
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
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
            <div className="space-y-4">
              <Controller
                name="valuation"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className="grid gap-4 md:grid-cols-3">
                    {VALUATION_METHODS.map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => onChange(method.value)}
                        className={`rounded-lg border-2 p-4 text-left transition-all ${
                          value === method.value 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Text className="font-medium">{method.label}</Text>
                        <Text className="mt-1 text-xs text-gray-500">{method.description}</Text>
                      </button>
                    ))}
                  </div>
                )}
              />
              
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <Input
                  type="number"
                  label="Cost / Standard Price"
                  {...register('standardPrice')}
                  placeholder="0.00"
                />
                <Input
                  type="number"
                  label="Costing Method"
                  {...register('costingMethod')}
                  placeholder="Auto"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Serial/Lot Settings */}
          {(tracking === 'serial' || tracking === 'lot') && (
            <div className="rounded-xl border border-gray-200 p-6">
              <Text className="mb-4 font-semibold">{tracking === 'serial' ? 'Serial' : 'Lot'} Number Settings</Text>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">Track Expiry Date</Text>
                    <Text className="text-xs text-gray-500">Track expiration for this product</Text>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <Text className="font-medium text-gray-700">Allow Negative Stock</Text>
                    <Text className="text-xs text-gray-500">Allow stock to go below zero</Text>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Stock Move Modal */}
      <AnimatePresence>
        {showMoveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowMoveModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    moveForm.type === 'incoming' ? 'bg-green-100' :
                    moveForm.type === 'outgoing' ? 'bg-red-100' :
                    moveForm.type === 'internal' ? 'bg-blue-100' : 'bg-amber-100'
                  }`}>
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
                <button type="button" onClick={() => setShowMoveModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Move Type</label>
                  <select
                    value={moveForm.type}
                    onChange={(e) => setMoveForm(prev => ({ ...prev, type: e.target.value as StockMove['type'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  >
                    {STOCK_MOVE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Quantity *</label>
                  <Input
                    type="number"
                    min="1"
                    value={moveForm.quantity}
                    onChange={(e) => setMoveForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    placeholder="Enter quantity"
                    className="text-lg"
                  />
                </div>

                {(moveForm.type === 'incoming' || moveForm.type === 'internal') && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Location From</label>
                    <select
                      value={moveForm.locationFrom}
                      onChange={(e) => setMoveForm(prev => ({ ...prev, locationFrom: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      <option value="">Select source...</option>
                      {LOCATION_OPTIONS.filter(l => l.value !== 'customer').map(loc => (
                        <option key={loc.value} value={loc.value}>{loc.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(moveForm.type === 'outgoing' || moveForm.type === 'internal') && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Location To</label>
                    <select
                      value={moveForm.locationTo}
                      onChange={(e) => setMoveForm(prev => ({ ...prev, locationTo: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      <option value="">Select destination...</option>
                      {LOCATION_OPTIONS.filter(l => l.value !== 'supplier').map(loc => (
                        <option key={loc.value} value={loc.value}>{loc.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Reference</label>
                  <Input
                    value={moveForm.reference}
                    onChange={(e) => setMoveForm(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="e.g., PO/2024/001"
                  />
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
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowMoveModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={handleAddStockMove}
                  disabled={moveForm.quantity <= 0}
                  className="flex-1"
                >
                  Confirm Move
                </Button>
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
                <button type="button" onClick={() => setShowRuleModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Warehouse</label>
                    <select
                      value={ruleForm.warehouseId}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, warehouseId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      {LOCATION_OPTIONS.filter(l => l.type === 'internal').map(loc => (
                        <option key={loc.value} value={loc.value}>{loc.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Location</label>
                    <select
                      value={ruleForm.locationId}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, locationId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    >
                      {LOCATION_OPTIONS.map(loc => (
                        <option key={loc.value} value={loc.value}>{loc.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Min Quantity</label>
                    <Input
                      type="number"
                      min="0"
                      value={ruleForm.minQuantity}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, minQuantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Max Quantity</label>
                    <Input
                      type="number"
                      min="0"
                      value={ruleForm.maxQuantity}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, maxQuantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Qty Multiple</label>
                    <Input
                      type="number"
                      min="1"
                      value={ruleForm.quantityMultiple}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, quantityMultiple: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Lead Time (days)</label>
                    <Input
                      type="number"
                      min="1"
                      value={ruleForm.leadTime}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, leadTime: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowRuleModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={handleAddRule}
                  disabled={ruleForm.minQuantity >= ruleForm.maxQuantity}
                  className="flex-1"
                >
                  Create Rule
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
