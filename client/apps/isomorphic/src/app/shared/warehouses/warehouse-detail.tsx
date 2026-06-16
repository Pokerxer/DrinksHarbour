'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiArrowLeft,
  PiArrowsClockwise,
  PiArrowsDownUpBold,
  PiCaretUpBold,
  PiCaretDownBold,
  PiMagnifyingGlass,
  PiX,
  PiPackageBold,
  PiCubeBold,
  PiLockKeyBold,
  PiWarningBold,
  PiXCircleBold,
  PiCheckCircleBold,
  PiSlidersBold,
  PiDownloadSimpleBold,
  PiMapPin,
  PiEyeBold,
  PiStackBold,
} from 'react-icons/pi';
import { exportToCSV } from '@core/utils/export-to-csv';
import {
  warehouseService,
  type Warehouse,
  type WarehouseBatch,
} from '@/services/warehouse.service';
import {
  warehouseStockService,
  type WarehouseStockRow,
} from '@/services/warehouseStock.service';
import { routes } from '@/config/routes';

const LOW_STOCK = 10;

const skuOf = (r: WarehouseStockRow) =>
  typeof r.subProduct === 'object'
    ? (r.subProduct.sku ?? r.subProduct._id)
    : r.subProduct;
const nameOf = (r: WarehouseStockRow) =>
  typeof r.subProduct === 'object' ? (r.subProduct.product?.name ?? '') : '';
const sizeOf = (r: WarehouseStockRow) =>
  typeof r.size === 'object' ? (r.size.size ?? r.size._id) : r.size;
const imageOf = (r: WarehouseStockRow): string | null => {
  if (typeof r.subProduct !== 'object') return null;
  return (
    r.subProduct.imagesOverride?.[0]?.url ??
    r.subProduct.product?.images?.[0]?.url ??
    null
  );
};
const subProductIdOf = (r: WarehouseStockRow): string | null =>
  typeof r.subProduct === 'object' ? r.subProduct._id : (r.subProduct ?? null);
const sizeIdOf = (r: WarehouseStockRow): string | null =>
  typeof r.size === 'object' ? r.size._id : (r.size ?? null);
const viewHrefOf = (r: WarehouseStockRow): string | null => {
  const id = subProductIdOf(r);
  return id ? routes.eCommerce.editSubProduct(id) : null;
};

const availOf = (r: WarehouseStockRow) =>
  Math.max(0, r.currentQuantity - r.reservedQuantity);

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
const statusOf = (r: WarehouseStockRow): StockStatus => {
  if (r.currentQuantity <= 0) return 'out_of_stock';
  if (availOf(r) <= LOW_STOCK) return 'low_stock';
  return 'in_stock';
};
const STATUS_SEVERITY: Record<StockStatus, number> = {
  out_of_stock: 0,
  low_stock: 1,
  in_stock: 2,
};
const STATUS_LABEL: Record<StockStatus, string> = {
  out_of_stock: 'Out',
  low_stock: 'Low',
  in_stock: 'In stock',
};

const locationOf = (r: WarehouseStockRow) =>
  [r.zone, r.aisle, r.shelf, r.bin].filter(Boolean).join(' · ');

// ── Stats header (gradient cards, click to filter) ────────────────────────────────

type StatColor = 'blue' | 'green' | 'amber' | 'red';
const COLOR_MAP: Record<
  StatColor,
  { bg: string; text: string; iconBg: string; ring: string }
> = {
  blue: {
    bg: 'from-blue-500/10 to-blue-500/5',
    text: 'text-blue-600',
    iconBg: 'bg-blue-500',
    ring: 'ring-blue-500/30',
  },
  green: {
    bg: 'from-green-500/10 to-green-500/5',
    text: 'text-green-600',
    iconBg: 'bg-green-500',
    ring: 'ring-green-500/30',
  },
  amber: {
    bg: 'from-amber-500/10 to-amber-500/5',
    text: 'text-amber-600',
    iconBg: 'bg-amber-500',
    ring: 'ring-amber-500/30',
  },
  red: {
    bg: 'from-red-500/10 to-red-500/5',
    text: 'text-red-600',
    iconBg: 'bg-red-500',
    ring: 'ring-red-500/30',
  },
};

function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: { total: number; units: number; reserved: number; lowOut: number };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  const cards = [
    {
      id: '',
      label: 'Stock Lines',
      value: stats.total,
      icon: PiPackageBold,
      color: 'blue' as StatColor,
      sub: 'SKU · size combos',
    },
    {
      id: 'units',
      label: 'Units On Hand',
      value: stats.units,
      icon: PiCubeBold,
      color: 'green' as StatColor,
      sub: 'Total quantity',
    },
    {
      id: 'reserved',
      label: 'Reserved',
      value: stats.reserved,
      icon: PiLockKeyBold,
      color: 'amber' as StatColor,
      sub: 'Allocated to orders',
    },
    {
      id: 'low_out',
      label: 'Low / Out',
      value: stats.lowOut,
      icon: PiWarningBold,
      color: 'red' as StatColor,
      sub: 'Click to filter',
    },
  ];

  // Only the status cards act as filters.
  const filterable: Record<string, boolean> = { '': true, low_out: true };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((stat, index) => {
        const colors = COLOR_MAP[stat.color];
        const isActive = activeFilter === stat.id;
        const Icon = stat.icon;
        const clickable = filterable[stat.id];

        return (
          <motion.button
            key={stat.id}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            whileHover={clickable ? { scale: 1.02, y: -2 } : undefined}
            whileTap={clickable ? { scale: 0.98 } : undefined}
            onClick={() => clickable && onFilterChange(isActive ? '' : stat.id)}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left transition-all ${colors.bg} ${isActive ? 'ring-4 ' + colors.ring : ''} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-wider opacity-70 ${colors.text}`}
                >
                  {stat.label}
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums text-gray-900">
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform group-hover:scale-110 ${colors.iconBg}`}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-3 border-t border-black/5 pt-3 text-xs text-gray-400">
              {isActive ? 'Active — click to clear' : stat.sub}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StockStatus }) {
  const map = {
    in_stock: {
      cls: 'bg-green-50 text-green-700',
      icon: <PiCheckCircleBold className="h-3.5 w-3.5" />,
    },
    low_stock: {
      cls: 'bg-amber-50 text-amber-700',
      icon: <PiWarningBold className="h-3.5 w-3.5" />,
    },
    out_of_stock: {
      cls: 'bg-red-50 text-red-600',
      icon: <PiXCircleBold className="h-3.5 w-3.5" />,
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map.cls}`}
    >
      {map.icon}
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Batch expiry badge ──────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function ExpiryBadge({ expiryDate }: { expiryDate?: string | null }) {
  if (!expiryDate) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        No expiry
      </span>
    );
  }
  const days = Math.floor(
    (new Date(expiryDate).getTime() - Date.now()) / MS_PER_DAY
  );
  const dateStr = new Date(expiryDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const cls =
    days < 30
      ? 'bg-red-50 text-red-600'
      : days < 60
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600';
  const note = days < 0 ? 'expired' : days < 60 ? `${days}d left` : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {dateStr}
      {note && <span className="opacity-70">· {note}</span>}
    </span>
  );
}

// ── Expanded batch list (one stock row's lots) ───────────────────────────────────────

function BatchPanel({
  loading,
  batches,
}: {
  loading: boolean;
  batches: WarehouseBatch[] | undefined;
}) {
  if (loading) {
    return (
      <div className="space-y-2 px-5 py-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }
  if (!batches || batches.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-gray-400">
        No batches tracked for this line.
      </p>
    );
  }
  return (
    <div className="space-y-1.5 px-5 py-4">
      {batches.map((b) => (
        <div
          key={b._id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-100"
        >
          <span className="font-mono font-semibold text-gray-700">
            {b.batchNumber}
          </span>
          <span className="tabular-nums text-gray-500">{b.quantity} units</span>
          <span className="ml-auto">
            <ExpiryBadge expiryDate={b.expiryDate} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Product thumbnail ─────────────────────────────────────────────────────────────

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <PiPackageBold className="h-5 w-5 text-gray-300" />
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="h-11 w-11 animate-pulse rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-7 w-24 animate-pulse rounded-full bg-gray-100" />
        </motion.div>
      ))}
    </div>
  );
}

// ── Sortable header cell ──────────────────────────────────────────────────────────

type SortKey = 'name' | 'size' | 'onHand' | 'reserved' | 'available' | 'status';

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-gray-700 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-[#b20202]' : ''}`}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <PiCaretUpBold className="h-3 w-3" />
          ) : (
            <PiCaretDownBold className="h-3 w-3" />
          )
        ) : (
          <PiArrowsDownUpBold className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────────

export default function WarehouseDetail({
  warehouseId,
}: {
  warehouseId: string;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batchesByRow, setBatchesByRow] = useState<
    Record<string, WarehouseBatch[]>
  >({});
  const [batchLoading, setBatchLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [wh, stock] = await Promise.all([
        warehouseService.getWarehouseById(warehouseId, token),
        warehouseStockService.getWarehouseStock(warehouseId, token),
      ]);
      setWarehouse(wh.data);
      setRows(stock.data ?? []);
      setBatchesByRow({});
      setExpanded(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, warehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBatches = useCallback(
    async (r: WarehouseStockRow) => {
      if (expanded === r._id) {
        setExpanded(null);
        return;
      }
      setExpanded(r._id);
      if (batchesByRow[r._id] || !token) return;
      const subProduct = subProductIdOf(r);
      const size = sizeIdOf(r);
      if (!subProduct || !size) return;
      setBatchLoading(r._id);
      try {
        const res = await warehouseService.getBatches(warehouseId, token, {
          subProduct,
          size,
        });
        setBatchesByRow((prev) => ({ ...prev, [r._id]: res.data ?? [] }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load batches');
        setExpanded((cur) => (cur === r._id ? null : cur));
      } finally {
        setBatchLoading((cur) => (cur === r._id ? null : cur));
      }
    },
    [expanded, batchesByRow, token, warehouseId]
  );

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const stats = useMemo(() => {
    const units = rows.reduce((s, r) => s + r.currentQuantity, 0);
    const reserved = rows.reduce((s, r) => s + r.reservedQuantity, 0);
    const lowOut = rows.filter((r) => statusOf(r) !== 'in_stock').length;
    return { total: rows.length, units, reserved, lowOut };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (filter === 'low_out' && statusOf(r) === 'in_stock') return false;
      if (!q) return true;
      return (
        String(nameOf(r)).toLowerCase().includes(q) ||
        String(skuOf(r)).toLowerCase().includes(q) ||
        String(sizeOf(r)).toLowerCase().includes(q)
      );
    });

    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const val = (r: WarehouseStockRow): string | number => {
        switch (sortKey) {
          case 'name':
            return String(nameOf(r) || skuOf(r)).toLowerCase();
          case 'size':
            return String(sizeOf(r)).toLowerCase();
          case 'onHand':
            return r.currentQuantity;
          case 'reserved':
            return r.reservedQuantity;
          case 'available':
            return availOf(r);
          case 'status':
            return STATUS_SEVERITY[statusOf(r)];
        }
      };
      out.sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }
    return out;
  }, [rows, search, filter, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      onHand: filteredRows.reduce((s, r) => s + r.currentQuantity, 0),
      reserved: filteredRows.reduce((s, r) => s + r.reservedQuantity, 0),
      available: filteredRows.reduce((s, r) => s + availOf(r), 0),
    }),
    [filteredRows]
  );

  const handleExport = () => {
    if (filteredRows.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    const data = filteredRows.map((r) => ({
      product: nameOf(r) || 'Unnamed product',
      sku: skuOf(r),
      size: sizeOf(r),
      location: locationOf(r) || '—',
      onHand: r.currentQuantity,
      reserved: r.reservedQuantity,
      available: availOf(r),
      status: STATUS_LABEL[statusOf(r)],
    }));
    exportToCSV(
      data,
      'Product,SKU,Size,Location,On hand,Reserved,Available,Status',
      `stock-${warehouse?.code ?? warehouseId}`
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <Link
          href={routes.warehouses.list}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#b20202]"
        >
          <PiArrowLeft className="h-4 w-4" /> Warehouses
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10 text-[#b20202]">
              <PiPackageBold className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {warehouse?.name ?? 'Warehouse'}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                {warehouse?.code && (
                  <span className="font-mono font-semibold text-gray-700">
                    {warehouse.code}
                  </span>
                )}
                {warehouse?.type && (
                  <span className="capitalize">
                    {warehouse.type.replace('_', ' ')}
                  </span>
                )}
                {warehouse?.address &&
                  [warehouse.address.city, warehouse.address.state].filter(
                    Boolean
                  ).length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <PiMapPin className="h-3.5 w-3.5" />
                      {[warehouse.address.city, warehouse.address.state]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <PiDownloadSimpleBold className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <StatsHeader
        stats={stats}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, SKU or size…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-800 outline-none transition-all focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>

        {filter === 'low_out' && (
          <button
            type="button"
            onClick={() => setFilter('')}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
          >
            <PiSlidersBold className="h-3.5 w-3.5" />
            Low / Out only
            <PiX className="h-3.5 w-3.5" />
          </button>
        )}

        <span className="ml-auto text-sm text-gray-400">
          {filteredRows.length} of {rows.length} lines
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PiPackageBold className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">
              {rows.length === 0
                ? 'No stock in this warehouse yet'
                : 'No lines match your filter'}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {rows.length === 0
                ? 'Receive a purchase order or transfer stock in to populate this location.'
                : 'Try clearing the search or status filter.'}
            </p>
            {(search || filter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilter('');
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
              >
                <PiArrowsClockwise className="h-4 w-4" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <SortHeader
                    label="Product"
                    sortKey="name"
                    active={sortKey === 'name'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Size"
                    sortKey="size"
                    active={sortKey === 'size'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-5 py-3 text-left">Location</th>
                  <SortHeader
                    label="On hand"
                    sortKey="onHand"
                    active={sortKey === 'onHand'}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Reserved"
                    sortKey="reserved"
                    active={sortKey === 'reserved'}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Available"
                    sortKey="available"
                    active={sortKey === 'available'}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    active={sortKey === 'status'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence initial={false}>
                  {filteredRows.map((r) => {
                    const loc = locationOf(r);
                    const href = viewHrefOf(r);
                    const name = nameOf(r);
                    const isOpen = expanded === r._id;
                    return [
                      <motion.tr
                        key={r._id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`group transition-colors hover:bg-gray-50/60 ${isOpen ? 'bg-gray-50/60' : ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {href ? (
                              <Link href={href} className="shrink-0">
                                <Thumb
                                  src={imageOf(r)}
                                  alt={name || skuOf(r)}
                                />
                              </Link>
                            ) : (
                              <Thumb src={imageOf(r)} alt={name || skuOf(r)} />
                            )}
                            <div className="min-w-0">
                              {href ? (
                                <Link
                                  href={href}
                                  className="font-semibold text-gray-900 transition-colors hover:text-[#b20202]"
                                >
                                  {name || 'Unnamed product'}
                                </Link>
                              ) : (
                                <p className="font-semibold text-gray-900">
                                  {name || (
                                    <span className="text-gray-400">
                                      Unnamed product
                                    </span>
                                  )}
                                </p>
                              )}
                              <p className="font-mono text-xs text-gray-400">
                                {skuOf(r)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">
                          {sizeOf(r)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {loc || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-gray-900">
                          {r.currentQuantity}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-500">
                          {r.reservedQuantity}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold tabular-nums text-gray-900">
                          {availOf(r)}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={statusOf(r)} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleBatches(r)}
                              aria-expanded={isOpen}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${isOpen ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                              <PiStackBold className="h-3.5 w-3.5" />
                              Batches
                              {isOpen ? (
                                <PiCaretUpBold className="h-3 w-3" />
                              ) : (
                                <PiCaretDownBold className="h-3 w-3" />
                              )}
                            </button>
                            {href ? (
                              <Link
                                href={href}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#b20202] hover:bg-[#b20202]/5 hover:text-[#b20202]"
                              >
                                <PiEyeBold className="h-3.5 w-3.5" /> View
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-300">
                                <PiEyeBold className="h-3.5 w-3.5" /> View
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>,
                      isOpen ? (
                        <motion.tr
                          key={`${r._id}-batches`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="bg-gray-50/40"
                        >
                          <td colSpan={8} className="p-0">
                            <div className="border-l-2 border-[#b20202]/40">
                              <BatchPanel
                                loading={batchLoading === r._id}
                                batches={batchesByRow[r._id]}
                              />
                            </div>
                          </td>
                        </motion.tr>
                      ) : null,
                    ];
                  })}
                </AnimatePresence>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/70 text-sm font-bold text-gray-700">
                  <td className="px-5 py-3" colSpan={3}>
                    Totals · {filteredRows.length} lines
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {totals.onHand.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">
                    {totals.reserved.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {totals.available.toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
