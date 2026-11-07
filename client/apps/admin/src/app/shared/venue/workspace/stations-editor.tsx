'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import {
  createStation,
  getStations,
  updateStation,
  type StationDTO,
  type StationInput,
} from '@/services/venue/ops';
import DeviceBridgeSection from './device-bridge-section';
import PrintJobsPanel from './print-jobs-panel';
import {
  buttonClass,
  EmptyState,
  fieldClass,
  hintClass,
  Notice,
  panelClass,
  primaryButtonClass,
} from './controls';

/**
 * S3 station configuration editor (Task 6, minimal honest scope) with the S4
 * device-bridge + print-jobs sections. Lists the location's preparation
 * stations and creates/edits one: name, menu-category matches, alert
 * threshold minutes, and the opaque staff/device id lists, plus the
 * default-station toggle (the server keeps at most one default per
 * location). The server enforces eligibility (stations.read/write) and
 * optimistic versions — this panel only mirrors those contracts. The bridge
 * and print-job contracts live in their own sections (token shown once;
 * delivery states read-only).
 */

const listToText = (values: string[]) => values.join(', ');
const textToList = (value: string) =>
  value.split(',').map((entry) => entry.trim()).filter(Boolean);

type Draft = {
  name: string;
  categories: string;
  staffIds: string;
  deviceIds: string;
  alertThresholdMins: string;
  isDefault: boolean;
};

const draftOf = (station: StationDTO | null): Draft => ({
  name: station?.name || '',
  categories: listToText(station?.categories || []),
  staffIds: listToText(station?.staffIds || []),
  deviceIds: listToText(station?.deviceIds || []),
  alertThresholdMins: String(station?.alertThresholdMins ?? 15),
  isDefault: station?.isDefault || false,
});

const inputOf = (draft: Draft): StationInput | null => {
  const threshold = Number(draft.alertThresholdMins);
  if (!draft.name.trim() || !Number.isInteger(threshold) || threshold < 1) return null;
  return {
    name: draft.name.trim(),
    categories: textToList(draft.categories),
    staffIds: textToList(draft.staffIds),
    deviceIds: textToList(draft.deviceIds),
    alertThresholdMins: threshold,
    isDefault: draft.isDefault,
  };
};

export default function StationsEditor({
  token,
  locationId,
  visits = [],
}: {
  token: string;
  locationId: string;
  /** Open visits ({_id, state}) for the session-scoped print-jobs panel. */
  visits?: { _id: string; state: string }[];
}) {
  const [stations, setStations] = useState<StationDTO[] | null>(null);
  const [editing, setEditing] = useState<StationDTO | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const data = await getStations(token, locationId);
    setStations(data.items);
    return data.items;
  }, [token, locationId]);
  useEffect(() => {
    let active = true;
    load()
      .then((items) => {
        if (active && !items.some((s) => s.id === editing?.id)) setEditing(null);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load stations');
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const pick = (station: StationDTO | null) => {
    setEditing(station);
    setDraft(draftOf(station));
    setError('');
    setMessage('');
  };
  async function save() {
    const input = inputOf(draft);
    if (!input || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (editing) {
        await updateStation(token, locationId, editing.id, { expectedVersion: editing.version, input });
        setMessage(`Station "${input.name}" saved.`);
      } else {
        await createStation(token, locationId, input);
        setMessage(`Station "${input.name}" created.`);
      }
      const items = await load();
      const saved = items.find((s) => s.name === input.name);
      pick(saved || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save station');
    } finally {
      setBusy(false);
    }
  }
  const valid = !!inputOf(draft);
  return (
    <section aria-label="Preparation stations" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Preparation stations</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Fired items are routed to the station owning the menu category;
            unmapped categories go to the location&apos;s default station. The
            alert threshold drives the kitchen&apos;s stale timer.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void load().catch((e) => setError(e instanceof Error ? e.message : 'Unable to refresh'))}>
            <RefreshCcw aria-hidden="true" className="size-4" />
            Reload stations
          </button>
          {editing && (
            <button type="button" className={buttonClass} disabled={busy} onClick={() => pick(null)}>
              New station
            </button>
          )}
        </div>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="success" role="status">
          {message}
        </Notice>
      )}
      {stations && !stations.length && (
        <EmptyState message="No stations yet. Add one so fired items have a place to land." />
      )}
      {!!stations?.length && (
        <ul className="space-y-2">
          {stations.map((station) => (
            <li key={station.id} className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {station.name}
                  {station.isDefault ? ' · default' : ''}
                </p>
                <p className={hintClass}>
                  {station.categories.length ? `Categories: ${station.categories.join(', ')}` : 'No category match (fallback only)'} · alert after {station.alertThresholdMins} min · {station.staffIds.length} staff · {station.deviceIds.length} devices
                </p>
              </div>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => pick(station)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className={`${panelClass} grid gap-4 sm:grid-cols-2`}
        aria-label={editing ? 'Edit station' : 'New station'}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block text-sm font-medium">
          Station name
          <input className={fieldClass} value={draft.name} onChange={(e) => patch({ name: e.target.value })} required maxLength={120} />
        </label>
        <label className="block text-sm font-medium">
          Categories (comma separated)
          <input className={fieldClass} value={draft.categories} onChange={(e) => patch({ categories: e.target.value })} placeholder="grill, dessert" />
        </label>
        <label className="block text-sm font-medium">
          Alert threshold (minutes)
          <input className={fieldClass} type="number" min={1} step={1} value={draft.alertThresholdMins} onChange={(e) => patch({ alertThresholdMins: e.target.value })} />
          <span className={hintClass}>An item is stale once it waited strictly longer than this.</span>
        </label>
        <label className="block text-sm font-medium">
          Staff ids (comma separated)
          <input className={fieldClass} value={draft.staffIds} onChange={(e) => patch({ staffIds: e.target.value })} />
          <span className={hintClass}>Only these staff can advance this station&apos;s items.</span>
        </label>
        <label className="block text-sm font-medium">
          Device ids (comma separated)
          <input className={fieldClass} value={draft.deviceIds} onChange={(e) => patch({ deviceIds: e.target.value })} />
          <span className={hintClass}>Opaque ids for kitchen displays (drivers arrive in phase 4).</span>
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" className="size-4" checked={draft.isDefault} onChange={(e) => patch({ isDefault: e.target.checked })} />
          Default station for unmapped categories
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className={primaryButtonClass} disabled={busy || !valid}>
            {editing ? 'Save station' : 'Create station'}
          </button>
        </div>
      </form>
      <DeviceBridgeSection token={token} locationId={locationId} />
      <PrintJobsPanel token={token} visits={visits} />
    </section>
  );
}
