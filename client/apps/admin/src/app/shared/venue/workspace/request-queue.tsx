'use client';
import { venueLocalToInstant, venueWallTime } from 'commerce-core';
import { CalendarClock, ChevronUp, Users } from 'lucide-react';
import CapacityReschedule from './capacity-reschedule';
import CapacityAcceptance, {
  type CapacityAvailability,
} from './capacity-acceptance';
import { useState } from 'react';
import type { RequestRow, Workspace } from '@/services/venue/experience';
import {
  buttonClass,
  dangerButtonClass,
  fieldClass,
  hintClass,
  panelClass,
  primaryButtonClass,
  Chip,
  EmptyState,
} from './controls';

export default function RequestQueue({
  rows,
  tables,
  canManage,
  canSeat,
  busy,
  onAction,
  onAvailability,
  onMore,
  more,
}: {
  rows: RequestRow[];
  tables: Workspace['tables'];
  canManage: boolean;
  canSeat: boolean;
  busy: boolean;
  onAction: (
    row: RequestRow,
    action: string,
    body?: unknown,
  ) => Promise<boolean>;
  onAvailability?: (row: RequestRow) => Promise<CapacityAvailability>;
  onMore: () => void;
  more: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [amendError, setAmendError] = useState('');
  const [declining, setDeclining] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [amend, setAmend] = useState({ partySize: 2, bookingAt: '' });
  return (
    <section className="space-y-4" aria-label="Requests and arrivals">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Requests and arrivals</h2>
        <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Review records staff attention. It does not guarantee future capacity.
          Seat guests against an available table when they arrive.
        </p>
      </div>
      {!rows.length && (
        <EmptyState message="No requests at this location." />
      )}
      {rows.map((row) => (
        <article key={row.id} className={`${panelClass} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              {row.guest.name}
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <Users aria-hidden="true" className="size-3.5" />
                {row.partySize} guests
              </span>
            </h3>
            <p className="flex items-center gap-1.5 text-sm tabular-nums text-gray-600 dark:text-gray-300">
              <CalendarClock aria-hidden="true" className="size-4" />
              {new Intl.DateTimeFormat('en-NG', {
                timeZone: row.policy.timezone,
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(row.bookingAt))}{' '}
              · {row.policy.timezone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              tone={row.status === 'pending' ? 'pending' : 'info'}
              label={row.statusLabel}
            />
            <Chip tone="info" label={row.requestState} />
          </div>
          <p className="break-all text-xs text-gray-500 dark:text-gray-400">
            Reference {row.reference}
          </p>
          {row.capacity && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Accepted tables:{' '}
              <span className="font-medium">
                {row.capacity.resourceIds
                  .map(
                    (r) => tables.find((t) => t._id === r)?.name || 'Table',
                  )
                  .join(' + ')}
              </span>{' '}
              · state {row.capacity.state}
            </p>
          )}
          {canManage &&
            onAvailability &&
            row.status === 'confirmed' &&
            row.capacity && (
              <CapacityReschedule
                key={`reschedule:${row.id}:${row.version}`}
                row={row}
                tables={tables}
                busy={busy}
                load={onAvailability}
                accept={(input) => onAction(row, 'accept', { input })}
              />
            )}
          {canManage &&
            onAvailability &&
            row.status === 'pending' && (
              <CapacityAcceptance
                key={`${row.id}:${row.version}`}
                tables={tables}
                busy={busy}
                load={() => onAvailability(row)}
                accept={(input) => onAction(row, 'accept', { input })}
              />
            )}
          {canManage && ['pending', 'confirmed'].includes(row.status) && (
            <div className="flex flex-wrap items-center gap-3">
              {row.status === 'pending' && (
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => void onAction(row, 'review')}
                >
                  Mark reviewed
                </button>
              )}
              {row.status === 'pending' &&
                (declining === row.id ? (
                  <span className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    Declining notifies the guest and ends this request.
                    <button
                      className={dangerButtonClass}
                      disabled={busy}
                      onClick={() => {
                        setDeclining(null);
                        void onAction(row, 'decline');
                      }}
                    >
                      Confirm decline
                    </button>
                    <button
                      className={buttonClass}
                      disabled={busy}
                      onClick={() => setDeclining(null)}
                    >
                      Keep request
                    </button>
                  </span>
                ) : (
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => setDeclining(row.id)}
                  >
                    Decline request
                  </button>
                ))}
              {row.status === 'pending' && (
                <button
                  className={buttonClass}
                  onClick={() => {
                    setEditing(row.id);
                    setAmendError('');
                    setAmend({
                      partySize: row.partySize,
                      bookingAt: venueWallTime(
                        row.bookingAt,
                        row.policy.timezone,
                      ),
                    });
                  }}
                >
                  Amend request
                </button>
              )}
              {canSeat &&
                (!row.capacity || row.capacity.state === 'confirmed') &&
                row.requestState === 'reviewed' && (
                  <>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium">
                        Seat {row.guest.name}
                        <select
                          className={fieldClass}
                          value={selected[row.id] || ''}
                          onChange={(e) =>
                            setSelected({ ...selected, [row.id]: e.target.value })
                          }
                        >
                          <option value="">Choose available table</option>
                          {tables
                            .filter(
                              (t) =>
                                (!row.capacity ||
                                  row.capacity.resourceIds.includes(t._id)) &&
                                t.status === 'available' &&
                                (row.capacity
                                  ? tables
                                      .filter((table) =>
                                        row.capacity?.resourceIds.includes(
                                          table._id,
                                        ),
                                      )
                                      .reduce(
                                        (sum, table) => sum + table.seats,
                                        0,
                                      )
                                  : t.seats) >= row.partySize,
                            )
                            .map((t) => (
                              <option key={t._id} value={t._id}>
                                {t.name} · {t.seats} seats
                              </option>
                            ))}
                        </select>
                      </label>
                      <p className={hintClass}>
                        Only tables that currently seat this party are listed.
                      </p>
                    </div>
                    <button
                      className={primaryButtonClass}
                      disabled={busy || !selected[row.id]}
                      onClick={() => {
                        const table = tables.find(
                          (t) => t._id === selected[row.id],
                        );
                        if (table)
                          void onAction(row, 'check-in', {
                            tableIds:
                              row.capacity?.resourceIds || [table._id],
                            expectedTableVersions: (
                              row.capacity?.resourceIds || [table._id]
                            ).map(
                              (r) =>
                                tables.find((t) => t._id === r)?.venueVersion ??
                                -1,
                            ),
                          });
                      }}
                    >
                      Check in arrival
                    </button>
                  </>
                )}
            </div>
          )}
          {editing === row.id && (
            <form
              className="space-y-3 rounded-xl border border-muted bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60"
              onSubmit={async (e) => {
                e.preventDefault();
                setAmendError('');
                try {
                  const success = await onAction(row, 'amend', {
                    input: {
                      guest: row.guest,
                      partySize: amend.partySize,
                      bookingAt: venueLocalToInstant(
                        amend.bookingAt,
                        row.policy.timezone,
                      ),
                    },
                  });
                  if (success) setEditing(null);
                } catch (error) {
                  setAmendError(
                    error instanceof Error
                      ? error.message
                      : 'Unable to save amendment',
                  );
                }
              }}
            >
              {amendError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                >
                  {amendError}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <label className="text-sm font-medium">
                  Party size
                  <input
                    required
                    min={1}
                    max={100}
                    type="number"
                    className={fieldClass}
                    value={amend.partySize}
                    onChange={(e) =>
                      setAmend({
                        ...amend,
                        partySize: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-sm font-medium">
                  Requested time · {row.policy.timezone}
                  <input
                    required
                    type="datetime-local"
                    className={`${fieldClass} w-auto`}
                    value={amend.bookingAt}
                    onChange={(e) =>
                      setAmend({ ...amend, bookingAt: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className={primaryButtonClass} disabled={busy}>
                  Save amendment
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setEditing(null)}
                >
                  Keep original request
                </button>
              </div>
            </form>
          )}
        </article>
      ))}
      {more && (
        <button type="button" onClick={onMore} className={buttonClass}>
          <ChevronUp aria-hidden="true" className="size-4 rotate-180" />
          Load more requests
        </button>
      )}
    </section>
  );
}
