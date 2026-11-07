'use client';

import { createContext, useEffect, useMemo, useState, useContext, type ReactNode } from 'react';
import type { WeddingDrinkId } from '@/components/Weddings/data';
import { readOccasionDraft, writeOccasionDraft } from '@/lib/occasionDraft';

type OccasionDrinksValue = {
  selected: WeddingDrinkId[];
  toggle: (id: WeddingDrinkId) => void;
};

const Context = createContext<OccasionDrinksValue | null>(null);

/**
 * Shared drink-category selection for an occasion page: the checkboxes in the
 * request-form planner and the quantity calculators both subscribe. Absent
 * everywhere = classic uncontrolled components (no behavior change).
 *
 * With a `draftKey` the selection also restores from — and persists to — the
 * per-occasion client draft (lib/occasionDraft.ts), so a customer's category
 * choices survive a reload or the sign-in redirect back to this page.
 */
export default function OccasionDrinksProvider({ children, draftKey }: { children: ReactNode; draftKey?: string }) {
  const [selected, setSelected] = useState<WeddingDrinkId[]>([]);
  const value = useMemo<OccasionDrinksValue>(() => ({
    selected,
    toggle: id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]),
  }), [selected]);
  useEffect(() => {
    if (!draftKey) return;
    const draft = readOccasionDraft(draftKey);
    if (draft?.preferences) setSelected(draft.preferences as WeddingDrinkId[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && selected.length) writeOccasionDraft(draftKey, { preferences: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, draftKey]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOptionalOccasionDrinks(): OccasionDrinksValue | null {
  return useContext(Context);
}
