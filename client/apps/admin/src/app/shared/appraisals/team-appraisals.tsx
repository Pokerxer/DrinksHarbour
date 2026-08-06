'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Input } from 'rizzui';
import {
  PiArrowClockwise,
  PiArrowRight,
  PiCalendarBlank,
  PiCheckCircle,
  PiMagnifyingGlass,
  PiUsersThree,
  PiWarningCircle,
  PiWarningOctagon,
} from 'react-icons/pi';
import {
  fetchTeamAppraisals,
  type Appraisal,
  type PersonRef,
} from '@/services/appraisal.service';
import AppraisalStateBadge from './state-badge';
import {
  deadlineTone,
  formatDueLabel,
  personName,
} from './my-appraisals-utils';
import {
  filterTeamAppraisals,
  isRowOverdue,
  managerActionFor,
  sortTeamAppraisals,
  teamSummary,
  type TeamScope,
} from './team-appraisals-utils';

function jobTitle(person?: PersonRef | null): string {
  return person?.employeeProfile?.work?.jobTitle || '—';
}

/** Two-letter monogram, falling back to the email when there is no name. */
function initials(person?: PersonRef | null): string {
  const first = person?.firstName?.trim()?.[0];
  const last = person?.lastName?.trim()?.[0];
  if (first || last) return `${first ?? ''}${last ?? ''}`.toUpperCase();
  return (person?.email?.trim()?.[0] ?? '?').toUpperCase();
}

function Avatar({ person }: { person?: PersonRef | null }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold tracking-wide text-gray-500"
    >
      {initials(person)}
    </div>
  );
}

/** The due date, coloured by urgency. Overdue only means something while the
 *  appraisal is still live — see isRowOverdue. */
function DueCell({ row }: { row: Appraisal }) {
  const deadline = row.cycle?.feedbackDeadline;
  if (!deadline) {
    return <span className="text-xs text-gray-300">No deadline</span>;
  }
  const overdue = isRowOverdue(row);
  const tone = deadlineTone(deadline);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium ${
        overdue
          ? 'text-red-600'
          : tone === 'soon'
            ? 'text-amber-600'
            : 'text-gray-500'
      }`}
    >
      {overdue ? (
        <PiWarningOctagon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <PiCalendarBlank className="h-3.5 w-3.5 shrink-0" />
      )}
      {overdue ? 'Overdue · ' : ''}
      {formatDueLabel(deadline)}
    </span>
  );
}

function OpenLink({ row, block }: { row: Appraisal; block?: boolean }) {
  const action = managerActionFor(row.state);
  return (
    <Link
      href={`/appraisals/${row._id}`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors ${
        block ? 'w-full justify-center border px-3 py-2' : ''
      } ${
        action.needsAction
          ? `text-[#b20202] hover:underline ${block ? 'border-[#b20202]/30 bg-[#b20202]/[0.04]' : ''}`
          : `text-gray-500 hover:text-gray-900 hover:underline ${block ? 'border-gray-200' : ''}`
      }`}
    >
      {/* The label is the ACTION, not a uniform "Open": a manager scanning the
          column needs to know which rows want work from them. */}
      {action.needsAction ? action.label : 'Open'}
      <PiArrowRight className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );
}

/** A summary tile that is also the filter for what it counts. */
function StatTile({
  label,
  value,
  active,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  tone: 'brand' | 'red' | 'emerald' | 'gray';
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const toneRing = {
    brand: 'ring-[#b20202]/40 bg-[#b20202]/[0.04]',
    red: 'ring-red-300 bg-red-50/60',
    emerald: 'ring-emerald-300 bg-emerald-50/60',
    gray: 'ring-gray-300 bg-gray-50',
  }[tone];
  const toneText = {
    brand: 'text-[#b20202]',
    red: 'text-red-600',
    emerald: 'text-emerald-600',
    gray: 'text-gray-700',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-gray-100 p-3.5 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]/40 sm:p-4 ${
        active ? `ring-2 ${toneRing}` : 'bg-white'
      }`}
    >
      <span
        className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 sm:flex ${toneText}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-xl font-bold tabular-nums ${toneText}`}>
          {value}
        </span>
        <span className="block truncate text-xs font-medium text-gray-500">
          {label}
        </span>
      </span>
    </button>
  );
}

export default function TeamAppraisals() {
  const [items, setItems] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<TeamScope>('all');

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    setLoading(true);
    setLoadFailed(null);
    try {
      const rows = await fetchTeamAppraisals();
      if (!signal.cancelled) setItems(rows);
    } catch (e) {
      if (signal.cancelled) return;
      const message =
        e instanceof Error
          ? e.message
          : "Failed to load your team's appraisals";
      // Recorded, not just toasted: a failed fetch used to leave `items` empty,
      // which rendered the "No appraisals yet" empty state — telling a manager
      // their team has no reviews when the request simply failed.
      setLoadFailed(message);
      toast.error(message);
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const summary = useMemo(() => teamSummary(items), [items]);
  const visible = useMemo(
    () => sortTeamAppraisals(filterTeamAppraisals(items, { query, scope })),
    [items, query, scope]
  );

  const isFiltered = scope !== 'all' || query.trim().length > 0;
  function toggleScope(next: TeamScope) {
    setScope((cur) => (cur === next ? 'all' : next));
  }

  /* ── Error state ───────────────────────────────────────────────────────── */
  if (!loading && loadFailed) {
    return (
      <div className="px-6 py-8 md:px-10 lg:px-14">
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <PiWarningCircle className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">
            Your team&rsquo;s appraisals could not be loaded.
          </p>
          <p className="mt-1 text-xs text-gray-400">{loadFailed}</p>
          <Button
            variant="outline"
            onClick={() => void load({ cancelled: false })}
            className="mt-6 rounded-xl"
          >
            <PiArrowClockwise className="me-1.5 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-8 sm:px-6 md:px-10 lg:px-14">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Team appraisals
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your direct reports&rsquo; performance reviews, outstanding work
          first.
        </p>
      </div>

      {/* Counters double as filters, so the number a manager is worried about
          is also the way to see only those rows. */}
      <div className="flex flex-wrap gap-3">
        <StatTile
          label="Need you"
          value={summary.needsAction}
          active={scope === 'needs-action'}
          tone="brand"
          icon={<PiUsersThree className="h-4.5 w-4.5" />}
          onClick={() => toggleScope('needs-action')}
        />
        <StatTile
          label="Overdue"
          value={summary.overdue}
          active={scope === 'overdue'}
          tone="red"
          icon={<PiWarningOctagon className="h-4.5 w-4.5" />}
          onClick={() => toggleScope('overdue')}
        />
        <StatTile
          label="Complete"
          value={summary.complete}
          active={scope === 'complete'}
          tone="emerald"
          icon={<PiCheckCircle className="h-4.5 w-4.5" />}
          onClick={() => toggleScope('complete')}
        />
        <StatTile
          label="Total"
          value={summary.total}
          active={scope === 'all' && !query}
          tone="gray"
          icon={<PiUsersThree className="h-4.5 w-4.5" />}
          onClick={() => {
            setScope('all');
            setQuery('');
          }}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, job title or cycle…"
          prefix={<PiMagnifyingGlass className="h-4 w-4 text-gray-400" />}
          className="w-full sm:max-w-xs"
          inputClassName="rounded-xl"
        />
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setScope('all');
              setQuery('');
            }}
            className="self-start text-xs font-semibold text-gray-400 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-[#b20202] sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Mobile: stacked cards ───────────────────────────────────────────
          A 6-column table forced into a 640px min-width used to mean the
          manager scrolled sideways on a phone to reach the status and the
          action — the two columns that matter most. */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-gray-50"
            />
          ))
        ) : visible.length === 0 ? (
          <EmptyState
            isFiltered={isFiltered}
            onClear={() => {
              setScope('all');
              setQuery('');
            }}
          />
        ) : (
          visible.map((a) => (
            <div
              key={a._id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <Avatar person={a.employee} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {personName(a.employee)}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {jobTitle(a.employee)}
                  </p>
                </div>
                <AppraisalStateBadge state={a.state} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span className="truncate">{a.cycle?.name || '—'}</span>
                <DueCell row={a} />
              </div>
              <OpenLink row={a} block />
            </div>
          ))
        )}
      </div>

      {/* ── md+: table ──────────────────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th scope="col" className="px-5 py-3">
                  Employee
                </th>
                <th scope="col" className="px-5 py-3">
                  Job title
                </th>
                <th scope="col" className="px-5 py-3">
                  Cycle
                </th>
                <th scope="col" className="px-5 py-3">
                  Due
                </th>
                <th scope="col" className="px-5 py-3">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16">
                    <EmptyState
                      isFiltered={isFiltered}
                      onClear={() => {
                        setScope('all');
                        setQuery('');
                      }}
                    />
                  </td>
                </tr>
              ) : (
                visible.map((a) => {
                  const needsAction = managerActionFor(a.state).needsAction;
                  return (
                    <tr
                      key={a._id}
                      className="transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {/* A left rule rather than a whole tinted row: the
                              rows needing work are findable at a glance without
                              turning the table into a colour chart. */}
                          <span
                            aria-hidden="true"
                            className={`-ms-2 h-8 w-0.5 rounded-full ${
                              needsAction ? 'bg-[#b20202]' : 'bg-transparent'
                            }`}
                          />
                          <Avatar person={a.employee} />
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {personName(a.employee)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {jobTitle(a.employee)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {a.cycle?.name || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <DueCell row={a} />
                      </td>
                      <td className="px-5 py-3.5">
                        <AppraisalStateBadge state={a.state} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <OpenLink row={a} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** "Nothing here" and "nothing MATCHED" are different problems and need
 *  different exits — the second one is the user's own filter. */
function EmptyState({
  isFiltered,
  onClear,
}: {
  isFiltered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        {isFiltered ? (
          <PiMagnifyingGlass className="h-7 w-7 text-gray-400" />
        ) : (
          <PiUsersThree className="h-7 w-7 text-gray-400" />
        )}
      </div>
      <h3 className="text-base font-semibold text-gray-700">
        {isFiltered ? 'No matching appraisals' : 'No appraisals yet'}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-gray-400">
        {isFiltered
          ? 'Nothing matches the current search and filter.'
          : 'None of your direct reports have an appraisal in progress.'}
      </p>
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-xs font-semibold text-[#b20202] underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
