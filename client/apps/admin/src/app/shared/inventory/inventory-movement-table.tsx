import React from 'react';
import {
  PiCaretRight,
  PiCheckSquare,
  PiSquare,
  PiPrinter,
  PiTrayArrowDown,
  PiWarningCircle,
} from 'react-icons/pi';
import { SortIcon } from '@/components/list-controls';
import type { InventoryMovement } from '@/services/inventory.service';
import MovementPagination from './inventory-movement-pagination';
import { fmtNgn } from './inventory-receipts-support';

import MovementRow from './inventory-movement-row';
import { movementGroupLabel } from './inventory-movement-groups';
import { movementStats } from './inventory-movement-view';
import { printMovementHistory as printMoves } from './inventory-movement-export';
import { buildMovementDocument } from './inventory-movement-document';
import { requestDocumentExport } from '@/utils/print/document-export';
import type { MovementBrowserView } from './use-movement-browser';

export default function MovementTable({ view }: { view: MovementBrowserView }) {
  const {
    preset,
    moves,
    loading,
    errorMsg,
    truncated,
    search,
    groupBy,
    sortCol,
    sortDir,
    page,
    setPage,
    selected,
    setSelected,
    checked,
    setChecked,
    expandedGroups,
    clearAllFilters,
    filtered,
    grouped,
    totalPages,
    paginated,
    filteredTotalCost,
    allChecked,
    someChecked,
    checkedMoves,
    checkedUnits,
    toggleAll,
    toggleOne,
    handleSort,
    toggleGroup,
    hasAnyFilter,
    HEADERS,
    exportDisabled,
  } = view;
  const renderRow = (move: InventoryMovement, isSelected: boolean) => (
    <MovementRow
      key={move._id}
      move={move}
      selected={isSelected}
      checked={checked.has(move._id)}
      select={() => setSelected(isSelected ? null : move)}
      toggle={() => toggleOne(move._id)}
      docTitle={preset.docTitle}
      receipt={preset.showSupplier}
      delivery={preset.showSource}
      internal={preset.showRoute}
      adjustment={preset.showReason}
      disabled={exportDisabled}
    />
  );
  return (
    <div
      className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected ? 'w-full lg:w-[65%]' : 'flex-1'}`}
    >
      {/* Selection bar */}
      {checked.size > 0 && (
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#b20202] bg-white px-4 py-2.5">
          <div className="flex-1 text-xs font-semibold text-gray-700">
            <span className="font-bold text-[#b20202]">{checked.size}</span> selected ·{' '}
            <span className="font-bold text-gray-900">{checkedUnits.toLocaleString()} units</span>
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
            disabled={exportDisabled}
            onClick={() =>
              preset.individualDocument && checkedMoves.length === 1
                ? requestDocumentExport(buildMovementDocument(checkedMoves[0], preset.docTitle))
                : printMoves(
                    checkedMoves,
                    preset.historyTitle || preset.docTitle,
                    'Selected matching entries',
                  )
            }
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#9a0101]"
          >
            <PiPrinter className="h-3.5 w-3.5" />
            Print {checked.size > 1 ? `${checked.size} Lines` : preset.docTitle}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 overflow-hidden pt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-gray-50 px-4 py-2.5">
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
          <table className="min-w-[850px] w-full border-collapse text-xs">
            <caption className="sr-only">
              {preset.showSupplier
                ? 'Inventory receipt history'
                : preset.showSource
                  ? 'Inventory delivery history'
                  : 'Inventory movement history'}
            </caption>
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
                    aria-sort={
                      sortCol === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={`cursor-pointer select-none px-3 py-3 transition-colors hover:text-gray-600 ${right ? 'text-right' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      aria-label={`Sort by ${label}`}
                      className="inline-flex items-center gap-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
                    >
                      {label}
                      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
                {(preset.showSupplier || preset.showSource || preset.showRoute) && (
                  <th className="px-3 py-3 text-right">Stock balance</th>
                )}
                <th className="w-8 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {grouped
                ? grouped.map(([groupName, groupMoves]) => {
                    const isCollapsed = !expandedGroups.has(groupName);
                    const groupStats = movementStats(groupMoves);
                    const groupCost = groupStats.cost;
                    const groupUnits = groupStats.units;
                    const share = filteredTotalCost > 0 ? (groupCost / filteredTotalCost) * 100 : 0;
                    return (
                      <React.Fragment key={`group-${groupName}`}>
                        <tr className="cursor-pointer select-none border-b border-gray-200 bg-gray-50/80 transition-colors hover:bg-gray-100">
                          <td
                            colSpan={
                              HEADERS.length +
                              2 +
                              (preset.showSupplier || preset.showSource || preset.showRoute ? 1 : 0)
                            }
                            className="px-4 py-2.5"
                          >
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupName)}
                              aria-expanded={!isCollapsed}
                              className="flex w-full items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
                            >
                              <PiCaretRight
                                className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                              />
                              <span className="max-w-[280px] truncate text-xs font-semibold text-gray-700">
                                {movementGroupLabel(groupBy, groupName, groupMoves)}
                              </span>
                              <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-gray-500">
                                {groupMoves.length}
                              </span>
                              <span className="text-[10px] tabular-nums text-gray-500">
                                {groupUnits.toLocaleString()} units
                              </span>
                              <span className="ml-1 flex max-w-[180px] flex-1 items-center gap-2">
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                                  <span
                                    className="block h-full rounded-full bg-[#b20202] transition-all"
                                    style={{
                                      width: `${Math.min(100, share)}%`,
                                    }}
                                  />
                                </span>
                                <span className="w-9 text-right text-[10px] tabular-nums text-gray-400">
                                  {share.toFixed(1)}%
                                </span>
                              </span>
                              <span className="ml-auto text-xs font-bold tabular-nums text-gray-800">
                                {fmtNgn(groupCost)}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {!isCollapsed &&
                          groupMoves.map((m) => renderRow(m, selected?._id === m._id))}
                      </React.Fragment>
                    );
                  })
                : paginated.map((m) => renderRow(m, selected?._id === m._id))}
            </tbody>
          </table>
        </div>
      )}

      <MovementPagination view={view} />

      {/* Truncation notice */}
      {truncated && !loading && (
        <div className="flex shrink-0 items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs text-amber-700">
            <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
            Showing latest {moves.length.toLocaleString()} lines — older records may be missing.
            Narrow the date range to load complete history. Export is disabled until history is
            complete.
          </span>
        </div>
      )}
    </div>
  );
}
