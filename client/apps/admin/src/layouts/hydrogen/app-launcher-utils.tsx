import { PiSquaresFourDuotone } from 'react-icons/pi';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import {
  tenantMenuItems,
  isSection,
  planAllows,
  roleAllows,
} from '@/layouts/hydrogen/tenant-menu-items';

// ── Tile model ──────────────────────────────────────────────────────────────────
// Shared by the full-screen AppLauncher overlay and the home page so both render
// exactly the same set of apps for a given user. A tile is a navigable menu
// entry; dropdown children are surfaced as secondary links under the tile.

export type Tile = {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  children?: { name: string; href: string }[];
};

export const DefaultIcon = <PiSquaresFourDuotone />;

export type Group = { label: string | null; tiles: Tile[] };

/**
 * Resolve a navigable href for a menu entry. Top-level entries that are pure
 * dropdown parents use '#' as their href — fall back to their first real child.
 */
export function resolveHref(item: {
  href?: string;
  dropdownItems?: { href: string }[];
}): string | null {
  if (item.href && item.href !== '#') return item.href;
  const child = item.dropdownItems?.find((d) => d.href && d.href !== '#');
  return child?.href ?? null;
}

/**
 * Build the platform (super-admin) groups. Mirrors the sidebar's selection
 * logic: platformOnly entries are hidden from non-platform-admin users, and
 * section grouping from the menu config is preserved. Names are de-duplicated
 * across all groups so the first (highest-priority) occurrence wins.
 */
export function buildPlatformGroups(isPlatformAdmin: boolean): Group[] {
  const groups: Group[] = [];
  const seen = new Set<string>();
  let cur: Group = { label: null, tiles: [] };
  const flush = () => {
    if (cur.tiles.length) groups.push(cur);
  };
  for (const item of menuItems as any[]) {
    if (!item?.href) {
      // section label
      flush();
      cur = { label: item.name, tiles: [] };
      continue;
    }
    if (item.platformOnly && !isPlatformAdmin) continue;
    // When a dropdown parent's own href is '#' the tile links to its first
    // child; in that case keep every child visible (the sidebar does too).
    // Only dedupe a child when the tile href IS the parent's own real href.
    const ownHref = item.href && item.href !== '#' ? item.href : null;
    const href = resolveHref(item);
    if (!href || seen.has(item.name)) continue;
    seen.add(item.name);
    cur.tiles.push({
      name: item.name,
      href,
      icon: item.icon ?? DefaultIcon,
      badge: item.badge,
      children: item.dropdownItems
        ?.filter((d: any) => !d.platformOnly || isPlatformAdmin)
        .filter((d: any) => d.href && (!ownHref || d.href !== ownHref))
        .map((d: any) => ({
          name: d.name,
          href: d.href,
        })),
    });
  }
  flush();
  return groups;
}

/**
 * Build the tenant groups. Applies the same plan AND role gating the sidebar
 * uses (requiredPlan / minRole), so users are never offered links that end in
 * access-denied. Section grouping from the tenant menu config is preserved.
 */
export function buildTenantGroups(
  plan: string | undefined,
  role: string | undefined
): Group[] {
  const groups: Group[] = [];
  const seen = new Set<string>();
  let cur: Group = { label: null, tiles: [] };
  const flush = () => {
    if (cur.tiles.length) groups.push(cur);
  };
  for (const entry of tenantMenuItems) {
    if (isSection(entry)) {
      flush();
      cur = { label: entry.label, tiles: [] };
      continue;
    }
    if (entry.requiredPlan && !planAllows(plan, entry.requiredPlan)) continue;
    if (entry.minRole && !roleAllows(role, entry.minRole)) continue;
    // See buildPlatformGroups: keep every child when the tile href is a
    // fallback to the first child, dedupe only against the parent's own href.
    const ownHref = entry.href && entry.href !== '#' ? entry.href : null;
    const href = resolveHref(entry);
    if (!href || seen.has(entry.name)) continue;
    seen.add(entry.name);
    cur.tiles.push({
      name: entry.name,
      href,
      icon: entry.icon ?? DefaultIcon,
      badge: entry.badge,
      children: entry.dropdownItems
        ?.filter((d) => !d.minRole || roleAllows(role, d.minRole))
        .filter((d) => d.href && (!ownHref || d.href !== ownHref))
        .map((d) => ({
          name: d.name,
          href: d.href,
        })),
    });
  }
  flush();
  return groups;
}
