// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  PiPlus, PiMapPin, PiPencil, PiArrowsDownUp, PiSpinner,
  PiArrowClockwise, PiWarehouse, PiTrash, PiSnowflake,
  PiThermometer, PiWind, PiSun, PiList, PiX,
  PiArrowsLeftRight, PiToggleLeft, PiToggleRight,
} from 'react-icons/pi';
import type { Warehouse } from '@/services/warehouse.service';
import { warehouseService }  from '@/services/warehouse.service';
import { LocationAdjustModal } from './LocationAdjustModal';

interface LocationsTabProps {
  warehouses: Warehouse[];
  totalStock: number;
  isLoading?: boolean;
  token?: string;
  onAddLocation: () => void;
  onEditLocation: (wh: Warehouse) => void;
  onDeleteLocation: (wh: Warehouse) => void;
  onAdjustLocation?: (wh: Warehouse) => void; // optional: open parent transfer modal
  onRefresh?: () => void;
}

// ── Metadata maps ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; cls: string }> = {
  warehouse:           { label: 'Warehouse',     cls: 'bg-blue-100 text-blue-700' },
  store:               { label: 'Store',         cls: 'bg-emerald-100 text-emerald-700' },
  distribution_center: { label: 'Distribution',  cls: 'bg-purple-100 text-purple-700' },
  supplier:            { label: 'Supplier',       cls: 'bg-amber-100 text-amber-700' },
  transit:             { label: 'Transit',        cls: 'bg-sky-100 text-sky-700' },
  custom:              { label: 'Custom',         cls: 'bg-gray-100 text-gray-600' },
};

const STATUS_META: Record<string, { dot: string; badgeCls: string }> = {
  active:      { dot: 'bg-green-500',  badgeCls: 'bg-green-100 text-green-700' },
  inactive:    { dot: 'bg-gray-300',   badgeCls: 'bg-gray-100 text-gray-500' },
  maintenance: { dot: 'bg-amber-400',  badgeCls: 'bg-amber-100 text-amber-700' },
  full:        { dot: 'bg-red-400',    badgeCls: 'bg-red-100 text-red-600' },
  reserved:    { dot: 'bg-blue-400',   badgeCls: 'bg-blue-100 text-blue-700' },
};

const CONDITION_META: Record<string, { label: string; icon: React.ReactNode }> = {
  refrigerated:       { label: 'Refrigerated',      icon: <PiThermometer className="h-3 w-3" /> },
  frozen:             { label: 'Frozen',             icon: <PiSnowflake    className="h-3 w-3" /> },
  climate_controlled: { label: 'Climate Controlled', icon: <PiThermometer className="h-3 w-3" /> },
  dark_storage:       { label: 'Dark Storage',       icon: <PiSun          className="h-3 w-3" /> },
  ventilated:         { label: 'Ventilated',         icon: <PiWind         className="h-3 w-3" /> },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function binAddress(wh: Warehouse): string | null {
  const parts = [wh.zone, wh.aisle, wh.shelf, wh.bin].filter(Boolean);
  return parts.length ? parts.join(' › ') : null;
}

/**
 * The warehouse's own currentQuantity is only updated via explicit addMovement() calls
 * and is NOT kept in sync by the POS/order inventory flow. The authoritative stock numbers
 * always live on SubProduct. We prefer those when available.
 */
function stockNums(wh: Warehouse): { onHand: number; reserved: number; available: number } {
  const sp = typeof wh.subProduct === 'object' && wh.subProduct ? wh.subProduct : null;
  const onHand   = sp?.totalStock    ?? wh.currentQuantity  ?? 0;
  const reserved = sp?.reservedStock  ?? wh.reservedQuantity ?? 0;
  const available = sp?.availableStock ?? Math.max(0, onHand - reserved);
  return { onHand, reserved, available };
}

function capacityPct(wh: Warehouse): number {
  if (!wh.capacity || wh.capacity <= 0) return 0;
  const { onHand } = stockNums(wh);
  return Math.min(100, Math.round((onHand / wh.capacity) * 100));
}

function CapacityBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Movement history panel (per-location drill-down) ─────────────────────────

function LocationHistoryPanel({
  warehouse, token, onClose,
}: { warehouse: Warehouse; token: string; onClose: () => void }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    setError(null);
    warehouseService.getWarehouseInventory(warehouse._id, token, { page, limit: LIMIT })
      .then(res => {
        setMovements(res.data?.movements || []);
        setTotal(res.data?.pagination?.total || 0);
      })
      .catch(e => setError(e.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [warehouse._id, token, page]);

  const typeColor: Record<string, string> = {
    received:  'text-green-600',
    shipped:   'text-red-600',
    adjusted:  'text-blue-600',
    damaged:   'text-amber-600',
    returned:  'text-purple-600',
    transferred: 'text-sky-600',
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <PiMapPin className="h-3.5 w-3.5 text-gray-400" />
          <p className="text-xs font-bold text-gray-800">{warehouse.location} — Movement History</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
          <PiX className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <PiSpinner className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center text-xs text-red-500">{error}</div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <PiList className="h-8 w-8 text-gray-200" />
            <p className="mt-2 text-xs text-gray-400">No movements recorded for this location</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-400">Date</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">Qty</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">Before</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">After</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-400">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movements.map((mv: any, i: number) => {
                const dateStr = mv.createdAt
                  ? new Date(mv.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—';
                const timeStr = mv.createdAt
                  ? new Date(mv.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const tc = typeColor[mv.type] || 'text-gray-600';
                return (
                  <tr key={mv._id || i} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <p className="text-gray-700">{dateStr}</p>
                      <p className="text-[10px] text-gray-400">{timeStr}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-semibold capitalize ${tc}`}>
                        {(mv.type || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${tc}`}>
                      {mv.category === 'out' || mv.category === 'adjustment' ? '−' : '+'}{mv.quantity ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{mv.quantityBefore ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 font-medium">{mv.quantityAfter ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400 max-w-[120px] truncate">{mv.notes || mv.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2">
          <span className="text-[10px] text-gray-400">{total} total movements</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">Prev</button>
            <span className="px-2 py-1 text-xs text-gray-500">Page {page}</span>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main LocationsTab component ───────────────────────────────────────────────

export function LocationsTab({
  warehouses,
  totalStock,
  isLoading,
  token,
  onAddLocation,
  onEditLocation,
  onDeleteLocation,
  onAdjustLocation,
  onRefresh,
}: LocationsTabProps) {
  const [showInactive, setShowInactive]         = useState(false);
  const [adjustingWarehouse, setAdjustingWarehouse] = useState<Warehouse | null>(null);
  const [historyWarehouse, setHistoryWarehouse]   = useState<Warehouse | null>(null);

  const active   = warehouses.filter(w =>  w.isActive);
  const inactive = warehouses.filter(w => !w.isActive);
  const displayed = showInactive ? warehouses : active;

  function handleAdjust(wh: Warehouse) {
    if (token) {
      setAdjustingWarehouse(wh);
    } else {
      onAdjustLocation?.(wh);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-bold text-gray-900">Stock Locations</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {active.length}
          </span>
          {inactive.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInactive(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showInactive
                ? <PiToggleRight className="h-4 w-4 text-gray-700" />
                : <PiToggleLeft  className="h-4 w-4" />}
              {showInactive ? 'Hide' : 'Show'} {inactive.length} inactive
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <PiArrowClockwise className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button type="button" onClick={onAddLocation}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
            <PiPlus className="h-3.5 w-3.5" />
            Add Location
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <PiSpinner className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && active.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <PiWarehouse className="mx-auto h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">No stock locations configured</p>
          <p className="mt-1 text-xs text-gray-400">Add locations to track inventory across warehouses and stores</p>
          <button type="button" onClick={onAddLocation}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
            <PiPlus className="h-4 w-4" /> Add First Location
          </button>
        </div>
      )}

      {/* ── Location Cards ── */}
      {!isLoading && displayed.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map(wh => {
            const type       = TYPE_META[wh.locationType] || TYPE_META.custom;
            const stat       = STATUS_META[wh.status]     || STATUS_META.active;
            const pct        = capacityPct(wh);
            const bin        = binAddress(wh);
            const cond       = wh.condition && CONDITION_META[wh.condition];
            const { onHand, reserved, available } = stockNums(wh);
            const isInactive = !wh.isActive;

            return (
              <div key={wh._id}
                className={`group relative flex flex-col rounded-2xl border bg-white p-4 transition-all ${
                  isInactive
                    ? 'border-gray-100 opacity-60'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}>

                {/* Inactive banner */}
                {isInactive && (
                  <div className="absolute inset-x-0 top-0 flex items-center justify-center rounded-t-2xl bg-gray-100 py-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Inactive</span>
                  </div>
                )}

                {/* Card header */}
                <div className={`flex items-start justify-between gap-2 mb-3 ${isInactive ? 'mt-4' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`flex h-2 w-2 shrink-0 rounded-full ${stat.dot}`} />
                      <p className="text-sm font-bold text-gray-900 truncate">{wh.location}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${type.cls}`}>
                        {type.label}
                      </span>
                      {cond && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          {cond.icon}{cond.label}
                        </span>
                      )}
                    </div>
                    {bin && (
                      <p className="mt-1 font-mono text-[10px] text-gray-400 tracking-tight">{bin}</p>
                    )}
                  </div>

                  {/* Action buttons — visible on hover */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => handleAdjust(wh)}
                      title="Adjust stock"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                      <PiArrowsDownUp className="h-3.5 w-3.5" />
                    </button>
                    {token && (
                      <button type="button" onClick={() => setHistoryWarehouse(wh)}
                        title="View movement history"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <PiList className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => onEditLocation(wh)}
                      title="Edit location"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                      <PiPencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => onDeleteLocation(wh)}
                      title="Delete location"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Stock numbers */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-100 bg-gray-50 mb-3">
                  {[
                    { label: 'On Hand',   value: onHand,    cls: 'text-gray-800' },
                    { label: 'Reserved',  value: reserved,  cls: 'text-amber-600' },
                    { label: 'Available', value: available, cls: 'text-green-600' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="px-2 py-2.5 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                      <p className={`text-lg font-black tabular-nums leading-none mt-0.5 ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Capacity bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span>Capacity</span>
                    <span className="tabular-nums font-medium">
                      {onHand}{wh.capacity ? ` / ${wh.capacity} (${pct}%)` : ''}
                    </span>
                  </div>
                  <CapacityBar pct={pct} />
                </div>

                {/* Threshold badges */}
                {(wh.minStockLevel > 0 || wh.maxStockLevel > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {wh.minStockLevel > 0 && (
                      <span className="text-[10px] text-gray-400">
                        Min <span className="font-semibold text-gray-600">{wh.minStockLevel}</span>
                      </span>
                    )}
                    {wh.maxStockLevel > 0 && (
                      <span className="text-[10px] text-gray-400">
                        Max <span className="font-semibold text-gray-600">{wh.maxStockLevel}</span>
                      </span>
                    )}
                    {wh.minStockLevel > 0 && onHand <= wh.minStockLevel && (
                      <span className="ml-auto rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                        LOW STOCK
                      </span>
                    )}
                    {wh.capacity > 0 && pct >= 90 && (
                      <span className="ml-auto rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                        NEAR FULL
                      </span>
                    )}
                  </div>
                )}

                {/* Notes */}
                {wh.notes && (
                  <p className="mt-2 truncate text-[10px] italic text-gray-400">{wh.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Location history drill-down ── */}
      {historyWarehouse && token && (
        <LocationHistoryPanel
          warehouse={historyWarehouse}
          token={token}
          onClose={() => setHistoryWarehouse(null)}
        />
      )}

      {/* ── Summary Table ── */}
      {!isLoading && displayed.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold text-gray-700">Location Summary</p>
            <span className="text-[10px] text-gray-400">{displayed.length} location{displayed.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Location</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Bin</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">On Hand</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Reserved</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Available</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden md:table-cell">Capacity</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map(wh => {
                  const type  = TYPE_META[wh.locationType] || TYPE_META.custom;
                  const pct   = capacityPct(wh);
                  const bin   = binAddress(wh);
                  const { onHand: whOnHand, reserved: whReserved, available: whAvail } = stockNums(wh);
                  return (
                    <tr key={wh._id} className={`hover:bg-gray-50 ${!wh.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[wh.status]?.dot || 'bg-gray-300'}`} />
                          <span className="font-medium text-gray-800">{wh.location}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${type.cls}`}>
                          {type.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-gray-400 hidden sm:table-cell">
                        {bin || <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{whOnHand}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600">{whReserved}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-green-600">{whAvail}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {wh.capacity ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] tabular-nums text-gray-500">{pct}%</span>
                            <div className="w-16"><CapacityBar pct={pct} /></div>
                          </div>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button type="button" onClick={() => handleAdjust(wh)} title="Adjust stock"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                            <PiArrowsDownUp className="h-3.5 w-3.5" />
                          </button>
                          {token && (
                            <button type="button" onClick={() => setHistoryWarehouse(wh)} title="History"
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                              <PiList className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onAdjustLocation && (
                            <button type="button" onClick={() => onAdjustLocation(wh)} title="Transfer"
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-sky-600">
                              <PiArrowsLeftRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => onEditLocation(wh)} title="Edit"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                            <PiPencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => onDeleteLocation(wh)} title="Delete"
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                            <PiTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-2.5 text-xs font-bold text-gray-700" colSpan={3}>Total (active)</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-gray-800">
                    {active.reduce((s, w) => s + stockNums(w).onHand, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-amber-600">
                    {active.reduce((s, w) => s + stockNums(w).reserved, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-green-600">
                    {active.reduce((s, w) => s + stockNums(w).available, 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Adjust modal ── */}
      {adjustingWarehouse && token && (
        <LocationAdjustModal
          warehouse={adjustingWarehouse}
          token={token}
          onClose={() => setAdjustingWarehouse(null)}
          onSuccess={() => { setAdjustingWarehouse(null); onRefresh?.(); }}
        />
      )}
    </div>
  );
}
