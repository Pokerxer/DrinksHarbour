'use client';

// app/shared/warehouses/warehouse-analysis/control-bar.tsx
// The toolbar above the report: filters toggle, group-by chip, measure
// dropdown, sort stack, smart search, chart-type switch and view toggle.
// Popovers (sort picker, search suggestions) now close on Escape and outside
// press — previously only the search dropdown did.

import { useEffect, useRef, useState } from 'react';
import {
  PiArrowCounterClockwise,
  PiArrowDown,
  PiArrowUp,
  PiBuildings,
  PiCaretDown,
  PiChartBar,
  PiChartLine,
  PiChartPieSlice,
  PiFunnel,
  PiMagnifyingGlass,
  PiPackage,
  PiSlidersHorizontal,
  PiStack,
  PiTable,
  PiTag,
  PiX,
} from 'react-icons/pi';
import {
  ALL_GROUP_ITEMS,
  MEASURES,
  type ChartType,
  type GroupByKey,
  type Measure,
  type SortCriterion,
  type SortField,
  type ViewMode,
} from '../warehouse-analysis-helpers';
import { Dropdown, DropItem } from '../warehouse-analysis-charts';

const SORT_FIELD_LABELS: {
  field: SortField;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    field: 'value',
    label: 'Value',
    icon: <PiChartBar className="h-3.5 w-3.5 text-gray-400" />,
  },
  {
    field: 'label',
    label: 'Label',
    icon: <PiTag className="h-3.5 w-3.5 text-gray-400" />,
  },
  {
    field: 'lines',
    label: 'Lines',
    icon: <PiTable className="h-3.5 w-3.5 text-gray-400" />,
  },
];

export default function ControlBar({
  active,
  panelOpen,
  onTogglePanel,
  filtersCount,
  groupByStack,
  onClearGroupBy,
  measure,
  onMeasureChange,
  sortStack,
  onAddSort,
  onRemoveSort,
  onToggleSortDir,
  onResetSort,
  onSearchFilter,
  chartType,
  onChartTypeChange,
  viewMode,
  onViewModeChange,
}: {
  active: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  filtersCount: number;
  groupByStack: GroupByKey[];
  onClearGroupBy: () => void;
  measure: Measure;
  onMeasureChange: (m: Measure) => void;
  sortStack: SortCriterion[];
  onAddSort: (f: SortField) => void;
  onRemoveSort: (f: SortField) => void;
  onToggleSortDir: (f: SortField) => void;
  onResetSort: () => void;
  onSearchFilter: (
    prefix: 'product_search:' | 'warehouse_search:' | 'catname_search:',
    term: string
  ) => void;
  chartType: ChartType;
  onChartTypeChange: (t: ChartType) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close popovers on Escape / outside press.
  useEffect(() => {
    if (!sortOpen && !searchOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setSortOpen(false);
      setSearchOpen(false);
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (sortRef.current && !sortRef.current.contains(t)) setSortOpen(false);
      if (searchRef.current && !searchRef.current.contains(t))
        setSearchOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [sortOpen, searchOpen]);

  const measureLabel =
    MEASURES.find((m) => m.key === measure)?.label ?? measure;

  const submitSearch = (
    prefix: 'product_search:' | 'warehouse_search:' | 'catname_search:'
  ) => {
    onSearchFilter(prefix, searchText);
    setSearchText('');
    setSearchOpen(false);
  };

  const suggestionBtn =
    'flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50';

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onTogglePanel}
        aria-expanded={panelOpen}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
          active
            ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <PiFunnel className="h-3.5 w-3.5" />
        Filters &amp; Group By
        {(filtersCount > 0 || groupByStack.length > 0) && (
          <span className="rounded-full bg-[#b20202]/15 px-1.5 py-px text-[10px] font-bold">
            {filtersCount + groupByStack.length}
          </span>
        )}
      </button>

      {groupByStack.length > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-teal-700 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
          <PiStack className="h-3 w-3 shrink-0" />
          {groupByStack
            .map((k) => ALL_GROUP_ITEMS.find((g) => g.key === k)?.label ?? k)
            .join(' > ')}
          <button
            type="button"
            onClick={onClearGroupBy}
            aria-label="Clear group by"
            className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100"
          >
            <PiX className="h-3 w-3" />
          </button>
        </span>
      )}

      <Dropdown label={`Measure: ${measureLabel}`} icon={<PiChartBar className="h-3.5 w-3.5" />}>
        {MEASURES.map((m) => (
          <DropItem
            key={m.key}
            label={m.label}
            selected={measure === m.key}
            onClick={() => onMeasureChange(m.key)}
          />
        ))}
      </Dropdown>

      {/* Sort stack */}
      <div ref={sortRef} className="relative flex items-center gap-1.5">
        {sortStack.map((s) => {
          const lbl =
            SORT_FIELD_LABELS.find((f) => f.field === s.field)?.label ?? s.field;
          return (
            <span
              key={s.field}
              className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700"
            >
              <button
                type="button"
                onClick={() => onToggleSortDir(s.field)}
                className="flex items-center gap-0.5 transition-colors hover:text-sky-900"
                title="Toggle direction"
              >
                {s.dir === 'desc' ? (
                  <PiArrowDown className="h-3 w-3" />
                ) : (
                  <PiArrowUp className="h-3 w-3" />
                )}
                {lbl}
              </button>
              <button
                type="button"
                onClick={() => onRemoveSort(s.field)}
                aria-label={`Remove sort ${lbl}`}
                className="ml-0.5 rounded transition-colors hover:text-red-500"
              >
                <PiX className="h-2.5 w-2.5" />
              </button>
            </span>
          );
        })}

        {sortStack.length < 2 && (
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            aria-expanded={sortOpen}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition-colors ${
              sortOpen
                ? 'border-gray-300 bg-gray-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            } text-gray-500`}
          >
            <PiSlidersHorizontal className="h-3 w-3 text-gray-400" />
            Sort
            <PiCaretDown
              className={`h-2.5 w-2.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}

        {sortOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
            {SORT_FIELD_LABELS.filter(
              (f) => !sortStack.some((s) => s.field === f.field)
            ).map((f) => (
              <button
                key={f.field}
                type="button"
                onClick={() => {
                  onAddSort(f.field);
                  setSortOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                {f.icon}
                {f.label}
              </button>
            ))}
            {sortStack.length > 0 && (
              <div className="mt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    onResetSort();
                    setSortOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                >
                  <PiArrowCounterClockwise className="h-3.5 w-3.5" />
                  Reset sort
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smart search */}
      <div ref={searchRef} className="relative min-w-[200px] flex-1">
        <div className="relative">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch('product_search:');
            }}
            placeholder="Search product, warehouse, or category…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
          />
        </div>
        {searchOpen && searchText.trim() && (
          <div className="absolute left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            <button
              type="button"
              onMouseDown={() => submitSearch('product_search:')}
              className={suggestionBtn}
            >
              <PiPackage className="h-3.5 w-3.5 text-gray-400" />
              Search <strong>Product</strong> for &quot;{searchText.trim()}&quot;
            </button>
            <button
              type="button"
              onMouseDown={() => submitSearch('warehouse_search:')}
              className={suggestionBtn}
            >
              <PiBuildings className="h-3.5 w-3.5 text-gray-400" />
              Search <strong>Warehouse</strong> for &quot;{searchText.trim()}
              &quot;
            </button>
            <button
              type="button"
              onMouseDown={() => submitSearch('catname_search:')}
              className={suggestionBtn}
            >
              <PiTag className="h-3.5 w-3.5 text-gray-400" />
              Search <strong>Category</strong> for &quot;{searchText.trim()}
              &quot;
            </button>
          </div>
        )}
      </div>

      {/* Chart-type switch */}
      {viewMode === 'graph' && (
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(
            [
              { t: 'bar', icon: <PiChartBar className="h-4 w-4" /> },
              { t: 'line', icon: <PiChartLine className="h-4 w-4" /> },
              { t: 'pie', icon: <PiChartPieSlice className="h-4 w-4" /> },
              { t: 'table', icon: <PiTable className="h-4 w-4" /> },
            ] as { t: ChartType; icon: React.ReactNode }[]
          ).map(({ t, icon }) => (
            <button
              key={t}
              type="button"
              title={t}
              aria-pressed={chartType === t}
              onClick={() => onChartTypeChange(t)}
              className={`rounded-md p-1.5 transition-colors ${
                chartType === t
                  ? 'bg-[#b20202] text-white'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      {/* View toggle: Graph / Pivot */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
        <button
          type="button"
          onClick={() => onViewModeChange('graph')}
          aria-pressed={viewMode === 'graph'}
          title="Graph view"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'graph'
              ? 'bg-[#b20202] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <PiChartBar className="h-3.5 w-3.5" />
          Graph
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('pivot')}
          aria-pressed={viewMode === 'pivot'}
          title="Pivot table"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'pivot'
              ? 'bg-[#b20202] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <PiTable className="h-3.5 w-3.5" />
          Pivot
        </button>
      </div>
    </div>
  );
}
