// @ts-nocheck
'use client';

/**
 * Banner Analytics Dashboard — shown above the banner list on the /banners
 * admin page. Fetches aggregate analytics + daily trends from the new
 * GET /api/banners/analytics/overview endpoint and renders:
 *
 *   1. Summary cards (impressions / clicks / CTR / conversions / conv. rate)
 *   2. Daily trends chart (recharts AreaChart — impressions + clicks over time)
 *   3. Placement breakdown table
 *   4. Top performing banners table
 *
 * Compact styling matches the admin's existing dashboard card language
 * (rounded-2xl borders, uppercase micro labels, tabular-nums values).
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Text } from 'rizzui';
import { motion } from 'framer-motion';
import {
  PiEyeBold,
  PiMouseBold,
  PiCursorBold,
  PiArrowsClockwiseBold,
  PiFireBold,
} from 'react-icons/pi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { bannerService } from '@/services/banner.service';

/* ── Placement label map ─────────────────────────────────────────────── */
const PLACEMENT_LABELS: Record<string, string> = {
  home_hero: 'Home Hero',
  home_secondary: 'Home Secondary',
  shop: 'Shop Hero',
  category_top: 'Category Top',
  product_page: 'Product Page',
  checkout: 'Checkout',
  sidebar: 'Sidebar',
  footer: 'Footer',
  popup: 'Popup',
  header: 'Header',
};

/* ── Stat card ───────────────────────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-black leading-none tabular-nums text-gray-900">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] text-gray-400">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tooltip for the chart ───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-gray-600">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs tabular-nums" style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/* ── Placement breakdown table ───────────────────────────────────────── */
function PlacementBreakdown({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
        Performance by Placement
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Placement
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">
                Banners
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">
                Impressions
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">
                Clicks
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">
                Avg CTR
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.placement || i}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="px-3 py-2 font-medium text-gray-900">
                  {PLACEMENT_LABELS[r.placement] || r.placement}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {r.count}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {r.impressions.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {r.clicks.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {(r.avgCTR ?? 0).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Top performers table ────────────────────────────────────────────── */
function TopPerformers({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
        Top Performing Banners
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Title</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Impressions</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Clicks</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b._id || i} className="border-b border-gray-50 last:border-0">
                <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-900">
                  {b.title || 'Untitled'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {(b.impressions ?? 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {(b.clicks ?? 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {(b.clickThroughRate ?? 0).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Entity banner top performers table ───────────────────────────────── */
function EntityTopPerformers({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  const LABEL: Record<string, string> = { brand: 'Brand', category: 'Category', subcategory: 'Subcategory' };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
        Top Entity Banners (Brand / Category / Subcategory)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Entity</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Impressions</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Clicks</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => {
              const entity = b.entity || {};
              return (
                <tr
                  key={b._id || i}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-900">
                    {entity.name || 'Unnamed'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-700">
                      {LABEL[b.entityType] || b.entityType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {(b.impressions ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {(b.clicks ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {(b.clickThroughRate ?? 0).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Entity banner type breakdown ─────────────────────────────────────── */
function EntityTypeBreakdown({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
        Entity Banners by Type
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Count</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Impressions</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Clicks</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Avg CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.entityType || i} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2 font-medium text-gray-900 capitalize">{r.entityType}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.count}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.impressions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.clicks.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">{(r.avgCTR ?? 0).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Entity banner trends chart ────────────────────────────────────────── */
function EntityTrendsChart({ trends }: { trends: any[] }) {
  if (!trends?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
        Entity Banner Daily Trends
      </h3>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gImpE" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gClkE" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="impressions"
              name="Impressions"
              stroke="#10b981"
              fill="url(#gImpE)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="clicks"
              name="Clicks"
              stroke="#f59e0b"
              fill="url(#gClkE)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────── */
export default function BannerAnalyticsDashboard() {
  const { data: session, status } = useSession();
  const token = session?.token || session?.user?.token || '';
  const [data, setData] = useState<any>(null);
  const [entityData, setEntityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (status !== 'authenticated' || !token) return;

    let cancelled = false;
    setLoading(true);
    Promise.all([
      bannerService.getAnalyticsOverview(token, { days }).catch(() => null),
      bannerService.getEntityAnalytics(token).catch(() => null),
    ])
      .then(([overviewRes, entityRes]) => {
        if (cancelled) return;
        if (overviewRes?.success) setData(overviewRes.data);
        if (entityRes?.success) setEntityData(entityRes.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, status, days]);

  if (status === 'loading' || loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-[96px] animate-pulse rounded-2xl border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};
  const trends = data.trends || [];
  const placementRows = data.breakdown?.byPlacement || [];
  const topPerformers = data.topPerformers || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* ── Summary cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={<PiEyeBold className="h-5 w-5" />}
          label="Total Impressions"
          value={(summary.totalImpressions ?? 0).toLocaleString()}
          sub={`${summary.activeBanners ?? 0} active banners`}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<PiMouseBold className="h-5 w-5" />}
          label="Total Clicks"
          value={(summary.totalClicks ?? 0).toLocaleString()}
          accent="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon={<PiCursorBold className="h-5 w-5" />}
          label="Overall CTR"
          value={`${(summary.overallCTR ?? 0).toFixed(2)}%`}
          sub={`Avg banner CTR: ${(summary.avgClickThroughRate ?? 0).toFixed(2)}%`}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={<PiArrowsClockwiseBold className="h-5 w-5" />}
          label="Conversions"
          value={(summary.totalConversions ?? 0).toLocaleString()}
          sub={`${(summary.overallConversionRate ?? 0).toFixed(2)}% rate`}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard
          icon={<PiFireBold className="h-5 w-5" />}
          label="Total Banners"
          value={summary.totalBanners ?? 0}
          sub={`${summary.activeBanners ?? 0} active / ${summary.totalBanners ?? 0} total`}
          accent="bg-red-50 text-red-600"
        />
      </div>

      {/* ── Trends chart ────────────────────────────────────────────── */}
      {trends.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Daily Trends — Last {days} Days
            </h3>
            <div className="flex gap-1">
              {[7, 14, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    days === d
                      ? 'bg-[#b20202] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trends}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gImp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gClk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  name="Impressions"
                  stroke="#3b82f6"
                  fill="url(#gImp)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#a855f7"
                  fill="url(#gClk)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Placement breakdown + Top performers ────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PlacementBreakdown rows={placementRows} />
        <TopPerformers rows={topPerformers} />
      </div>

      {/* ── Entity banners (brand / category / subcategory heroes) ───── */}
      {entityData && (
        <>
          <EntityTrendsChart trends={entityData.trends || []} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <EntityTypeBreakdown rows={entityData.byType || []} />
            <EntityTopPerformers rows={entityData.topPerformers || []} />
          </div>
        </>
      )}
    </motion.div>
  );
}
