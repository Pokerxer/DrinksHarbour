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
  PiSquaresFourBold,
  PiRowsBold,
  PiFileCsvBold,
  PiFileXlsBold,
  PiFilePdfBold,
} from 'react-icons/pi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
import { fraunces } from '../purchases/purchases-fonts';

// Fallback low-stock threshold; overridden by the tenant's warehouse settings.
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
const statusOf = (
  r: WarehouseStockRow,
  lowStock: number = LOW_STOCK
): StockStatus => {
  if (r.currentQuantity <= 0) return 'out_of_stock';
  if (availOf(r) <= lowStock) return 'low_stock';
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

// ── Export ──────────────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'excel' | 'pdf';

type ExportColumn = {
  key: string;
  label: string;
  value: (r: WarehouseStockRow) => string | number;
  numeric?: boolean;
};

// Richer column set than the old CSV-only export: SKU, size, the full
// zone/aisle/shelf/bin breakdown and the derived available/status fields.
const buildExportColumns = (lowStock: number = LOW_STOCK): ExportColumn[] => [
  {
    key: 'product',
    label: 'Product',
    value: (r) => nameOf(r) || 'Unnamed product',
  },
  { key: 'sku', label: 'SKU', value: (r) => String(skuOf(r) ?? '') },
  { key: 'size', label: 'Size', value: (r) => String(sizeOf(r) ?? '') },
  { key: 'zone', label: 'Zone', value: (r) => r.zone ?? '' },
  { key: 'aisle', label: 'Aisle', value: (r) => r.aisle ?? '' },
  { key: 'shelf', label: 'Shelf', value: (r) => r.shelf ?? '' },
  { key: 'bin', label: 'Bin', value: (r) => r.bin ?? '' },
  {
    key: 'onHand',
    label: 'On Hand',
    value: (r) => r.currentQuantity,
    numeric: true,
  },
  {
    key: 'reserved',
    label: 'Reserved',
    value: (r) => r.reservedQuantity,
    numeric: true,
  },
  {
    key: 'available',
    label: 'Available',
    value: (r) => availOf(r),
    numeric: true,
  },
  {
    key: 'status',
    label: 'Status',
    value: (r) => STATUS_LABEL[statusOf(r, lowStock)],
  },
];

// Index of the three numeric columns (for right-alignment in PDF/Excel).
// Column positions are fixed regardless of the low-stock threshold.
const NUMERIC_COL_INDEXES = buildExportColumns().reduce<number[]>(
  (acc, c, i) => {
    if (c.numeric) acc.push(i);
    return acc;
  },
  []
);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const RGB_BRAND: [number, number, number] = [178, 2, 2];
const RGB_CREAM: [number, number, number] = [245, 240, 232];
const RGB_INK: [number, number, number] = [42, 36, 32];
const RGB_ALT: [number, number, number] = [250, 248, 243];

// ── Stats dashboard (brand-themed cards, click to filter) ─────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  active,
  clickable,
  index,
  onClick,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  active: boolean;
  clickable: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={clickable ? { y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.99 } : undefined}
      onClick={clickable ? onClick : undefined}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${
        active
          ? 'border-[#b20202]/40 ring-2 ring-[#b20202]/15'
          : 'border-[#ece4d6] hover:shadow-md'
      } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* accent rule */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
            {label}
          </p>
          <p
            className={`${fraunces.className} mt-1.5 text-3xl font-semibold tabular-nums text-[#2a2420]`}
          >
            {value.toLocaleString()}
          </p>
        </div>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 border-t border-[#f1ece2] pt-3 text-xs text-gray-400">
        {active ? 'Active — click to clear' : sub}
      </p>
    </motion.button>
  );
}

function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: { total: number; units: number; reserved: number; lowOut: number };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  // Accents drawn from the shared wine-label palette (warehouse-analysis-helpers).
  const cards = [
    {
      id: '',
      label: 'Stock Lines',
      value: stats.total,
      icon: PiPackageBold,
      accent: '#5b7da0',
      sub: 'SKU · size combos',
    },
    {
      id: 'units',
      label: 'Units On Hand',
      value: stats.units,
      icon: PiCubeBold,
      accent: '#3d6b5c',
      sub: 'Total quantity',
    },
    {
      id: 'reserved',
      label: 'Reserved',
      value: stats.reserved,
      icon: PiLockKeyBold,
      accent: '#c8932c',
      sub: 'Allocated to orders',
    },
    {
      id: 'low_out',
      label: 'Low / Out',
      value: stats.lowOut,
      icon: PiWarningBold,
      accent: '#b20202',
      sub: 'Click to filter',
    },
  ];

  // Only the status cards act as filters.
  const filterable: Record<string, boolean> = { '': true, low_out: true };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((stat, index) => {
        const isActive = activeFilter === stat.id;
        return (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value}
            sub={stat.sub}
            icon={stat.icon}
            accent={stat.accent}
            active={isActive}
            clickable={!!filterable[stat.id]}
            index={index}
            onClick={() => onFilterChange(isActive ? '' : stat.id)}
          />
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

function Thumb({
  src,
  alt,
  className = 'h-11 w-11',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 ${className}`}
    >
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

// ── Grid card (one stock line) ──────────────────────────────────────────────────────

function StockCard({
  r,
  isOpen,
  batchLoading,
  batches,
  onToggleBatches,
  lowStock,
}: {
  r: WarehouseStockRow;
  isOpen: boolean;
  batchLoading: boolean;
  batches: WarehouseBatch[] | undefined;
  onToggleBatches: (r: WarehouseStockRow) => void;
  lowStock: number;
}) {
  const status = statusOf(r, lowStock);
  const href = viewHrefOf(r);
  const name = nameOf(r);
  const loc = locationOf(r);
  const thumb = (
    <Thumb src={imageOf(r)} alt={name || skuOf(r)} className="h-14 w-14" />
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isOpen
          ? 'border-[#b20202]/40 ring-1 ring-[#b20202]/10'
          : 'border-[#ece4d6]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {href ? (
          <Link href={href} className="shrink-0">
            {thumb}
          </Link>
        ) : (
          thumb
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {href ? (
              <Link
                href={href}
                className="line-clamp-2 font-semibold leading-snug text-gray-900 transition-colors hover:text-[#b20202]"
              >
                {name || 'Unnamed product'}
              </Link>
            ) : (
              <p className="line-clamp-2 font-semibold leading-snug text-gray-900">
                {name || <span className="text-gray-400">Unnamed product</span>}
              </p>
            )}
            <StatusBadge status={status} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-gray-400">{skuOf(r)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              Size {sizeOf(r)}
            </span>
            {loc && (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <PiMapPin className="h-3.5 w-3.5" />
                {loc}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quantities */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60 text-center">
        <div className="px-2 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            On hand
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
            {r.currentQuantity}
          </p>
        </div>
        <div className="px-2 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Reserved
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-500">
            {r.reservedQuantity}
          </p>
        </div>
        <div className="px-2 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Available
          </p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-[#b20202]">
            {availOf(r)}
          </p>
        </div>
      </div>

      {/* Batches (expandable) */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="batches"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 bg-gray-50/40"
          >
            <div className="border-l-2 border-[#b20202]/40">
              <BatchPanel loading={batchLoading} batches={batches} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => onToggleBatches(r)}
          aria-expanded={isOpen}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            isOpen
              ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
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
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-[#b20202] hover:bg-[#b20202]/5 hover:text-[#b20202]"
          >
            <PiEyeBold className="h-3.5 w-3.5" /> View
          </Link>
        ) : (
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-3 py-2 text-xs font-medium text-gray-300">
            <PiEyeBold className="h-3.5 w-3.5" /> View
          </span>
        )}
      </div>
    </motion.div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-4 h-12 animate-pulse rounded-lg bg-gray-100" />
        </motion.div>
      ))}
    </div>
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
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [exportOpen, setExportOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batchesByRow, setBatchesByRow] = useState<
    Record<string, WarehouseBatch[]>
  >({});
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState(LOW_STOCK);

  // Tenant-global low-stock threshold from warehouse settings.
  useEffect(() => {
    if (!token) return;
    warehouseService
      .getWarehouseSettings(token)
      .then((res) => {
        const v = res?.data?.warehouseSettings?.lowStockThreshold;
        if (typeof v === 'number') setLowStock(v);
      })
      .catch(() => {});
  }, [token]);

  const exportColumns = useMemo(() => buildExportColumns(lowStock), [lowStock]);

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
    const lowOut = rows.filter(
      (r) => statusOf(r, lowStock) !== 'in_stock'
    ).length;
    return { total: rows.length, units, reserved, lowOut };
  }, [rows, lowStock]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (filter === 'low_out' && statusOf(r, lowStock) === 'in_stock')
        return false;
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
            return STATUS_SEVERITY[statusOf(r, lowStock)];
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
  }, [rows, search, filter, sortKey, sortDir, lowStock]);

  const totals = useMemo(
    () => ({
      onHand: filteredRows.reduce((s, r) => s + r.currentQuantity, 0),
      reserved: filteredRows.reduce((s, r) => s + r.reservedQuantity, 0),
      available: filteredRows.reduce((s, r) => s + availOf(r), 0),
    }),
    [filteredRows]
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (filteredRows.length === 0) {
        toast.error('Nothing to export');
        return;
      }

      const stamp = new Date();
      const code = warehouse?.code ?? warehouseId;
      const fileBase = `stock-${code}-${stamp.toISOString().slice(0, 10)}`;
      const warehouseName = warehouse?.name ?? 'Warehouse';

      // Context note describing the active search / status filter.
      const ctx: string[] = [];
      if (filter === 'low_out') ctx.push('Low / Out only');
      if (search.trim()) ctx.push(`Search: “${search.trim()}”`);
      const ctxNote = ctx.length ? ` · ${ctx.join(' · ')}` : '';

      // Footer totals cell per column.
      const totalCell = (key: string): string | number => {
        if (key === 'product') return `TOTAL · ${filteredRows.length} lines`;
        if (key === 'onHand') return totals.onHand;
        if (key === 'reserved') return totals.reserved;
        if (key === 'available') return totals.available;
        return '';
      };

      try {
        if (format === 'csv') {
          const esc = (v: string | number) => {
            const s = String(v ?? '');
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          };
          const lines = [
            exportColumns.map((c) => esc(c.label)).join(','),
            ...filteredRows.map((r) =>
              exportColumns.map((c) => esc(c.value(r))).join(',')
            ),
            exportColumns.map((c) => esc(totalCell(c.key))).join(','),
          ];
          downloadBlob(
            new Blob(['﻿' + lines.join('\r\n')], {
              type: 'text/csv;charset=utf-8;',
            }),
            `${fileBase}.csv`
          );
        } else if (format === 'excel') {
          const aoa: (string | number)[][] = [
            [warehouseName],
            [`Stock on hand${ctxNote}`],
            [
              `Code: ${warehouse?.code ?? '—'}    Type: ${
                warehouse?.type?.replace('_', ' ') ?? '—'
              }`,
            ],
            [`Generated: ${stamp.toLocaleString()}`],
            [],
            exportColumns.map((c) => c.label),
            ...filteredRows.map((r) => exportColumns.map((c) => c.value(r))),
            exportColumns.map((c) => totalCell(c.key)),
          ];
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws['!cols'] = [
            { wch: 30 },
            { wch: 16 },
            { wch: 10 },
            { wch: 8 },
            { wch: 8 },
            { wch: 8 },
            { wch: 8 },
            { wch: 10 },
            { wch: 10 },
            { wch: 10 },
            { wch: 11 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Stock');
          XLSX.writeFile(wb, `${fileBase}.xlsx`);
        } else {
          const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
          });
          const pageW = doc.internal.pageSize.getWidth();
          const M = 12;

          // Branded header bar.
          doc.setFillColor(...RGB_BRAND);
          doc.rect(0, 0, pageW, 16, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(warehouseName, M, 10);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text('STOCK ON HAND', pageW / 2, 10, { align: 'center' });
          doc.text(stamp.toLocaleString('en-GB'), pageW - M, 10, {
            align: 'right',
          });

          // Meta line.
          doc.setTextColor(90, 90, 90);
          doc.setFontSize(8);
          const addr = warehouse?.address
            ? [warehouse.address.city, warehouse.address.state]
                .filter(Boolean)
                .join(', ')
            : '';
          const metaBits = [
            warehouse?.code && `Code: ${warehouse.code}`,
            warehouse?.type && `Type: ${warehouse.type.replace('_', ' ')}`,
            addr && `Location: ${addr}`,
            `${filteredRows.length} lines${ctxNote}`,
          ]
            .filter(Boolean)
            .join('     ·     ');
          doc.text(metaBits, M, 23);

          autoTable(doc, {
            startY: 27,
            head: [exportColumns.map((c) => c.label)],
            body: filteredRows.map((r) =>
              exportColumns.map((c) => String(c.value(r)))
            ),
            foot: [exportColumns.map((c) => String(totalCell(c.key)))],
            styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
            headStyles: {
              fillColor: RGB_BRAND,
              textColor: 255,
              fontStyle: 'bold',
            },
            footStyles: {
              fillColor: RGB_CREAM,
              textColor: RGB_INK,
              fontStyle: 'bold',
            },
            alternateRowStyles: { fillColor: RGB_ALT },
            columnStyles: Object.fromEntries(
              NUMERIC_COL_INDEXES.map((i) => [i, { halign: 'right' as const }])
            ),
            margin: { left: M, right: M },
          });
          doc.save(`${fileBase}.pdf`);
        }
        toast.success(`Exported ${filteredRows.length} lines`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed');
      }
    },
    [
      filteredRows,
      warehouse,
      warehouseId,
      filter,
      search,
      totals,
      exportColumns,
    ]
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
      {/* ── Header ── */}
      <div>
        <Link
          href={routes.warehouses.list}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#b20202]"
        >
          <PiArrowLeft className="h-4 w-4" /> Warehouses
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#ece4d6] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10 text-[#b20202]">
              <PiPackageBold className="h-6 w-6" />
            </div>
            <div>
              <h1
                className={`${fraunces.className} text-2xl font-semibold text-[#2a2420]`}
              >
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                disabled={filteredRows.length === 0}
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PiDownloadSimpleBold className="h-4 w-4" />
                Export
                <PiCaretDownBold
                  className={`h-3 w-3 transition-transform ${exportOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {exportOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setExportOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-[#ece4d6] bg-white py-1 shadow-lg"
                  >
                    {(
                      [
                        {
                          fmt: 'csv',
                          label: 'CSV',
                          ext: '.csv',
                          icon: PiFileCsvBold,
                        },
                        {
                          fmt: 'excel',
                          label: 'Excel',
                          ext: '.xlsx',
                          icon: PiFileXlsBold,
                        },
                        {
                          fmt: 'pdf',
                          label: 'PDF',
                          ext: '.pdf',
                          icon: PiFilePdfBold,
                        },
                      ] as const
                    ).map(({ fmt, label, ext, icon: Icon }) => (
                      <button
                        key={fmt}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setExportOpen(false);
                          handleExport(fmt);
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-[#b20202]/5 hover:text-[#b20202]"
                      >
                        <Icon className="h-4 w-4 text-[#b20202]" />
                        <span className="font-medium">{label}</span>
                        <span className="ml-auto font-mono text-xs text-gray-400">
                          {ext}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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

        {/* View toggle */}
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#ece4d6] bg-white p-1">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            title="Grid view"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === 'grid'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <PiSquaresFourBold className="h-4 w-4" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
            title="Table view"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === 'table'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <PiRowsBold className="h-4 w-4" />
            Table
          </button>
        </div>
      </div>

      {/* ── Stock ── */}
      {loading ? (
        view === 'grid' ? (
          <GridSkeleton />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
            <LoadingSkeleton />
          </div>
        )
      ) : filteredRows.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
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
        </div>
      ) : view === 'grid' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {filteredRows.map((r) => (
                <StockCard
                  key={r._id}
                  r={r}
                  isOpen={expanded === r._id}
                  batchLoading={batchLoading === r._id}
                  batches={batchesByRow[r._id]}
                  onToggleBatches={toggleBatches}
                  lowStock={lowStock}
                />
              ))}
            </AnimatePresence>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-[#ece4d6] bg-white px-5 py-3 text-sm shadow-sm">
            <span className="mr-auto font-bold text-gray-700">
              Totals · {filteredRows.length} lines
            </span>
            <span className="text-gray-500">
              On hand{' '}
              <b className="tabular-nums text-gray-900">
                {totals.onHand.toLocaleString()}
              </b>
            </span>
            <span className="text-gray-500">
              Reserved{' '}
              <b className="tabular-nums text-gray-600">
                {totals.reserved.toLocaleString()}
              </b>
            </span>
            <span className="text-gray-500">
              Available{' '}
              <b className="tabular-nums text-[#b20202]">
                {totals.available.toLocaleString()}
              </b>
            </span>
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
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
                          <StatusBadge status={statusOf(r, lowStock)} />
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
        </div>
      )}
    </main>
  );
}
