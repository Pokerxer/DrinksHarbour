'use client';

import { Fragment, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiBell, PiCaretDown, PiCaretLeft, PiCaretRight, PiColumns, PiExport,
  PiFileArrowDown, PiReceipt, PiFileText, PiGear, PiKanban, PiList,
  PiMagnifyingGlass, PiPlus, PiPrinter, PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder, type SalesOrderGroup } from '@/services/salesOrder.service';
import { printSalesDocs } from '@/utils/salesPrint';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import type {
  DocTypeFilter, ActiveFilter, GroupByKey, GroupBySubOption, DatePreset,
  SavedSearch, OptionalCol,
} from './sales-list-helpers';
import type { CustomGroup } from '../advanced-search/advanced-search-types';
import {
  PAGE_SIZE, FAVORITES_KEY, CUSTOM_GROUP_KEY, warehouseName, salespersonName,
  dateRange, downloadCsv, fmtDate, fmtDateTime, GROUP_OPTIONS, DATE_PRESETS,
} from './sales-list-helpers';
import SalesListActionDropdown from './sales-list-action-dropdown';
import SalesListGearDropdown from './sales-list-gear-dropdown';
import SalesListFilterPanel from './sales-list-filter-panel';
import SalesListColumnChooser, { OPTIONAL_COLS } from './sales-list-column-chooser';
import SalesListKanban from './sales-list-kanban';
import ActivitiesModal from './sales-list-activities-modal';
import SalesListSpreadsheet from './sales-list-spreadsheet';

function DocTypeBadge({ so }: { so: SalesOrder }) {
  if (so.docType === 'order') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        Sales Order
      </span>
    );
  }
  const qs = so.quoteStatus;
  if (qs === 'converted')
    return (
      <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
        Converted
      </span>
    );
  if (qs === 'accepted')
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
        Quotation Sent
      </span>
    );
  if (qs === 'rejected')
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        Cancelled
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
      Quotation
    </span>
  );
}

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div
            className="h-4 rounded bg-gray-100"
            style={{ width: `${60 + (i % 3) * 20}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

interface SalesListProps {
  defaultDocType?: DocTypeFilter;
}

export default function SalesList({ defaultDocType = 'all' }: SalesListProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUser = session?.user as
    | { token?: string; id?: string; _id?: string; name?: string }
    | undefined;
  const token = sessionUser?.token ?? '';
  const currentUserId = sessionUser?.id ?? sessionUser?._id ?? '';

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [serverGroups, setServerGroups] = useState<SalesOrderGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    const initial: ActiveFilter[] = [];
    if (defaultDocType === 'quotation')
      initial.push({ id: 'quotation', label: 'Quotations', type: 'docType', value: 'quotation' });
    if (defaultDocType === 'order')
      initial.push({ id: 'order', label: 'Sales Orders', type: 'docType', value: 'order' });
    return initial;
  });

  const [groupBy, setGroupBy] = useState<GroupByKey>('none');
  const [groupBySubOption, setGroupBySubOption] = useState<GroupBySubOption | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<SavedSearch[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_GROUP_KEY);
      return raw ? (JSON.parse(raw) as CustomGroup[]) : [];
    } catch {
      return [];
    }
  });
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [spreadsheetView, setSpreadsheetView] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  const [colChooserOpen, setColChooserOpen] = useState(false);
  const colChooserRef = useRef<HTMLDivElement>(null);
  const [optCols, setOptCols] = useState<OptionalCol[]>(OPTIONAL_COLS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activityOrderId, setActivityOrderId] = useState<string | null>(null);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when search or filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, activeFilters, groupBy, groupBySubOption]);

  // Fetch data from server
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const docFilter = activeFilters.find((f) => f.type === 'docType');
      const dateFilter = activeFilters.find((f) => f.type === 'date');
      const myFilter = activeFilters.find((f) => f.type === 'my');

      const params: Record<string, string | number | undefined> = {};
      if (groupBy === 'none') { params.page = page; params.limit = PAGE_SIZE; }
      if (debouncedSearch) params.search = debouncedSearch;
      if (docFilter?.value) params.docType = docFilter.value;
      if (myFilter) params.salesperson = currentUserId;

      // date preset → dateFrom/dateTo range
      if (dateFilter?.value) {
        const range = dateRange(dateFilter.value);
        if (range) {
          params.dateFrom = range[0].toISOString();
          params.dateTo = range[1].toISOString();
        }
      }

      // custom date range (overrides preset if both dateFrom/dateTo are set)
      if (dateFrom) params.dateFrom = new Date(dateFrom + 'T00:00:00').toISOString();
      if (dateTo) params.dateTo = new Date(dateTo + 'T23:59:59').toISOString();

      const customFilters = activeFilters.filter((f) => f.type === 'custom' && f.filterValue);
      if (customFilters.length > 0) {
        params.filters = JSON.stringify(customFilters.map((f) => f.filterValue));
      }

      // group-by params
      if (groupBy !== 'none') {
        params.groupBy = groupBy;
        if (groupBySubOption) params.groupBySubOption = groupBySubOption;
      }

      const res = await salesOrderService.list(token, params);
      if (res.groups) {
        setServerGroups(res.groups);
        setOrders(res.groups.flatMap((g) => g.docs));
        setTotal(res.groups.reduce((s, g) => s + g.count, 0));
        setTotalPages(1);
      } else {
        setServerGroups(null);
        setOrders(res.data ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedSearch, activeFilters, groupBy, groupBySubOption, currentUserId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(JSON.parse(raw) as SavedSearch[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CUSTOM_GROUP_KEY, JSON.stringify(customGroups)); } catch { /* ignore */ }
  }, [customGroups]);

  const persistFavorites = useCallback((next: SavedSearch[]) => {
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  function saveFavorite(name: string) {
    const fav: SavedSearch = { id: `${Date.now()}`, name, filters: activeFilters, groupBy, groupBySubOption, search };
    persistFavorites([...favorites, fav]);
    toast.success(`Saved "${name}"`);
  }

  function applyFavorite(fav: SavedSearch) {
    setActiveFilters(fav.filters);
    setGroupBy(fav.groupBy);
    setGroupBySubOption(fav.groupBySubOption);
    setSearch(fav.search);
  }

  function deleteFavorite(id: string) {
    persistFavorites(favorites.filter((f) => f.id !== id));
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
      if (colChooserRef.current && !colChooserRef.current.contains(e.target as Node)) setColChooserOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setFilterPanelOpen(false);
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target as Node)) setActionDropdownOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Groups from server (when groupBy is set) or computed client-side as fallback
  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    // Server-sent groups — use as-is
    if (serverGroups) {
      return serverGroups.map((g) => ({
        label: g._id,
        rows: g.docs as SalesOrder[],
        total: g.total,
        currency: g.currency,
      }));
    }
    // Client-side fallback (legacy path for ungrouped requests)
    const map = new Map<string, { label: string; rows: SalesOrder[]; total: number; currency: string }>();
    for (const o of orders) {
      let label = 'None';
      if (groupBy === 'salesperson') label = salespersonName(o);
      else if (groupBy === 'customer') label = o.customerSnapshot?.name || 'None';
      else if (groupBy === 'paymentMethod') label = o.paymentMethod || 'None';
      else if (groupBy === 'orderDate')
        label = o.createdAt
          ? new Date(o.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          : 'None';
      else if (groupBy === 'defaultSalesPriceInclude') label = 'N/A';
      const g = map.get(label) ?? { label, rows: [], total: 0, currency: o.currency };
      g.rows.push(o);
      g.total += o.total ?? 0;
      map.set(label, g);
    }
    return Array.from(map.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [orders, groupBy, serverGroups]);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  const allPageSelected = orders.length > 0 && orders.every((o) => selected.has(o._id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) orders.forEach((o) => next.delete(o._id));
      else orders.forEach((o) => next.add(o._id));
      return next;
    });
  }

  const selectedOrdersTotal = useMemo(
    () => orders.filter((o) => selected.has(o._id)).reduce((sum, o) => sum + (o.total ?? 0), 0),
    [orders, selected],
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCol(key: string) {
    setOptCols((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }

  function colVisible(key: string) { return optCols.find((c) => c.key === key)?.visible ?? false; }

  function addFilter(f: ActiveFilter) {
    setActiveFilters((prev) => {
      const without = prev.filter((x) => x.type !== f.type || x.id === f.id);
      return without.some((x) => x.id === f.id)
        ? without.filter((x) => x.id !== f.id)
        : [...without, f];
    });
  }

  function handleSetGroupBy(key: GroupByKey, subOption?: GroupBySubOption) {
    setGroupBy(key);
    setGroupBySubOption(subOption);
  }

  function setDateFilter(preset: DatePreset | null) {
    setActiveFilters((prev) => {
      const without = prev.filter((f) => f.type !== 'date');
      if (!preset) return without;
      const label = DATE_PRESETS.find((p) => p.value === preset)?.label ?? 'Create Date';
      return [...without, { id: `date-${preset}`, label, type: 'date', value: preset }];
    });
  }

  function removeFilter(id: string) {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }

  function clearFilters() {
    setActiveFilters([]);
    setDateFrom('');
    setDateTo('');
  }

  function addCustomGroup(group: CustomGroup) {
    setCustomGroups((prev) => [...prev, group]);
  }

  function removeCustomGroup(id: string) {
    setCustomGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function exportAll() {
    downloadCsv(orders, `sales-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportSelected() {
    const rows = orders.filter((o) => selected.has(o._id));
    downloadCsv(rows, `sales-selected-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function handleBulkCreateInvoice() {
    try {
      const res = await salesOrderService.bulkCreateInvoice(Array.from(selected), token);
      const ok = res.results.filter((r) => r.ok).length;
      toast.success(`Created ${ok} invoice(s)`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk create invoice failed');
    }
  }

  function handlePrint() {
    const rows = orders.filter((o) => selected.has(o._id));
    if (rows.length === 0) { toast.error('No orders selected'); return; }
    printSalesDocs(rows, 'quotation');
  }

  async function handleBulkAction(action: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast.error('No orders selected'); return; }
    try {
      let res;
      switch (action) {
        case 'export':
          exportSelected();
          return;
        case 'spreadsheet':
          toast.success('Insert in spreadsheet - coming soon');
          return;
        case 'duplicate':
          res = await salesOrderService.bulkDuplicate(ids, token);
          break;
        case 'delete':
          if (!window.confirm(`Delete ${ids.length} order(s)? This cannot be undone.`)) return;
          res = await salesOrderService.bulkDelete(ids, token);
          break;
        case 'accrued-revenue':
          res = await salesOrderService.bulkAccruedRevenue(ids, token);
          break;
        case 'create-invoice':
          res = await salesOrderService.bulkCreateInvoice(ids, token);
          break;
        case 'cancel':
          if (!window.confirm(`Cancel ${ids.length} order(s)?`)) return;
          res = await salesOrderService.bulkCancel(ids, token);
          break;
        case 'followers': {
          const actionType = window.prompt('Add or Remove? (add/remove)')?.toLowerCase();
          if (!actionType || !['add', 'remove'].includes(actionType)) return;
          const userId = window.prompt('User ID:');
          if (!userId) return;
          res = await salesOrderService.bulkFollowers(ids, actionType as 'add' | 'remove', userId, token);
          break;
        }
        case 'send-email': {
          const to = window.prompt('To (email):');
          if (!to) return;
          const subject = window.prompt('Subject:');
          if (!subject) return;
          const body = window.prompt('Body:');
          if (!body) return;
          res = await salesOrderService.bulkSendEmail(ids, to, subject, body, token);
          break;
        }
        case 'mark-sent':
          res = await salesOrderService.markAsSent(ids, token);
          break;
        default:
          toast.error(`Unknown action: ${action}`);
          return;
      }
      if (res) {
        const ok = res.results.filter((r) => r.ok).length;
        toast.success(`${action}: ${ok}/${ids.length} succeeded`);
      }
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Bulk ${action} failed`);
    }
  }

  function openImport() { fileInputRef.current?.click(); }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const docFilter = activeFilters.find((f) => f.type === 'docType');
      const docType = docFilter?.value === 'quotation' ? 'quotation' : 'order';
      const res = await salesOrderService.importCsv(text, docType, token);
      toast.success(`Created ${res.data.created} orders`);
      if (res.data.errors?.length) {
        toast.error(`${res.data.errors.length} import errors`);
        res.data.errors.slice(0, 5).forEach((err) => toast.error(`Row ${err.row}: ${err.message}`, { id: `import-err-${err.row}` }));
      }
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  }

  function toggleSpreadsheet() { setSpreadsheetView((v) => !v); }

  function openKnowledge() { window.open('https://help.drinksharbour.com', '_blank'); }

  const visibleColCount = 2 + (colVisible('creationDate') ? 1 : 0) + 1 +
    (colVisible('website') ? 1 : 0) + 1 + (colVisible('activities') ? 1 : 0) +
    (colVisible('untaxedAmount') ? 1 : 0) + (colVisible('total') ? 1 : 0) +
    (colVisible('warehouse') ? 1 : 0) + 1;

  const docFilter = activeFilters.find((f) => f.type === 'docType');
  const listTitle = docFilter
    ? docFilter.value === 'quotation' ? 'Quotations' : 'Sales Orders'
    : 'All Orders';

  function renderRow(o: SalesOrder) {
    return (
      <tr
        key={o._id}
        className={`group cursor-pointer transition-colors hover:bg-gray-50 ${
          selected.has(o._id) ? 'bg-brand/5' : ''
        }`}
        onClick={() => router.push(routes.eCommerce.salesDetails(o._id))}
      >
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected.has(o._id)}
            onChange={() => toggleRow(o._id)}
            className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            aria-label={`Select ${o.soNumber}`}
          />
        </td>
        <td className="px-3 py-3">
          <Link
            href={routes.eCommerce.salesDetails(o._id)}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-sm font-semibold text-brand hover:underline"
          >
            {o.soNumber}
          </Link>
        </td>
        {colVisible('creationDate') && (
          <td className="px-3 py-3 text-sm text-gray-600">{fmtDateTime(o.createdAt)}</td>
        )}
        <td className="px-3 py-3 text-sm text-gray-800">{o.customerSnapshot?.name ?? '—'}</td>
        {colVisible('website') && <td className="px-3 py-3 text-sm text-gray-500">—</td>}
        <td className="px-3 py-3 text-sm text-gray-600">
          {typeof o.salesperson === 'object' && o.salesperson ? o.salesperson.name : '—'}
        </td>
        {colVisible('activities') && (
          <td className="px-3 py-3 text-center">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActivityOrderId(o._id); }}
              className="inline-flex rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
              aria-label="View activities"
            >
              <PiBell className="h-3.5 w-3.5" />
            </button>
          </td>
        )}
        {colVisible('untaxedAmount') && (
          <td className="px-3 py-3 text-right text-sm text-gray-700">
            {fmtCur((o.total ?? 0) - (o.taxTotal ?? 0), o.currency)}
          </td>
        )}
        {colVisible('total') && (
          <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">
            {fmtCur(o.total, o.currency)}
          </td>
        )}
        {colVisible('warehouse') && (
          <td className="px-3 py-3 text-sm text-gray-600">{warehouseName(o)}</td>
        )}
        <td className="px-3 py-3"><DocTypeBadge so={o} /></td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col">
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImportFile} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={routes.eCommerce.createSale}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <PiPlus className="h-4 w-4" />
          New
        </Link>

        <div ref={gearRef} className="relative flex shrink-0 items-center">
          <span className="text-sm font-semibold text-gray-800">{listTitle}</span>
          <button
            type="button"
            onClick={() => setGearOpen((v) => !v)}
            title="Actions"
            className="ml-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="More actions"
          >
            <PiGear className="h-4 w-4" />
          </button>
          <SalesListGearDropdown
            open={gearOpen}
            onImport={openImport}
            onExport={exportAll}
            onKnowledge={openKnowledge}
            onSpreadsheet={toggleSpreadsheet}
            onClose={() => setGearOpen(false)}
          />
        </div>

        <div ref={searchRef} className="relative min-w-0 flex-1">
          <div
            className={`flex items-center rounded-lg border bg-white ${
              filterPanelOpen ? 'border-brand ring-2 ring-brand/20' : 'border-gray-200'
            }`}
          >
            <PiMagnifyingGlass className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
            <div className="flex flex-1 flex-wrap items-center gap-1 px-2 py-1.5">
              {activeFilters.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"
                >
                  {f.label}
                  <button type="button" onClick={() => removeFilter(f.id)} className="hover:text-brand-dark" aria-label={`Remove ${f.label} filter`}>
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {groupBy !== 'none' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Group: {GROUP_OPTIONS.find((g) => g.key === groupBy)?.label}
                  <button type="button" onClick={() => setGroupBy('none')} className="hover:text-indigo-900" aria-label="Clear grouping">
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              )}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setFilterPanelOpen(true)}
                placeholder={activeFilters.length || groupBy !== 'none' ? '' : 'Search…'}
                className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-gray-400"
                aria-label="Search orders"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterPanelOpen((v) => !v)}
              className="border-l border-gray-200 px-2 py-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              aria-label="Toggle filter panel"
            >
              <PiCaretDown className={`h-3.5 w-3.5 transition-transform ${filterPanelOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <SalesListFilterPanel
            open={filterPanelOpen}
            onClose={() => setFilterPanelOpen(false)}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onClearFilters={clearFilters}
            activeFilters={activeFilters}
            groupBy={groupBy}
            groupBySubOption={groupBySubOption}
            onSetGroupBy={handleSetGroupBy}
            onSetDate={setDateFilter}
            customGroups={customGroups}
            onAddCustomGroup={addCustomGroup}
            onRemoveCustomGroup={removeCustomGroup}
            favorites={favorites}
            onApplyFavorite={applyFavorite}
            onSaveFavorite={saveFavorite}
            onDeleteFavorite={deleteFavorite}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFrom={setDateFrom}
            onDateTo={setDateTo}
            triggerRef={searchRef as React.RefObject<HTMLDivElement | null>}
          />
        </div>

        {!loading && (
          <span className="shrink-0 text-sm text-gray-500">
            {total === 0
              ? '0'
              : groupBy !== 'none'
                ? `${groups?.length ?? 0} groups · ${orders.length}`
                : `${pageStart}–${pageEnd} / ${total}`}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" disabled={page <= 1 || groupBy !== 'none' || spreadsheetView} onClick={() => setPage((p) => p - 1)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Previous page">
            <PiCaretLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={page >= totalPages || groupBy !== 'none' || spreadsheetView} onClick={() => setPage((p) => p + 1)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Next page">
            <PiCaretRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
          <button type="button" onClick={() => { setView('list'); setSpreadsheetView(false); }}
            className={`rounded-md p-1.5 transition-colors ${view === 'list' && !spreadsheetView ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label="List view" aria-pressed={view === 'list' && !spreadsheetView}>
            <PiList className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setView('kanban'); setSpreadsheetView(false); }}
            className={`rounded-md p-1.5 transition-colors ${view === 'kanban' && !spreadsheetView ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label="Kanban view" aria-pressed={view === 'kanban' && !spreadsheetView}>
            <PiKanban className="h-4 w-4" />
          </button>
        </div>

        <div ref={colChooserRef} className="relative shrink-0">
          <button type="button" onClick={() => setColChooserOpen((v) => !v)} title="Optional columns"
            className={`rounded-lg border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50 ${colChooserOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
            aria-label="Toggle column chooser">
            <PiColumns className="h-4 w-4" />
          </button>
          <SalesListColumnChooser open={colChooserOpen} cols={optCols} onToggle={toggleCol} token={token} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 px-4 py-2.5">
          <span className="text-sm font-medium text-brand">{selected.size} selected</span>
          <span className="text-sm font-semibold text-gray-900">
            Total: {fmtCur(selectedOrdersTotal, orders.find((o) => selected.has(o._id))?.currency ?? 'NGN')}
          </span>
          <div className="h-4 w-px bg-brand/20" />
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-gray-600 hover:text-gray-900">
            Clear
          </button>
          <button
            type="button"
            onClick={handleBulkCreateInvoice}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiReceipt className="h-3.5 w-3.5" />
            Create Invoice
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiPrinter className="h-3.5 w-3.5" />
            Print
          </button>
          <div ref={actionDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setActionDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiFileArrowDown className="h-3.5 w-3.5" />
              Action
              <PiCaretDown className={`h-3 w-3 transition-transform ${actionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <SalesListActionDropdown
              open={actionDropdownOpen}
              onClose={() => setActionDropdownOpen(false)}
              onAction={handleBulkAction}
              triggerRef={actionDropdownRef}
            />
          </div>
        </div>
      )}

      {spreadsheetView ? (
        <SalesListSpreadsheet orders={orders} />
      ) : view === 'kanban' ? (
        <SalesListKanban orders={orders} isQuotation={docFilter?.value === 'quotation'} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                      aria-label="Select all on page" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Number</th>
                  {colVisible('creationDate') && (
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Creation Date</th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</th>
                  {colVisible('website') && (
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Website</th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Salesperson</th>
                  {colVisible('activities') && (
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Activities</th>
                  )}
                  {colVisible('untaxedAmount') && (
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Untaxed Amt</th>
                  )}
                  {colVisible('total') && (
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                  )}
                  {colVisible('warehouse') && (
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Warehouse</th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} cols={visibleColCount} />)
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColCount} className="py-20 text-center text-sm text-gray-400">
                      <PiFileText className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                      No records found
                    </td>
                  </tr>
                ) : groups ? (
                  groups.map((g) => {
                    const expanded = expandedGroups.has(g.label);
                    return (
                      <Fragment key={`grp-${g.label}`}>
                        <tr className="cursor-pointer bg-gray-50/70 hover:bg-gray-100" onClick={() => toggleGroup(g.label)}>
                          <td colSpan={visibleColCount} className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <PiCaretRight className={`h-3.5 w-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              <span className="font-semibold text-gray-800">{g.label}</span>
                              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">{g.rows.length}</span>
                              <span className="ml-auto text-sm font-semibold text-gray-900">{fmtCur(g.total, g.currency)}</span>
                            </div>
                          </td>
                        </tr>
                        {expanded && g.rows.map((o) => renderRow(o))}
                      </Fragment>
                    );
                  })
                ) : (
                  orders.map((o) => renderRow(o))
                )}
              </tbody>
            </table>
          </div>

          {!loading && groupBy === 'none' && total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">Showing {pageStart}–{pageEnd} of {total}</p>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = totalPages <= 5 ? i + 1
                    : page <= 3 ? i + 1
                    : page >= totalPages - 2 ? totalPages - 4 + i
                    : page - 2 + i;
                  return (
                    <button key={pg} type="button" onClick={() => setPage(pg)}
                      className={`min-w-[32px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        pg === page ? 'border-brand bg-brand text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {pg}
                    </button>
                  );
                })}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ActivitiesModal
        orderId={activityOrderId ?? ''}
        token={token}
        open={!!activityOrderId}
        onClose={() => setActivityOrderId(null)}
      />
    </div>
  );
}
