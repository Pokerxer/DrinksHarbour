'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { venueErrorCode } from '@/services/venue/api';
import { getOpenVisitSnapshot } from '@/services/venue/ops';
import {
  BILL_ALREADY_COLLECTED,
  consolidateBills,
  joinParty,
  leaveParty,
  moveVisit,
  releaseTable,
  type ReleaseOutcome,
  type VisitLinesDTO,
} from '@/services/venue/transfers';
import { buttonClass, EmptyState, fieldClass, Notice, panelClass } from './controls';

/**
 * S6 floor-ops panel (minimal honest scope). The visit list rides the
 * open-visits snapshot the workspace already loads (`visits` prop); the
 * selected visit's detail (tables, partyGroup, version) comes from the
 * existing bill read. Commands call the S6 transfer routes with the visit
 * version and refresh both the snapshot and the workspace list. Every rule
 * is server-owned — the panel only branches on the one code the design says
 * is a MESSAGE, not an error: BILL_ALREADY_COLLECTED means the visits keep
 * their separate bills (coordinated payment), never a rewrite.
 */

const COORDINATED_PAYMENT_NOTICE =
  'These visits already have a frozen bill or collected money, so their bills were not combined. Each visit keeps its own bill — settle them side by side (coordinated payment) instead. A paid sale is never rewritten.';

export default function FloorOps({
  token,
  visits,
  tables,
  onChanged,
}: {
  token: string;
  /** Open visits from the workspace snapshot ({_id, state}). */
  visits: { _id: string; state: string }[];
  /** The location's tables from the same workspace snapshot. */
  tables: { _id: string; name: string; status: string }[];
  /** Reload the workspace visits/tables after a command changes one. */
  onChanged: () => Promise<void> | void;
}) {
  const open = useMemo(() => visits.filter((visit) => visit.state === 'open'), [visits]);
  const [sessionId, setSessionId] = useState('');
  const [snapshot, setSnapshot] = useState<VisitLinesDTO | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [otherVisit, setOtherVisit] = useState('');
  const [outcome, setOutcome] = useState<ReleaseOutcome>('cleared');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refused, setRefused] = useState(false);
  const load = useCallback(async (id: string) => {
    const data = await getOpenVisitSnapshot(token, id);
    setSnapshot(data);
    return data;
  }, [token]);
  const select = (id: string) => {
    setSessionId(id);
    setPicked([]);
    setOtherVisit('');
    setRefused(false);
    setError('');
    setMessage('');
    if (id) load(id).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load visit'));
    else setSnapshot(null);
  };
  useEffect(() => {
    select(open[0]?._id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    setRefused(false);
    try {
      await action();
      await load(sessionId);
      await onChanged();
      setMessage(success);
    } catch (e) {
      if (venueErrorCode(e) === BILL_ALREADY_COLLECTED) setRefused(true);
      else setError(e instanceof Error ? e.message : 'Unable to run the floor command');
    } finally {
      setBusy(false);
    }
  }
  const others = open.filter((visit) => visit._id !== sessionId);
  const currentTables = snapshot?.tableIds || [];
  const freeTables = tables.filter((table) => !currentTables.includes(table._id) && table.status === 'available');
  const grouped = !!snapshot?.partyGroup;
  const version = snapshot?.version ?? 0;
  const toggle = (tableId: string) =>
    setPicked((rows) => (rows.includes(tableId) ? rows.filter((id) => id !== tableId) : [...rows, tableId]));
  const visitPicker = (label: string) => (
    <label className="block text-sm font-medium">
      {label}
      <select className={fieldClass} value={otherVisit} disabled={busy || !others.length} onChange={(e) => setOtherVisit(e.target.value)}>
        <option value="">Choose a visit…</option>
        {others.map((visit) => (
          <option key={visit._id} value={visit._id}>{visit._id.slice(-6)}</option>
        ))}
      </select>
    </label>
  );
  return (
    <section aria-label="Floor ops" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Floor ops</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Move a visit between tables, join parties, release tables and
            consolidate bills. Every command is version-checked on the server;
            nothing here rewrites a paid bill.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Visit
            <select
              className={fieldClass}
              value={sessionId}
              disabled={busy || !open.length}
              onChange={(e) => select(e.target.value)}
            >
              {open.map((visit) => (
                <option key={visit._id} value={visit._id}>{visit._id.slice(-6)}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={buttonClass}
            disabled={busy || !sessionId}
            onClick={() => void load(sessionId).catch((e) => setError(e instanceof Error ? e.message : 'Unable to refresh'))}
          >
            <RefreshCcw aria-hidden="true" className="size-4" />
            Reload
          </button>
        </div>
      </div>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {message && <Notice tone="success" role="status">{message}</Notice>}
      {refused && <Notice tone="info" role="status">{COORDINATED_PAYMENT_NOTICE}</Notice>}
      {!open.length && <EmptyState message="No open visits at this location. Open a visit to use floor ops." />}
      {sessionId && snapshot && (
        <>
          <div className={panelClass}>
            <h3 className="font-medium">Visit …{sessionId.slice(-6)}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Tables {currentTables.length ? currentTables.map((id) => id.slice(-4)).join(', ') : 'none'} · version {version}
              {grouped ? ' · in a party group' : ''}
            </p>
            {grouped && (
              <button type="button" className={buttonClass} disabled={busy}
                onClick={() => void run(() => leaveParty(token, sessionId, { expectedVersion: version }), 'Visit left the party group.')}>
                Leave party
              </button>
            )}
          </div>
          <div className={panelClass}>
            <h3 className="font-medium">Move visit to free tables</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The same visit continues at the new tables — held lines, bills and
              fired work stay exactly where they are.
            </p>
            {freeTables.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {freeTables.map((table) => (
                  <li key={table._id}>
                    <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-muted px-3 text-sm">
                      <input type="checkbox" checked={picked.includes(table._id)} disabled={busy} onChange={() => toggle(table._id)} />
                      {table.name || table._id.slice(-4)}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">No free tables at this location right now.</p>
            )}
            <button type="button" className={buttonClass} disabled={busy || !picked.length}
              onClick={() => void run(() => moveVisit(token, sessionId, { targetTableIds: picked, expectedVersion: version }), 'Visit moved to the chosen tables.')}>
              Move visit
            </button>
          </div>
          <div className={panelClass}>
            <h3 className="font-medium">Join another visit&apos;s party</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Parties sit together but every visit keeps its own bill, deposits
              and payer privacy.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {visitPicker('Other visit')}
              <button type="button" className={buttonClass} disabled={busy || !otherVisit}
                onClick={() => void run(() => joinParty(token, sessionId, { targetSessionId: otherVisit, expectedVersion: version }), 'Visit joined the party.')}>
                Join party
              </button>
            </div>
          </div>
          <div className={panelClass}>
            <h3 className="font-medium">Consolidate another visit into this one</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Manager action — allowed only before either bill has any
              collection. Once money has moved, the refusal above points at the
              separate bills.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {visitPicker('Visit to fold in')}
              <button type="button" className={buttonClass} disabled={busy || !otherVisit}
                onClick={() => void run(() => consolidateBills(token, sessionId, { intoSessionId: otherVisit, expectedVersion: version }), 'Bills consolidated into this visit.')}>
                Consolidate
              </button>
            </div>
          </div>
          <div className={panelClass}>
            <h3 className="font-medium">Release table</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Only an emptied open visit releases its tables — accepted lines, a
              frozen bill or a party group must be resolved first.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-sm font-medium">
                Outcome
                <select className={fieldClass} value={outcome} disabled={busy} onChange={(e) => setOutcome(e.target.value as ReleaseOutcome)}>
                  <option value="cleared">Cleared</option>
                  <option value="transferred_away">Transferred away</option>
                </select>
              </label>
              <button type="button" className={buttonClass} disabled={busy}
                onClick={() => void run(() => releaseTable(token, sessionId, { outcome, expectedVersion: version }), 'Table released.')}>
                Release table
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
