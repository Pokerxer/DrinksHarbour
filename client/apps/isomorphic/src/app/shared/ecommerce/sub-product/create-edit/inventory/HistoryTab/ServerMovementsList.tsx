// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  PiPlus,
  PiMinus,
  PiArrowsLeftRight,
  PiSliders,
  PiTrash,
  PiArrowClockwise,
  PiPackage,
  PiSpinner,
} from 'react-icons/pi';
import type { InventoryMovement } from '@/services/inventory.service';

interface ServerMovementsListProps {
  movements: InventoryMovement[];
  isLoading: boolean;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;

type CategoryFilter = 'all' | 'in' | 'out' | 'transfer' | 'adjustment' | 'sale';

function getCategoryFilter(movement: InventoryMovement): CategoryFilter {
  if (movement.type === 'sold' || movement.type === 'shipped') return 'sale';
  if (movement.category === 'in') return 'in';
  if (movement.category === 'out') return 'out';
  if (movement.category === 'transfer') return 'transfer';
  if (movement.category === 'adjustment') return 'adjustment';
  return 'in';
}

function getIconStyle(category: string) {
  switch (category) {
    case 'in':
      return { bg: 'bg-green-100', text: 'text-green-600' };
    case 'out':
    case 'sale':
      return { bg: 'bg-red-100', text: 'text-red-600' };
    case 'transfer':
      return { bg: 'bg-blue-100', text: 'text-blue-600' };
    case 'adjustment':
      return { bg: 'bg-amber-100', text: 'text-amber-600' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function getIcon(category: string) {
  switch (category) {
    case 'in':
      return <PiPlus className="h-4 w-4" />;
    case 'out':
    case 'sale':
      return <PiMinus className="h-4 w-4" />;
    case 'transfer':
      return <PiArrowsLeftRight className="h-4 w-4" />;
    case 'adjustment':
      return <PiSliders className="h-4 w-4" />;
    default:
      return <PiPlus className="h-4 w-4" />;
  }
}

function getQtyColor(category: string) {
  if (category === 'in') return 'text-green-600';
  if (category === 'out' || category === 'sale') return 'text-red-600';
  return 'text-blue-600';
}

function getQtyPrefix(category: string) {
  if (category === 'in') return '+';
  if (category === 'out' || category === 'sale') return '-';
  return '~';
}

function formatType(type: string) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[d.getMonth()];
    const year = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${mon} ${year} · ${hh}:${mm}`;
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  let cls = '';
  if (status === 'confirmed') cls = 'bg-green-100 text-green-700';
  else if (status === 'pending') cls = 'bg-amber-100 text-amber-700';
  else if (status === 'cancelled') cls = 'bg-gray-100 text-gray-500';
  else cls = 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

const FILTER_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'In' },
  { id: 'out', label: 'Out' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'adjustment', label: 'Adjustment' },
  { id: 'sale', label: 'Sale' },
];

export function ServerMovementsList({
  movements,
  isLoading,
  onRefresh,
  onCancel,
}: ServerMovementsListProps) {
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [page, setPage] = useState(1);

  const filtered = movements.filter((m) => {
    if (activeFilter === 'all') return true;
    return getCategoryFilter(m) === activeFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleFilterChange = (f: CategoryFilter) => {
    setActiveFilter(f);
    setPage(1);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Movement History</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {filtered.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
        >
          <PiArrowClockwise className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-100 px-4 py-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleFilterChange(tab.id)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <PiSpinner className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PiPackage className="h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">No movements recorded yet</p>
          <p className="mt-1 text-xs text-gray-400">Movements will appear here once stock changes are recorded</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {paginated.map((movement) => {
            const cat = getCategoryFilter(movement);
            const iconStyle = getIconStyle(cat);
            const sizeName = movement.size?.displayName || movement.sizeName || null;
            const performedBy = movement.performedBy
              ? `${movement.performedBy.firstName || ''} ${movement.performedBy.lastName || ''}`.trim()
              : null;
            const canCancel = movement.status !== 'cancelled' && movement.category !== 'out';

            return (
              <div
                key={movement._id}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                {/* Left: icon + info */}
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconStyle.bg} ${iconStyle.text}`}
                  >
                    {getIcon(cat)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800">
                        {formatType(movement.type)}
                      </span>
                      {movement.reference && (
                        <span className="text-xs text-gray-400">#{movement.reference}</span>
                      )}
                      {sizeName && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {sizeName}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(movement.createdAt)}</p>
                    {(movement.reason || movement.notes) && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {movement.reason || movement.notes}
                      </p>
                    )}
                    {performedBy && (
                      <p className="mt-0.5 text-xs text-gray-400">By: {performedBy}</p>
                    )}
                  </div>
                </div>

                {/* Right: quantity + status + cancel */}
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <span className={`text-sm font-semibold ${getQtyColor(cat)}`}>
                    {getQtyPrefix(cat)}{movement.quantity}
                  </span>
                  {movement.quantityBefore !== undefined && movement.quantityAfter !== undefined ? (
                    <span className="text-xs text-gray-400">
                      {movement.quantityBefore} → {movement.quantityAfter}
                    </span>
                  ) : null}
                  <StatusBadge status={movement.status} />
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onCancel(movement._id)}
                      className="mt-0.5 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="Cancel movement"
                    >
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i));
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`rounded px-2 py-1 text-xs ${
                    page === pageNum ? 'bg-blue-100 font-medium text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
