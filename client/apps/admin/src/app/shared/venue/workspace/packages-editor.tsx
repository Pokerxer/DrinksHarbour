'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import {
  createPackage,
  listPackages,
  quotePackage,
  updatePackage,
  type PackageDTO,
  type PackageInput,
  type PackageQuoteDTO,
} from '@/services/venue/packages';
import { describeVenueFailure } from '@/services/venue/api';
import type { Candidate } from '@/services/venue/experience';
import { buttonClass, Chip, EmptyState, fieldClass, Notice, panelClass, primaryButtonClass } from './controls';

/**
 * Phase-4 E4 package definitions panel (management surface). A package is a
 * versioned definition: the sellable package line (from the venue catalog),
 * its tracked components (the tenant's own stock, chosen the same way),
 * optional included admissions and an optional seat-plan. The server rejects
 * duplicates/foreign lines/unknown stock rows; failures surface through the
 * shared `describeVenueFailure` helper — the code sits beside the message
 * (STOCK_UNAVAILABLE, STATE_CHANGED refresh → retry), load errors carry Retry
 * and command errors carry Dismiss, and each success gets a short
 * confirmation. Deactivation hides the row from the floor commit picker.
 * Money is never decided here — the "canonical price" button surfaces the
 * package line's venue price.
 */

/** NGN display for a minor-unit quote amount, matching workspace money cases. */
const money = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n / 100);

/** One fact string per rendered Notice — every element owns a single text node. */
type PanelNotice = { kind: 'load' | 'command'; text: string };

export default function PackagesEditor({ token, locationId, catalog }: { token: string; locationId: string; catalog: Candidate[] }) {
  const [rows, setRows] = useState<PackageDTO[] | null>(null);
  const [quote, setQuote] = useState<{ id: string; line: PackageQuoteDTO['line'] } | null>(null);
  const [error, setError] = useState<PanelNotice | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // create form
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [componentSizeId, setComponentSizeId] = useState('');
  const [componentQty, setComponentQty] = useState(2);
  const [admissions, setAdmissions] = useState(2);
  const [seats, setSeats] = useState('');

  const load = useCallback(async () => {
    setRows(null); setQuote(null); setError(null);
    try { setRows((await listPackages(token, locationId)).items); }
    catch (failure) { setError({ kind: 'load', text: describeVenueFailure(failure, 'Unable to load packages') }); }
  }, [token, locationId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, confirmation?: string, after?: (value: unknown) => void) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const result = await fn();
      await load();
      after?.(result);
      if (confirmation) setSuccess(confirmation);
    }
    catch (failure) { setError({ kind: 'command', text: describeVenueFailure(failure, 'Package command failed') }); }
    finally { setBusy(false); }
  };

  const create = () => act(async () => {
    const input: PackageInput = {
      name: name.trim(), packageSubProductId: lineId, sizeId,
      components: [{ subProductId: componentId, sizeId: componentSizeId, quantity: componentQty }],
      includedAdmissions: admissions,
      tablePlan: seats ? { seatCount: Number(seats) } : {},
    };
    await createPackage(token, locationId, { input });
    setName(''); setSeats('');
  }, 'Package created — it is now available to commit on the floor.');

  const deactivate = (row: PackageDTO) => act(
    () => updatePackage(token, locationId, row.id, { expectedVersion: row.version, input: { active: false } }),
    'Package deactivated — it no longer appears in the commit queue.',
  );
  const showPrice = (row: PackageDTO) => act(() => quotePackage(token, locationId, row.id), undefined, result => {
    setQuote({ id: row.id, line: (result as PackageQuoteDTO).line });
  });

  const chosenLine = catalog.find(row => row.id === lineId);
  return (
    <section className={panelClass} aria-label="Package definitions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Event packages</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            A package is an offer, never a sale: it reserves component stock, seats and included admissions for a booking. Money moves only through the canonical venue checkout.
          </p>
        </div>
        <button type="button" className={buttonClass} onClick={() => void load()} disabled={busy}>
          <RefreshCcw aria-hidden className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {error && (
        <Notice tone="error" role="alert" action={
          <button type="button" className={buttonClass} onClick={() => (error.kind === 'load' ? void load() : setError(null))}>
            {error.kind === 'load' ? 'Retry' : 'Dismiss'}
          </button>
        }>{error.text}</Notice>
      )}
      {success && <Notice tone="success" role="status">{success}</Notice>}
      {rows === null && !error && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400" role="status">Loading packages…</p>}
      {rows?.length === 0 && <EmptyState message="No packages yet — define one below: a sellable package line, its included stock and admissions, and an optional seat plan." />}
      {rows?.length ? (
        <ul className="mt-3 space-y-2">
          {rows.map(row => (
            <li key={row.id} className="rounded-lg border border-muted p-3 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.name}</span>
                <Chip tone={row.active ? 'ready' : 'locked'} label={row.active ? 'Active' : 'Inactive'} />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {`${row.components.length} component${row.components.length === 1 ? '' : 's'} · ${row.includedAdmissions} included admission${row.includedAdmissions === 1 ? '' : 's'}${row.tablePlan.seatCount ? ` · ≥${row.tablePlan.seatCount} seats` : ''}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={buttonClass} onClick={() => void showPrice(row)} disabled={busy}>Canonical price</button>
                {row.active && <button type="button" className={buttonClass} onClick={() => void deactivate(row)} disabled={busy}>Deactivate</button>}
              </div>
              {quote?.id === row.id && (
                <p className="mt-2 text-xs tabular-nums text-gray-700 dark:text-gray-300">
                  {`Package price ${money(quote.line.netMinor)} + ${money(quote.line.taxMinor)} tax`}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="mt-4 space-y-2"
        onSubmit={event => { event.preventDefault(); void create(); }}
        aria-label="Create an event package"
      >
        <label className="block text-sm">
          Package name
          <input className={fieldClass} required maxLength={120} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Sellable package line
          <select className={fieldClass} required value={lineId} onChange={e => { setLineId(e.target.value); setSizeId(''); }}>
            <option value="">Choose item</option>
            {catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          Package size
          <select className={fieldClass} required value={sizeId} onChange={e => setSizeId(e.target.value)}>
            <option value="">Choose size</option>
            {(chosenLine?.sizes || []).map(size => <option key={size.id} value={size.id}>{size.name}</option>)}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-sm">
            Included component
            <select className={fieldClass} required value={componentId} onChange={e => { setComponentId(e.target.value); setComponentSizeId(''); }}>
              <option value="">Choose stock item</option>
              {catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Component size
            <select className={fieldClass} required value={componentSizeId} onChange={e => setComponentSizeId(e.target.value)}>
              <option value="">Choose size</option>
              {(catalog.find(row => row.id === componentId)?.sizes || []).map(size => <option key={size.id} value={size.id}>{size.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Included units
            <input className={fieldClass} required type="number" min={1} max={100} value={componentQty} onChange={e => setComponentQty(Number(e.target.value))} />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            Included admissions (0–100)
            <input className={fieldClass} required type="number" min={0} max={100} value={admissions} onChange={e => setAdmissions(Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            Seats to reserve (optional)
            <input className={fieldClass} type="number" min={1} max={100} value={seats} onChange={e => setSeats(e.target.value)} placeholder="Placed first-fit at commit." />
          </label>
        </div>
        <button type="submit" className={primaryButtonClass} disabled={busy}>Create package</button>
      </form>
    </section>
  );
}
