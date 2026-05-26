'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  PiGearSix, PiArrowRight, PiArrowsClockwise,
  PiShoppingCart, PiCurrencyNgn, PiCreditCard, PiBank,
  PiDeviceMobile, PiTimer, PiTrendUp, PiReceipt,
  PiStorefront, PiWarningCircle, PiCheckCircle,
  PiUserCircle, PiCalendar, PiArrowUpRight, PiArrowDownRight,
  PiCrown,
} from 'react-icons/pi';
import {
  Bar, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import { POSDashboardData, POSSessionInfo, POSRecentOrder } from '@/app/shared/point-of-sale/types';
import POSNavHeader from './pos-nav-header';

// ── helpers ──────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch { return true; }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  cash:          <PiCurrencyNgn className="h-4 w-4" />,
  card:          <PiCreditCard  className="h-4 w-4" />,
  bank_transfer: <PiBank        className="h-4 w-4" />,
  mobile_money:  <PiDeviceMobile className="h-4 w-4" />,
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card / POS', bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money', split: 'Split',
};

// ── Sales chart (Recharts ComposedChart — same pattern as customized-mix-chart) ─

function fmtYAxis(v: number): string {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `₦${Math.round(v / 1_000)}K`;
  return `₦${v}`;
}

function SalesChart({ data }: { data: { date: string; sales: number; orders: number }[] }) {
  if (!data.length) return null;

  // Shape recharts expects: add a 'day' label and keep sales + orders
  const chartData = data.map((d, i) => ({
    day:    new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    date:   new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales:  d.sales,
    orders: d.orders,
    isToday: i === data.length - 1,
  }));

  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const avgSales   = totalSales / data.length;
  const bestIdx    = data.reduce((bi, d, i) => d.sales > data[bi].sales ? i : bi, 0);

  const half     = Math.floor(data.length / 2);
  const earlyAvg = data.slice(0, half).reduce((s, d) => s + d.sales, 0) / (half || 1);
  const lateAvg  = data.slice(half).reduce((s, d) => s + d.sales, 0) / ((data.length - half) || 1);
  const trendPct = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : 0;

  return (
    <div className="space-y-4">

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '7-day total',   value: formatCurrency(totalSales) },
          { label: 'Daily average', value: formatCurrency(avgSales)   },
          { label: 'Best day',      value: data[bestIdx]
              ? new Date(data[bestIdx].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : '—' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Single ComposedChart: Bar (revenue, left axis) + Line (orders, right axis) */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            barSize={28}
            margin={{ top: 4, right: 40, left: -8, bottom: 0 }}
            className="[&_.recharts-cartesian-grid-vertical]:opacity-0"
          >
            <defs>
              <linearGradient id="posSalesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#b20202" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#d42b2b" stopOpacity={0.65} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />

            {/* Left Y-axis — revenue */}
            <YAxis
              yAxisId="revenue"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtYAxis}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              width={52}
            />

            {/* Right Y-axis — order count */}
            <YAxis
              yAxisId="orders"
              orientation="right"
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              width={32}
              tickFormatter={(v: number) => String(v)}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 }}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />

            {/* Revenue bars — left axis */}
            <Bar
              yAxisId="revenue"
              dataKey="sales"
              name="Revenue"
              fill="url(#posSalesGradient)"
              radius={[4, 4, 0, 0]}
            />

            {/* Orders line — right axis */}
            <Line
              yAxisId="orders"
              dataKey="orders"
              name="Orders"
              type="monotone"
              stroke="#64748b"
              strokeWidth={2}
              dot={{ r: 3, fill: '#fff', stroke: '#64748b', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#64748b' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Trend footnote */}
      <div className="flex items-center gap-1.5 text-[10px]">
        {trendPct >= 0
          ? <><PiArrowUpRight className="h-3 w-3 text-emerald-500" /><span className="font-semibold text-emerald-600">{trendPct.toFixed(0)}% trend up</span></>
          : <><PiArrowDownRight className="h-3 w-3 text-red-400" /><span className="font-semibold text-red-500">{Math.abs(trendPct).toFixed(0)}% trend down</span></>
        }
        <span className="text-gray-400">vs earlier in the week</span>
        {data[bestIdx] && (
          <span className="ml-auto flex items-center gap-1 text-gray-400">
            <PiCrown className="h-3 w-3 text-amber-400" />
            Best: {new Date(data[bestIdx].date).toLocaleDateString('en-US', { weekday: 'short' })} {formatCurrency(data[bestIdx].sales)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent = false,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-5 ${accent ? 'border-[#b20202]/20 bg-[#b20202]/5' : 'border-gray-200 bg-white'}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-500'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`mt-0.5 text-xl font-black tabular-nums leading-none ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="mt-1 text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Terminal card ─────────────────────────────────────────────────────────────

type TerminalInfo = { sessionOpen: boolean | null; closingDate: string | null; closingBalance: string | null; sessionSales?: number; sessionOrders?: number; cashierName?: string; openedAt?: string };

function TerminalCard({
  id, title, badge, description, avatarLetter, avatarBg, info, onOpen,
}: {
  id: string; title: string; badge: string; description: string;
  avatarLetter: string; avatarBg: string; info: TerminalInfo;
  onOpen: () => void;
}) {
  const router = useRouter();

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="h-1 w-full bg-[#b20202]" />

      <div className="flex flex-1 flex-col p-6">
        {/* Title row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold tracking-wide text-gray-900">
              {title} <span className="font-normal text-gray-400 text-sm">[{badge}]</span>
            </h3>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${avatarBg} text-sm font-bold text-white`}>
            {avatarLetter}
          </div>
        </div>

        {/* Session status strip */}
        {info.sessionOpen && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <div className="flex flex-1 items-center justify-between gap-2">
              <span className="text-xs font-semibold text-green-700">Session active</span>
              {info.cashierName && (
                <span className="flex items-center gap-1 text-[10px] text-green-600">
                  <PiUserCircle className="h-3.5 w-3.5" />
                  {info.cashierName}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {info.sessionOpen ? (
            <>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Session Sales</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
                  {info.sessionSales != null ? formatCurrency(info.sessionSales) : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Orders</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
                  {info.sessionOrders ?? '—'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Closing Balance</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">{info.closingBalance ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Last Closed</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">{info.closingDate ?? '—'}</p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push(`${routes.pos.lock}?terminal=${id}`)}
            className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101]"
          >
            {info.sessionOpen ? 'Continue Selling' : 'Open Session'}
            <PiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          {info.sessionOpen === null ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />
          ) : info.sessionOpen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <PiCheckCircle className="h-3.5 w-3.5" />
              Open
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              <PiWarningCircle className="h-3.5 w-3.5" />
              Closed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recent order row ───────────────────────────────────────────────────────────

function RecentOrderRow({ order }: { order: POSRecentOrder }) {
  const customer = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || 'Walk-in'
    : 'Walk-in';
  const isToday = new Date(order.placedAt || order.createdAt).toDateString() === new Date().toDateString();
  const timeStr = isToday
    ? fmtTime(order.placedAt || order.createdAt)
    : fmtDate(order.placedAt || order.createdAt);

  return (
    <div className="flex items-center gap-4 py-3 px-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
        <PiReceipt className="h-4 w-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{order.orderNumber || '—'}</p>
        <p className="text-[10px] text-gray-400">{customer}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-400 tabular-nums">{timeStr}</span>
        <span className="text-xs text-gray-500 capitalize hidden sm:inline">
          {METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
        </span>
        <span className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(order.total)}</span>
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

const TERMINALS = [
  { id: 'retail',    title: 'RETAIL',    badge: 'CASHIERS',  description: 'Front-counter sales for walk-in customers', avatarLetter: 'R', avatarBg: 'bg-orange-500' },
  { id: 'wholesale', title: 'WHOLESALE', badge: 'MANAGERS',  description: 'Bulk & account-based orders',              avatarLetter: 'M', avatarBg: 'bg-sky-600'    },
];

const DEFAULT_TERM = { sessionOpen: null, closingDate: null, closingBalance: null };

export default function POSDashboard() {
  const { token: posToken } = usePOSAuth();
  const { data: session }   = useSession();
  const sessionToken = (session?.user as { token?: string })?.token ?? null;
  const token = (!posToken || isTokenExpired(posToken)) ? sessionToken : posToken;

  const [dashData, setDashData]   = useState<POSDashboardData | null>(null);
  const [loading,  setLoading]    = useState(false);
  const [retailInfo,    setRetailInfo]    = useState<TerminalInfo>(DEFAULT_TERM);
  const [wholesaleInfo, setWholesaleInfo] = useState<TerminalInfo>(DEFAULT_TERM);

  function fetchAll(tk: string) {
    setLoading(true);

    // Dashboard stats
    posApi.getDashboard(tk)
      .then(d => setDashData(d))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Terminal session info
    function fetchTerminal(type: 'retail' | 'wholesale', setter: (s: TerminalInfo) => void) {
      posApi.getSessionInfo(tk, type)
        .then((data) => {
          const sess = data.currentSession;
          const last = data.lastSession;
          setter({
            sessionOpen:    !!sess,
            sessionSales:   sess?.totalSales,
            sessionOrders:  sess?.orderCount,
            cashierName:    sess?.activeCashier
              ? (sess.activeCashier.posName || `${sess.activeCashier.firstName} ${sess.activeCashier.lastName}`)
              : undefined,
            openedAt:       sess?.openedAt,
            closingDate:    last ? fmtDate(last.closedAt) : null,
            closingBalance: last ? formatCurrency(last.totalSales) : null,
          });
        })
        .catch(() => setter({ ...DEFAULT_TERM, sessionOpen: false }));
    }

    fetchTerminal('retail', setRetailInfo);
    fetchTerminal('wholesale', setWholesaleInfo);
  }

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token]);

  const terminalInfo = { retail: retailInfo, wholesale: wholesaleInfo };

  const today = dashData?.today;
  const yesterday = dashData?.yesterday;
  const month = dashData?.thisMonth;
  const recentOrders = dashData?.recentOrders ?? [];
  const chartData = dashData?.chartData ?? [];

  // Payment breakdown from today
  const breakdown = today?.breakdown ?? {};
  const breakdownEntries = Object.entries(breakdown)
    .filter(([, v]) => v.total > 0)
    .sort(([, a], [, b]) => b.total - a.total);

  const salesGrowth = yesterday?.totalSales && yesterday.totalSales > 0
    ? (((today?.totalSales ?? 0) - yesterday.totalSales) / yesterday.totalSales) * 100
    : null;

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">

      {/* ── Nav ── */}
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <POSNavHeader />
      </div>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 py-8 md:px-10 lg:px-14"
        style={{ background: 'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)' }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
              <Image src="/logo-short.svg" alt="DrinksHarbour" width={38} height={38} className="rounded-xl" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200">DrinksHarbour</p>
              <h1 className="mt-0.5 text-2xl font-bold text-white">Point of Sale</h1>
              <p className="mt-0.5 text-sm text-red-200">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Hero stats */}
          <div className="flex items-center gap-3">
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            <button
              type="button"
              onClick={() => token && fetchAll(token)}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {today && (
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-200">Today</p>
                  <p className="text-xl font-black tabular-nums text-white">{formatCurrency(today.totalSales)}</p>
                </div>
                {salesGrowth !== null && (
                  <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${salesGrowth >= 0 ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>
                    <PiTrendUp className={`h-3 w-3 ${salesGrowth < 0 ? 'rotate-180' : ''}`} />
                    {Math.abs(salesGrowth).toFixed(0)}%
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 bg-gray-50 px-6 pb-10 pt-6 md:px-10 lg:px-14">

        {!token ? (
          /* Not authenticated */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
              <PiWarningCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-700">Not signed in to POS</h2>
            <p className="mt-1 text-sm text-gray-400">Log in as a cashier or manager to view the dashboard</p>
            <a
              href={routes.pos.lock}
              className="mt-4 flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
            >
              <PiStorefront className="h-4 w-4" /> Open POS
            </a>
          </div>
        ) : (
          <>
            {/* ── Stats row ── */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Today's Sales"
                value={formatCurrency(today?.totalSales ?? 0)}
                sub={salesGrowth != null ? `${salesGrowth >= 0 ? '↑' : '↓'} ${Math.abs(salesGrowth).toFixed(0)}% vs yesterday` : undefined}
                icon={<PiCurrencyNgn className="h-5 w-5" />}
                accent
              />
              <StatCard
                label="Today's Orders"
                value={String(today?.orderCount ?? 0)}
                sub={today?.orderCount && today.totalSales ? `Avg ${formatCurrency(today.totalSales / today.orderCount)}` : undefined}
                icon={<PiShoppingCart className="h-5 w-5" />}
              />
              <StatCard
                label="This Month"
                value={formatCurrency(month?.totalSales ?? 0)}
                sub={`${month?.orderCount ?? 0} orders`}
                icon={<PiCalendar className="h-5 w-5" />}
              />
              <StatCard
                label="Yesterday"
                value={formatCurrency(yesterday?.totalSales ?? 0)}
                sub={`${yesterday?.orderCount ?? 0} orders`}
                icon={<PiTimer className="h-5 w-5" />}
              />
            </div>

            {/* ── Main grid ── */}
            <div className="grid gap-6 lg:grid-cols-3">

              {/* LEFT: terminals + chart */}
              <div className="space-y-6 lg:col-span-2">

                {/* Section label */}
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-gray-700">Terminals</h2>
                  <button type="button" aria-label="Configure" className="text-gray-400 hover:text-[#b20202] transition-colors">
                    <PiGearSix className="h-4 w-4" />
                  </button>
                </div>

                {/* Terminal cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {TERMINALS.map((t) => (
                    <TerminalCard
                      key={t.id}
                      {...t}
                      info={terminalInfo[t.id as 'retail' | 'wholesale']}
                      onOpen={() => {}}
                    />
                  ))}
                </div>

                {/* 7-day chart */}
                {chartData.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Sales — Last 7 Days</p>
                        <p className="text-[10px] text-gray-400">Revenue bars · dot = order count · hover for details</p>
                      </div>
                      <PiTrendUp className="h-5 w-5 text-gray-200" />
                    </div>
                    <SalesChart data={chartData.slice(-7)} />
                  </div>
                )}
              </div>

              {/* RIGHT: recent orders + payment breakdown */}
              <div className="space-y-6">

                {/* Payment breakdown */}
                {breakdownEntries.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="mb-3 text-sm font-bold text-gray-800">Today by Method</p>
                    <div className="space-y-2.5">
                      {breakdownEntries.map(([method, { total, count }]) => {
                        const pct = today?.totalSales ? Math.round((total / today.totalSales) * 100) : 0;
                        return (
                          <div key={method}>
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400">{METHOD_ICON[method] ?? <PiCurrencyNgn className="h-4 w-4" />}</span>
                                <span className="text-xs font-medium text-gray-700">{METHOD_LABEL[method] ?? method}</span>
                                <span className="text-[10px] text-gray-400">({count})</span>
                              </div>
                              <span className="text-xs font-bold tabular-nums text-gray-800">{formatCurrency(total)}</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-[#b20202]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent orders */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800">Recent Orders</p>
                    <a href={routes.pos.orders} className="text-[11px] font-semibold text-[#b20202] hover:underline">
                      View all →
                    </a>
                  </div>

                  {recentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <PiShoppingCart className="h-8 w-8 text-gray-200 mb-2" />
                      <p className="text-xs text-gray-400">No orders yet today</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {recentOrders.slice(0, 8).map((order) => (
                        <RecentOrderRow key={order._id} order={order} />
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
