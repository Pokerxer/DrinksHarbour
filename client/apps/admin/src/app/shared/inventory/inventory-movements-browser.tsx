'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowsClockwise,
  PiArrowsLeftRight,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiCaretUp,
  PiCheckSquare,
  PiDownloadSimple,
  PiMagnifyingGlass,
  PiPrinter,
  PiSignInDuotone,
  PiSquare,
  PiStack,
  PiTrayArrowDown,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
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
  weekLabel,
  whCell,
  type GroupKey,
  type SavedSearch,
  type SortCol,
  type SortDir,
} from './inventory-receipts-support';
import {
  PRESETS,
  lineCost,
  type MovesPresetKey,
} from './inventory-movements-presets';
import MoveDetail from './inventory-movements-detail';
import SummaryCards, { computeMoveStats } from './inventory-movements-summary';

const FETCH_LIMIT = 500;
const ALL_LIMIT = 2000;

const STATUS_OPTIONS = ['confirmed', 'pending', 'cancelled', 'rejected'] as const;

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
  const token = (session?.user as { token?: string })?.token ?? '';

  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupKey | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [tabFilter, setTabFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
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

  // Monotonic request id — only the latest fetch may commit state.
  const requestIdRef = useRef(0);
  // Whether any data has landed yet; drives skeleton vs background refresh.
  const hasDataRef = useRef(false);
  // Whether a "Load all" fetch already ran (hides the repeat call-to-action).
  const hasLoadedAllRef = useRef(false);

  useEffect(() => {
    setSavedSearches(loadSaved(preset.savedKey));
  }, [preset.savedKey]);

  const fetchMoves = useCallback(
    async (all = false) => {
      if (sessionStatus === 'loading') return;
      if (!token) {
        setLoading(false);
        return;
      }
      const requestId = ++requestIdRef.current;
      setErrorMsg(null);
      if (!hasDataRef.current || all) {
        hasLoadedAllRef.current = hasLoadedAllRef.current || all;
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const raw = await inventoryService.getMovements(token, {
          category: preset.category,
          limit: all ? ALL_LIMIT : FETCH_LIMIT,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        if (requestId !== requestIdRef.current) return;

        const res = raw as { data?: { movements?: InventoryMovement[] } };
        const fetched = res.data?.movements ?? [];
        let rows = fetched;
        if (preset.types)
          rows = rows.filter((m) => preset.types!.includes(m.type));

        hasDataRef.current = true;
        setMoves(rows);
        setTruncated(fetched.length >= (all ? ALL_LIMIT : FETCH_LIMIT));
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : `Failed to load ${preset.emptyNoun}`
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
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
    statusFilter,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    warehouseFilter,
    supplierFilter,
    sortCol,
    sortDir,
  ]);

  // Escape closes the detail panel.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const warehouses = useMemo(
    () =>
      Array.from(new Set(moves.map(whCell).filter((w) => w !== '\u2014'))).sort(),
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
    setStatusFilter('');
    clearDateRange();
    setWarehouseFilter('');
    setSupplierFilter('');
  }

  // ── Filter + sort ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...moves];

    const tab = preset.tabs.find((t) => t.key === tabFilter);
    if (tab?.match) list = list.filter(tab.match);

    if (statusFilter) list = list.filter((m) => m.status === statusFilter);

    if (dateFrom) {
      const fromTs = toTs(dateFrom, timeFrom);
      list = list.filter((m) => new Date(moveDate(m)).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs_ = toTs(dateTo, timeTo) + 59_000;
      list = list.filter((m) => new Date(moveDate(m)).getTime() <= toTs_);
    }

    if (warehouseFilter) list = list.filter((m) => whCell(m) === warehouseFilter);
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
          (m.reason ?? '').toLowerCase().includes(q) ||
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
    statusFilter,
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

  const stats = useMemo(
    () => computeMoveStats(filtered, whCell, productLabel),
    [filtered]
  );

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
        case 'reason':
          key = m.reason?.trim() || m.notes?.trim() || 'No reason recorded';
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
          key = '\u2014';
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
  const filteredTotalCost = stats.cost;

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
    !!statusFilter ||
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

  if (sessionStatus !== 'loading' && !token) {
    return (
      <div className="flex h-[calc(100dvh-47px)] flex-col items-center justify-center gap-3 bg-gray-50 text-center">
        <PiSignInDuotone className="h-10 w-10 text-gray-300" />
        <h1 className="text-lg font-bold text-gray-900">Sign in required</h1>
        <p className="max-w-sm text-sm text-gray-500">
          Sign in to your tenant account to view {preset.emptyNoun}.
        </p>
        <Link
          href={routes.signIn}
          className="mt-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

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
            aria-label={isChk ? 'Deselect line' : 'Select line'}
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
            aria-label={`Print ${preset.docTitle.toLowerCase()} for this line`}
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
              {preset.sub}
              {' \u00b7 '}
              <span className="font-medium text-gray-600">
                {filtered.length.toLocaleString()}
              </span>{' '}
              shown
              {filtered.length !== moves.length && (
                <span> of {moves.length.toLocaleString()} loaded</span>
              )}
              {refreshing && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-[#b20202]">
                  <PiArrowsClockwise className="h-3 w-3 animate-spin" />
                  updating…
                </span>
              )}
              {truncated && !refreshing && (
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
                aria-pressed={tabFilter === t.key}
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
                aria-expanded={showPanel}
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
              disabled={loading || refreshing}
              aria-label="Refresh list"
              title="Refresh list"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`}
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
                aria-pressed={activePreset === p.label}
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
                aria-label="Filter by warehouse"
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

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs capitalize text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
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
                  aria-label="Filter by supplier"
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
                  placeholder="Product, reference, batch, reason…"
                  aria-label="Search adjustments"
                  className="h-[34px] w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
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
                    aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <PiCaretLeft className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
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

      {/* ── Error banner ── */}
      {errorMsg && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2">
          <span className="flex items-center gap-2 text-xs text-red-700">
            <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMsg}
            {!hasDataRef.current && ' — showing no data.'}
          </span>
          <button
            type="button"
            onClick={() => fetchMoves()}
            className="rounded-lg bg-[#b20202] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#8f0202]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      <SummaryCards
        presetTitle={preset.title}
        unitsLabel={preset.unitsLabel}
        showSupplier={preset.showSupplier}
        stats={stats}
      />

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
                  {errorMsg && moves.length === 0
                    ? `Could not load ${preset.emptyNoun}`
                    : search
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
                        aria-label={allChecked ? 'Deselect all' : 'Select all'}
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
                        aria-sort={
                          sortCol === col
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
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
                                  <span className="max-w-[280px] truncate text-xs font-semibold text-gray-700">
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
                      aria-label={`Go to page ${p}`}
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
                Showing latest {moves.length.toLocaleString()} lines — older
                records may be missing.
              </span>
              {!hasLoadedAllRef.current && (
                <button
                  type="button"
                  onClick={() => fetchMoves(true)}
                  className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline"
                >
                  Load all
                </button>
              )}
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
                  and print its document · Esc closes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
