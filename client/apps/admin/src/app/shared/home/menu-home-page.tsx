'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import HeaderMenuRight from '@/layouts/header-menu-right';
import { useTenant } from '@/context/TenantContext';
import { TENANT_ROLES } from '@/types/authorization';
import {
  buildPlatformGroups,
  buildTenantGroups,
  type Group,
} from '@/layouts/hydrogen/app-launcher-utils';

/**
 * Home page — the app menu rendered as the home screen.
 *
 * Designed exactly like the old full-screen sidebar-menu overlay (dark red
 * gradient, "All Apps" grid), so the homepage IS the menu. Uses the same menu
 * data and gating as the sidebar (see layouts/hydrogen/app-launcher-utils.ts),
 * so the tiles a user sees here are always the links their plan and role are
 * allowed to open. The negative margins break out of the (hydrogen) container
 * padding so the gradient bleeds edge-to-edge.
 */
export default function MenuHomePage() {
  const { tenant, isMainSite } = useTenant();
  const { data: session } = useSession();

  const role = session?.user?.role ?? '';
  const isTenantUser = TENANT_ROLES.includes(role as any);
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);

  const groups = useMemo<Group[]>(() => {
    if (!isMainSite || isTenantUser)
      return buildTenantGroups(tenant?.plan, role);
    return buildPlatformGroups(isPlatformAdmin);
  }, [isMainSite, isTenantUser, isPlatformAdmin, role, tenant?.plan]);

  const hasTiles = groups.some((g) => g.tiles.length > 0);

  return (
    <div
      className="-mx-4 -mt-2 -mb-6 relative flex min-h-[calc(100svh-2rem)] flex-col overflow-hidden md:-mx-5 lg:-mx-6 lg:-mb-8 lg:min-h-[calc(100svh-2.5rem)] 3xl:-mx-8 3xl:-mt-4 3xl:min-h-[calc(100svh-3rem)] 4xl:-mx-10 4xl:-mb-9 4xl:min-h-[calc(100svh-3.25rem)]"
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
        .applauncher-bar { animation: applauncher-fade .35s ease-out both }
        .applauncher-tile { animation: applauncher-pop .45s cubic-bezier(.2,.7,.3,1) both }
        @media (prefers-reduced-motion: reduce) {
          .applauncher-bar, .applauncher-tile { animation: none !important }
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

      {/* ── Apps grid ── */}
      <div className="relative z-10 flex flex-1 items-start justify-center px-6 py-10 sm:items-center sm:px-9">
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
                  {groups.map((group, i) => (
                    <section key={`${group.label ?? '_'}-${i}`}>
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
