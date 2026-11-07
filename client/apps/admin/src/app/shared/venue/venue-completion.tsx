'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { RefreshCcw } from 'lucide-react';
import VenueCheckout from './venue-checkout';
import {
  buttonClass,
  Chip,
  EmptyState,
  Notice,
  panelClass,
  primaryButtonClass,
} from './workspace/controls';

type Visit = {
  id: string;
  location: string;
  tables: string[];
  openedAt: string;
  timezone: string;
  state?: string;
};
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function VisitStatusChip({
  completed,
  selected,
}: {
  completed: boolean;
  selected: boolean;
}) {
  if (completed) return <Chip tone="ready" label="Completed" />;
  if (selected) return <Chip tone="info" label="Bill open below" />;
  return <Chip tone="pending" label="Open · completion required" />;
}

export default function VenueCompletion({
  initialVisit,
}: {
  initialVisit?: string;
}) {
  const { data: session } = useSession();
  const token = session?.user?.token || '';
  const manager = ['tenant_owner', 'tenant_admin'].includes(
    session?.user?.role || '',
  );
  const generation = useRef(0);
  const [scope, setScope] = useState('');
  const [rows, setRows] = useState<Visit[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState(
    initialVisit && /^[a-f\d]{24}$/i.test(initialVisit) ? initialVisit : '',
  );
  const [completed, setCompleted] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (after?: string) => {
      if (!token || !manager) return;
      const current = ++generation.current;
      setScope(token);
      if (!after) setRows([]);
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `${API}/api/venue-ops/open-visits${after ? `?after=${after}` : ''}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
        );
        const result = (await response.json()) as {
          data: { items: Visit[]; next: string | null };
          message?: string;
        };
        if (!response.ok)
          throw new Error(result.message || 'Unable to load existing visits');
        if (current !== generation.current) return;
        setRows((old) =>
          after ? [...old, ...result.data.items] : result.data.items,
        );
        setNext(result.data.next);
      } catch (e) {
        if (current !== generation.current) return;
        setError(e instanceof Error ? e.message : 'Unable to load visits');
        if (!after) setRows([]);
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [token, manager],
  );
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);
  const visibleRows = scope === token ? rows : [];
  const openCount = visibleRows.filter((row) => !completed.includes(row.id))
    .length;
  const doneCount = visibleRows.filter((row) =>
    completed.includes(row.id),
  ).length;
  const firstOpenId = visibleRows.find(
    (row) => !completed.includes(row.id) && row.id !== selected,
  )?.id;
  // Focus the first pending visit once per completed load so keyboard and
  // screen-reader users start on the actionable row. No per-update refocusing
  // while the manager works through the list in one session.
  const firstOpenRef = useRef<HTMLButtonElement | null>(null);
  const focusedGeneration = useRef<number | null>(null);
  useEffect(() => {
    if (loading || !firstOpenId) return;
    if (focusedGeneration.current === generation.current) return;
    focusedGeneration.current = generation.current;
    firstOpenRef.current?.focus();
  }, [loading, firstOpenId]);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">
            Complete existing visits
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Finish and reconcile visits that were already opened. This page
            cannot start new visits or add orders.
          </p>
        </div>
        {manager && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={buttonClass}
            >
              <RefreshCcw aria-hidden="true" className="size-4" />
              Reload existing visits
            </button>
            <Link href="/venue" className={buttonClass}>
              Back to venue workspace
            </Link>
          </div>
        )}
      </div>
      {!manager ? (
        <Notice tone="info" role="status">
          <strong>Cashier view locked for this page.</strong> Cashiers complete
          permitted visits through{' '}
          <Link className="font-semibold underline" href="/pos/sell">
            the cashier POS
          </Link>
          . Manager access is required to reconcile saved visits here.
        </Notice>
      ) : (
        <>
          {error && (
            <Notice
              tone="error"
              role="alert"
              action={
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className={buttonClass}
                >
                  Retry loading visits
                </button>
              }
            >
              {error}
            </Notice>
          )}
          {loading && (
            <div className="space-y-3" role="status">
              <div className="h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-24 animate-pulse rounded-xl border border-muted bg-gray-100 dark:border-gray-700 dark:bg-gray-800" />
            </div>
          )}
          {!loading && !error && !visibleRows.length && (
            <EmptyState
              message="No eligible open visits. Every opened visit for this venue has been completed or there is nothing awaiting reconciliation."
              action={
                <button
                  type="button"
                  onClick={() => void load()}
                  className={buttonClass}
                >
                  Refresh the list
                </button>
              }
            />
          )}
          {!loading && !!visibleRows.length && (
            <section
              aria-label="Visit completion progress"
              className={`${panelClass} space-y-3`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">
                  Completion progress
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-semibold tabular-nums">
                    {doneCount} completed
                  </span>{' '}
                  ·{' '}
                  <span className="font-semibold tabular-nums">
                    {openCount} open
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold tabular-nums">
                    {visibleRows.length}
                  </span>{' '}
                  loaded visits
                </p>
              </div>
              <div
                aria-hidden="true"
                className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              >
                <div
                  className="h-full rounded-full bg-green-600 transition-all duration-300 dark:bg-green-500"
                  style={{
                    width: `${Math.round(
                      (doneCount / visibleRows.length) * 100,
                    )}%`,
                  }}
                />
              </div>
              {firstOpenId ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-semibold tabular-nums">
                    Visits awaiting action: {openCount}
                  </span>{' '}
                  — open the next pending bill below and reconcile its
                  payment.
                </p>
              ) : (
                <p
                  role="status"
                  className="text-sm font-semibold text-green-700 dark:text-green-300"
                >
                  All loaded visits are completed in this session. Refresh the
                  list to confirm nothing else is open.
                </p>
              )}
              {openCount > 0 && (
                <p role="status" className="sr-only">
                  {openCount} {openCount === 1 ? 'visit' : 'visits'} awaiting
                  action.
                </p>
              )}
            </section>
          )}
          <ul className="space-y-3">
            {visibleRows.map((row) => {
              const isCompleted = completed.includes(row.id);
              const isSelected = selected === row.id;
              return (
                <li
                  key={row.id}
                  className={`${panelClass} ${
                    isSelected && !isCompleted
                      ? 'border-primary'
                      : ''
                  } flex flex-wrap items-start justify-between gap-3`}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-semibold">
                        {row.location} ·{' '}
                        {row.tables.join(', ') || 'Assigned tables'}
                      </h3>
                      <VisitStatusChip
                        completed={isCompleted}
                        selected={isSelected}
                      />
                    </div>
                    <p className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
                      Opened{' '}
                      {new Intl.DateTimeFormat('en-NG', {
                        timeZone: row.timezone,
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(row.openedAt))}{' '}
                      · {row.timezone}
                    </p>
                  </div>
                  <button
                    ref={
                      row.id === firstOpenId
                        ? (node) => {
                            firstOpenRef.current = node;
                          }
                        : undefined
                    }
                    className={
                      row.id === firstOpenId
                        ? primaryButtonClass
                        : buttonClass
                    }
                    onClick={() => setSelected(row.id)}
                    disabled={isCompleted}
                  >
                    {isCompleted ? 'Completed' : 'Open existing bill'}
                  </button>
                </li>
              );
            })}
          </ul>
          {next && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(next)}
              className={buttonClass}
            >
              More existing visits
            </button>
          )}
          {selected && (
            <VenueCheckout
              key={`${token}:${selected}`}
              token={token}
              sessionId={selected}
              onSettled={() =>
                setCompleted((old) =>
                  old.includes(selected) ? old : [...old, selected],
                )
              }
            />
          )}
        </>
      )}
    </main>
  );
}
