'use client';
import PayerControls from './payer-controls';
import { useCallback, useEffect, useState } from 'react';
import { CreditCard, RefreshCcw } from 'lucide-react';
import { collectBill, freezeBill, getBill, reconcileBill } from '@/services/venue/api';
import type { VenueBill, VenueMode } from '@/services/venue/types';
import { buttonClass, Chip, fieldClass, panelClass, primaryButtonClass } from './workspace/controls';
const money = (minor = 0) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(minor / 100);
type Props = { token: string; sessionId: string; mode?: VenueMode; prepare?: () => Promise<void>; onSettled?: () => void; onBillChange?: (bill: VenueBill) => void };

const stateChips: Record<string, { tone: 'ready' | 'pending' | 'info' | 'danger'; label: string }> = {
  open: { tone: 'info', label: 'Open · review bill lines' },
  unpaid: { tone: 'pending', label: 'Unpaid · awaiting collection' },
  payment_pending: { tone: 'pending', label: 'Payment pending' },
  receipt_verified: { tone: 'pending', label: 'Awaiting reconciliation' },
  settled: { tone: 'ready', label: 'Settled · visit closed' },
};

export default function VenueCheckout({ token, sessionId, mode = 'admin', prepare, onSettled, onBillChange }: Props) {
  const [bill, setBill] = useState<VenueBill>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [cash, setCash] = useState(''); const [age, setAge] = useState(false);
  const applyBill = useCallback((fresh: VenueBill) => { setBill(fresh); onBillChange?.(fresh); }, [onBillChange]);
  const refresh = useCallback(async () => { const fresh = await getBill(token, sessionId, mode); applyBill(fresh); return fresh; }, [token, sessionId, mode, applyBill]);
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : 'Unable to load venue')); }, [refresh]);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update bill'); await refresh().catch(() => undefined); }
    finally { setBusy(false); }
  }
  const pending = bill && !['open', 'unpaid', 'settled'].includes(bill.state);
  return <section className={`${panelClass} space-y-4`} aria-label="Venue checkout">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-semibold">Visit bill</h3>
      {bill && stateChips[bill.state] && <Chip tone={stateChips[bill.state].tone} label={stateChips[bill.state].label} />}
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
    {!bill && <p role="status" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><RefreshCcw aria-hidden="true" className="size-4 motion-safe:animate-spin" />Loading bill…</p>}
    {bill && <>
      {bill.lines.length > 0 && (
        <ul className="space-y-1 border-t border-muted pt-3 text-sm dark:border-gray-700">
          {bill.lines.map(line => (
            <li key={`${line.lineId}:${line.revision}`} className="flex justify-between gap-4 leading-6">
              <span className="font-medium">{line.quantity} × {line.name}</span>
              <span className="tabular-nums">{money(line.netMinor + line.taxMinor)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1 border-t border-muted pt-3 text-sm tabular-nums dark:border-gray-700">
        {bill.financialLines?.map((line, i) => <p key={i} className="flex justify-between gap-4"><span className="text-gray-600 dark:text-gray-300">{line.description}</span><span>{money(line.amountMinor + line.taxMinor)}</span></p>)}
        {bill.allocatedMinor !== undefined && <p className="flex justify-between gap-4"><span className="text-gray-600 dark:text-gray-300">Applied payments and credit</span><span>{money(bill.allocatedMinor)}</span></p>}
        {bill.allocatedMinor !== undefined && <p className="flex justify-between gap-4 text-base font-semibold"><span>Remaining</span><span>{money(bill.outstandingMinor)}</span></p>}
        {bill.totalMinor !== undefined && <p className="flex justify-between gap-4 text-base font-semibold"><span>Total</span><span>{money(bill.totalMinor)}</span></p>}
        {bill.commissionMinor !== undefined && <p className="flex justify-between gap-4 text-xs text-gray-500 dark:text-gray-400"><span>Platform commission</span><span>{money(bill.commissionMinor)}</span></p>}
      </div>
      {bill.state === 'open' && <>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} /> Guest meets the legal drinking age</label>
        <div>
          <button className={primaryButtonClass} disabled={busy || !age} onClick={() => void act(async () => {
            if (prepare) await prepare();
            const latest = await refresh();
            applyBill(await freezeBill(token, sessionId, { expectedVersion: latest.version, lineVersion: latest.lineVersion, ageVerified: age }, mode));
          })}> Review and freeze bill</button>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Age must be confirmed before the bill is frozen for payment. Freezing uses the server&rsquo;s current versions.</p>
        </div>
      </>}
      {bill.state === 'unpaid' && <>
        <PayerControls key={sessionId} token={token} bill={bill} onRefresh={() => void refresh()} />
        <div className="space-y-3 rounded-xl border border-muted bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          {bill.moneyVersion !== 2 && <>
            <div className="space-y-1">
              <label className="block text-sm font-medium">Customer receipt email <input type="email" className={fieldClass} value={email} onChange={e => setEmail(e.target.value)} /></label>
              <p className="text-xs text-gray-500 dark:text-gray-400">Paystack sends the receipt to this address.</p>
            </div>
            <button className={primaryButtonClass} disabled={busy || !email} onClick={() => void act(async () => {
              const result = await collectBill(token, sessionId, { expectedVersion: bill.version, quoteId: bill.quoteId!, method: 'paystack', email }, mode);
              applyBill(result.bill);
              if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
            })}><CreditCard aria-hidden="true" className="size-4" />Pay with Paystack</button>
          </>}
          {bill.supportedTenders?.includes('cash') && <div className="space-y-2">
            <div className="space-y-1">
              <label htmlFor="venue-cash" className="block text-sm font-medium">Cash received (₦)</label>
              <input id="venue-cash" type="number" min="0" step="0.01" className={`${fieldClass} w-40`} value={cash} onChange={e => setCash(e.target.value)} />
            </div>
            <button className={buttonClass} disabled={busy || !cash} onClick={() => void act(async () => {
              const result = await collectBill(token, sessionId, { expectedVersion: bill.version, quoteId: bill.quoteId!, method: 'cash', amountTenderedMinor: Math.round(Number(cash) * 100) }, mode);
              applyBill(result.bill);
            })}>Record cash payment</button>
          </div>}
        </div>
      </>}
      {pending && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{bill.state === 'receipt_verified' ? 'Funds received. Reconciliation pending.' : 'Payment is pending. Check its status before collecting again.'}</p>}
      {bill.state === 'payment_pending' && bill.authorizationUrl?.startsWith('https://') && <a className={`${buttonClass} w-fit font-semibold text-blue-700 underline dark:text-blue-300`} href={bill.authorizationUrl}>Resume secure checkout</a>}
      {bill.state !== 'open' && bill.state !== 'settled' && <button className={buttonClass} disabled={busy} onClick={() => void act(async () => { await reconcileBill(token, sessionId, mode); await refresh(); })}>Check payment</button>}
      {bill.state === 'settled' && <><p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">Payment settled. Visit closed.</p>{onSettled && <button className={buttonClass} onClick={onSettled}>Done</button>}</>}
      <div>
        <button className={buttonClass} disabled={busy} onClick={() => void act(async () => { await refresh(); })}>
          <RefreshCcw aria-hidden="true" className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />Refresh bill
        </button>
      </div>
    </>}
  </section>;
}
