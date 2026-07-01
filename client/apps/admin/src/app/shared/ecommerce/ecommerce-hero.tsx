'use client';

import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  PiTrendUp,
  PiStorefront,
} from 'react-icons/pi';
import { useTenant } from '@/context/TenantContext';
import { useDashboard } from '@/app/shared/ecommerce/dashboard/use-dashboard';
import { TENANT_ROLES } from '@/types/authorization';

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n}`;
}

/**
 * Brand-red hero strip shown across all /ecommerce/* routes, mirroring the
 * POS dashboard hero. The hero reads from the DashboardContext when available
 * (only the dashboard page provides it) to show today's sales + growth;
 * on other ecommerce pages it shows just the brand block + date.
 */
export default function EcommerceHero() {
  const { tenant, isMainSite } = useTenant();
  const { data: session } = useSession();
  const role = session?.user?.role ?? '';
  const isTenantUser = TENANT_ROLES.includes(role as any);

  const accentColor = tenant?.primaryColor || '#b20202';
  const data = useDashboard();

  const todayRevenue = data?.statCards?.today?.revenue ?? null;
  const yestRevenue = data?.statCards?.yesterday?.revenue ?? null;
  const todayOrders = data?.statCards?.today?.orders ?? null;

  const growth =
    yestRevenue != null && yestRevenue > 0
      ? (((todayRevenue ?? 0) - yestRevenue) / yestRevenue) * 100
      : null;

  const title = isTenantUser ? 'Store Dashboard' : 'Marketplace';
  const eyebrow = isTenantUser ? tenant?.name ?? 'DrinksHarbour' : 'DrinksHarbour';

  return (
    <div
      className="relative overflow-hidden px-6 py-8 md:px-10 lg:px-14"
      style={{
        background: `linear-gradient(135deg, ${accentColor} 0%, ${shade(accentColor, -18)} 60%, ${shade(accentColor, -32)} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-white/5" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
            {tenant?.logo?.url && !isMainSite ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logo.url}
                alt={tenant.logo.alt || tenant.name}
                className="h-10 w-10 rounded-xl object-contain"
              />
            ) : (
              <Image
                src="/logo-short.svg"
                alt="DrinksHarbour"
                width={38}
                height={38}
                className="rounded-xl"
              />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/70">
              {eyebrow}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-white">{title}</h1>
            <p className="mt-0.5 text-sm text-white/70">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Hero stats — only when dashboard data is present */}
        <div className="flex items-center gap-3">
          {data && todayRevenue !== null && (
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
              <PiStorefront className="h-4 w-4 text-white/70" />
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                  Today
                </p>
                <p className="text-xl font-black tabular-nums text-white">
                  {fmt(todayRevenue)}
                </p>
              </div>
              {todayOrders != null && (
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                    Orders
                  </p>
                  <p className="text-xl font-black tabular-nums text-white">
                    {todayOrders}
                  </p>
                </div>
              )}
              {growth !== null && (
                <div
                  className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    growth >= 0
                      ? 'bg-green-500/30 text-green-200'
                      : 'bg-red-500/30 text-red-200'
                  }`}
                >
                  <PiTrendUp
                    className={`h-3 w-3 ${growth < 0 ? 'rotate-180' : ''}`}
                  />
                  {Math.abs(growth).toFixed(0)}%
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Lighten/darken a hex color by a percentage (-100..100).
 * Keeps the hero gradient in the tenant accent color family.
 */
function shade(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  );
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}