'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import TrialBalanceTable from './trial-balance-table';
import PlTable from './pl-table';
import BalanceSheetTable from './balance-sheet-table';
import GeneralLedgerTable from './general-ledger-table';
import { BSKpis, GLKpis, PLKpis, TBKpis } from './report-widgets';
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

/** /accounting/reports — tabbed workspace: KPI chips, chart, then the table. */
export default function ReportsView({ initialTab = 'trial-balance' }: { initialTab?: Tab }) {
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
    setLoading(true);
    try {
      if (tab === 'trial-balance') {
        const res = await accountingService.trialBalance(token, { period });
        setTb(res.data);
      } else if (tab === 'profit-loss') {
        const res = await accountingService.profitLoss(token, {
          from: from || undefined,
          to: to || undefined,
        });
        setPl(res.data);
      } else if (tab === 'balance-sheet') {
        const res = await accountingService.balanceSheet(token, {
          asOf: to || new Date().toISOString(),
        });
        setBs(res.data);
      } else {
        const res = await accountingService.generalLedger(token, {
          account: glAccount,
          from: from || undefined,
          to: to || undefined,
        });
        setGl(res.data);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, tab, period, from, to, glAccount]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    accountingService
      .accounts(token)
      .then((res) => setAccounts(res.data ?? []))
      .catch(() => {});
  }, [token]);

  const windowLabel = dateWindowLabel(from, to);
  const subtitle =
    tab === 'trial-balance'
      ? `Period ${periodLabel(period)} · NGN`
      : tab === 'balance-sheet'
        ? `As of ${to ? new Date(to).toLocaleDateString() : 'today'} · NGN`
        : `${windowLabel} · NGN`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
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
                <optgroup key={g.type} label={ACCOUNT_TYPE_LABELS[g.type] ?? g.type}>
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

      {/* Active-window caption; everything stays visible (dimmed) while refreshing */}
      <p className="mb-2 text-xs text-gray-500" aria-live="polite">
        {subtitle}
      </p>
      <div className={loading ? 'pointer-events-none opacity-50 transition-opacity' : ''}>
        {tab === 'trial-balance' && tb && (
          <>
            <TBKpis data={tb} />
            {tb.rows.length > 0 && (
              <div className="mb-3 max-w-sm">
                <TBTypeMixChart data={tb} />
              </div>
            )}
            <TrialBalanceTable data={tb} period={period} />
          </>
        )}
        {tab === 'profit-loss' && pl && (
          <>
            <PLKpis data={pl} />
            <div className="mb-3">
              <PLBreakdownChart data={pl} />
            </div>
            <PlTable data={pl} subtitle={subtitle} />
          </>
        )}
        {tab === 'balance-sheet' && bs && (
          <>
            <BSKpis data={bs} />
            <div className="mb-3">
              <BSPositionChart data={bs} />
            </div>
            <BalanceSheetTable data={bs} subtitle={subtitle} />
          </>
        )}
        {tab === 'general-ledger' && gl && (
          <>
            <GLKpis data={gl} />
            {(gl.lines.length > 0 || (gl.openingBalance ?? 0) !== 0) && (
              <div className="mb-3">
                <GLBalanceChart data={gl} />
              </div>
            )}
            <GeneralLedgerTable data={gl} subtitle={subtitle} />
          </>
        )}
        {!loading && !tb && !pl && !bs && !gl && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            Choose a report and window above.
          </div>
        )}
      </div>
    </div>
  );
}
