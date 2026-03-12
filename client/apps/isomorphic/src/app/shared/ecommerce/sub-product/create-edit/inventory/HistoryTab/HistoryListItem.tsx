'use client';

import { Text, Badge, Button } from 'rizzui';
import { motion } from 'framer-motion';
import {
  PiCalendar,
  PiPath,
  PiArrowsDownUp,
  PiArrowsLeftRight,
  PiArrowCounterClockwise,
  PiPencil,
  PiArrowRight,
  PiPackage,
  PiPrinter,
  PiCheck,
} from 'react-icons/pi';
import type { StockAdjustment } from '../shared/types';

interface HistoryListItemProps {
  item: StockAdjustment;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
}

export function HistoryListItem({
  item,
  isSelected,
  onSelect,
  onClick,
}: HistoryListItemProps) {
  const getStatusBadgeClass = () => {
    switch (item.status) {
      case 'done':
        return 'bg-green-100 text-green-700 border border-green-200';
      case 'ready':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'waiting':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'pending':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'cancel':
        return 'bg-red-100 text-red-700 border border-red-200';
      case 'returned':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const getOperationIcon = () => {
    if (item.type === 'add' || item.operationType === 'receipt') {
      return <PiArrowsDownUp className="h-4 w-4 text-green-600 rotate-180" />;
    }
    if (item.type === 'remove' || item.operationType === 'delivery') {
      return <PiArrowsDownUp className="h-4 w-4 text-red-600" />;
    }
    if (item.operationType === 'transfer') {
      return <PiArrowsLeftRight className="h-4 w-4 text-blue-600" />;
    }
    if (item.type === 'return' || item.operationType === 'return') {
      return <PiArrowCounterClockwise className="h-4 w-4 text-amber-600" />;
    }
    return <PiPencil className="h-4 w-4 text-amber-600" />;
  };

  const getOperationLabel = () => {
    if (item.operationType === 'receipt') return 'Receipt';
    if (item.operationType === 'delivery') return 'Delivery';
    if (item.operationType === 'transfer') return 'Transfer';
    if (item.operationType === 'pos_order') return 'PoS Order';
    if (item.operationType === 'return') return 'Return';
    if (item.type === 'add') return 'Receipt';
    if (item.type === 'remove') return 'Delivery';
    if (item.type === 'transfer') return 'Transfer';
    if (item.type === 'return') return 'Return';
    return 'Adjustment';
  };

  const getStatusLabel = () => {
    switch (item.status) {
      case 'done':
        return 'Done';
      case 'ready':
        return 'Ready';
      case 'waiting':
        return 'Waiting';
      case 'pending':
        return 'Pending';
      case 'draft':
        return 'Draft';
      case 'cancel':
        return 'Cancelled';
      case 'returned':
        return 'Returned';
      default:
        return item.status;
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 },
      }}
      className={`rounded-xl border bg-white hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden group ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
      }`}
      onClick={onClick}
    >
      {/* Header with gradient */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="rounded border-gray-300 w-4 h-4 cursor-pointer"
          />
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass()}`}>
              {item.status === 'done' && <PiCheck className="mr-1 h-3 w-3" />}
              {getStatusLabel()}
            </span>
            {item.type === 'transfer' && (
              <Badge color="info" variant="flat" className="text-xs">
                <PiArrowsLeftRight className="mr-1 h-3 w-3" />
                Transfer
              </Badge>
            )}
            {item.type === 'return' && (
              <Badge color="warning" variant="flat" className="text-xs">
                <PiArrowCounterClockwise className="mr-1 h-3 w-3" />
                Return
              </Badge>
            )}
          </div>
          <Text
            className={`font-mono text-sm font-bold px-2 py-1 rounded ${
              item.type === 'transfer' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'
            }`}
          >
            {item.reference ||
              item.transferReference ||
              `WH/${item.operationType?.slice(0, 3).toUpperCase() || 'MOV'}/${item.id.slice(-5)}`}
          </Text>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.type === 'transfer' && (
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
              <Text className="font-semibold">{new Date(item.timestamp).toLocaleDateString()}</Text>
              <Text className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</Text>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <PiPath className="h-3 w-3 text-gray-400" />
                <Text className="text-xs text-gray-500 uppercase font-medium">Operation</Text>
              </div>
              <div className="flex items-center gap-2">
                {getOperationIcon()}
                <Text className="font-semibold text-sm">{getOperationLabel()}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* From/To */}
        <div className="p-4">
          <div className="space-y-3">
            {item.type === 'transfer' ? (
              <>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <Text className="text-xs text-purple-600 uppercase font-medium">
                      Transfer Route
                    </Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-center">
                      <Text className="text-xs text-gray-500">From</Text>
                      <Text className="font-semibold text-sm text-purple-700">
                        {item.fromLocationName || item.fromLocation || 'WH/Stock'}
                      </Text>
                    </div>
                    <PiArrowRight className="h-4 w-4 text-purple-400" />
                    <div className="flex-1 text-center">
                      <Text className="text-xs text-gray-500">To</Text>
                      <Text className="font-semibold text-sm text-purple-700">
                        {item.toLocationName || item.toLocation || 'WH/Stock'}
                      </Text>
                    </div>
                  </div>
                  {item.transferReference && (
                    <Text className="text-xs text-purple-500 mt-2 text-center font-mono">
                      Ref: {item.transferReference}
                    </Text>
                  )}
                </div>
                {item.transferNotes && (
                  <div className="mt-2">
                    <Text className="text-xs text-gray-500">Notes</Text>
                    <Text className="text-xs text-gray-700 mt-0.5">{item.transferNotes}</Text>
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
                  <Text className="font-semibold text-sm">
                    {item.fromLocation || (item.type === 'add' ? 'Vendors' : 'WH/Stock')}
                  </Text>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <PiArrowRight className="h-3 w-3 text-gray-400" />
                    <Text className="text-xs text-gray-500 uppercase font-medium">To</Text>
                  </div>
                  <Text className="font-semibold text-sm">
                    {item.toLocation || (item.type === 'remove' ? 'Customers' : 'WH/Stock')}
                  </Text>
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
              {item.sourceDocument || `Shop/${item.id.slice(-3)}`}
            </Text>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Text className="font-semibold">{item.productName || 'SubProduct'}</Text>
              {(item.lotNumber || item.serialNumber) && (
                <Text className="text-xs text-purple-600 mt-0.5">
                  {item.serialNumber ? `SN: ${item.serialNumber}` : `Lot: ${item.lotNumber}`}
                </Text>
              )}
              {(item.sizeVariant || item.sizeLabel) && (
                <Badge color="primary" variant="flat" className="mt-1 text-xs">
                  Size: {item.sizeLabel || item.sizeVariant}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <Text className="text-xs text-gray-500">Demand</Text>
                <Text className="font-bold text-lg">{item.demand || item.quantity}</Text>
              </div>
              <div className="text-center">
                <Text className="text-xs text-gray-500">Done</Text>
                <Text className="font-bold text-lg text-green-600">
                  {item.picked || item.quantity}
                </Text>
              </div>
              <div className="text-center">
                <Text className="text-xs text-gray-500">Unit</Text>
                <Text className="font-medium text-gray-600">{item.unit || 'units'}</Text>
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
  );
}
