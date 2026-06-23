'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiTruck,
  PiBuildings,
  PiArrowClockwise,
  PiCheckCircle,
  PiWarning,
  PiClock,
  PiCalendarBlank,
  PiCaretDown,
  PiArrowRight,
  PiMagnifyingGlass,
  PiArrowUp,
  PiArrowDown,
  PiMinus,
  PiExport,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';

// ─── Types ────────────────────────────────────────────────────────
interface DeliveredPO {
  _id: string;
  poNumber: string;
  confirmationDate?: string;
  expectedArrival?: string;
  arrivalDate?: string;
  totalAmount?: number;
  status: string;
  deltaDays: number | null;
}

interface MonthBucket {
  label: string;
  key: string;
  total: number;
  onTime: number;
  late: number;
  rate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────
function daysDelta(expected: string, actual: string): number {
  const e = new Date(expected);
  const a = new Date(actual);
  e.setHours(0, 0, 0, 0);
  a.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - e.getTime()) / 86_400_000);
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

function rateColor(rate: number) {
  if (rate >= 90) return 'text-emerald-500';
  if (rate >= 70) return 'text-amber-500';
  return 'text-red-500';
}

// ─── Delta chip ───────────────────────────────────────────────────
function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null)
    return <span className="text-[11px] italic text-gray-300">—</span>;
  if (delta < 0)
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
        {Math.abs(delta)}d early
      </span>
    );
  if (delta === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
        On time
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
      {delta}d late
    </span>
  );
}

// ─── Variance bar ─────────────────────────────────────────────────
function VarianceBar({ delta, max }: { delta: number | null; max: number }) {
  if (delta === null || max === 0) return null;
  const pct = Math.min((Math.abs(delta) / max) * 100, 100);
  return (
    <div className="flex h-1.5 w-20 items-center overflow-hidden rounded-full bg-gray-100">
      {delta < 0 ? (
        <>
          <div className="flex-1" />
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${pct / 2}%` }}
          />
          <div className="flex-1 bg-gray-100" />
        </>
      ) : delta > 0 ? (
        <>
          <div className="flex-1 bg-gray-100" />
          <div
            className="h-full rounded-full bg-red-400"
            style={{ width: `${pct / 2}%` }}
          />
          <div className="flex-1" />
        </>
      ) : (
        <div className="mx-auto h-2 w-0.5 rounded-full bg-sky-400" />
      )}
    </div>
  );
}

// ─── Animated gauge (half-circle) ────────────────────────────────
function Gauge({ rate }: { rate: number }) {
  const r = 72;
  const cx = 90;
  const cy = 94;
  const arc = Math.PI * r;
  const filled = (rate / 100) * arc;
  const color = rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444';
  const trackColor =
    rate >= 90 ? '#d1fae5' : rate >= 70 ? '#fef3c7' : '#fee2e2';
  return (
    <svg width="180" height="100" viewBox="0 0 180 100">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={trackColor}
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${arc}`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
      />
      {/* Center tick marks */}
      {[0, 70, 90].map((pct) => {
        const angle = Math.PI * (1 - pct / 100);
        const innerR = r - 10;
        const outerR = r + 2;
        const x1 = cx + Math.cos(angle) * outerR;
        const y1 = cy - Math.sin(angle) * outerR;
        const x2 = cx + Math.cos(angle) * innerR;
        const y2 = cy - Math.sin(angle) * innerR;
        return (
          <line
            key={pct}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
        );
      })}
      {/* Labels */}
      <text
        x={cx - r - 4}
        y={cy + 14}
        fontSize="8"
        fill="#94a3b8"
        textAnchor="middle"
      >
        0
      </text>
      <text
        x={cx + r + 4}
        y={cy + 14}
        fontSize="8"
        fill="#94a3b8"
        textAnchor="middle"
      >
        100
      </text>
    </svg>
  );
}

// ─── Rate line chart (SVG) ────────────────────────────────────────
function RateLineChart({ months }: { months: MonthBucket[] }) {
  if (months.length < 2) return null;
  const W = 600;
  const H = 140;
  const PAD = { top: 16, right: 24, bottom: 28, left: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const pts = months.map((m, i) => ({
    x: PAD.left + (i / (months.length - 1)) * plotW,
    y: PAD.top + (1 - m.rate / 100) * plotH,
    ...m,
  }));

  const linePath = `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `M ${pts[0].x},${PAD.top + plotH} L ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} L ${pts[pts.length - 1].x},${PAD.top + plotH} Z`;

  const y90 = PAD.top + (1 - 0.9) * plotH;
  const y70 = PAD.top + (1 - 0.7) * plotH;

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: '160px' }}
      >
        <defs>
          <linearGradient id="rateArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Reference zones */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={y90 - PAD.top}
          fill="#d1fae5"
          fillOpacity="0.3"
        />
        <rect
          x={PAD.left}
          y={y90}
          width={plotW}
          height={y70 - y90}
          fill="#fef3c7"
          fillOpacity="0.35"
        />
        <rect
          x={PAD.left}
          y={y70}
          width={plotW}
          height={PAD.top + plotH - y70}
          fill="#fee2e2"
          fillOpacity="0.25"
        />

        {/* Reference lines */}
        <line
          x1={PAD.left}
          y1={y90}
          x2={PAD.left + plotW}
          y2={y90}
          stroke="#10b981"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.5"
        />
        <line
          x1={PAD.left}
          y1={y70}
          x2={PAD.left + plotW}
          y2={y70}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.5"
        />

        {/* Reference labels */}
        <text
          x={PAD.left - 4}
          y={y90 + 3}
          fontSize="8"
          fill="#10b981"
          textAnchor="end"
          opacity="0.8"
        >
          90%
        </text>
        <text
          x={PAD.left - 4}
          y={y70 + 3}
          fontSize="8"
          fill="#f59e0b"
          textAnchor="end"
          opacity="0.8"
        >
          70%
        </text>

        {/* Area fill */}
        <path d={areaPath} fill="url(#rateArea)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {pts.map((p) => (
          <g key={p.key} className="group">
            <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="white"
              stroke={
                p.rate >= 90 ? '#10b981' : p.rate >= 70 ? '#f59e0b' : '#ef4444'
              }
              strokeWidth="2.5"
            />
          </g>
        ))}

        {/* X axis month labels */}
        {pts.map(
          (p, i) =>
            (i === 0 ||
              i === pts.length - 1 ||
              pts.length <= 6 ||
              i % 2 === 0) && (
              <text
                key={p.key}
                x={p.x}
                y={H - 4}
                fontSize="8.5"
                fill="#9ca3af"
                textAnchor="middle"
              >
                {p.label}
              </text>
            )
        )}

        {/* Y axis */}
        {[0, 50, 100].map((v) => {
          const y = PAD.top + (1 - v / 100) * plotH;
          return (
            <g key={v}>
              <text
                x={PAD.left - 6}
                y={y + 3}
                fontSize="8"
                fill="#d1d5db"
                textAnchor="end"
              >
                {v}%
              </text>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + plotW}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────
function exportCSV(rows: DeliveredPO[], vendorName: string) {
  const headers = [
    'PO Number',
    'Expected Arrival',
    'Actual Arrival',
    'Variance (days)',
    'Status',
    'Amount',
  ];
  const lines = rows.map((r) =>
    [
      r.poNumber,
      r.expectedArrival ? fmtDate(r.expectedArrival) : '',
      r.arrivalDate ? fmtDate(r.arrivalDate) : '',
      r.deltaDays ?? '',
      r.deltaDays === null ? 'no data' : r.deltaDays <= 0 ? 'on time' : 'late',
      r.totalAmount ?? '',
    ]
      .map((v) => `"${v}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${vendorName}-delivery-performance.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ────────────────────────────────────────────────
export default function PurchasesVendorOnTime({
  vendorId,
}: {
  vendorId: string;
}) {
  const { data: session, status: authStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'ontime' | 'late' | 'early'>(
    'all'
  );
  const [sortCol, setSortCol] = useState<'date' | 'delta' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    if (authStatus === 'loading' || !token) return;
    setLoading(true);
    try {
      const [v, poRes] = await Promise.all([
        vendorService.getById(vendorId, token),
        purchaseOrderService.fetchPurchaseOrders({ vendor: vendorId }, token),
      ]);
      setVendor(v);
      const list: PurchaseOrder[] =
        (poRes as any)?.data ??
        (poRes as any)?.purchaseOrders ??
        (Array.isArray(poRes) ? poRes : []);
      setPos(list);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [vendorId, token, authStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Delivered POs ─────────────────────────────────────────────────
  const delivered: DeliveredPO[] = useMemo(
    () =>
      pos
        .filter((p) => ['received', 'billed', 'done'].includes(p.status))
        .map((p) => {
          const expected = p.expectedArrival ?? (p as any).expectedDelivery;
          const actual = p.arrivalDate ?? (p as any).receivedAt;
          const delta = expected && actual ? daysDelta(expected, actual) : null;
          return {
            _id: p._id,
            poNumber: p.poNumber,
            confirmationDate: p.confirmationDate,
            expectedArrival: expected,
            arrivalDate: actual,
            totalAmount: (p as any).totalAmount,
            status: p.status,
            deltaDays: delta,
          };
        }),
    [pos]
  );

  // ── KPIs ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const withData = delivered.filter((p) => p.deltaDays !== null);
    const onTimePOs = withData.filter((p) => p.deltaDays! <= 0);
    const latePOs = withData.filter((p) => p.deltaDays! > 0);
    const earlyPOs = withData.filter((p) => p.deltaDays! < 0);
    const rate =
      withData.length > 0
        ? Math.round((onTimePOs.length / withData.length) * 100)
        : null;
    const avgDelta =
      withData.length > 0
        ? withData.reduce((s, p) => s + p.deltaDays!, 0) / withData.length
        : null;
    const worstDelay =
      latePOs.length > 0 ? Math.max(...latePOs.map((p) => p.deltaDays!)) : null;
    const maxAbsDelta =
      withData.length > 0
        ? Math.max(...withData.map((p) => Math.abs(p.deltaDays!)), 1)
        : 1;

    // Consecutive on-time streak (most-recent first)
    const sorted = [...delivered]
      .filter(
        (p) => p.deltaDays !== null && (p.arrivalDate || p.expectedArrival)
      )
      .sort(
        (a, b) =>
          new Date(b.arrivalDate ?? b.expectedArrival ?? 0).getTime() -
          new Date(a.arrivalDate ?? a.expectedArrival ?? 0).getTime()
      );
    let streak = 0;
    for (const p of sorted) {
      if (p.deltaDays !== null && p.deltaDays <= 0) streak++;
      else break;
    }

    return {
      total: delivered.length,
      withData: withData.length,
      onTime: onTimePOs.length,
      late: latePOs.length,
      early: earlyPOs.length,
      rate,
      avgDelta,
      worstDelay,
      maxAbsDelta,
      streak,
    };
  }, [delivered]);

  // ── Monthly trend ─────────────────────────────────────────────────
  const monthlyTrend: MonthBucket[] = useMemo(() => {
    const map = new Map<
      string,
      { total: number; onTime: number; late: number }
    >();
    delivered.forEach((p) => {
      const dateKey = p.arrivalDate || p.expectedArrival;
      if (!dateKey || p.deltaDays === null) return;
      const k = monthKey(dateKey);
      const b = map.get(k) ?? { total: 0, onTime: 0, late: 0 };
      b.total++;
      if (p.deltaDays <= 0) b.onTime++;
      else b.late++;
      map.set(k, b);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({
        key: k,
        label: monthLabel(k),
        total: v.total,
        onTime: v.onTime,
        late: v.late,
        rate: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
      }));
  }, [delivered]);

  // ── Trend direction ───────────────────────────────────────────────
  const trendDir = useMemo(() => {
    if (monthlyTrend.length < 4) return null;
    const recent = monthlyTrend.slice(-3);
    const prev = monthlyTrend.slice(-6, -3);
    if (!prev.length) return null;
    const recentAvg = recent.reduce((s, m) => s + m.rate, 0) / recent.length;
    const prevAvg = prev.reduce((s, m) => s + m.rate, 0) / prev.length;
    const diff = recentAvg - prevAvg;
    if (diff > 5)
      return { dir: 'up', label: 'Improving', diff: Math.round(diff) };
    if (diff < -5)
      return { dir: 'down', label: 'Declining', diff: Math.round(-diff) };
    return { dir: 'stable', label: 'Stable', diff: Math.round(Math.abs(diff)) };
  }, [monthlyTrend]);

  // ── Filtered + sorted rows ────────────────────────────────────────
  const rows = useMemo(() => {
    let list = [...delivered];
    if (filter === 'ontime')
      list = list.filter((p) => p.deltaDays !== null && p.deltaDays <= 0);
    if (filter === 'late')
      list = list.filter((p) => p.deltaDays !== null && p.deltaDays > 0);
    if (filter === 'early')
      list = list.filter((p) => p.deltaDays !== null && p.deltaDays < 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.poNumber.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'delta')
        cmp = (a.deltaDays ?? 999) - (b.deltaDays ?? 999);
      if (sortCol === 'amount')
        cmp = (a.totalAmount ?? 0) - (b.totalAmount ?? 0);
      if (sortCol === 'date')
        cmp =
          new Date(a.arrivalDate ?? a.expectedArrival ?? 0).getTime() -
          new Date(b.arrivalDate ?? b.expectedArrival ?? 0).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [delivered, filter, search, sortCol, sortDir]);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  const rate = kpis.rate;

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-xl"
        style={{
          background:
            'linear-gradient(135deg, #0a0a0a 0%, #051120 55%, #0a0a0a 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            {/* Vendor info */}
            <div>
              <Link
                href={`/purchases/vendors/${vendorId}`}
                className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-300"
              >
                <PiArrowLeft className="h-3.5 w-3.5" />
                {vendor?.name ?? 'Vendor'}
              </Link>
              <div className="flex items-center gap-3.5">
                {vendor?.photo ? (
                  <img
                    src={vendor.photo}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-white/15"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10">
                    <PiBuildings className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">
                    {vendor?.name ?? '…'}
                  </h1>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                    Delivery Performance
                  </p>
                </div>
              </div>
            </div>

            {/* Centre — gauge */}
            <div className="flex flex-col items-center">
              {rate !== null ? (
                <>
                  <Gauge rate={rate} />
                  <div
                    className={`-mt-2 text-[52px] font-black tabular-nums leading-none ${rateColor(rate)}`}
                  >
                    {rate}%
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    on-time rate
                  </p>
                  <div
                    className={`mt-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${
                      rate >= 90
                        ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                        : rate >= 70
                          ? 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
                          : 'bg-red-500/15 text-red-400 ring-red-500/25'
                    }`}
                  >
                    {rate >= 90
                      ? 'Excellent'
                      : rate >= 70
                        ? 'Needs improvement'
                        : 'Poor — take action'}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div className="text-[48px] font-black leading-none text-gray-700">
                    —
                  </div>
                  <p className="text-[11px] text-gray-500">
                    No delivery data yet
                  </p>
                </div>
              )}
            </div>

            {/* Right — 3 key stats */}
            <div className="flex flex-col gap-3.5">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600">
                  Delivered
                </div>
                <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                  {kpis.total}
                </div>
                <div className="text-[10px] text-gray-500">
                  of {pos.length} orders
                </div>
              </div>
              <div className="h-px bg-white/5" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600">
                  Avg Variance
                </div>
                <div
                  className={`mt-0.5 text-2xl font-black tabular-nums ${kpis.avgDelta === null ? 'text-gray-600' : kpis.avgDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {kpis.avgDelta === null
                    ? '—'
                    : `${kpis.avgDelta > 0 ? '+' : ''}${kpis.avgDelta.toFixed(1)}d`}
                </div>
                <div className="text-[10px] text-gray-500">
                  {kpis.avgDelta === null
                    ? 'no data'
                    : kpis.avgDelta <= 0
                      ? 'ahead of schedule'
                      : 'behind schedule'}
                </div>
              </div>
              <div className="h-px bg-white/5" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600">
                  On-time Streak
                </div>
                <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                  {kpis.streak}
                </div>
                <div className="text-[10px] text-gray-500">
                  {kpis.streak === 1 ? 'order' : 'orders'} in a row
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'On Time',
            value: kpis.onTime,
            sub: `${kpis.withData > 0 ? Math.round((kpis.onTime / kpis.withData) * 100) : 0}% of tracked`,
            bar: kpis.withData > 0 ? (kpis.onTime / kpis.withData) * 100 : 0,
            barColor: 'bg-emerald-400',
            bg: 'bg-emerald-50/60',
            text: 'text-emerald-700',
            ring: 'ring-emerald-100',
          },
          {
            label: 'Late',
            value: kpis.late,
            sub: kpis.worstDelay
              ? `Worst: ${kpis.worstDelay}d late`
              : 'No late deliveries',
            bar: kpis.withData > 0 ? (kpis.late / kpis.withData) * 100 : 0,
            barColor: 'bg-red-400',
            bg: kpis.late > 0 ? 'bg-red-50/60' : 'bg-gray-50',
            text: kpis.late > 0 ? 'text-red-700' : 'text-gray-400',
            ring: kpis.late > 0 ? 'ring-red-100' : 'ring-gray-100',
          },
          {
            label: 'Early',
            value: kpis.early,
            sub: `Arrived before schedule`,
            bar: kpis.withData > 0 ? (kpis.early / kpis.withData) * 100 : 0,
            barColor: 'bg-blue-400',
            bg: 'bg-sky-50/60',
            text: 'text-sky-700',
            ring: 'ring-sky-100',
          },
          {
            label: 'No Date Data',
            value: kpis.total - kpis.withData,
            sub: `Orders missing dates`,
            bar:
              kpis.total > 0
                ? ((kpis.total - kpis.withData) / kpis.total) * 100
                : 0,
            barColor: 'bg-gray-300',
            bg: 'bg-gray-50',
            text: 'text-gray-500',
            ring: 'ring-gray-100',
          },
        ].map(({ label, value, sub, bar, barColor, bg, text, ring }) => (
          <div key={label} className={`rounded-2xl ${bg} p-4 ring-1 ${ring}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {label}
            </p>
            <p className={`mt-1 text-3xl font-black tabular-nums ${text}`}>
              {value}
            </p>
            {/* Fill bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${bar}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Trend insight banner ── */}
      {trendDir && (
        <div
          className={`flex items-center gap-4 rounded-xl px-5 py-3.5 ring-1 ${
            trendDir.dir === 'up'
              ? 'bg-emerald-50 ring-emerald-100'
              : trendDir.dir === 'down'
                ? 'bg-red-50 ring-red-100'
                : 'bg-gray-50 ring-gray-100'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              trendDir.dir === 'up'
                ? 'bg-emerald-500'
                : trendDir.dir === 'down'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
            }`}
          >
            {trendDir.dir === 'up' ? (
              <PiArrowUp className="h-4 w-4 text-white" />
            ) : trendDir.dir === 'down' ? (
              <PiArrowDown className="h-4 w-4 text-white" />
            ) : (
              <PiMinus className="h-4 w-4 text-white" />
            )}
          </div>
          <div>
            <p
              className={`text-sm font-bold ${
                trendDir.dir === 'up'
                  ? 'text-emerald-800'
                  : trendDir.dir === 'down'
                    ? 'text-red-800'
                    : 'text-gray-700'
              }`}
            >
              {trendDir.label}
              {trendDir.diff > 0 && ` · ${trendDir.diff}pp shift`}
            </p>
            <p className="text-[11px] text-gray-500">
              {trendDir.dir === 'up'
                ? `On-time rate rose ${trendDir.diff} percentage points vs the prior 3-month period.`
                : trendDir.dir === 'down'
                  ? `On-time rate fell ${trendDir.diff} percentage points vs the prior 3-month period.`
                  : 'Performance is consistent with the prior 3-month period.'}
            </p>
          </div>
          {trendDir.dir === 'down' && kpis.worstDelay && (
            <div className="ml-auto shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-red-500">
                Worst delay
              </div>
              <div className="text-lg font-black text-red-700">
                +{kpis.worstDelay}d
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Rate line chart ── */}
      {monthlyTrend.length > 1 && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                On-Time Rate Trend
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Monthly % over {monthlyTrend.length} months · reference lines at
                70% and 90%
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-400">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-6 rounded-full bg-emerald-400" />
                90%+ Excellent
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-6 rounded-full bg-amber-400" />
                70–89%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-6 rounded-full bg-red-400" />
                Below 70%
              </span>
            </div>
          </div>
          <div className="px-4 pb-4 pt-3">
            <RateLineChart months={monthlyTrend} />
          </div>
        </div>
      )}

      {/* ── Delivery History Table ── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-4">
          <h2 className="flex-1 text-sm font-bold text-gray-800">
            Delivery History
            <span className="ml-2 text-[11px] font-normal text-gray-400">
              ({delivered.length} orders)
            </span>
          </h2>

          {/* Filters */}
          <div className="flex gap-0.5 rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'ontime', label: 'On Time' },
                { id: 'late', label: 'Late' },
                { id: 'early', label: 'Early' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                  filter === id
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO#…"
              className="w-28 rounded-xl border border-gray-200 py-1.5 pl-7 pr-3 text-xs focus:border-blue-400 focus:outline-none"
            />
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-3.5 w-3.5" />
          </button>

          {rows.length > 0 && (
            <button
              onClick={() => exportCSV(rows, vendor?.name ?? 'vendor')}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              <PiExport className="h-3.5 w-3.5" /> Export
            </button>
          )}
        </div>

        {delivered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <PiTruck className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-600">
              No delivered orders yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Performance data appears once purchase orders reach{' '}
              <span className="font-semibold">received</span> status
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-gray-500">
              No orders match this filter
            </p>
            <button
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
              className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    PO Number
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                    onClick={() => toggleSort('date')}
                  >
                    <span className="flex items-center gap-1">
                      Arrival
                      <PiCaretDown
                        className={`h-3 w-3 transition-transform ${sortCol === 'date' ? 'text-gray-700' : 'opacity-30'} ${sortCol === 'date' && sortDir === 'asc' ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Expected
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Actual
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                    onClick={() => toggleSort('delta')}
                  >
                    <span className="flex items-center gap-1">
                      Variance
                      <PiCaretDown
                        className={`h-3 w-3 transition-transform ${sortCol === 'delta' ? 'text-gray-700' : 'opacity-30'} ${sortCol === 'delta' && sortDir === 'asc' ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                    onClick={() => toggleSort('amount')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Amount
                      <PiCaretDown
                        className={`h-3 w-3 transition-transform ${sortCol === 'amount' ? 'text-gray-700' : 'opacity-30'} ${sortCol === 'amount' && sortDir === 'asc' ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {rows.map((p, i) => {
                  const isLate = p.deltaDays !== null && p.deltaDays > 0;
                  const isEarly = p.deltaDays !== null && p.deltaDays < 0;
                  const isExact = p.deltaDays === 0;
                  return (
                    <tr
                      key={p._id}
                      className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${i % 2 === 1 ? 'bg-gray-50/25' : ''}`}
                    >
                      {/* PO number */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-5 w-[3px] shrink-0 rounded-full ${
                              isLate
                                ? 'bg-red-400'
                                : isEarly
                                  ? 'bg-blue-400'
                                  : isExact
                                    ? 'bg-emerald-400'
                                    : 'bg-gray-200'
                            }`}
                          />
                          <Link
                            href={`/purchases/${p._id}`}
                            className="font-bold text-gray-800 transition-colors hover:text-blue-600 hover:underline"
                          >
                            {p.poNumber}
                          </Link>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-gray-500">
                        {fmtDate(p.arrivalDate || p.expectedArrival)}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500">
                        {fmtDate(p.expectedArrival)}
                      </td>

                      <td className="px-4 py-3.5">
                        {p.arrivalDate ? (
                          <span className="font-medium text-gray-700">
                            {fmtDate(p.arrivalDate)}
                          </span>
                        ) : (
                          <span className="italic text-gray-300">
                            Not recorded
                          </span>
                        )}
                      </td>

                      {/* Variance: chip + bar */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <DeltaChip delta={p.deltaDays} />
                          <VarianceBar
                            delta={p.deltaDays}
                            max={kpis.maxAbsDelta}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold text-gray-700">
                        {p.totalAmount != null ? (
                          `₦${p.totalAmount.toLocaleString()}`
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <Link
                          href={`/purchases/${p._id}`}
                          className="text-gray-300 transition-colors hover:text-blue-500"
                        >
                          <PiArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                  <td
                    className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400"
                    colSpan={4}
                  >
                    {rows.length} order{rows.length !== 1 ? 's' : ''} shown
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const withD = rows.filter((r) => r.deltaDays !== null);
                      if (!withD.length) return null;
                      const onT = withD.filter((r) => r.deltaDays! <= 0).length;
                      const r = Math.round((onT / withD.length) * 100);
                      return (
                        <span
                          className={`text-[11px] font-black ${rateColor(r)}`}
                        >
                          {r}% on time
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] font-bold text-gray-700">
                    ₦
                    {rows
                      .reduce((s, r) => s + (r.totalAmount ?? 0), 0)
                      .toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
