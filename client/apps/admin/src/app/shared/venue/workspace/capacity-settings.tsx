'use client';
import { useCallback, useEffect, useState } from 'react';
import { venueLocalToInstant, venueWallTime } from 'commerce-core';
import { Save } from 'lucide-react';
import { experienceRequest, type Workspace } from '@/services/venue/experience';
import {
  buttonClass,
  Chip,
  fieldClass,
  hintClass,
  Notice,
  panelClass,
  primaryButtonClass,
} from './controls';
type Policy = {
  version: number;
  enabled: boolean;
  timezone: string;
  resources: string[];
  combinations: string[][];
  windows: { start: string; end: string }[];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  holdSeconds: number;
  financialPolicyVersion?: number | null;
};

const initial = (timezone: string): Policy => ({
  version: 0,
  enabled: false,
  timezone,
  resources: [],
  combinations: [],
  windows: [{ start: '', end: '' }],
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 10,
  holdSeconds: 600,
  financialPolicyVersion: null,
});

type NumericPolicyKey =
  | 'durationMinutes'
  | 'bufferBeforeMinutes'
  | 'bufferAfterMinutes'
  | 'holdSeconds';

const numberFields: [NumericPolicyKey, string, string][] = [
  ['durationMinutes', 'Seating duration (minutes)', 'How long a booking keeps its tables before leaving them free.'],
  ['bufferBeforeMinutes', 'Buffer before (minutes)', 'Turnaround time reserved before each seating.'],
  ['bufferAfterMinutes', 'Buffer after (minutes)', 'Turnaround time reserved after each seating.'],
  ['holdSeconds', 'Hold duration (seconds)', 'Seconds a returned acceptance stays reserved for this guest before expiry.'],
];

export default function CapacitySettings({
  token,
  locationId,
  timezone,
  tables,
}: {
  token: string;
  locationId: string;
  timezone: string;
  tables: Workspace['tables'];
}) {
  const [policy, setPolicy] = useState<Policy>(initial(timezone));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const row = await experienceRequest<Policy | null>(
        token,
        `/locations/${locationId}/capacity`,
      );
      setPolicy(
        row
          ? {
              ...row,
              windows: row.windows.map((w) => ({
                start: venueWallTime(w.start, row.timezone),
                end: venueWallTime(w.end, row.timezone),
              })),
            }
          : initial(timezone),
      );
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load capacity');
    }
  }, [token, locationId, timezone]);
  useEffect(() => {
    setReady(false);
    void load();
  }, [load]);
  if (!ready)
    return (
      <section aria-label="Capacity settings" className="space-y-4">
        <h2 className="text-xl font-semibold">Capacity settings</h2>
        {error ? (
          <Notice
            tone="error"
            role="alert"
            action={
              <button type="button" className={buttonClass} onClick={load}>
                Retry loading policy
              </button>
            }
          >
            {error}
          </Notice>
        ) : (
          <div className="space-y-3" role="status">
            <div className="h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-24 animate-pulse rounded-xl border border-muted bg-gray-100 dark:border-gray-700 dark:bg-gray-800" />
          </div>
        )}
      </section>
    );
  return (
    <section aria-label="Capacity settings" className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">Capacity settings</h2>
        <Chip
          tone={policy.enabled ? 'ready' : 'info'}
          label={policy.enabled ? 'Acceptance enabled' : 'Acceptance off'}
        />
        <Chip tone="info" label={`Version ${policy.version}`} />
      </div>
      <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        Choose tables and dated service windows before enabling capacity.
      </p>
      <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        All times use {policy.timezone}. Live commitments must be resolved
        before changing their configuration.
      </p>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4 rounded border-gray-400"
          checked={policy.enabled}
          onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })}
        />
        Enable capacity acceptance
      </label>
      <fieldset className={`${panelClass} space-y-2`}>
        <legend className="px-1 text-base font-semibold">Physical tables</legend>
        <p className={hintClass}>
          Only enrolled tables can be held for accepted bookings.
        </p>
        {tables.map((t) => (
          <label key={t._id} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border-gray-400"
              checked={policy.resources.includes(t._id)}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  resources: e.target.checked
                    ? [...policy.resources, t._id]
                    : policy.resources.filter((r) => r !== t._id),
                  combinations: policy.combinations.filter(
                    (c) => !c.includes(t._id),
                  ),
                })
              }
            />
            {t.name} · {t.seats} seats
          </label>
        ))}
      </fieldset>
      <fieldset className={`${panelClass} space-y-3`}>
        <legend className="px-1 text-base font-semibold">
          Dated service windows
        </legend>
        <p className={hintClass}>
          A window covers one service day (it may end after midnight). Guests
          can request times falling inside a window.
        </p>
        {policy.windows.map((w, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-muted bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
          >
            <label className="text-sm font-medium">
              Service starts
              <input
                type="datetime-local"
                className={`${fieldClass} w-auto`}
                value={w.start}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    windows: policy.windows.map((row, index) =>
                      index === i ? { ...row, start: e.target.value } : row,
                    ),
                  })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Service ends
              <input
                type="datetime-local"
                className={`${fieldClass} w-auto`}
                value={w.end}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    windows: policy.windows.map((row, index) =>
                      index === i ? { ...row, end: e.target.value } : row,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className={buttonClass}
              disabled={policy.windows.length === 1}
              onClick={() =>
                setPolicy({
                  ...policy,
                  windows: policy.windows.filter((_, index) => index !== i),
                })
              }
            >
              Remove window {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            setPolicy({ ...policy, windows: [...policy.windows, { start: '', end: '' }] })
          }
        >
          Add service window
        </button>
      </fieldset>
      <fieldset className={`${panelClass} space-y-2`}>
        <legend className="px-1 text-base font-semibold">
          Seating rhythm
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {numberFields.map(([key, label, hint]) => (
            <label key={key} className="block text-sm font-medium">
              {label}
              <input
                type="number"
                className={fieldClass}
                value={policy[key]}
                onChange={(e) =>
                  setPolicy({ ...policy, [key]: Number(e.target.value) })
                }
              />
              <span className={hintClass}>{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={`${panelClass} space-y-2`}>
        <p className="text-sm">
          <span className="font-semibold">Combined tables:</span>{' '}
          <span className="text-gray-600 dark:text-gray-300">
            {policy.combinations
              .map((c) =>
                c.map((id) => tables.find((t) => t._id === id)?.name || id).join(' + '),
              )
              .join('; ') || 'None'}
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={policy.resources.length < 2}
            onClick={() =>
              setPolicy({
                ...policy,
                combinations: policy.combinations.some(
                  (c) =>
                    c.length === policy.resources.length &&
                    c.every((id) => policy.resources.includes(id)),
                )
                  ? policy.combinations
                  : [...policy.combinations, [...policy.resources]],
              })
            }
          >
            Allow all selected tables as a combination
          </button>
          {!!policy.combinations.length && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => setPolicy({ ...policy, combinations: [] })}
            >
              Remove combined-table options
            </button>
          )}
        </div>
      </div>
      <label className="block max-w-sm text-sm font-medium">
        Approved financial policy version (optional)
        <input
          type="number"
          min="1"
          className={fieldClass}
          value={policy.financialPolicyVersion || ''}
          onChange={(e) =>
            setPolicy({
              ...policy,
              financialPolicyVersion: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
        <span className={hintClass}>
          Link the venue money policy that governs shared payments for these
          bookings.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={primaryButtonClass}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            setMessage('');
            try {
              const { version, ...values } = policy;
              const result = await experienceRequest<{ version: number }>(
                token,
                `/locations/${locationId}/capacity`,
                'PUT',
                {
                  expectedVersion: version,
                  input: {
                    ...values,
                    windows: values.windows.map((w) => ({
                      start: venueLocalToInstant(w.start, policy.timezone),
                      end: venueLocalToInstant(w.end, policy.timezone),
                    })),
                  },
                },
              );
              setPolicy({ ...policy, version: result.version });
              setMessage(
                'Capacity saved. Reload venue status before accepting requests.',
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Unable to save capacity',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save aria-hidden="true" className="size-4" />
          Save capacity policy
        </button>
        {busy && (
          <p role="status" className="text-sm text-gray-600 dark:text-gray-300">
            Saving capacity policy…
          </p>
        )}
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
    </section>
  );
}
