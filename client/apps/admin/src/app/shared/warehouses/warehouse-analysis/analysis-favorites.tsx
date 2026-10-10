'use client';
import { useState } from 'react';
import { PiCheck, PiStar, PiTrash } from 'react-icons/pi';
import { ALL_GROUP_ITEMS, type SavedSearch } from '../warehouse-analysis-helpers';
export default function AnalysisFavorites({
  savedSearches,
  activeSearchId,
  onApplySearch,
  onDeleteSearch,
  onSaveSearch,
}: {
  savedSearches: SavedSearch[];
  activeSearchId: string | null;
  onApplySearch: (search: SavedSearch) => void;
  onDeleteSearch: (id: string) => void;
  onSaveSearch: (name: string) => void;
}) {
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  function submitSave() {
    if (!saveSearchName.trim()) return;
    onSaveSearch(saveSearchName.trim());
    setSavingSearch(false);
    setSaveSearchName('');
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
        <PiStar className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Favorites</span>
        {savedSearches.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-600">
            {savedSearches.length}
          </span>
        )}
      </div>
      <div className="max-h-[420px] flex-1 space-y-1.5 overflow-y-auto p-3">
        {savedSearches.length === 0 && !savingSearch && (
          <div className="py-6 text-center">
            <PiStar className="mx-auto mb-2 h-8 w-8 text-gray-200" />
            <p className="text-xs text-gray-400">No saved searches yet</p>
            <p className="mt-0.5 text-[11px] text-gray-300">
              Save your current filters for quick access
            </p>
          </div>
        )}
        {savedSearches.map((s) => {
          const active = s.id === activeSearchId;
          return (
            <div
              key={s.id}
              className={`group rounded-xl border p-2.5 transition-colors ${
                active
                  ? 'border-teal-200 bg-teal-50'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onApplySearch(s)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  {active && <PiCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />}
                  <span
                    className={`truncate text-sm font-medium ${
                      active ? 'text-teal-700' : 'text-gray-800'
                    }`}
                  >
                    {s.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSearch(s.id)}
                  aria-label={`Delete saved search ${s.name}`}
                  className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:text-red-400"
                >
                  <PiTrash className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 truncate text-[11px] text-gray-400">
                {s.filters.length} filter{s.filters.length === 1 ? '' : 's'}
                {s.groupBy
                  ? ` · ${[s.groupBy, s.groupBy2]
                      .filter(Boolean)
                      .map((k) => ALL_GROUP_ITEMS.find((g) => g.key === k)?.label ?? k)
                      .join(' > ')}`
                  : ''}
              </p>
            </div>
          );
        })}

        {savingSearch ? (
          <div className="rounded-xl border border-gray-200 p-2.5">
            <input
              autoFocus
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSave();
                if (e.key === 'Escape') {
                  setSavingSearch(false);
                  setSaveSearchName('');
                }
              }}
              placeholder="Search name…"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#b20202]"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={submitSave}
                className="flex-1 rounded-lg bg-[#b20202] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#7a0101]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavingSearch(false);
                  setSaveSearchName('');
                }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSavingSearch(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-2.5 py-2 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
          >
            <PiStar className="h-3.5 w-3.5" />
            Save current view
          </button>
        )}
      </div>
    </div>
  );
}
