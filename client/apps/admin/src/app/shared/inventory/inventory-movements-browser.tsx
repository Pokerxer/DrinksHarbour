'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiArrowsClockwise,
  PiArrowsLeftRight,
  PiBuildings,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiCaretUp,
  PiCheckSquare,
  PiCurrencyNgn,
  PiDownloadSimple,
  PiInfo,
  PiMagnifyingGlass,
  PiPackage,
  PiPrinter,
  PiReceipt,
  PiSquare,
  PiStack,
  PiTrayArrowDown,
  PiTruck,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import { SortIcon } from '@/components/list-controls';
import {
  inventoryService,
  type InventoryMovement,
} from '@/services/inventory.service';
import {
  DATE_PRESETS,
  DateTimeRange,
  GROUP_LABELS,
  GroupPanel,
  PAGE_SIZE,
  TYPE_COLOR,
  TYPE_LABEL,
  byLabel,
  exportCsv,
  fmtDate,
  fmtDateTime,
  fmtNgn,
  fmtTime,
  loadSaved,
  moveDate,
  persistSaved,
  printMoves,
  productLabel,
  qtyCls,
  qtySign,
  quarterLabel,
  referenceLabel,
  sizeLabel,
  toTs,
  warehouseLabel,
  weekLabel,
  type GroupKey,
  type SavedSearch,
  type SortCol,
  type SortDir,
} from './inventory-receipts-support';

const STATUS_CLS: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-amber-50 text-amber-600',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-50 text-red-600',
};

function lineCost(m: InventoryMovement) {
  return m.totalCost ?? (m.unitCost ?? 0) * Math.abs(m.quantity);
}

/** Warehouse cell label; transfers render "source → destination". */
function whCell(m: InventoryMovement): string {
  if (
    m.category === 'transfer' &&
    (m.sourceWarehouse || m.destinationWarehouse)
  ) {
    return `${warehouseLabel(m.sourceWarehouse)} → ${warehouseLabel(m.destinationWarehouse)}`;
  }
  return warehouseLabel(m.warehouse);
}

// ── Presets ───────────────────────────────────────────────────────────────────

export type MovesPresetKey =
  | 'receipts'
  | 'deliveries'
  | 'internal'
  | 'adjustments'
  | 'scrap'
  | 'moves';

interface Tab {
  key: string;
  label: string;
  /** undefined = "all" tab */
  match?: (m: InventoryMovement) => boolean;
}

interface Preset {
  title: string;
  sub: string;
  docTitle: string;
  csvPrefix: string;
  savedKey: string;
  /** Server-side movement filters */
  category?: string;
  types?: string[];
  tabs: Tab[];
  showSupplier: boolean;
  unitsLabel: string;
  emptyNoun: string;
}

const typeTab = (key: string, label: string): Tab => ({
  key,
  label,
  match: (m) => m.type === key,
});
const catTab = (key: string, label: string): Tab => ({
  key,
  label,
  match: (m) => m.category === key,
});

const PRESETS: Record<MovesPresetKey, Preset> = {
  receipts: {
    title: 'Receipts',
    sub: 'Incoming stock into your warehouses',
    docTitle: 'Goods Receipt Note',
    csvPrefix: 'inventory-receipts',
    savedKey: 'dh-inventory-receipt-searches',
    category: 'in',
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('received', 'Received'),
      typeTab('purchase', 'Purchases'),
      typeTab('return', 'Returns'),
      {
        key: 'other',
        label: 'Other',
        match: (m) => !['received', 'purchase', 'return'].includes(m.type),
      },
    ],
    showSupplier: true,
    unitsLabel: 'Units Received',
    emptyNoun: 'receipts',
  },
  deliveries: {
    title: 'Deliveries',
    sub: 'Outgoing stock — sales and shipments',
    docTitle: 'Delivery Note',
    csvPrefix: 'inventory-deliveries',
    savedKey: 'dh-inventory-delivery-searches',
    category: 'out',
    types: ['sold', 'shipped'],
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('sold', 'Sold'),
      typeTab('shipped', 'Shipped'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Issued',
    emptyNoun: 'deliveries',
  },
  internal: {
    title: 'Internal',
    sub: 'Moves between your warehouses and locations',
    docTitle: 'Internal Transfer Note',
    csvPrefix: 'inventory-internal',
    savedKey: 'dh-inventory-internal-searches',
    category: 'transfer',
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('transfer_in', 'Transfers In'),
      typeTab('transfer_out', 'Transfers Out'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Moved',
    emptyNoun: 'internal moves',
  },
  adjustments: {
    title: 'Adjustments',
    sub: 'Stock corrections outside normal operations',
    docTitle: 'Stock Adjustment Report',
    csvPrefix: 'inventory-adjustments',
    savedKey: 'dh-inventory-adjustment-searches',
    category: 'adjustment',
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('adjustment_in', 'Increases'),
      typeTab('adjustment_out', 'Decreases'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Adjusted',
    emptyNoun: 'adjustments',
  },
  scrap: {
    title: 'Scrap',
    sub: 'Stock removed as damaged, expired, stolen or written off',
    docTitle: 'Scrap Report',
    csvPrefix: 'inventory-scrap',
    savedKey: 'dh-inventory-scrap-searches',
    types: ['damaged', 'expired', 'theft', 'written_off'],
    tabs: [
      { key: 'all', label: 'All' },
      typeTab('damaged', 'Damaged'),
      typeTab('expired', 'Expired'),
      typeTab('theft', 'Theft'),
      typeTab('written_off', 'Written off'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Scrapped',
    emptyNoun: 'scrapped stock',
  },
  moves: {
    title: 'Moves History',
    sub: 'Every stock move across your warehouses',
    docTitle: 'Stock Moves Report',
    csvPrefix: 'inventory-moves',
    savedKey: 'dh-inventory-moves-searches',
    tabs: [
      { key: 'all', label: 'All' },
      catTab('in', 'In'),
      catTab('out', 'Out'),
      catTab('transfer', 'Transfer'),
      catTab('adjustment', 'Adjustment'),
    ],
    showSupplier: false,
    unitsLabel: 'Units Moved',
    emptyNoun: 'stock moves',
  },
};

// ── Detail panel ──────────────────────────────────────────────────────────────

function MoveDetail({
  move,
  docTitle,
  onClose,
}: {
  move: InventoryMovement;
  docTitle: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'document'>('details');
  const size = sizeLabel(move);
  const po = move.relatedPurchaseOrder as { poNumber?: string } | undefined;
  const isTransfer = move.category === 'transfer';

  const infoRows: { label: string; value: string }[] = [
    { label: 'Type', value: TYPE_LABEL[move.type] ?? move.type },
    ...(isTransfer
      ? [
          { label: 'From', value: warehouseLabel(move.sourceWarehouse) },
          { label: 'To', value: warehouseLabel(move.destinationWarehouse) },
        ]
      : [{ label: 'Warehouse', value: warehouseLabel(move.warehouse) }]),
    { label: 'Reference', value: move.reference ?? '—' },
    ...(po?.poNumber ? [{ label: 'Purchase Order', value: po.poNumber }] : []),
    ...(move.supplierName
      ? [{ label: 'Supplier', value: move.supplierName }]
      : []),
    ...(move.batchNumber ? [{ label: 'Batch', value: move.batchNumber }] : []),
    ...(move.lotNumber ? [{ label: 'Lot', value: move.lotNumber }] : []),
    ...(move.expirationDate
      ? [{ label: 'Expiry', value: fmtDate(move.expirationDate) }]
      : []),
    { label: 'Source', value: move.source ?? '—' },
    { label: 'By', value: byLabel(move) },
    ...(move.quantityBefore != null && move.quantityAfter != null
      ? [
          {
            label: 'Stock level',
            value: `${move.quantityBefore} → ${move.quantityAfter}`,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {referenceLabel(move)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[move.status] ?? STATUS_CLS.cancelled}`}
            >
              {move.status}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {fmtDateTime(moveDate(move))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => printMoves([move], docTitle)}
            title={`Print ${docTitle.toLowerCase()}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202]"
          >
            <PiPrinter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {(
          [
            {
              id: 'details',
              label: 'Details',
              icon: <PiInfo className="h-3.5 w-3.5" />,
            },
            {
              id: 'document',
              label: 'Document',
              icon: <PiReceipt className="h-3.5 w-3.5" />,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
              tab === t.id
                ? 'border-b-2 border-[#b20202] text-[#b20202]'
                : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              {
                label: 'Quantity',
                value: `${qtySign(move)}${Math.abs(move.quantity)}`,
                cls: qtyCls(move),
              },
              {
                label: 'Unit cost',
                value: move.unitCost != null ? fmtNgn(move.unitCost) : '—',
                cls: 'text-gray-900',
              },
              {
                label: 'Total cost',
                value: fmtNgn(lineCost(move)),
                cls: 'text-[#b20202]',
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {label}
                </p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-bold text-gray-900">
              {productLabel(move)}
            </p>
            {size && <p className="text-xs text-gray-400">{size}</p>}
          </div>

          <div className="space-y-1.5 border-b border-gray-100 px-5 py-3 text-xs">
            {infoRows.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="shrink-0 font-semibold text-gray-500">
                  {label}
                </span>
                <span className="truncate text-right font-medium capitalize text-gray-800">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {(move.reason || move.notes) && (
            <div className="px-5 py-3 text-xs">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Notes
              </p>
              <p className="text-gray-600">{move.reason ?? move.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between border-b-2 border-[#b20202] pb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{docTitle}</p>
                <p className="text-[10px] text-gray-400">
                  {fmtDateTime(moveDate(move))}
                </p>
              </div>
              <span className="text-[10px] font-extrabold text-[#b20202]">
                DRINKSHARBOUR
              </span>
            </div>
            <table className="mt-3 w-full text-[11px]">
              <tbody>
                {[
                  [
                    'Product',
                    `${productLabel(move)}${size ? ` · ${size}` : ''}`,
                  ],
                  ['Type', TYPE_LABEL[move.type] ?? move.type],
                  ['Warehouse', whCell(move)],
                  ['Reference', referenceLabel(move)],
                  ['Quantity', `${qtySign(move)}${Math.abs(move.quantity)}`],
                  [
                    'Unit cost',
                    move.unitCost != null ? fmtNgn(move.unitCost) : '—',
                  ],
                  ['Total', fmtNgn(lineCost(move))],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 pr-3 font-semibold text-gray-500">
                      {k}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-800">
                      {v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => printMoves([move], docTitle)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#b20202] py-2 text-xs font-bold text-white hover:bg-[#9a0101]"
            >
              <PiPrinter className="h-3.5 w-3.5" /> Print {docTitle}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main browser ──────────────────────────────────────────────────────────────

/**
 * Generalized stock-move browser in the POS Orders style. Each inventory
 * operations/report page renders it with a preset (receipts, deliveries,
 * internal, adjustments, scrap, moves) that sets the server filter, type tabs,
 * document title and saved-search key.
 */
export default function InventoryMovementsBrowser({
  preset: presetKey,
}: {
  preset: MovesPresetKey;
}) {
  const preset = PRESETS[presetKey];
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? null;

  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupKey | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [tabFilter, setTabFilter] = useState('all');
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryMovement | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [activePreset, setActivePreset] = useState('');

  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  useEffect(() => {
    setSavedSearches(loadSaved(preset.savedKey));
  }, [preset.savedKey]);

  const fetchMoves = useCallback(
    (all = false) => {
      if (sessionStatus === 'loading') return;
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      inventoryService
        .getMovements(token, {
          category: preset.category,
          limit: all ? 2000 : 500,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
        .then((raw) => {
          const res = raw as { data?: { movements?: InventoryMovement[] } };
          let rows = res.data?.movements ?? [];
          if (preset.types)
            rows = rows.filter((m) => preset.types!.includes(m.type));
          setMoves(rows);
          setTruncated(!all && (res.data?.movements?.length ?? 0) === 500);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [token, sessionStatus, preset]
  );

  useEffect(() => {
    fetchMoves();
  }, [fetchMoves]);
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);
  useEffect(() => {
    setPage(1);
  }, [
    search,
    tabFilter,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    warehouseFilter,
    supplierFilter,
    sortCol,
    sortDir,
  ]);

  const warehouses = useMemo(
    () =>
      Array.from(
        new Set(moves.map((m) => whCell(m)).filter((w) => w !== '—'))
      ).sort(),
    [moves]
  );
  const suppliers = useMemo(
    () =>
      Array.from(
        new Set(moves.map((m) => m.supplierName).filter(Boolean) as string[])
      ).sort(),
    [moves]
  );

  function saveSearch(name: string) {
    const entry: SavedSearch = {
      id: Date.now().toString(),
      name,
      query: search,
      groupBy,
    };
    const updated = [...savedSearches, entry];
    setSavedSearches(updated);
    persistSaved(updated, preset.savedKey);
  }
  function loadSavedSearch(s: SavedSearch) {
    setSearch(s.query);
    setGroupBy(s.groupBy);
    setPage(1);
  }
  function deleteSaved(id: string) {
    const updated = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updated);
    persistSaved(updated, preset.savedKey);
  }

  function applyPreset(p: (typeof DATE_PRESETS)[0]) {
    setDateFrom(p.from());
    setDateTo(p.to());
    setTimeFrom(p.tf);
    setTimeTo(p.tt);
    setActivePreset(p.label);
  }
  function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('00:00');
    setTimeTo('23:59');
    setActivePreset('');
  }
  function clearAllFilters() {
    setSearch('');
    setGroupBy(null);
    setTabFilter('all');
    clearDateRange();
    setWarehouseFilter('');
    setSupplierFilter('');
  }

  // ── Filter + sort ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...moves];

    const tab = preset.tabs.find((t) => t.key === tabFilter);
    if (tab?.match) list = list.filter(tab.match);

    if (dateFrom) {
      const fromTs = toTs(dateFrom, timeFrom);
      list = list.filter((m) => new Date(moveDate(m)).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs_ = toTs(dateTo, timeTo) + 59_000;
      list = list.filter((m) => new Date(moveDate(m)).getTime() <= toTs_);
    }

    if (warehouseFilter)
      list = list.filter((m) => whCell(m) === warehouseFilter);
    if (supplierFilter)
      list = list.filter((m) => m.supplierName === supplierFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          productLabel(m).toLowerCase().includes(q) ||
          (sizeLabel(m) ?? '').toLowerCase().includes(q) ||
          referenceLabel(m).toLowerCase().includes(q) ||
          (m.batchNumber ?? '').toLowerCase().includes(q) ||
          (m.supplierName ?? '').toLowerCase().includes(q) ||
          whCell(m).toLowerCase().includes(q) ||
          (TYPE_LABEL[m.type] ?? m.type).toLowerCase().includes(q) ||
          byLabel(m).toLowerCase().includes(q) ||
          fmtDate(moveDate(m)).toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'date':
          cmp =
            new Date(moveDate(a)).getTime() - new Date(moveDate(b)).getTime();
          break;
        case 'product':
          cmp = productLabel(a).localeCompare(productLabel(b));
          break;
        case 'type':
          cmp = (TYPE_LABEL[a.type] ?? a.type).localeCompare(
            TYPE_LABEL[b.type] ?? b.type
          );
          break;
        case 'warehouse':
          cmp = whCell(a).localeCompare(whCell(b));
          break;
        case 'reference':
          cmp = referenceLabel(a).localeCompare(referenceLabel(b));
          break;
        case 'qty':
          cmp = Math.abs(a.quantity) - Math.abs(b.quantity);
          break;
        case 'cost':
          cmp = lineCost(a) - lineCost(b);
          break;
        case 'by':
          cmp = byLabel(a).localeCompare(byLabel(b));
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [
    moves,
    preset.tabs,
    tabFilter,
    search,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    warehouseFilter,
    supplierFilter,
    sortCol,
    sortDir,
  ]);

  // Summary stats (filtered)
  const stats = useMemo(() => {
    const units = filtered.reduce((s, m) => s + Math.abs(m.quantity), 0);
    const cost = filtered.reduce((s, m) => s + lineCost(m), 0);
    const whSet = new Set(
      filtered.map((m) => whCell(m)).filter((w) => w !== '—')
    );
    const productSet = new Set(filtered.map((m) => productLabel(m)));
    const supplierSet = new Set(
      filtered.map((m) => m.supplierName).filter(Boolean)
    );
    const poSet = new Set(
      filtered
        .map(
          (m) => (m.relatedPurchaseOrder as { _id?: string } | undefined)?._id
        )
        .filter(Boolean)
    );
    return {
      count: filtered.length,
      units,
      cost,
      warehouses: whSet.size,
      products: productSet.size,
      suppliers: supplierSet.size,
      pos: poSet.size,
    };
  }, [filtered]);

  // Group by
  const grouped = useMemo((): [string, InventoryMovement[]][] | null => {
    if (!groupBy) return null;
    const map = new Map<string, InventoryMovement[]>();
    filtered.forEach((m) => {
      const d = new Date(moveDate(m));
      let key: string;
      switch (groupBy) {
        case 'warehouse':
          key = whCell(m);
          break;
        case 'type':
          key = TYPE_LABEL[m.type] ?? m.type;
          break;
        case 'product':
          key = productLabel(m);
          break;
        case 'supplier':
          key = m.supplierName || 'No supplier';
          break;
        case 'source':
          key = (m.source || 'manual').replace(/\b\w/g, (c) => c.toUpperCase());
          break;
        case 'day':
          key = fmtDate(moveDate(m));
          break;
        case 'week':
          key = weekLabel(d);
          break;
        case 'month':
          key = d.toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
          });
          break;
        case 'quarter':
          key = quarterLabel(d);
          break;
        case 'year':
          key = String(d.getFullYear());
          break;
        default:
          key = '—';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = grouped
    ? []
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const displayList = grouped ? filtered : paginated;
  const filteredTotalCost = filtered.reduce((s, m) => s + lineCost(m), 0);

  const allChecked =
    displayList.length > 0 && displayList.every((m) => checked.has(m._id));
  const someChecked = checked.size > 0 && !allChecked;
  const checkedMoves = moves.filter((m) => checked.has(m._id));
  const checkedUnits = checkedMoves.reduce(
    (s, m) => s + Math.abs(m.quantity),
    0
  );

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(displayList.map((m) => m._id)));
  }
  function toggleOne(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  }
  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  const hasAnyFilter =
    !!search ||
    !!dateFrom ||
    !!dateTo ||
    !!warehouseFilter ||
    !!supplierFilter ||
    tabFilter !== 'all' ||
    !!groupBy;

  const HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
    { col: 'date', label: 'Date & Time' },
    { col: 'product', label: 'Product' },
    { col: 'type', label: 'Type' },
    { col: 'warehouse', label: 'Warehouse' },
    { col: 'reference', label: 'Reference' },
    { col: 'qty', label: 'Qty', right: true },
    { col: 'cost', label: 'Cost', right: true },
    { col: 'by', label: 'By' },
  ];

  function renderRow(m: InventoryMovement, isSel: boolean) {
    const isChk = checked.has(m._id);
    const size = sizeLabel(m);
    return (
      <tr
        key={m._id}
        className={`cursor-pointer border-b border-gray-100/80 transition-colors ${
          isSel
            ? 'bg-[#b20202] text-white'
            : isChk
              ? 'border-l-2 border-l-[#b20202] bg-[#b20202]/5'
              : 'border-l-2 border-l-transparent hover:bg-gray-50/80'
        }`}
      >
        <td
          className="w-8 px-2 py-2.5 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => toggleOne(m._id)}
            className="text-gray-300 transition-colors hover:text-[#b20202]"
          >
            {isChk ? (
              <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
            ) : (
              <PiSquare className="h-4 w-4" />
            )}
          </button>
        </td>
        <td
          className="px-3 py-2.5"
          onClick={() => setSelected(isSel ? null : m)}
        >
          <div
            className={`text-xs font-medium leading-tight ${isSel ? 'text-white' : 'text-gray-800'}`}
          >
            {fmtDate(moveDate(m))}
          </div>
          <div
            className={`mt-0.5 font-mono text-[10px] ${isSel ? 'text-red-200' : 'text-gray-400'}`}
          >
            {fmtTime(moveDate(m))}
          </div>
        </td>
        <td
          className="max-w-[180px] px-3 py-2.5"
          onClick={() => setSelected(isSel ? null : m)}
        >
          <div
            className={`truncate text-xs font-semibold ${isSel ? 'text-white' : 'text-gray-800'}`}
          >
            {productLabel(m)}
          </div>
          {size && (
            <div
              className={`truncate text-[10px] ${isSel ? 'text-red-200' : 'text-gray-400'}`}
            >
              {size}
            </div>
          )}
        </td>
        <td
          className="px-3 py-2.5"
          onClick={() => setSelected(isSel ? null : m)}
        >
          {isSel ? (
            <span className="text-[11px] capitalize text-red-100">
              {TYPE_LABEL[m.type] ?? m.type}
            </span>
          ) : (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLOR[m.type] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {TYPE_LABEL[m.type] ?? m.type}
            </span>
          )}
        </td>
        <td
          className={`px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={() => setSelected(isSel ? null : m)}
        >
          {whCell(m)}
        </td>
        <td
          className={`max-w-[110px] truncate px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-500'}`}
          onClick={() => setSelected(isSel ? null : m)}
        >
          {referenceLabel(m)}
        </td>
        <td
          className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : qtyCls(m)}`}
          onClick={() => setSelected(isSel ? null : m)}
        >
          {qtySign(m)}
          {Math.abs(m.quantity)}
        </td>
        <td
          className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : 'text-gray-900'}`}
          onClick={() => setSelected(isSel ? null : m)}
        >
          {fmtNgn(lineCost(m))}
        </td>
        <td
          className={`max-w-[90px] truncate px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={() => setSelected(isSel ? null : m)}
        >
          {byLabel(m)}
        </td>
        <td
          className="w-8 px-2 py-2.5 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => printMoves([m], preset.docTitle)}
            className={`transition-colors ${isSel ? 'text-white/50 hover:text-white' : 'text-gray-300 hover:text-[#b20202]'}`}
          >
            <PiPrinter className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-47px)] flex-col overflow-hidden bg-gray-50">
      {/* ── Control bar ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        {/* Row 1: title + tabs + actions */}
        <div className="flex items-center gap-4 border-b border-gray-100 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-gray-900">
              {preset.title}
            </h1>
            <p className="mt-0.5 text-[11px] text-gray-400">
              <span className="font-medium text-gray-600">
                {filtered.length.toLocaleString()}
              </span>{' '}
              shown
              {filtered.length !== moves.length && (
                <span> of {moves.length.toLocaleString()} loaded</span>
              )}
              {truncated && (
                <button
                  type="button"
                  onClick={() => fetchMoves(true)}
                  className="ml-2 text-[#b20202] underline-offset-2 hover:underline"
                >
                  Load all →
                </button>
              )}
            </p>
          </div>

          {/* Type tabs */}
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {preset.tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTabFilter(t.key);
                  setSelected(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tabFilter === t.key
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPanel((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showPanel || groupBy
                    ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PiStack className="h-3.5 w-3.5" />
                {groupBy ? `Group: ${GROUP_LABELS[groupBy]}` : 'Group By'}
                {showPanel ? (
                  <PiCaretUp className="h-3 w-3" />
                ) : (
                  <PiCaretDown className="h-3 w-3" />
                )}
              </button>
              {showPanel && (
                <GroupPanel
                  groupBy={groupBy}
                  savedSearches={savedSearches}
                  onSetGroupBy={setGroupBy}
                  onSave={saveSearch}
                  onLoadSaved={loadSavedSearch}
                  onDeleteSaved={deleteSaved}
                  onClose={() => setShowPanel(false)}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchMoves()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => exportCsv(filtered, preset.csvPrefix)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Row 2: filters */}
        <div className="space-y-2.5 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Quick range
            </span>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  activePreset === p.label
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <DateTimeRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              timeFrom={timeFrom}
              timeTo={timeTo}
              onDateFrom={(v) => {
                setDateFrom(v);
                setActivePreset('');
              }}
              onDateTo={(v) => {
                setDateTo(v);
                setActivePreset('');
              }}
              onTimeFrom={(v) => {
                setTimeFrom(v);
                setActivePreset('');
              }}
              onTimeTo={(v) => {
                setTimeTo(v);
                setActivePreset('');
              }}
              onClear={clearDateRange}
            />

            <div className="mx-1 mt-5 w-px self-stretch bg-gray-100" />

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Warehouse
              </span>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {preset.showSupplier && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Supplier
                </span>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                >
                  <option value="">All suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mx-1 mt-5 w-px self-stretch bg-gray-100" />

            <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Search
              </span>
              <div className="relative">
                <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Product, reference, batch, warehouse…"
                  className="h-[34px] w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <PiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {hasAnyFilter && (
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex h-[34px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-100"
                >
                  <PiX className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
            )}

            {!groupBy && totalPages > 1 && (
              <div className="ml-auto flex items-end gap-1">
                <div className="flex h-[34px] items-center gap-1">
                  <span className="px-1 text-[11px] text-gray-400">
                    {page}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <PiCaretLeft className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <PiCaretRight className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid shrink-0 grid-cols-5 divide-x divide-gray-200 border-b border-gray-200 bg-white">
        {[
          {
            label: preset.title,
            value: stats.count.toLocaleString(),
            icon: <PiTrayArrowDown className="h-4 w-4" />,
            color: 'text-blue-600',
            sub: 'stock-move lines',
          },
          {
            label: preset.unitsLabel,
            value: stats.units.toLocaleString(),
            icon: <PiStack className="h-4 w-4" />,
            color: 'text-emerald-600',
            sub: 'in this view',
          },
          {
            label: 'Cost Value',
            value: fmtNgn(stats.cost),
            icon: <PiCurrencyNgn className="h-4 w-4" />,
            color: 'text-[#b20202]',
            sub: 'at unit cost',
          },
          {
            label: 'Warehouses',
            value: stats.warehouses.toLocaleString(),
            icon: <PiBuildings className="h-4 w-4" />,
            color: 'text-purple-600',
            sub: 'involved',
          },
          preset.showSupplier
            ? {
                label: 'Suppliers',
                value: stats.suppliers.toLocaleString(),
                icon: <PiTruck className="h-4 w-4" />,
                color: 'text-amber-500',
                sub: `${stats.pos} linked POs`,
              }
            : {
                label: 'Products',
                value: stats.products.toLocaleString(),
                icon: <PiPackage className="h-4 w-4" />,
                color: 'text-amber-500',
                sub: 'distinct products',
              },
        ].map(({ label, value, icon, color, sub }) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 ${color}`}>{icon}</span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
                {value}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Body (table + detail) ── */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected ? 'w-[58%]' : 'flex-1'}`}
        >
          {/* Selection bar */}
          {checked.size > 0 && (
            <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#b20202] bg-white px-4 py-2.5">
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="font-bold text-[#b20202]">{checked.size}</span>{' '}
                selected ·{' '}
                <span className="font-bold text-gray-900">
                  {checkedUnits.toLocaleString()} units
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => printMoves(checkedMoves, preset.docTitle)}
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#9a0101]"
              >
                <PiPrinter className="h-3.5 w-3.5" />
                Print{' '}
                {checked.size > 1 ? `${checked.size} Lines` : preset.docTitle}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex-1 overflow-hidden pt-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-gray-50 px-4 py-2.5"
                >
                  <div className="h-3 w-3 shrink-0 animate-pulse rounded bg-gray-100" />
                  {[90, 110, 70, 80, 70, 40, 60, 55].map((w, j) => (
                    <div
                      key={j}
                      className="h-3.5 animate-pulse rounded-md bg-gray-100"
                      style={{ width: w }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <PiTrayArrowDown className="h-8 w-8 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  {search
                    ? `No ${preset.emptyNoun} matching "${search}"`
                    : `No ${preset.emptyNoun} match the filters`}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Try adjusting the date range or clearing filters
                </p>
              </div>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-[#b20202] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-gray-300 transition-colors hover:text-[#b20202]"
                      >
                        {allChecked ? (
                          <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                        ) : someChecked ? (
                          <PiCheckSquare className="h-4 w-4 text-gray-400" />
                        ) : (
                          <PiSquare className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    {HEADERS.map(({ col, label, right }) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className={`cursor-pointer select-none px-3 py-3 transition-colors hover:text-gray-600 ${right ? 'text-right' : ''}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <SortIcon
                            col={col}
                            sortCol={sortCol}
                            sortDir={sortDir}
                          />
                        </span>
                      </th>
                    ))}
                    <th className="w-8 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {grouped
                    ? grouped.map(([groupName, groupMoves]) => {
                        const isCollapsed = !expandedGroups.has(groupName);
                        const groupCost = groupMoves.reduce(
                          (s, m) => s + lineCost(m),
                          0
                        );
                        const groupUnits = groupMoves.reduce(
                          (s, m) => s + Math.abs(m.quantity),
                          0
                        );
                        const share =
                          filteredTotalCost > 0
                            ? (groupCost / filteredTotalCost) * 100
                            : 0;
                        return (
                          <React.Fragment key={`group-${groupName}`}>
                            <tr
                              className="cursor-pointer select-none border-b border-gray-200 bg-gray-50/80 transition-colors hover:bg-gray-100"
                              onClick={() => toggleGroup(groupName)}
                            >
                              <td colSpan={10} className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <PiCaretRight
                                    className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                                  />
                                  <span className="text-xs font-semibold text-gray-700">
                                    {groupName}
                                  </span>
                                  <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-gray-500">
                                    {groupMoves.length}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-gray-500">
                                    {groupUnits.toLocaleString()} units
                                  </span>
                                  <div className="ml-1 flex max-w-[180px] flex-1 items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                                      <div
                                        className="h-full rounded-full bg-[#b20202] transition-all"
                                        style={{
                                          width: `${Math.min(100, share)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-9 text-right text-[10px] tabular-nums text-gray-400">
                                      {share.toFixed(1)}%
                                    </span>
                                  </div>
                                  <span className="ml-auto text-xs font-bold tabular-nums text-gray-800">
                                    {fmtNgn(groupCost)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed &&
                              groupMoves.map((m) =>
                                renderRow(m, selected?._id === m._id)
                              )}
                          </React.Fragment>
                        );
                      })
                    : paginated.map((m) =>
                        renderRow(m, selected?._id === m._id)
                      )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {!groupBy && totalPages > 1 && !loading && (
            <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5">
              <span className="text-[11px] text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length.toLocaleString()}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors ${
                        p === page
                          ? 'border-[#b20202] bg-[#b20202] text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Truncation notice */}
          {truncated && !loading && (
            <div className="flex shrink-0 items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs text-amber-700">
                <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
                Showing latest 500 lines — older records may be missing.
              </span>
              <button
                type="button"
                onClick={() => fetchMoves(true)}
                className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline"
              >
                Load all
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div
          className={`flex flex-col bg-white transition-all duration-200 ${selected ? 'flex-1 overflow-hidden' : 'w-72 shrink-0'}`}
        >
          {selected ? (
            <MoveDetail
              move={selected}
              docTitle={preset.docTitle}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner">
                <PiArrowsLeftRight className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Select a line
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Click any row to view details
                  <br />
                  and print its document
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
