'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  accountingService,
  type Account,
  type BalanceSheet,
  type GeneralLedger,
  type ProfitLoss,
  type TrialBalance,
} from '@/services/accounting.service';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  dateWindowLabel,
  periodLabel,
} from './accounting-helpers';
import { asLocalDate } from './report-status';
import TrialBalanceTable from './trial-balance-table';
import PlTable from './pl-table';
import BalanceSheetTable from './balance-sheet-table';
import GeneralLedgerTable from './general-ledger-table';
import { BSKpis, GLKpis, PLKpis, TBKpis } from './report-widgets';
import DraftsExcludedNotice from './report-drafts-notice';
import PlComparisonTable from './pl-comparison-table';
import {
  BSPositionChart,
  GLBalanceChart,
  PLBreakdownChart,
  TBTypeMixChart,
} from './report-charts';

type Tab = 'trial-balance' | 'profit-loss' | 'balance-sheet' | 'general-ledger';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'trial-balance', label: 'Trial Balance' },
  { key: 'profit-loss', label: 'Profit & Loss' },
  { key: 'balance-sheet', label: 'Balance Sheet' },
  { key: 'general-ledger', label: 'General Ledger' },
];

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

/** Placeholder for the selected report while its first payload is in flight. */
function ReportSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading report">
      <div className="mb-3 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 flex-1 rounded-xl border border-gray-200 bg-white" />
        ))}
      </div>
      <div className="h-56 rounded-lg border border-gray-200 bg-white" />
    </div>
  );
}

/** /accounting/reports — tabbed workspace: KPI chips, chart, then the table. */
export default function ReportsView({
  initialTab = 'trial-balance',
}: {
  initialTab?: Tab;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [tab, setTab] = useState<Tab>(initialTab);
  // Trial balance uses a month selector; the rest use from/to dates.
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [glAccount, setGlAccount] = useState('1000');
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [gl, setGl] = useState<GeneralLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);
  const [error, setError] = useState('');
  // The filter window the currently displayed payload was fetched for. The
  // caption is built from this, not from the live inputs: changing the period
  // used to relabel stale numbers with the new period, so the screen said
  // "September 2026" above August's figures.
  const [loadedWindow, setLoadedWindow] = useState<{
    tab: Tab;
    period: string;
    from: string;
    to: string;
  } | null>(null);

  // Accounts grouped by canonical type for the GL selector.
  const accountsByType = useMemo(
    () =>
      ACCOUNT_TYPE_ORDER.map((type) => ({
        type,
        rows: accounts.filter((a) => a.type === type),
      })).filter((g) => g.rows.length > 0),
    [accounts]
  );

  const load = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    // Snapshot of the filters this request is for. Recorded with the payload
    // so the caption always describes the numbers actually on screen.
    const asked = { tab, period, from, to };
    setLoading(true);
    setError('');
    try {
      if (tab === 'trial-balance') {
        const res = await accountingService.trialBalance(token, { period });
        if (seq === requestSeq.current) {
          setTb(res.data);
          setLoadedWindow(asked);
        }
      } else if (tab === 'profit-loss') {
        const res = await accountingService.profitLoss(token, {
          from: from || undefined,
          to: to || undefined,
          // The variance table is the point of a P&L; "all time" has no prior
          // window and the server returns null rather than a fabricated one.
          compare: true,
        });
        if (seq === requestSeq.current) {
          setPl(res.data);
          setLoadedWindow(asked);
        }
      } else if (tab === 'balance-sheet') {
        const res = await accountingService.balanceSheet(token, {
          asOf: to || new Date().toISOString(),
        });
        if (seq === requestSeq.current) {
          setBs(res.data);
          setLoadedWindow(asked);
        }
      } else {
        const res = await accountingService.generalLedger(token, {
          account: glAccount,
          from: from || undefined,
          to: to || undefined,
        });
        if (seq === requestSeq.current) {
          setGl(res.data);
          setLoadedWindow(asked);
        }
      }
    } catch (e) {
      if (seq === requestSeq.current) setError((e as Error).message);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, tab, period, from, to, glAccount]);

  useEffect(() => {
    void load();
    const sequence = requestSeq;
    return () => {
      sequence.current++;
    };
  }, [load]);

  useEffect(() => {
    if (!token) return;
    accountingService
      .accounts(token)
      .then((res) => {
        const list = res.data ?? [];
        setAccounts(list);
        // The ledger defaulted to a hard-coded 1000, which 404s for a tenant
        // whose chart has no such code. Fall back to the first real account so
        // the tab opens on something loadable.
        setGlAccount((current) => {
          if (list.some((a) => a.code === current)) return current;
          return list[0]?.code ?? current;
        });
      })
      .catch(() => {});
  }, [token]);

  // The caption must describe the payload on screen, not the pending inputs.
  const shown = loadedWindow && loadedWindow.tab === tab ? loadedWindow : null;
  const captionPeriod = shown?.period ?? period;
  const captionFrom = shown?.from ?? from;
  const captionTo = shown?.to ?? to;
  const windowLabel = dateWindowLabel(captionFrom, captionTo);
  const subtitle =
    tab === 'trial-balance'
      ? `Period ${periodLabel(captionPeriod)} · NGN`
      : tab === 'balance-sheet'
        ? `As of ${
            asLocalDate(captionTo)?.toLocaleDateString() ??
            new Date().toLocaleDateString()
          } · NGN`
        : `${windowLabel} · NGN`;

  // True when the inputs have moved on from what produced the visible figures.
  const captionStale =
    !shown ||
    shown.period !== period ||
    shown.from !== from ||
    shown.to !== to;

  // The payload backing the selected tab. Used for the empty state, which must
  // reflect only what the user is looking at.
  const activeData =
    tab === 'trial-balance' ? tb : tab === 'profit-loss' ? pl : tab === 'balance-sheet' ? bs : gl;

  return (
    <div className="min-w-0">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-3 min-h-10 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* A real tablist: arrow keys move between reports, Home/End jump to the
            ends. Four tab buttons with no roles were unreachable-by-keyboard as
            a set, and wrapped onto two rows on a phone. */}
        <div
          role="tablist"
          aria-label="Financial reports"
          className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200"
          onKeyDown={(e) => {
            const i = TABS.findIndex((t) => t.key === tab);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              setTab(TABS[(i + 1) % TABS.length].key);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              setTab(TABS[(i - 1 + TABS.length) % TABS.length].key);
            } else if (e.key === 'Home') {
              e.preventDefault();
              setTab(TABS[0].key);
            } else if (e.key === 'End') {
              e.preventDefault();
              setTab(TABS[TABS.length - 1].key);
            }
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`report-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="report-panel"
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Period pickers per tab */}
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'trial-balance' && (
            <label className="text-xs text-gray-500">
              Period
              <input
                type="month"
                className={`${SELECT_CLS} ml-2`}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </label>
          )}
          {(tab === 'profit-loss' || tab === 'general-ledger') && (
            <>
              <input
                type="date"
                className={SELECT_CLS}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From date"
              />
              <input
                type="date"
                className={SELECT_CLS}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
              />
            </>
          )}
          {tab === 'balance-sheet' && (
            <input
              type="date"
              className={SELECT_CLS}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="As of date"
            />
          )}
          {tab === 'general-ledger' && (
            <select
              className={`${SELECT_CLS} max-w-[260px]`}
              value={glAccount}
              onChange={(e) => setGlAccount(e.target.value)}
              aria-label="Account"
            >
              {accountsByType.map((g) => (
                <optgroup
                  key={g.type}
                  label={ACCOUNT_TYPE_LABELS[g.type] ?? g.type}
                >
                  {g.rows.map((a) => (
                    <option key={a._id} value={a.code}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={`rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 ${
              loading ? 'animate-pulse disabled:opacity-50' : ''
            }`}
          >
            {loading ? 'Crunching…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Caption describes the figures on screen; the marker says when those
          figures no longer match the filters beside them. */}
      <p className="mb-2 flex items-center gap-2 text-xs text-gray-500" aria-live="polite">
        <span>{subtitle}</span>
        {captionStale && activeData && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
            {loading ? 'updating…' : 'stale — refresh'}
          </span>
        )}
      </p>
      <div
        id="report-panel"
        role="tabpanel"
        aria-labelledby={`report-tab-${tab}`}
        className={
          loading ? 'pointer-events-none opacity-50 transition-opacity' : ''
        }
      >
        {/* Only the selected report's data is considered. The four payloads are
            kept separately so switching back and forth is instant, but the old
            code asked "is anything loaded at all?" across all of them — so the
            empty state below could never appear, and a first visit to a tab
            rendered nothing but a dimmed gap while the request was in flight. */}
        {tab === 'trial-balance' &&
          (tb ? (
            <>
              <TBKpis data={tb} />
              <DraftsExcludedNotice count={tb.draftsExcluded} />
              {tb.rows.length > 0 && (
                <div className="mb-3 max-w-sm">
                  <TBTypeMixChart data={tb} />
                </div>
              )}
              <TrialBalanceTable data={tb} period={period} />
            </>
          ) : (
            <ReportSkeleton />
          ))}
        {tab === 'profit-loss' &&
          (pl ? (
            <>
              <PLKpis data={pl} />
              <DraftsExcludedNotice count={pl.draftsExcluded} />
              <PlComparisonTable data={pl} previousWindow={pl.previousWindow} />
              <div className="mb-3">
                <PLBreakdownChart data={pl} />
              </div>
              <PlTable data={pl} subtitle={subtitle} />
            </>
          ) : (
            <ReportSkeleton />
          ))}
        {tab === 'balance-sheet' &&
          (bs ? (
            <>
              <BSKpis data={bs} />
              <DraftsExcludedNotice count={bs.draftsExcluded} />
              <div className="mb-3">
                <BSPositionChart data={bs} />
              </div>
              <BalanceSheetTable data={bs} subtitle={subtitle} />
            </>
          ) : (
            <ReportSkeleton />
          ))}
        {tab === 'general-ledger' &&
          (gl ? (
            <>
              <GLKpis data={gl} />
              {(gl.lines.length > 0 || (gl.openingBalance ?? 0) !== 0) && (
                <div className="mb-3">
                  <GLBalanceChart data={gl} />
                </div>
              )}
              <GeneralLedgerTable data={gl} subtitle={subtitle} />
            </>
          ) : (
            <ReportSkeleton />
          ))}
        {!loading && !activeData && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            Choose a report and window above.
          </div>
        )}
      </div>
    </div>
  );
}
