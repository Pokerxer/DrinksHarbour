'use client';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
import { experienceRequest } from '@/services/venue/experience';
import type { VenueBill } from '@/services/venue/types';
import {
  buttonClass,
  Chip,
  fieldClass,
  hintClass,
  panelClass,
  primaryButtonClass,
  Notice,
} from './workspace/controls';

type Portion = {
  id: string;
  token?: string;
  amountMinor: number;
  currency: string;
  expiresAt: string;
  state: string;
};

const platform = process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3002';
const money = (minor: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(minor / 100);

const portionTones: Record<string, 'ready' | 'pending' | 'info' | 'danger'> = {
  paid: 'ready',
  pending: 'pending',
  reserved: 'info',
  expired: 'danger',
};

export default function PayerControls({
  token,
  bill,
  onRefresh,
}: {
  token: string;
  bill: VenueBill;
  onRefresh: () => void;
}) {
  const [count, setCount] = useState('2');
  const [amounts, setAmounts] = useState('');
  const [policy, setPolicy] = useState('');
  const [mode, setMode] = useState('equal');
  const [cash, setCash] = useState<Record<string, string>>({});
  const [change, setChange] = useState<number | null>(null);
  const [portions, setPortions] = useState<Portion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = `/locations/${bill.locationId}/visits/${bill.sessionId}/payers`;
  const loadPortions = useCallback(async () => {
    setError('');
    try {
      const current = await experienceRequest<{ portions: Portion[] }>(
        token,
        path,
        'GET',
      );
      setPortions(current.portions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load portions');
    }
  }, [token, path]);
  useEffect(() => {
    if (!bill.moneyEnabled || !bill.locationId || bill.state !== 'unpaid') return;
    let active = true;
    setLoading(true);
    void loadPortions().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPortions, bill.version, bill.moneyEnabled, bill.state]);
  async function updatePortion(portion: Portion, action: 'cash' | 'release') {
    setBusy(true);
    setError('');
    try {
      const value = await experienceRequest<{ changeMinor?: number }>(
        token,
        `${path}/${portion.id}/${action}`,
        'POST',
        action === 'cash'
          ? {
              expectedVersion: bill.version,
              amountTenderedMinor: Number(cash[portion.id]),
            }
          : {},
      );
      if (value.changeMinor !== undefined) setChange(value.changeMinor);
      const current = await experienceRequest<{ portions: Portion[] }>(token, path, 'GET');
      setPortions(current.portions);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update portion');
    } finally {
      setBusy(false);
    }
  }
  if (!bill.moneyEnabled || !bill.locationId || bill.state !== 'unpaid') return null;
  return (
    <section aria-label="Shared bill payments" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="inline-flex items-center gap-2 text-base font-semibold">
          <Users aria-hidden="true" className="size-4" />
          Share this bill
        </h4>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        One bill, independent Paystack payments. Reserved or pending portions
        cannot be collected twice.
      </p>
      <p className="text-sm tabular-nums text-gray-700 dark:text-gray-200">
        Outstanding:{' '}
        <span className="font-semibold">{money(bill.outstandingMinor || 0)}</span>
        . Deposits already applied reduce this amount.
      </p>
      <fieldset className="space-y-3 rounded-xl border border-muted bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <legend className="px-1 text-sm font-semibold">
          Reserve payer portions
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Split method
            <select className={fieldClass} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="equal">Equal amounts</option>
              <option value="exact">Exact amounts</option>
            </select>
          </label>
          {mode === 'equal' ? (
            <label className="block text-sm font-medium">
              Number of equal portions
              <input
                type="number"
                min="1"
                max="100"
                className={fieldClass}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </label>
          ) : (
            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Exact amounts in kobo, separated by commas
                <input
                  className={fieldClass}
                  value={amounts}
                  onChange={(e) => setAmounts(e.target.value)}
                />
              </label>
              <p className={hintClass}>
                For example: 300000, 300000, 200000 — portions reserve in the
                order listed.
              </p>
            </div>
          )}
        </div>
        {!bill.financialPolicyVersion && (
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Approved financial policy version
              <input
                type="number"
                min="1"
                className={`${fieldClass} w-40`}
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
              />
            </label>
            <p className={hintClass}>
              Required before reserves. Find it under Capacity settings or the
              money policy you approved.
            </p>
          </div>
        )}
        <button
          className={primaryButtonClass}
          disabled={busy || (!policy && !bill.financialPolicyVersion)}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const body = {
                expectedVersion: bill.version,
                ...(mode === 'equal'
                  ? { equalCount: Number(count) }
                  : { amountsMinor: amounts.split(',').map((v) => Number(v.trim())) }),
                financialPolicyVersion:
                  bill.financialPolicyVersion || Number(policy),
              };
              const result = await experienceRequest<{ portions: Portion[] }>(
                token,
                path,
                'POST',
                body,
              );
              setPortions(result.portions);
              onRefresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to reserve portions');
            } finally {
              setBusy(false);
            }
          }}
        >
          Reserve payer portions
        </button>
      </fieldset>
      <ul className="space-y-3">
        {loading && !portions.length && (
          <li role="status" className="text-sm text-gray-600 dark:text-gray-300">
            Checking payer portions…
          </li>
        )}
        {portions.map((p, i) => (
          <li
            key={p.id}
            className="space-y-2 rounded-xl border border-muted bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                tone={portionTones[p.state] || 'pending'}
                label={p.state}
              />
              <span className="text-sm font-medium tabular-nums">
                Portion {i + 1} · {money(p.amountMinor, p.currency)}
              </span>
            </div>
            <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {p.token ? `expires ${new Date(p.expiresAt).toLocaleString()}` : `expires ${new Date(p.expiresAt).toLocaleString()}`}
            </p>
            {p.state === 'reserved' && (
              <>
                {p.token && (
                  <p className="text-sm">
                    <a
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-blue-700 underline dark:text-blue-300"
                      target="_blank"
                      rel="noreferrer"
                      href={`${platform}/venue-pay/${encodeURIComponent(p.id)}?token=${encodeURIComponent(p.token)}`}
                    >
                      Open payer portion {i + 1} · {money(p.amountMinor, p.currency)}
                    </a>
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <button
                    disabled={busy}
                    onClick={() => void updatePortion(p, 'release')}
                    className={buttonClass}
                  >
                    Release unstarted portion {i + 1}
                  </button>
                  {bill.supportedTenders?.includes('cash') && (
                    <>
                      <div className="space-y-1">
                        <label
                          htmlFor={`portion-cash-${p.id}`}
                          className="block text-sm font-medium"
                        >
                          Cash tendered for portion {i + 1} in kobo
                        </label>
                        <input
                          id={`portion-cash-${p.id}`}
                          type="number"
                          min={p.amountMinor}
                          className={`${fieldClass} w-40`}
                          value={cash[p.id] || ''}
                          onChange={(e) => setCash({ ...cash, [p.id]: e.target.value })}
                        />
                      </div>
                      <button
                        disabled={busy || !cash[p.id]}
                        onClick={() => void updatePortion(p, 'cash')}
                        className={primaryButtonClass}
                      >
                        Collect cash for portion {i + 1}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {change !== null && (
        <p
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium tabular-nums text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
        >
          Change due: {money(change)}
        </p>
      )}
      {error && (
        <Notice
          tone="error"
          role="alert"
          action={
            <button
              type="button"
              className={buttonClass}
              disabled={busy || loading}
              onClick={() => void loadPortions()}
            >
              Retry
            </button>
          }
        >
          {error}
        </Notice>
      )}
    </section>
  );
}
