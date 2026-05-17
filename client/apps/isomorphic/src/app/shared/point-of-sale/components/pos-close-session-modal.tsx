'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { useTenant } from '@/context/TenantContext';
import { POSSession, POSClosingControl } from '@/app/shared/point-of-sale/types';
import { formatCurrency, formatTime } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import {
  PiWarningCircle, PiCheckCircle, PiX, PiBackspace,
  PiCurrencyNgn, PiCreditCard, PiBank, PiDeviceMobile,
  PiArrowRight, PiPrinter,
} from 'react-icons/pi';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  session: POSSession;
  onSessionClosed: () => void;
  onCancel: () => void;
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card / POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash:          <PiCurrencyNgn className="h-4 w-4" />,
  card:          <PiCreditCard   className="h-4 w-4" />,
  bank_transfer: <PiBank         className="h-4 w-4" />,
  mobile_money:  <PiDeviceMobile className="h-4 w-4" />,
};

// ── Z-Report ───────────────────────────────────────────────────────────────────

function ZReport({ session, onDone }: { session: POSSession; onDone: () => void }) {
  const { tenant } = useTenant();
  const router     = useRouter();

  // Auto-redirect to /point-of-sale after the user has had time to read the report
  // (they can still click the button early)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      router.push(routes.pos.index);
    }, 8000); // 8 seconds to read, then auto-redirect
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [router]);

  const methods = session.methodBalances?.filter((m) => m.theoretical > 0) ?? [];
  const hasDiff = session.hasDifference;

  const reportDate = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  function handlePrint() {
    const win = window.open('', '_blank', 'width=420,height=750,scrollbars=yes');
    if (!win) return;
    const rows = methods.map((m) => {
      const diff = (m.counted ?? m.theoretical) - m.theoretical;
      const hasDiff = Math.abs(diff) > 0.01;
      return `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #eee;text-transform:capitalize">${(METHOD_LABELS[m.method] || m.method)}</td>
        <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee">${formatCurrency(m.theoretical)}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${m.counted != null ? formatCurrency(m.counted) : '—'}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee;color:${hasDiff ? '#b20202' : '#16a34a'}">${hasDiff ? (diff > 0 ? '+' : '') + formatCurrency(diff) : '✓'}</td>
      </tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Z-Report</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;width:400px;margin:0 auto}</style>
    </head><body>
      <div style="text-align:center;margin-bottom:12px">
        <strong style="font-size:14px;letter-spacing:2px">DRINKS HARBOUR</strong><br>
        <strong style="font-size:12px">Z-REPORT / CLOSING CONTROL</strong>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px;margin-bottom:8px">
        <tr><td style="color:#555;width:100px">Date</td><td>${reportDate}</td></tr>
        <tr><td style="color:#555">Session</td><td>${session._id}</td></tr>
        <tr><td style="color:#555">Opened</td><td>${formatTime(session.openedAt)}</td></tr>
        <tr><td style="color:#555">Closed</td><td>${session.closedAt ? formatTime(session.closedAt) : '—'}</td></tr>
        <tr><td style="color:#555">Orders</td><td>${session.orderCount}</td></tr>
        <tr><td style="color:#555">Total Sales</td><td><strong>${formatCurrency(session.totalSales)}</strong></td></tr>
        <tr><td style="color:#555">Opening Cash</td><td>${formatCurrency(session.openingCash)}</td></tr>
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px">
        <thead><tr style="color:#888">
          <th style="text-align:left">Method</th>
          <th style="text-align:right">Theoretical</th>
          <th style="text-align:right">Counted</th>
          <th style="text-align:right">Diff</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:2px solid #333;margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-weight:bold">
        <span>TOTAL SALES</span><span>${formatCurrency(session.totalSales)}</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <p style="text-align:center;font-size:10px;color:#666">This report is confidential.<br>Please retain for records.</p>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <PiCheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Session Closed</h2>
            <p className="text-xs text-gray-400">{tenant?.name} · {reportDate}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
          {[
            { label: 'Total Sales',   value: formatCurrency(session.totalSales), color: 'text-[#b20202]' },
            { label: 'Orders',        value: String(session.orderCount),         color: 'text-gray-900' },
            { label: 'Opening Cash',  value: formatCurrency(session.openingCash), color: 'text-gray-900' },
          ].map(({ label, value, color }, i) => (
            <div key={label} className={`px-5 py-4 text-center ${i > 0 ? 'border-l border-gray-100' : ''}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Time range */}
        <div className="flex items-center justify-center gap-3 border-b border-gray-100 px-6 py-3 text-sm text-gray-500">
          <span>Opened <strong className="text-gray-800">{formatTime(session.openedAt)}</strong></span>
          <PiArrowRight className="h-3.5 w-3.5 text-gray-300" />
          <span>Closed <strong className="text-gray-800">{session.closedAt ? formatTime(session.closedAt) : '—'}</strong></span>
        </div>

        {/* Payment method breakdown */}
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-2">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <span>Method</span>
              <span className="text-right">Theoretical</span>
              <span className="text-right">Counted</span>
              <span className="text-right">Difference</span>
            </div>
          </div>

          {methods.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No payment data</p>
          ) : (
            methods.map((m) => {
              const counted = m.counted ?? m.theoretical;
              const diff    = counted - m.theoretical;
              const hasDiff = Math.abs(diff) > 0.01;
              return (
                <div
                  key={m.method}
                  className={`grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center border-b border-gray-50 px-5 py-3 ${
                    hasDiff ? 'bg-red-50/50' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <span className={hasDiff ? 'text-red-400' : 'text-gray-400'}>
                      {METHOD_ICONS[m.method]}
                    </span>
                    {METHOD_LABELS[m.method] || m.method}
                  </span>
                  <span className="text-right text-sm tabular-nums text-gray-600">{formatCurrency(m.theoretical)}</span>
                  <span className="text-right text-sm tabular-nums font-medium text-gray-800">
                    {m.counted != null ? formatCurrency(m.counted) : '—'}
                  </span>
                  <span className={`text-right text-sm font-bold tabular-nums ${hasDiff ? 'text-red-600' : 'text-green-600'}`}>
                    {hasDiff ? (diff > 0 ? '+' : '') + formatCurrency(diff) : '✓'}
                  </span>
                </div>
              );
            })
          )}

          {/* Totals */}
          <div className="border-t-2 border-gray-200 bg-gray-50 px-5 py-3">
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>Total Sales</span>
              <span className="tabular-nums">{formatCurrency(session.totalSales)}</span>
            </div>
          </div>

          {/* Difference warning */}
          {hasDiff && (
            <div className="mx-5 mb-4 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Cash difference detected. Review with your manager and keep this report on file.</span>
            </div>
          )}

          {/* Closing notes */}
          {session.closingNotes && (
            <div className="mx-5 mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              <span className="font-semibold">Notes: </span>{session.closingNotes}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <PiPrinter className="h-4 w-4" /> Print Z-Report
          </button>
          <button
            type="button"
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              router.push(routes.pos.index);
            }}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white hover:opacity-90"
            style={{ backgroundColor: '#b20202' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main: Closing Control ──────────────────────────────────────────────────────

export default function POSCloseSessionModal({ session, onSessionClosed, onCancel }: Props) {
  const { token, terminal } = usePOSAuth();
  const { tenant }          = useTenant();

  const [control,        setControl]        = useState<POSClosingControl | null>(null);
  const [loadingControl, setLoadingControl] = useState(true);
  const [counted,        setCounted]        = useState<Record<string, string>>({});
  const [activeMethod,   setActiveMethod]   = useState<string | null>(null);
  const [numInput,       setNumInput]       = useState('0');
  const [fresh,          setFresh]          = useState(false);
  const [closingNotes,   setClosingNotes]   = useState('');
  const [closing,        setClosing]        = useState(false);
  const [error,          setError]          = useState('');
  const [closedSession,  setClosedSession]  = useState<POSSession | null>(null);

  const terminalLabel = (terminal === 'wholesale' ? 'Wholesale' : 'Retail') + ' Terminal';

  useEffect(() => {
    if (!token) return;
    posApi
      .getClosingControl(token, session._id)
      .then((data) => {
        setControl(data);
        const init: Record<string, string> = {};
        data.methods?.forEach((m) => { init[m.method] = String(m.theoretical); });
        setCounted(init);
        // Auto-select cash if present
        const cash = data.methods?.find((m) => m.method === 'cash');
        if (cash) { setActiveMethod('cash'); setNumInput(String(cash.theoretical)); }
      })
      .catch(() => setError('Failed to load closing data'))
      .finally(() => setLoadingControl(false));
  }, [token, session._id]);

  // ── Method selection ─────────────────────────────────────────────────────────

  function selectMethod(method: string) {
    setActiveMethod(method);
    setNumInput(counted[method] ?? '0');
    setFresh(true);
  }

  function setExact(method: string) {
    const theoretical = control?.methods.find((m) => m.method === method)?.theoretical ?? 0;
    setCounted((p) => ({ ...p, [method]: String(theoretical) }));
    if (activeMethod === method) setNumInput(String(theoretical));
  }

  // ── Numpad ───────────────────────────────────────────────────────────────────

  const pushDigit = useCallback((d: string) => {
    if (!activeMethod) return;
    let next: string;
    if (d === '⌫') {
      next = numInput.length > 1 ? numInput.slice(0, -1) : '0';
      setFresh(false);
    } else if (d === '.') {
      next = numInput.includes('.') ? numInput : (numInput || '0') + '.';
      setFresh(false);
    } else if (fresh) {
      next = d === '0' ? '0' : d;
      setFresh(false);
    } else {
      next = numInput === '0' ? d : numInput.length >= 12 ? numInput : numInput + d;
    }
    setNumInput(next);
    setCounted((p) => ({ ...p, [activeMethod]: next }));
  }, [activeMethod, numInput, fresh]);

  const pushClear = useCallback(() => {
    if (!activeMethod) return;
    setNumInput('0');
    setCounted((p) => ({ ...p, [activeMethod]: '0' }));
    setFresh(false);
  }, [activeMethod]);

  // ── Close session ─────────────────────────────────────────────────────────────

  async function handleClose() {
    if (!token || !control) return;
    setClosing(true);
    setError('');
    try {
      const countedBalances = Object.entries(counted).map(([method, val]) => ({
        method,
        counted: parseFloat(val) || 0,
      }));
      const result = await posApi.closeSession(token, session._id, countedBalances, closingNotes);
      setClosedSession(result);
      onSessionClosed();
    } catch (err: any) {
      setError(err.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  }

  // ── Z-Report ─────────────────────────────────────────────────────────────────

  if (closedSession) {
    return <ZReport session={closedSession} onDone={() => {}} />;
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const differences = control
    ? control.methods.map((m) => ({
        method: m.method,
        diff: (parseFloat(counted[m.method] ?? String(m.theoretical)) || 0) - m.theoretical,
      }))
    : [];
  const hasDifferences = differences.some((d) => Math.abs(d.diff) > 0.01);
  const allFilled = control ? Object.keys(counted).length >= control.methods.length : false;
  const activeMethodData = control?.methods.find((m) => m.method === activeMethod);
  const activeTheoretical = activeMethodData?.theoretical ?? 0;
  const activeCounted = parseFloat(counted[activeMethod ?? ''] ?? '0') || 0;
  const activeDiff = activeCounted - activeTheoretical;

  return (
    <div className="fixed inset-0 z-50 flex bg-[#f0f0f0]">

      {/* ══ LEFT: Session summary + method list ══════════════════════════════ */}
      <div className="flex w-[420px] shrink-0 flex-col border-r border-gray-200 bg-white">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <Image src="/logo-short.svg" alt="DH" width={28} height={28} className="rounded-full" />
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {tenant?.name || 'DrinksHarbour'} · {terminalLabel}
            </p>
            <h2 className="text-sm font-bold text-gray-900">Closing Control</h2>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {loadingControl ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
          </div>
        ) : !control ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-red-500">{error}</div>
        ) : (
          <>
            {/* Session stats */}
            <div className="shrink-0 border-b border-gray-100 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Opened at',    value: formatTime(session.openedAt) },
                  { label: 'Orders',       value: String(control.orderCount) },
                  { label: 'Opening cash', value: formatCurrency(control.openingCash) },
                  { label: 'Total sales',  value: formatCurrency(control.totalSales), bold: true, red: true },
                ].map(({ label, value, bold, red }) => (
                  <div key={label} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
                    <p className={`mt-0.5 text-sm font-bold tabular-nums ${red ? 'text-[#b20202]' : 'text-gray-900'}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment method rows */}
            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-2">
                <div className="grid grid-cols-[1.5fr_1fr_1fr] text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <span>Method</span>
                  <span className="text-right">Expected</span>
                  <span className="text-right">Counted</span>
                </div>
              </div>

              {control.methods.map((m) => {
                const countedVal  = parseFloat(counted[m.method] ?? String(m.theoretical)) || 0;
                const diff        = countedVal - m.theoretical;
                const hasDiff     = Math.abs(diff) > 0.01;
                const isActive    = activeMethod === m.method;

                return (
                  <button
                    key={m.method}
                    type="button"
                    onClick={() => selectMethod(m.method)}
                    className={`grid w-full grid-cols-[1.5fr_1fr_1fr] items-center border-b border-gray-100 px-5 py-3.5 text-left transition-all ${
                      isActive
                        ? 'bg-[#b20202]/5 border-l-4 border-l-[#b20202]'
                        : hasDiff
                        ? 'bg-red-50/50 border-l-4 border-l-red-300 hover:bg-red-50'
                        : 'bg-white border-l-4 border-l-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-[#b20202]' : hasDiff ? 'text-red-400' : 'text-gray-400'}>
                        {METHOD_ICONS[m.method]}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${isActive ? 'text-[#b20202]' : 'text-gray-800'}`}>
                          {METHOD_LABELS[m.method] || m.method}
                        </p>
                        {m.orderCount > 0 && (
                          <p className="text-[10px] text-gray-400">{m.orderCount} order{m.orderCount > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-right text-sm tabular-nums text-gray-500">
                      {formatCurrency(m.theoretical)}
                    </span>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`text-sm font-bold tabular-nums ${
                        hasDiff ? 'text-red-600' : isActive ? 'text-[#b20202]' : 'text-gray-900'
                      }`}>
                        {formatCurrency(countedVal)}
                      </span>
                      {hasDiff ? (
                        <span className="text-[10px] font-semibold text-red-500">
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-green-600">✓ Balanced</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Difference warning */}
            {hasDifferences && (
              <div className="shrink-0 mx-4 mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
                <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Differences detected. Verify physical cash and card receipts.</span>
              </div>
            )}

            {/* Notes */}
            <div className="shrink-0 border-t border-gray-100 px-5 py-3">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Closing Notes
              </label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={2}
                placeholder="Notes about this session (optional)…"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
              />
            </div>
          </>
        )}
      </div>

      {/* ══ RIGHT: Numpad for counting ════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col bg-[#f0f0f0]">

        {/* Active method display */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-5">
          {activeMethod ? (
            <>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  {METHOD_ICONS[activeMethod]}
                  {METHOD_LABELS[activeMethod] || activeMethod}
                </div>
                <button
                  type="button"
                  onClick={() => setExact(activeMethod)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Match expected
                </button>
              </div>
              {/* Calculator display */}
              <div className={`rounded-2xl px-6 py-4 text-center ${
                Math.abs(activeDiff) > 0.01 ? 'bg-red-50 ring-1 ring-red-200' : 'bg-gray-50'
              }`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Amount counted
                </p>
                <p className={`text-4xl font-bold tabular-nums ${
                  Math.abs(activeDiff) > 0.01 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {formatCurrency(activeCounted)}
                </p>
                {Math.abs(activeDiff) > 0.01 ? (
                  <p className="mt-1 text-sm font-semibold text-red-500">
                    {activeDiff > 0 ? '+' : ''}{formatCurrency(activeDiff)} vs expected
                  </p>
                ) : activeCounted > 0 ? (
                  <p className="mt-1 text-sm font-semibold text-green-600">
                    ✓ Matches expected {formatCurrency(activeTheoretical)}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-gray-50 px-6 py-8 text-center">
              <p className="text-sm text-gray-400">Select a payment method on the left to count</p>
            </div>
          )}
        </div>

        {/* Numpad */}
        <div className="flex flex-1 flex-col justify-center px-8 py-4">
          <div className="grid grid-cols-3 gap-2">
            {['7','8','9','4','5','6','1','2','3'].map((d) => (
              <button key={d} type="button" disabled={!activeMethod}
                onClick={() => pushDigit(d)}
                className="flex h-14 items-center justify-center rounded-2xl border border-gray-200 bg-white text-xl font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-30">
                {d}
              </button>
            ))}
            <button type="button" disabled={!activeMethod}
              onClick={pushClear}
              className="flex h-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-100 active:scale-95 disabled:opacity-30">
              C
            </button>
            <button type="button" disabled={!activeMethod}
              onClick={() => pushDigit('0')}
              className="flex h-14 items-center justify-center rounded-2xl border border-gray-200 bg-white text-xl font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-30">
              0
            </button>
            <button type="button" disabled={!activeMethod}
              onClick={() => pushDigit('⌫')}
              className="flex h-14 items-center justify-center rounded-2xl border border-red-200 bg-red-100 text-red-600 shadow-sm transition-all hover:bg-red-200 active:scale-95 disabled:opacity-30">
              <PiBackspace className="h-5 w-5" />
            </button>
          </div>

          {/* Decimal */}
          <button type="button" disabled={!activeMethod}
            onClick={() => pushDigit('.')}
            className="mt-2 h-12 w-full rounded-2xl border border-orange-100 bg-orange-50 text-base font-semibold text-orange-500 shadow-sm transition-all hover:bg-orange-100 active:scale-95 disabled:opacity-30">
            .
          </button>
        </div>

        {/* Close Session button */}
        <div className="shrink-0 border-t border-gray-300 bg-white px-8 py-4">
          {error && <p className="mb-3 text-center text-sm font-medium text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleClose}
            disabled={closing || !allFilled || !control}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition-all disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: hasDifferences ? '#b45309' : '#b20202' }}
          >
            {closing ? (
              <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Closing…</>
            ) : hasDifferences ? (
              <><PiWarningCircle className="h-5 w-5" /> Close with differences</>
            ) : (
              'Close Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
