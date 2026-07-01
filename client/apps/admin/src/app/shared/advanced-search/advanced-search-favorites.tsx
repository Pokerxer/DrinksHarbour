'use client';

import { useState } from 'react';
import { PiStar, PiTrash, PiFloppyDisk } from 'react-icons/pi';
import type { SavedSearch } from './advanced-search-types';

interface Props {
  favorites: SavedSearch[];
  onApplyFavorite: (search: SavedSearch) => void;
  onDeleteFavorite: (id: string) => void;
  onSaveFavorite: (name: string) => void;
}

export default function AdvancedSearchFavorites({
  favorites,
  onApplyFavorite,
  onDeleteFavorite,
  onSaveFavorite,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  function commitSave() {
    const name = saveName.trim();
    if (!name) return;
    onSaveFavorite(name);
    setSaveName('');
    setSaveOpen(false);
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
        Saved Searches
      </p>
      <div className="space-y-0.5">
        {favorites.length === 0 && (
          <p className="px-2 py-3 text-xs text-gray-400">No saved searches yet</p>
        )}
        {favorites.map((fav) => (
          <div
            key={fav.id}
            className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <PiStar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <button
              type="button"
              onClick={() => onApplyFavorite(fav)}
              className="flex-1 truncate text-left hover:text-brand transition-colors"
            >
              {fav.name}
            </button>
            <button
              type="button"
              onClick={() => onDeleteFavorite(fav.id)}
              className="rounded-md p-1 opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
              title="Delete favorite"
              aria-label={`Delete favorite "${fav.name}"`}
            >
              <PiTrash className="h-3 w-3 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2">
        {saveOpen ? (
          <div className="space-y-1.5 rounded-lg bg-gray-50 px-2 py-2">
            <input
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSave();
                if (e.key === 'Escape') setSaveOpen(false);
              }}
              placeholder="Name this search..."
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/20"
              aria-label="Name for saved search"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={commitSave}
                disabled={!saveName.trim()}
                className="flex-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setSaveName(''); setSaveOpen(false); }}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            <PiFloppyDisk className="h-3.5 w-3.5 text-gray-400" />
            Save current search
          </button>
        )}
      </div>
    </div>
  );
}
