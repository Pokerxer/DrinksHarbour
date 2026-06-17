'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiCaretLeftBold,
  PiDotsNineBold,
  PiSquaresFourDuotone,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import {
  tenantMenuItems,
  isSection,
  planAllows,
} from '@/layouts/hydrogen/tenant-menu-items';
import { useAppLauncher } from '@/layouts/hydrogen/hydrogen-sidebar-utils';
import { useTenant } from '@/context/TenantContext';
import { TENANT_ROLES } from '@/types/authorization';
import HeaderMenuRight from '@/layouts/header-menu-right';

// ── Tile model ──────────────────────────────────────────────────────────────────
type Tile = { name: string; href: string; icon: React.ReactNode };

const DefaultIcon = <PiSquaresFourDuotone />;

/**
 * Resolve a navigable href for a menu entry. Top-level entries that are pure
 * dropdown parents use '#' as their href — fall back to their first real child.
 */
function resolveHref(item: {
  href?: string;
  dropdownItems?: { href: string }[];
}): string | null {
  if (item.href && item.href !== '#') return item.href;
  const child = item.dropdownItems?.find((d) => d.href && d.href !== '#');
  return child?.href ?? null;
}

type Group = { label: string | null; tiles: Tile[] };

// Mirror SidebarMenu's selection logic so the launcher never becomes a second
// source of truth — it reads the exact same menu data the sidebar rendered,
// preserving its section grouping. Names are de-duplicated across all groups.
function buildPlatformGroups(isPlatformAdmin: boolean): Group[] {
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
    const href = resolveHref(item);
    if (!href || seen.has(item.name)) continue;
    seen.add(item.name);
    cur.tiles.push({ name: item.name, href, icon: item.icon ?? DefaultIcon });
  }
  flush();
  return groups;
}

function buildTenantGroups(plan?: string): Group[] {
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
    const href = resolveHref(entry);
    if (!href || seen.has(entry.name)) continue;
    seen.add(entry.name);
    cur.tiles.push({ name: entry.name, href, icon: entry.icon ?? DefaultIcon });
  }
  flush();
  return groups;
}

// ── Launcher button (placed in page headers to open the overlay) ─────────────────
export function LauncherButton({ className }: { className?: string }) {
  const { setOpen } = useAppLauncher();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open app launcher"
      title="Apps"
      className={cn(
        'group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:-translate-y-px hover:border-[#b20202]/40 hover:bg-[#b20202] hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]/40 active:translate-y-0',
        className
      )}
    >
      <PiDotsNineBold className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
    </button>
  );
}

// ── Full-screen launcher overlay ─────────────────────────────────────────────────
export default function AppLauncher() {
  const { open, setOpen } = useAppLauncher();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { tenant, isMainSite } = useTenant();

  const role = session?.user?.role ?? '';
  const isTenantUser = TENANT_ROLES.includes(role as any);
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);

  const groups = useMemo(() => {
    if (!isMainSite || isTenantUser) return buildTenantGroups(tenant?.plan);
    return buildPlatformGroups(isPlatformAdmin);
  }, [isMainSite, isTenantUser, isPlatformAdmin, tenant?.plan]);

  const hasTiles = groups.some((g) => g.tiles.length > 0);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="applauncher-overlay fixed inset-0 z-[60] flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="App launcher"
      style={{
        background:
          'radial-gradient(120% 120% at 15% 0%,#c20202 0%,#9a0101 42%,#5e0101 100%)',
      }}
    >
      <style>{`
        @keyframes applauncher-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes applauncher-pop {
          from { opacity: 0; transform: translateY(14px) scale(.94) }
          to   { opacity: 1; transform: none }
        }
        .applauncher-overlay { animation: applauncher-fade .22s ease-out }
        .applauncher-bar { animation: applauncher-fade .35s ease-out both }
        .applauncher-tile { animation: applauncher-pop .45s cubic-bezier(.2,.7,.3,1) both }
        @media (prefers-reduced-motion: reduce) {
          .applauncher-overlay, .applauncher-bar, .applauncher-tile { animation: none !important }
        }
      `}</style>

      {/* Atmosphere */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[34rem] w-[34rem] rounded-full bg-black/25 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Top bar ── */}
      <div className="applauncher-bar relative z-10 flex items-center justify-between gap-4 px-6 pt-6 sm:px-9">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close app launcher"
          className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <PiCaretLeftBold className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur-md">
            <Image
              src="/logo-short.svg"
              alt="DH"
              width={22}
              height={22}
              className="rounded-full"
            />
            <span className="hidden text-sm font-semibold text-white sm:inline">
              {tenant?.name || 'DrinksHarbour'}
            </span>
          </div>
          <HeaderMenuRight />
        </div>
      </div>

      {/* ── Apps grid ── */}
      <div className="relative z-10 flex flex-1 items-start justify-center overflow-y-auto px-6 py-10 sm:items-center sm:px-9">
        <div className="w-full max-w-5xl">
          <div className="applauncher-bar mb-9 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-200/80">
              {tenant?.name || 'DrinksHarbour'}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              All Apps
            </h1>
            <p className="mt-1 text-sm text-red-100/70">
              Jump to any part of your workspace
            </p>
          </div>

          {!hasTiles ? (
            <p className="text-center text-sm text-red-200">
              No apps available.
            </p>
          ) : (
            (() => {
              let n = -1; // running index for the staggered reveal
              return (
                <div className="space-y-9">
                  {groups.map((group) => (
                    <section key={group.label ?? '_'}>
                      {group.label && (
                        <h2 className="applauncher-bar mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-100/60">
                          <span>{group.label}</span>
                          <span className="h-px flex-1 bg-white/10" />
                        </h2>
                      )}
                      <div className="grid grid-cols-3 gap-x-5 gap-y-7 sm:grid-cols-4 sm:gap-x-7 md:grid-cols-6">
                        {group.tiles.map((tile) => {
                          n += 1;
                          return (
                            <Link
                              key={tile.name}
                              href={tile.href}
                              onClick={() => setOpen(false)}
                              style={{
                                animationDelay: `${Math.min(n * 24, 420)}ms`,
                              }}
                              className="applauncher-tile group flex flex-col items-center gap-3 rounded-2xl outline-none"
                            >
                              <span className="relative flex aspect-square w-full items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-white/25 to-white/[0.06] text-white shadow-lg shadow-black/20 ring-1 ring-inset ring-white/20 backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1.5 group-hover:from-white/35 group-hover:to-white/10 group-hover:shadow-xl group-hover:shadow-black/30 group-hover:ring-white/50 group-focus-visible:ring-2 group-focus-visible:ring-white group-active:translate-y-0 group-active:scale-95 [&>svg]:h-9 [&>svg]:w-9 [&>svg]:drop-shadow">
                                {/* sheen */}
                                <span className="pointer-events-none absolute inset-x-2 top-1.5 h-1/3 rounded-full bg-white/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                                {tile.icon}
                              </span>
                              <span className="line-clamp-2 max-w-full text-center text-[13px] font-medium leading-tight text-red-50/85 transition-colors group-hover:text-white">
                                {tile.name}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
