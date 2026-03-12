'use client';

import { Text, Badge, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPlus, PiArrowsDownUp, PiArrowsLeftRight, PiPencil, PiArrowRight, PiSpinner, PiArrowsClockwise } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import { STOCK_MOVE_TYPES, getMoveIcon, WAREHOUSE_OPTIONS } from '../shared/constants';
import type { StockMove, SizeVariant } from '../shared/types';
import type { InventoryMovement } from '@/services/inventory.service';

interface MovesTabProps {
  stockMoves: StockMove[];
  serverMovements?: InventoryMovement[];
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  selectedSize: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onNewMove: (type?: StockMove['type']) => void;
}

export function MovesTab({
  stockMoves,
  serverMovements = [],
  hasSizeVariants,
  sizes,
  selectedSize,
  isLoading,
  onRefresh,
  onNewMove,
}: MovesTabProps) {
  // Use server movements if available, otherwise fall back to local
  const movesToDisplay = serverMovements.length > 0 
    ? serverMovements.map(m => ({
        id: m._id,
        type: m.type === 'received' || m.type === 'transfer_in' ? 'incoming' : 
              m.type === 'sold' || m.type === 'transfer_out' || m.type === 'damaged' ? 'outgoing' : 'internal',
        quantity: m.quantity,
        date: new Date(m.createdAt),
        reference: m.reference || m._id,
        status: m.status === 'completed' ? 'done' : 'draft',
        warehouseFrom: m.warehouse?._id || '',
        warehouseTo: '',
        productName: m.product?.name,
      }))
    : stockMoves;

  const getMoveTypeStats = (type: string) => {
    const moves = movesToDisplay.filter((m: any) => m.type === type);
    return {
      count: moves.length,
      total: moves.reduce((sum: number, m: any) => sum + m.quantity, 0),
    };
  };

  return (
    <motion.div variants={fieldStaggerVariants} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Text className="font-semibold">Stock Moves</Text>
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
          <Button onClick={() => onNewMove()}>
            <PiPlus className="mr-1 h-4 w-4" /> New Move
          </Button>
        </div>
      </div>

      {/* Move Type Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {STOCK_MOVE_TYPES.map((type) => {
          const IconComponent = getMoveIcon(type.iconName);
          const stats = getMoveTypeStats(type.value);
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onNewMove(type.value as StockMove['type'])}
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

      {/* Empty State or Moves List */}
      {movesToDisplay.length === 0 && !isLoading ? (
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
                {getMoveTypeStats('incoming').total}
              </Text>
              <Text className="text-xs text-green-600">{getMoveTypeStats('incoming').count} moves</Text>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <div className="flex items-center gap-2">
                <PiArrowsDownUp className="h-5 w-5 text-red-600" />
                <Text className="text-sm font-medium text-red-700">Outgoing</Text>
              </div>
              <Text className="text-2xl font-bold text-red-700 mt-1">
                {getMoveTypeStats('outgoing').total}
              </Text>
              <Text className="text-xs text-red-600">{getMoveTypeStats('outgoing').count} moves</Text>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-center gap-2">
                <PiArrowsLeftRight className="h-5 w-5 text-blue-600" />
                <Text className="text-sm font-medium text-blue-700">Internal</Text>
              </div>
              <Text className="text-2xl font-bold text-blue-700 mt-1">
                {getMoveTypeStats('internal').total}
              </Text>
              <Text className="text-xs text-blue-600">{getMoveTypeStats('internal').count} moves</Text>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2">
                <PiPencil className="h-5 w-5 text-amber-600" />
                <Text className="text-sm font-medium text-amber-700">Adjustments</Text>
              </div>
              <Text className="text-2xl font-bold text-amber-700 mt-1">
                {getMoveTypeStats('adjustment').total}
              </Text>
              <Text className="text-xs text-amber-600">
                {getMoveTypeStats('adjustment').count} moves
              </Text>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    From - To
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Source Doc
                  </th>
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
                      <Text className="font-medium font-mono text-blue-600">
                        {move.reference || move.id}
                      </Text>
                      {move.sizeLabel && (
                        <Badge color="primary" variant="flat" className="text-xs mt-1">
                          {move.sizeLabel}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        color={
                          move.type === 'incoming'
                            ? 'success'
                            : move.type === 'outgoing'
                            ? 'danger'
                            : move.type === 'internal'
                            ? 'info'
                            : 'warning'
                        }
                      >
                        {move.type === 'incoming'
                          ? 'Receipt'
                          : move.type === 'outgoing'
                          ? 'Delivery'
                          : move.type === 'internal'
                          ? 'Internal'
                          : 'Adjustment'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{move.quantity}</td>
                    <td className="px-4 py-3 text-sm">
                      {move.warehouseFrom || move.warehouseTo ? (
                        <div className="flex items-center gap-1">
                          <Text>
                            {WAREHOUSE_OPTIONS.find((w) => w.value === move.warehouseFrom)?.label ||
                              move.warehouseFrom ||
                              '-'}
                          </Text>
                          <PiArrowRight className="h-3 w-3 text-gray-400" />
                          <Text>
                            {WAREHOUSE_OPTIONS.find((w) => w.value === move.warehouseTo)?.label ||
                              move.warehouseTo ||
                              '-'}
                          </Text>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{move.sourceDocument || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        color={
                          move.status === 'done'
                            ? 'success'
                            : move.status === 'draft'
                            ? 'secondary'
                            : 'danger'
                        }
                      >
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
  );
}
