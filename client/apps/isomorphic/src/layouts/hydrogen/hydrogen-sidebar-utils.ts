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
  const [expanded, setExpanded] = useAtom(
    hydrogenSidebarExpandedAtomWithPersistence
  );

  return {
    expanded: expanded ?? true,
    setExpanded,
  };
}

// ── App launcher (full-screen Odoo-style apps overlay) ──────────────────────────
// Replaces the persistent sidebar. Always starts closed on load (no persistence) —
// it is a transient overlay toggled from the page-header launcher button.
const appLauncherOpenAtom = atom(false);

export function useAppLauncher() {
  const [open, setOpen] = useAtom(appLauncherOpenAtom);
  return { open, setOpen };
}
