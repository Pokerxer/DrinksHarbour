'use client';

import { Text, Badge, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPlus, PiUpload, PiDownload, PiMapPin, PiPencil, PiArrowsDownUp, PiSpinner, PiArrowsClockwise } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import type { InventoryQuant, SizeVariant } from '../shared/types';
import type { Warehouse } from '@/services/warehouse.service';

interface LocationsTabProps {
  inventoryQuants: InventoryQuant[];
  totalStock: number;
  totalReserved: number;
  totalAvailable: number;
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  sizeStockMap: Record<string, number>;
  isLoading?: boolean;
  warehouses?: Warehouse[];
  onAddLocation: () => void;
  onEditLocation: (quant: InventoryQuant) => void;
  onAdjustLocation: (quant: InventoryQuant) => void;
  onRefresh?: () => void;
  onExport: () => void;
}

export function LocationsTab({
  inventoryQuants,
  totalStock,
  totalReserved,
  totalAvailable,
  hasSizeVariants,
  sizes,
  sizeStockMap,
  isLoading,
  warehouses,
  onAddLocation,
  onEditLocation,
  onAdjustLocation,
  onRefresh,
  onExport,
}: LocationsTabProps) {
  const activeQuants = inventoryQuants.filter((q) => q.isActive);

  const getLocationTypeColor = (type: string) => {
    switch (type) {
      case 'internal':
        return { bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'production':
        return { bg: 'bg-purple-100', text: 'text-purple-600' };
      case 'supplier':
        return { bg: 'bg-green-100', text: 'text-green-600' };
      case 'customer':
        return { bg: 'bg-amber-100', text: 'text-amber-600' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  return (
    <motion.div variants={fieldStaggerVariants} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text className="font-semibold text-lg">Stock Locations</Text>
          <Text className="text-sm text-gray-500">Manage inventory across different locations</Text>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <PiSpinner className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <PiArrowsClockwise className="mr-1 h-4 w-4" />
              )}
              Refresh
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddLocation}>
            <PiPlus className="mr-1 h-4 w-4" /> Add Location
          </Button>
          <Button variant="outline" size="sm">
            <PiUpload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <PiDownload className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <PiSpinner className="h-8 w-8 animate-spin text-blue-600" />
          <Text className="ml-2 text-gray-500">Loading locations...</Text>
        </div>
      )}

      {/* Location Cards */}
      {!isLoading && activeQuants.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <PiMapPin className="mx-auto h-12 w-12 text-gray-400" />
          <Text className="mt-3 text-gray-500">No locations configured</Text>
          <Text className="text-sm text-gray-400">Add warehouse locations to track inventory by location</Text>
          <Button className="mt-4" onClick={onAddLocation}>
            <PiPlus className="mr-1 h-4 w-4" /> Add First Location
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeQuants.map((quant) => {
          const colors = getLocationTypeColor(quant.locationType);
          return (
            <div
              key={quant.id}
              className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}>
                    <PiMapPin className={`h-5 w-5 ${colors.text}`} />
                  </div>
                  <div>
                    <Text className="font-semibold">{quant.locationName}</Text>
                    <Text className="text-xs text-gray-500 capitalize">{quant.locationType}</Text>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onEditLocation(quant)}
                    className="rounded p-1.5 hover:bg-gray-100"
                  >
                    <PiPencil className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => onAdjustLocation(quant)}
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

              {/* Size Variant Stock */}
              {hasSizeVariants && (
                <div className="border-t border-gray-100 pt-3">
                  <Text className="text-xs text-gray-500 mb-2">Stock by Size</Text>
                  <div className="flex flex-wrap gap-1">
                    {sizes.map((s) => (
                      <Badge key={s?.size} color="primary" variant="flat" className="text-xs">
                        {s?.label || s?.size}:{' '}
                        {sizeStockMap[s?.size]
                          ? Math.floor((sizeStockMap[s?.size] * quant.quantity) / (totalStock || 1))
                          : 0}
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
          );
        })}
        </div>
      )}

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
            {activeQuants.map((quant) => (
              <tr key={quant.id} className="border-t border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PiMapPin className="h-4 w-4 text-gray-400" />
                    <Text className="font-medium">{quant.locationName}</Text>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    color={
                      quant.locationType === 'internal'
                        ? 'primary'
                        : quant.locationType === 'production'
                        ? 'secondary'
                        : quant.locationType === 'supplier'
                        ? 'success'
                        : 'warning'
                    }
                    variant="flat"
                    className="text-xs capitalize"
                  >
                    {quant.locationType}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium">{quant.quantity}</td>
                <td className="px-4 py-3 text-right text-amber-600">{quant.reservedQuantity}</td>
                <td className="px-4 py-3 text-right text-green-600 font-medium">
                  {quant.availableQuantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {totalStock > 0 ? Math.round((quant.quantity / totalStock) * 100) : 0}%
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onAdjustLocation(quant)}
                      className="rounded p-1 hover:bg-gray-100 text-green-600"
                      title="Adjust Stock"
                    >
                      <PiArrowsDownUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEditLocation(quant)}
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
              <td className="px-4 py-3" colSpan={2}>
                Total
              </td>
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
  );
}
