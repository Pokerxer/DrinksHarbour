import { useEffect, useState } from 'react';
import {
  loadSaved,
  persistSaved,
  type SavedSearch,
  type SortCol,
  type SortDir,
} from './inventory-receipts-support';
export type MovementSavedSearch = SavedSearch & {
  products?: string;
  warehouse?: string;
  supplier?: string;
  source?: string;
  fromWarehouse?: string;
  toWarehouse?: string;
  status?: string;
  tab?: string;
  from?: string;
  to?: string;
  timeFrom?: string;
  timeTo?: string;
  sortCol?: SortCol;
  sortDir?: SortDir;
};

export function useMovementSavedSearches(key: string) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  useEffect(() => {
    setSavedSearches(loadSaved(key));
  }, [key]);
  const save = (entry: MovementSavedSearch) => {
    const next = [...savedSearches, entry];
    setSavedSearches(next);
    persistSaved(next, key);
  };
  const deleteSaved = (id: string) => {
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    persistSaved(next, key);
  };
  return { savedSearches, save, deleteSaved };
}
