'use client';

import { atom, useAtom } from 'jotai';

const LOCAL_STORAGE_KEY = 'iso-hydrogen-sidebar-expanded';

const hydrogenSidebarExpandedAtom = atom(
  typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : true
);

const hydrogenSidebarExpandedAtomWithPersistence = atom(
  (get) => get(hydrogenSidebarExpandedAtom),
  (get, set, newValue: boolean) => {
    set(hydrogenSidebarExpandedAtom, newValue);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newValue));
  }
);

export function useHydrogenSidebar() {
  const [expanded, setExpanded] = useAtom(hydrogenSidebarExpandedAtomWithPersistence);

  return {
    expanded: expanded ?? true,
    setExpanded,
  };
}
