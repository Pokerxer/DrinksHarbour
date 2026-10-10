import {
  PiArrowsClockwise,
  PiCaretUp,
  PiCaretDown,
  PiDownloadSimple,
  PiPrinter,
  PiStack,
} from 'react-icons/pi';

import { GROUP_LABELS, GroupPanel } from './inventory-receipts-support';

import {
  printMovementHistory as printMoves,
  exportMovementCSV as exportCsv,
} from './inventory-movement-export';
import type { MovementBrowserView } from './use-movement-browser';
export default function MovementHeader({
  view,
  onAdjustment,
}: {
  view: MovementBrowserView;
  onAdjustment?: () => void;
}) {
  const {
    preset,
    moves,
    loading,
    fetchMoves,
    refreshing,
    showPanel,
    setShowPanel,
    groupBy,
    setGroupBy,
    savedSearches,
    tabFilter,
    setTabFilter,
    setSelected,
    saveSearch,
    loadSavedSearch,
    deleteSaved,
    filtered,
    exportDisabled,
  } = view;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold leading-tight text-gray-900">{preset.title}</h1>
        <p className="mt-0.5 text-[11px] text-gray-400">
          {preset.sub}
          {' \u00b7 '}
          <span className="font-medium text-gray-600">{filtered.length.toLocaleString()}</span>{' '}
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
        </p>
      </div>

      {/* Type tabs */}
      <div className="flex max-w-full flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-0.5">
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
        {onAdjustment && view.canAdjust && (
          <button
            type="button"
            onClick={onAdjustment}
            className="rounded-lg bg-[#b20202] px-3 py-2 text-xs font-semibold text-white hover:bg-[#9a0101]"
          >
            New adjustment
          </button>
        )}
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
            {showPanel ? <PiCaretUp className="h-3 w-3" /> : <PiCaretDown className="h-3 w-3" />}
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
          <PiArrowsClockwise className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          disabled={exportDisabled}
          onClick={() => printMoves(filtered, preset.historyTitle || preset.docTitle)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          <PiPrinter className="h-3.5 w-3.5" />
          Print history
        </button>
        <button
          type="button"
          onClick={() => exportCsv(filtered, preset.csvPrefix)}
          disabled={exportDisabled}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
        >
          <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>
    </div>
  );
}
