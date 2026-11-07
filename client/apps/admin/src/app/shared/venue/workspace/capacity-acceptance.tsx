'use client';
import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import {
  buttonClass,
  Chip,
  fieldClass,
  panelClass,
  primaryButtonClass,
  Notice,
} from './controls';

export type CapacityAvailability = {
  policyVersion: number;
  options: { resourceIds: string[] }[];
  asOf: string;
  durationMinutes: number;
  timezone: string;
};

export default function CapacityAcceptance({
  tables,
  busy,
  load,
  accept,
}: {
  tables: { _id: string; name: string }[];
  busy: boolean;
  load: () => Promise<CapacityAvailability>;
  accept: (input: { resourceIds: string[]; policyVersion: number }) => Promise<boolean>;
}) {
  const [result, setResult] = useState<CapacityAvailability | null>(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className={`${panelClass} space-y-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={busy || loading}
          onClick={async () => {
            setError('');
            setResult(null);
            setSelected('');
            setLoading(true);
            try {
              setResult(await load());
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'Unable to check capacity. Retry.',
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          <RefreshCcw
            aria-hidden="true"
            className={`size-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
          />
          {loading ? 'Checking availability…' : 'Check booking availability'}
        </button>
      </div>
      {error && (
        <Notice
          tone="error"
          role="alert"
          action={
            <button
              type="button"
              className={buttonClass}
              disabled={busy || loading}
              onClick={async () => {
                setError('');
                setResult(null);
                setSelected('');
                setLoading(true);
                try {
                  setResult(await load());
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Unable to check capacity. Retry.',
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              Retry
            </button>
          }
        >
          {error}
        </Notice>
      )}
      {result && !result.options.length && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No tables are available for this interval.
        </p>
      )}
      {result && result.options.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              tone="ready"
              label={`Held for ${result.durationMinutes} minutes`}
            />
            <Chip tone="info" label={`Policy version ${result.policyVersion}`} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tables are secured when you accept.
          </p>
          <label className="block max-w-sm text-sm font-medium">
            Available tables
            <select
              className={fieldClass}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose tables</option>
              {result.options.map((option, i) => (
                <option key={option.resourceIds.join(':')} value={i}>
                  {option.resourceIds
                    .map((r) => tables.find((t) => t._id === r)?.name || 'Table')
                    .join(' + ')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={busy || selected === ''}
            onClick={async () => {
              const option = result.options[Number(selected)];
              if (!option) return;
              setError('');
              try {
                if (
                  !(await accept({
                    resourceIds: option.resourceIds,
                    policyVersion: result.policyVersion,
                  }))
                ) {
                  setResult(null);
                  setSelected('');
                  setError(
                    'Booking changed or tables were taken. Refresh availability before retrying.',
                  );
                }
              } catch (e) {
                setResult(null);
                setError(
                  e instanceof Error ? e.message : 'Unable to accept booking',
                );
              }
            }}
          >
            Accept booking
          </button>
        </div>
      )}
    </div>
  );
}
