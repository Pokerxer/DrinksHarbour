'use client';

// shared/appraisals/cycles-list.tsx — HR's index of every review cycle.
//
// The LIST is the page. The create form used to sit permanently expanded at
// the top, so the thing anyone actually opens this route for — "which cycles
// are running, and how far through are they" — started below the fold on a
// laptop and two screens down on a phone. Creating a cycle happens a handful
// of times a year; reading the list happens every time. The form is now a
// modal behind one button and the list starts at the top.
//
// Pure logic (completion maths, search, status filter, ordering) lives in
// cycles-list-utils.ts because this app's vitest runs `environment: 'node'` —
// there is no DOM, so a component cannot be rendered and anything worth
// asserting has to be a pure function.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Select, Switch, Text } from 'rizzui';
import {
  PiArrowClockwise,
  PiCalendarBlank,
  PiCaretRight,
  PiCheckCircle,
  PiClipboardText,
  PiMagnifyingGlass,
  PiPlayCircle,
  PiPlusBold,
  PiUsersThree,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import {
  createCycle,
  fetchCycles,
  fetchTemplates,
  type AppraisalCycle,
  type AppraisalTemplateDoc,
} from '@/services/appraisal.service';
import { deadlineTone } from './my-appraisals-utils';
import {
  CYCLE_STATUS_FILTERS,
  cycleCompletion,
  cyclesSummary,
  filterCycles,
  sortCycles,
  type CycleStatusFilter,
} from './cycles-list-utils';

const CYCLE_STATUS_META: Record<
  AppraisalCycle['status'],
  { label: string; bg: string }
> = {
  draft: { label: 'Draft', bg: 'bg-gray-100 text-gray-500' },
  collecting: { label: 'Collecting', bg: 'bg-blue-100 text-blue-700' },
  closed: { label: 'Closed', bg: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100 text-gray-400' },
};

// A cycle's `status` is its own 4-value enum, not an `AppraisalState` — it
// has 'closed', which no appraisal ever has (an appraisal that's done is
// 'released'/'acknowledged'), so this is a small sibling to
// state-badge.tsx's AppraisalStateBadge rather than a forced reuse of it.
// Exported so cycle-detail.tsx (which shows the same cycle) can render the
// identical badge instead of a second, possibly-drifting copy.
export function CycleStatusBadge({
  status,
}: {
  status: AppraisalCycle['status'];
}) {
  const meta = CYCLE_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        meta?.bg ?? 'bg-gray-100 text-gray-500'
      }`}
    >
      {meta?.label ?? status}
    </span>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ── New cycle ─────────────────────────────────────────────────────────── */

function NewCycleForm({
  onCreated,
  onCancel,
}: {
  onCreated: (cycle: AppraisalCycle) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [nominationDeadline, setNominationDeadline] = useState('');
  const [feedbackDeadline, setFeedbackDeadline] = useState('');
  // Defaults on: peer review is the normal shape of a cycle. HR turns it off
  // only to run a self + manager assessment only (see helper text below).
  const [peerReviewEnabled, setPeerReviewEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<AppraisalTemplateDoc[]>([]);
  // The FAMILY id, never a version `_id`. The server resolves the family to
  // its current latest at create and re-resolves it once at launch; sending a
  // specific version's id defeats both and 400s.
  const [templateFamily, setTemplateFamily] = useState('');
  // Errors show only once the field has been touched or a submit attempted —
  // "Cycle name is required" the instant the modal opens is telling HR off for
  // not having typed yet.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchTemplates();
        if (cancelled) return;
        setTemplates(rows);
        // Deliberately NOT preselected. Preselecting the tenant default meant
        // a cycle created without touching this control silently ran the
        // generic six-question form, and nobody found out until employees
        // opened an appraisal that was not the one HR had written. The form a
        // cycle runs is the whole cycle; it has to be chosen, not defaulted.
      } catch {
        // Non-fatal: with no list the field stays empty, the request omits
        // `templateFamily`, and the server falls back to the tenant default.
        // Failing cycle creation over a cosmetic picker would be worse.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // `{name} (v{version})` so HR can see which version they are about to launch
  // against. One option per family — fetchTemplates returns latest-only.
  const templateOptions = templates.map((t) => ({
    value: t.family,
    label: `${t.name} (v${t.version})${t.isDefault ? ' — default' : ''}`,
  }));

  // The server 400s a blank name (see appraisalCycle.controller.js#createCycle)
  // — validated here first so an empty submit is a disabled button, not a
  // round trip that comes back as a generic error toast.
  const nameError = !name.trim() ? 'Cycle name is required' : null;
  // Only enforced once the list has loaded. If fetchTemplates failed there is
  // no choice to make, and blocking creation behind a picker that never
  // appeared would be worse than the server's fallback.
  const templateError =
    templates.length > 0 && !templateFamily ? 'Choose a review form' : null;
  // Nominating happens before feedback is collected, so a nomination deadline
  // after the feedback deadline describes a cycle that cannot run. The server
  // stores both without comparing them, so this is the only place it is caught.
  const deadlineError =
    nominationDeadline &&
    feedbackDeadline &&
    nominationDeadline > feedbackDeadline
      ? 'The nomination deadline must fall on or before the feedback deadline.'
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const blocked = nameError || templateError || deadlineError;
    if (blocked) {
      toast.error(blocked);
      return;
    }
    setSubmitting(true);
    try {
      const cycle = await createCycle({
        name: name.trim(),
        // Only sent when peer review is actually on — a nomination deadline on
        // a self-and-manager cycle is a date nothing ever reads.
        nominationDeadline:
          peerReviewEnabled && nominationDeadline
            ? nominationDeadline
            : undefined,
        feedbackDeadline: feedbackDeadline || undefined,
        peerReviewEnabled,
        templateFamily: templateFamily || undefined,
      });
      toast.success('Cycle created');
      onCreated(cycle);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not create the cycle'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">New cycle</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            It starts as a draft — nothing reaches employees until you launch
            it.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label="Close"
          className="-me-1 -mt-1 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label
          htmlFor="cycle-name"
          className="mb-1.5 block text-xs font-semibold text-gray-500"
        >
          Cycle name
        </label>
        <Input
          id="cycle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="e.g. H2 2026 review"
          disabled={submitting}
          autoFocus
          error={touched && nameError ? nameError : undefined}
        />
      </div>

      {/* Stacked on a phone, side by side from sm: two native date inputs at
          half a 360px viewport each are unusable. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Only shown while peer review is on — see handleSubmit. */}
        {peerReviewEnabled && (
          <div>
            <label
              htmlFor="cycle-nomination-deadline"
              className="mb-1.5 block text-xs font-semibold text-gray-500"
            >
              Nomination deadline
            </label>
            <Input
              id="cycle-nomination-deadline"
              type="date"
              value={nominationDeadline}
              onChange={(e) => setNominationDeadline(e.target.value)}
              max={feedbackDeadline || undefined}
              disabled={submitting}
            />
          </div>
        )}
        <div>
          <label
            htmlFor="cycle-feedback-deadline"
            className="mb-1.5 block text-xs font-semibold text-gray-500"
          >
            Feedback deadline
          </label>
          <Input
            id="cycle-feedback-deadline"
            type="date"
            value={feedbackDeadline}
            onChange={(e) => setFeedbackDeadline(e.target.value)}
            min={nominationDeadline || undefined}
            disabled={submitting}
          />
        </div>
      </div>

      {deadlineError ? (
        <Text className="-mt-1 text-xs font-medium text-red-600">
          {deadlineError}
        </Text>
      ) : null}

      {templateOptions.length > 0 ? (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
            Review form
          </label>
          <Select
            value={
              templateOptions.find((o) => o.value === templateFamily) ?? null
            }
            options={templateOptions}
            placeholder="Choose a form…"
            onChange={(o: { value: string; label: string }) =>
              setTemplateFamily(o.value)
            }
            disabled={submitting}
          />
          {touched && templateError ? (
            <Text className="mt-1.5 text-xs font-medium text-red-600">
              {templateError}
            </Text>
          ) : null}
          <Text className="mt-1.5 text-xs text-gray-400">
            The cycle pins this form&apos;s current version when it launches.
            Editing the form afterwards will not change a cycle already running.
          </Text>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-gray-700">Peer review</Text>
          <Text className="text-xs text-gray-400">
            Employees nominate peers for review. Turn off to run a self and
            manager assessment only.
          </Text>
        </div>
        <Switch
          checked={peerReviewEnabled}
          onChange={(e) => setPeerReviewEnabled(e.target.checked)}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-xl"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            submitting || Boolean(nameError || templateError || deadlineError)
          }
          className="rounded-xl bg-[#b20202] hover:bg-[#9f0101]"
        >
          <PiPlusBold className="me-1.5 h-4 w-4" />
          {submitting ? 'Creating…' : 'Create cycle'}
        </Button>
      </div>
    </form>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

/** A summary tile that is also the filter for what it counts — same idiom as
 *  the team page: the number HR is worried about is the way to see those rows. */
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
  tone: 'brand' | 'blue' | 'emerald' | 'gray';
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const toneRing = {
    brand: 'ring-[#b20202]/40 bg-[#b20202]/[0.04]',
    blue: 'ring-blue-300 bg-blue-50/60',
    emerald: 'ring-emerald-300 bg-emerald-50/60',
    gray: 'ring-gray-300 bg-gray-50',
  }[tone];
  const toneText = {
    brand: 'text-[#b20202]',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    gray: 'text-gray-700',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 p-3.5 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]/40 sm:p-4 ${
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

/**
 * How far through a cycle is, as a bar plus its own numbers.
 *
 * `pct === null` renders "Not launched" and NO bar rather than an empty
 * 0%-wide one: a zero-width bar claims the work started and went nowhere,
 * where the truth is that it has not started.
 */
function ProgressCell({ byState }: { byState?: Record<string, number> }) {
  const c = cycleCompletion(byState);
  if (c.pct === null) {
    return (
      <span className="text-xs text-gray-300">
        {c.cancelled > 0 ? 'All cancelled' : 'Not launched'}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tabular-nums text-gray-900">
          {c.pct}%
        </span>
        <span className="text-xs text-gray-400">
          {c.done} of {c.total - c.cancelled} released
        </span>
      </span>
      <span
        role="progressbar"
        aria-valuenow={c.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${c.pct}% released`}
        className="block h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-gray-100"
      >
        <span
          className={`block h-full rounded-full ${
            c.pct === 100 ? 'bg-emerald-500' : 'bg-[#b20202]'
          }`}
          style={{ width: `${c.pct}%` }}
        />
      </span>
    </span>
  );
}

/** The deadline, coloured by urgency — one rule for the module, from
 *  my-appraisals-utils. A closed cycle's deadline is history, so it never
 *  goes red: chasing a finished cycle is noise. */
function DeadlineCell({ cycle }: { cycle: AppraisalCycle }) {
  const finished = cycle.status === 'closed' || cycle.status === 'cancelled';
  const tone = finished ? 'normal' : deadlineTone(cycle.feedbackDeadline);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm ${
        tone === 'overdue'
          ? 'font-medium text-[#b20202]'
          : tone === 'soon'
            ? 'font-medium text-amber-600'
            : 'text-gray-600'
      }`}
    >
      <PiCalendarBlank className="h-3.5 w-3.5 shrink-0 text-current opacity-70" />
      {formatDate(cycle.feedbackDeadline)}
      {tone === 'overdue' && ' · passed'}
    </span>
  );
}

function EmptyState({
  isFiltered,
  onClear,
  onCreate,
}: {
  isFiltered: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        {isFiltered ? (
          <PiMagnifyingGlass className="h-7 w-7 text-gray-400" />
        ) : (
          <PiClipboardText className="h-7 w-7 text-gray-400" />
        )}
      </div>
      <h3 className="text-base font-semibold text-gray-700">
        {isFiltered ? 'No matching cycles' : 'No cycles yet'}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-gray-400">
        {isFiltered
          ? 'Nothing matches the current search and status.'
          : 'Create your first review cycle to get started.'}
      </p>
      {isFiltered ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-xs font-semibold text-[#b20202] underline underline-offset-2"
        >
          Clear filters
        </button>
      ) : (
        <Button
          onClick={onCreate}
          className="mt-5 rounded-xl bg-[#b20202] hover:bg-[#9f0101]"
        >
          <PiPlusBold className="me-1.5 h-4 w-4" />
          New cycle
        </Button>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function CyclesList() {
  const router = useRouter();
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [loading, setLoading] = useState(true);
  // Recorded, not just toasted: a failed fetch used to leave `cycles` empty,
  // which rendered "No cycles yet" — telling HR the company has never run a
  // review when the request simply failed.
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CycleStatusFilter>('all');
  const [creating, setCreating] = useState(false);

  async function load(signal: { cancelled: boolean }) {
    setLoading(true);
    setLoadFailed(null);
    try {
      const rows = await fetchCycles();
      if (!signal.cancelled) setCycles(rows);
    } catch (err) {
      if (signal.cancelled) return;
      const message =
        err instanceof Error ? err.message : 'Failed to load review cycles';
      setLoadFailed(message);
      toast.error(message);
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, []);

  const summary = useMemo(() => cyclesSummary(cycles), [cycles]);
  const visible = useMemo(
    () => sortCycles(filterCycles(cycles, { query, status })),
    [cycles, query, status]
  );

  const isFiltered = status !== 'all' || query.trim().length > 0;
  function clearFilters() {
    setStatus('all');
    setQuery('');
  }
  function toggleStatus(next: CycleStatusFilter) {
    setStatus((cur) => (cur === next ? 'all' : next));
  }

  function handleCreated(cycle: AppraisalCycle) {
    // Prepended with an empty count map rather than left undefined: the row
    // renders "Not launched", which is exactly what a just-created cycle is.
    setCycles((prev) => [{ ...cycle, byState: cycle.byState ?? {} }, ...prev]);
    setCreating(false);
    // A brand-new cycle is a draft. Landing on a filtered list that excludes
    // it looks like the create silently failed.
    clearFilters();
  }

  /* ── Error state ─────────────────────────────────────────────────────── */
  if (!loading && loadFailed) {
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <PiWarningCircle className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">
            Review cycles could not be loaded.
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

  /**
   * A row's contents, shared by the card and the table.
   *
   * A plain function, NOT a nested component: declaring a component inside the
   * body gives it a new type identity on every render, which remounts the
   * whole subtree and closes anything transient inside it.
   */
  function renderName(cycle: AppraisalCycle) {
    return (
      // A real <Link>, not a div with an onClick: this is the keyboard and
      // screen-reader path, and it is what makes middle-click / open-in-new-tab
      // work. The row click below is a pointer convenience layered on top.
      <Link
        href={`/appraisals/cycles/${cycle._id}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex max-w-full items-center gap-1.5 rounded text-sm font-semibold text-gray-900 hover:text-[#b20202] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]/30"
      >
        <PiClipboardText className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="truncate">{cycle.name}</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 md:px-10 lg:px-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Review cycles
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and launch performance review cycles across the company.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="shrink-0 rounded-xl bg-[#b20202] hover:bg-[#9f0101]"
        >
          <PiPlusBold className="me-1.5 h-4 w-4" />
          New cycle
        </Button>
      </div>

      {/* A fixed grid, not flex-wrap with flex-1: wrapped flex tiles stretch to
          different widths at mid viewports, so the row reads as an accident. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Collecting"
          value={summary.collecting}
          active={status === 'collecting'}
          tone="blue"
          icon={<PiPlayCircle className="h-4.5 w-4.5" />}
          onClick={() => toggleStatus('collecting')}
        />
        <StatTile
          label="Draft"
          value={summary.draft}
          active={status === 'draft'}
          tone="brand"
          icon={<PiClipboardText className="h-4.5 w-4.5" />}
          onClick={() => toggleStatus('draft')}
        />
        <StatTile
          label="Closed"
          value={summary.closed}
          active={status === 'closed'}
          tone="emerald"
          icon={<PiCheckCircle className="h-4.5 w-4.5" />}
          onClick={() => toggleStatus('closed')}
        />
        <StatTile
          label="All cycles"
          value={summary.total}
          active={status === 'all' && !query}
          tone="gray"
          icon={<PiUsersThree className="h-4.5 w-4.5" />}
          onClick={clearFilters}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cycles…"
          prefix={<PiMagnifyingGlass className="h-4 w-4 text-gray-400" />}
          className="w-full sm:max-w-xs"
          inputClassName="rounded-xl"
        />
        {/* The picker carries `cancelled` too, which has no tile — a status
            with no way to filter to it is a set of rows HR cannot reach. */}
        <Select
          value={
            CYCLE_STATUS_FILTERS.find((o) => o.value === status) ??
            CYCLE_STATUS_FILTERS[0]
          }
          // Spread, not cast: the constant is a ReadonlyArray and rizzui wants
          // a mutable one.
          options={[...CYCLE_STATUS_FILTERS]}
          onChange={(o: { value: CycleStatusFilter; label: string }) =>
            setStatus(o.value)
          }
          className="w-full sm:w-44"
          selectClassName="rounded-xl"
        />
        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="self-start text-xs font-semibold text-gray-400 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-[#b20202] sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Below lg: stacked cards ────────────────────────────────────────
          Not a horizontal scroller. A 6-column table at min-w-[640px] on a
          phone hides the rightmost column, which here is the progress — the
          reason HR opened the page. */}
      <div className="flex flex-col gap-3 lg:hidden">
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
            onClear={clearFilters}
            onCreate={() => setCreating(true)}
          />
        ) : (
          visible.map((c) => (
            // Not role="button": the card holds a link, and nesting
            // interactive controls inside a button flattens both for a screen
            // reader. The name is the real link; this is pointer convenience.
            <div
              key={c._id}
              role="presentation"
              onClick={() => router.push(`/appraisals/cycles/${c._id}`)}
              className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:border-gray-200 hover:bg-gray-50/60 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{renderName(c)}</div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <CycleStatusBadge status={c.status} />
                  <PiCaretRight className="h-3.5 w-3.5 text-gray-300" />
                </div>
              </div>
              <div className="mt-3">
                <ProgressCell byState={c.byState} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="text-gray-400">
                  Launched {formatDate(c.launchedAt)}
                </span>
                <DeadlineCell cycle={c} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── lg+: table ───────────────────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th scope="col" className="px-5 py-3">
                  Name
                </th>
                <th scope="col" className="px-5 py-3">
                  Status
                </th>
                <th scope="col" className="px-5 py-3">
                  Progress
                </th>
                <th scope="col" className="px-5 py-3">
                  Launched
                </th>
                <th scope="col" className="px-5 py-3">
                  Deadline
                </th>
                <th scope="col" className="w-10 px-5 py-3">
                  <span className="sr-only">Open</span>
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
                      onClear={clearFilters}
                      onCreate={() => setCreating(true)}
                    />
                  </td>
                </tr>
              ) : (
                visible.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => router.push(`/appraisals/cycles/${c._id}`)}
                    className="cursor-pointer transition-colors hover:bg-gray-50/70"
                  >
                    <td className="max-w-xs px-5 py-3.5">{renderName(c)}</td>
                    <td className="px-5 py-3.5">
                      <CycleStatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <ProgressCell byState={c.byState} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {formatDate(c.launchedAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <DeadlineCell cycle={c} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <PiCaretRight
                        aria-hidden="true"
                        className="inline h-4 w-4 text-gray-300"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={creating} onClose={() => setCreating(false)} size="lg">
        {/* Mounted only while open, so every field starts blank on each visit
            rather than holding the last abandoned draft. */}
        {creating && (
          <NewCycleForm
            onCreated={handleCreated}
            onCancel={() => setCreating(false)}
          />
        )}
      </Modal>
    </div>
  );
}
