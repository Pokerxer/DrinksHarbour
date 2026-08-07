'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Modal, Title } from 'rizzui';
import {
  PiCalendarBlank,
  PiCheckCircle,
  PiRocketLaunch,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  closeCycle,
  fetchCycle,
  fetchCycleProgress,
  launchCycle,
  skipPeers,
  type AppraisalCycle,
  type AppraisalState,
  type CycleProgress,
  type PersonRef,
  type StalledAppraisal,
} from '@/services/appraisal.service';
import AppraisalStateBadge from './state-badge';
import { CycleStatusBadge } from './cycles-list';
import CycleRoster from './cycle-roster';
import CycleReport from './cycle-report';

// launchCycle's resolved shape isn't exported as a standalone type from the
// service (it's inlined in the function signature), so this is derived from
// the function itself rather than hand-duplicated — if the service's return
// shape ever changes, this stays correct instead of silently drifting.
type LaunchResult = Awaited<ReturnType<typeof launchCycle>>;

// Maps the server's skip reason codes (server/services/appraisal.helpers.js
// #planCycleLaunch) to text HR can act on. An employee skipped for having no
// manager is exactly the kind of thing that must stay visible, not get
// summarised into a bare count — so every skip reason renders a name, and an
// unrecognised code still renders (verbatim) rather than being dropped.
function reasonLabel(reason: string): string {
  if (reason === 'no_manager') return 'No manager assigned';
  if (reason === 'self_manager')
    return 'Employee is listed as their own manager';
  return reason;
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

// Same fallback chain as appraisal-peer-approval.tsx / appraisal-nominate-form.tsx:
// full name, then email, then a literal "Unknown" rather than rendering
// nothing for a PersonRef the server couldn't resolve.
function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

function InlineNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <PiWarningCircle className="h-8 w-8 text-gray-400" />
      </div>
      <h1 className="text-base font-semibold text-gray-700">
        Can&rsquo;t open this cycle
      </h1>
      <p className="mt-1 text-sm text-gray-400">{message}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="h-6 w-64 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-50" />
      <div className="mt-6 h-40 animate-pulse rounded-xl bg-gray-50" />
    </div>
  );
}

/**
 * `progress.byState` is keyed by `Appraisal.state`, which is a mongoose enum
 * matching `AppraisalState` — the server can only ever aggregate values the
 * schema allows, so this cast (rather than a second hand-written label map)
 * is safe, not just convenient.
 */
function ProgressByState({ byState }: { byState: CycleProgress['byState'] }) {
  const entries = Object.entries(byState);
  if (entries.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-400">
        No appraisals have been launched for this cycle yet.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([state, count]) => (
        <div
          key={state}
          className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2"
        >
          <AppraisalStateBadge state={state as AppraisalState} />
          <span className="text-sm font-semibold text-gray-700">{count}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * `progress.stalled` only ever contains appraisals in `nominating` or
 * `pending_peer_approval` (see appraisalCycle.controller.js#getCycleProgress)
 * — the two states HR can act on directly. Each row's primary link matches
 * what is actually true of that state: a `nominating` row has no nomination
 * yet, so "Nominate on their behalf" applies; a `pending_peer_approval` row
 * already has one awaiting a decision, so "Approve peers" applies instead.
 * Showing both on every row would send HR to nominate for someone who
 * already has peers proposed, or to "approve" a nomination that doesn't
 * exist yet — so exactly one primary link renders, chosen by `row.state`.
 * "Skip peers" is legal for both states server-side, so it always renders.
 */
function StalledList({
  rows,
  skippingId,
  onSkipPeers,
}: {
  rows: StalledAppraisal[];
  skippingId: string | null;
  onSkipPeers: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-400">
        No peer-review appraisals are stalled right now.
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <th className="py-2 pr-3">Employee</th>
            <th className="py-2 pr-3">Manager</th>
            <th className="py-2 pr-3">State</th>
            <th className="py-2 pr-3">Since</th>
            <th className="py-2 pr-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const isSkipping = skippingId === row._id;
            return (
              <tr key={row._id}>
                <td className="py-2.5 pr-3 text-sm font-medium text-gray-900">
                  {personName(row.employee)}
                </td>
                <td className="py-2.5 pr-3 text-sm text-gray-600">
                  {personName(row.manager)}
                </td>
                <td className="py-2.5 pr-3">
                  <AppraisalStateBadge state={row.state} />
                </td>
                <td className="py-2.5 pr-3 text-sm text-gray-500">
                  {formatDate(row.since)}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {row.state === 'nominating' && (
                      <Link
                        href={`/appraisals/${row._id}/nominate`}
                        className="text-xs font-semibold text-[#b20202] hover:underline"
                      >
                        Nominate on their behalf
                      </Link>
                    )}
                    {row.state === 'pending_peer_approval' && (
                      <Link
                        href={`/appraisals/${row._id}`}
                        className="text-xs font-semibold text-[#b20202] hover:underline"
                      >
                        Approve peers
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSkipPeers(row._id)}
                      disabled={isSkipping}
                    >
                      {isSkipping ? 'Skipping…' : 'Skip peers'}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LaunchResultPanel({ result }: { result: LaunchResult }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {result.created}
          </p>
          <p className="text-xs text-gray-400">Created</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {result.alreadyExisted}
          </p>
          <p className="text-xs text-gray-400">Already existed</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {result.skipped.length}
          </p>
          <p className="text-xs text-gray-400">Skipped</p>
        </div>
      </div>

      {result.skipped.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
            {result.skipped.length} employee
            {result.skipped.length === 1 ? ' was' : 's were'} not enrolled —
            these need attention, not just a count.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.skipped.map((s, i) => (
              <li
                key={`${s.employee?._id}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs"
              >
                {/* launchCycle resolves each skipped id to a user, because an
                    HR user cannot chase an ObjectId. It falls back to `{_id}`
                    alone when the record can't be found, so show the id in
                    that case rather than an empty row. Never render
                    `s.employee` directly — it is an object, and React throws
                    "Objects are not valid as a React child". */}
                {[s.employee?.firstName, s.employee?.lastName]
                  .filter(Boolean)
                  .join(' ') ? (
                  <span className="font-medium text-gray-700">
                    {[s.employee?.firstName, s.employee?.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                ) : (
                  <span className="font-mono text-gray-500">
                    Employee ID: {s.employee?._id}
                  </span>
                )}
                <span className="font-medium text-amber-700">
                  {reasonLabel(s.reason)}
                </span>
              </li>
            ))}
          </ul>
          {/* This used to tell HR the response "only carries employee ids, not
              names — look these up in Employees", directly beneath a list
              rendering the names. The server resolves them now; the advice
              outlived the limitation it described. */}
          <p className="mt-2 text-[11px] text-gray-400">
            Fix the underlying record — usually a missing manager on the
            employee&rsquo;s profile — then launch again. Employees who already
            have an appraisal for this cycle are skipped, not duplicated.
          </p>
        </div>
      )}
    </div>
  );
}

export default function CycleDetail({ id }: { id: string }) {
  const [cycle, setCycle] = useState<AppraisalCycle | null>(null);
  const [progress, setProgress] = useState<CycleProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [closing, setClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [skippingId, setSkippingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, p] = await Promise.all([
          fetchCycle(id),
          fetchCycleProgress(id),
        ]);
        if (cancelled) return;
        setCycle(c);
        setProgress(p);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load this cycle';
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function refreshProgress() {
    try {
      const p = await fetchCycleProgress(id);
      setProgress(p);
    } catch {
      // The launch/close action itself already reported success or failure;
      // a failed progress refetch shouldn't pile a second, unrelated error
      // toast on top of that.
    }
  }

  async function handleLaunch() {
    setLaunching(true);
    try {
      const result = await launchCycle(id);
      setLaunchResult(result);
      toast.success(
        `Launched: ${result.created} created, ${result.alreadyExisted} already existed, ${result.skipped.length} skipped`
      );
      setShowLaunchModal(false);
      const updated = await fetchCycle(id);
      setCycle(updated);
      await refreshProgress();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not launch this cycle'
      );
    } finally {
      setLaunching(false);
    }
  }

  // A row can go stale between render and click — someone else may already
  // have nominated, approved, or skipped for this employee. That surfaces as
  // a normal server error here (skip-peers is only legal at `nominating` /
  // `pending_peer_approval`), so it's reported the same way as every other
  // action's failure rather than assumed impossible.
  async function handleSkipPeers(appraisalId: string) {
    setSkippingId(appraisalId);
    try {
      await skipPeers(appraisalId);
      toast.success('Peer review skipped for this appraisal');
      // Re-fetch rather than splice the row out locally — the server is
      // authoritative on whether this (or any other) row still belongs in
      // the stalled list.
      await refreshProgress();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not skip peer review for this appraisal'
      );
    } finally {
      setSkippingId(null);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      const updated = await closeCycle(id);
      setCycle(updated);
      await refreshProgress();
      toast.success('Cycle closed');
      setShowCloseModal(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not close this cycle'
      );
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error || !cycle) {
    return <InlineNotice message={error || 'This cycle could not be found.'} />;
  }

  const inactive = cycle.status === 'closed' || cycle.status === 'cancelled';
  const launchDisabledReason = inactive
    ? `This cycle is ${cycle.status} and can no longer be launched.`
    : null;
  const closeDisabledReason = inactive
    ? `This cycle is already ${cycle.status}.`
    : null;

  return (
    // Widened from max-w-3xl once the roster landed: that table is ~820px on
    // its own, so a 3xl column meant scrolling it horizontally on every screen.
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Title as="h1" className="text-xl font-semibold text-gray-900">
            {cycle.name}
          </Title>
          <CycleStatusBadge status={cycle.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <PiCalendarBlank className="h-3.5 w-3.5" />
            Launched {formatDate(cycle.launchedAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <PiCalendarBlank className="h-3.5 w-3.5" />
            Feedback deadline {formatDate(cycle.feedbackDeadline)}
          </span>
          {cycle.closedAt && (
            <span className="flex items-center gap-1.5">
              <PiCheckCircle className="h-3.5 w-3.5" />
              Closed {formatDate(cycle.closedAt)}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">
          Appraisals by state
        </p>
        {progress && <ProgressByState byState={progress.byState} />}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Feedback submitted
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {progress
              ? `${progress.feedbackSubmitted} / ${progress.feedbackTotal}`
              : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">
          Stalled peer review
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Appraisals still waiting on nomination or manager approval. Nothing
          here advances on its own — act on a row to move it forward.
        </p>
        {progress && (
          <StalledList
            rows={progress.stalled}
            skippingId={skippingId}
            onSkipPeers={handleSkipPeers}
          />
        )}
      </div>

      {/* Kept in its own component rather than inlined: this file is already
          long, and the roster carries the HR-only reviewer-identity data —
          which is easier to keep track of when it lives in one file with the
          rule written at the top of it. */}
      <CycleRoster cycleId={id} />

      <CycleReport cycleId={id} />

      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Actions</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Confirmed, like Close. Launching is the larger of the two: it
              creates an appraisal for every eligible employee and starts
              notifying them, and there is no unlaunch. */}
          <Button
            onClick={() => setShowLaunchModal(true)}
            disabled={launching || Boolean(launchDisabledReason)}
            className="bg-[#b20202] hover:bg-[#9f0101]"
          >
            <PiRocketLaunch className="me-1.5 h-4 w-4" />
            {launching ? 'Launching…' : 'Launch'}
          </Button>
          {launchDisabledReason && (
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
              {launchDisabledReason}
            </p>
          )}

          <Button
            variant="outline"
            onClick={() => setShowCloseModal(true)}
            disabled={closing || Boolean(closeDisabledReason)}
          >
            Close cycle
          </Button>
          {closeDisabledReason && (
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
              {closeDisabledReason}
            </p>
          )}
        </div>

        {launchResult && <LaunchResultPanel result={launchResult} />}
      </div>

      <Modal
        isOpen={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        size="sm"
      >
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900">
            Launch {cycle.name}?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This creates an appraisal for every eligible employee and starts
            asking them and their managers for feedback.{' '}
            {cycle.peerReviewEnabled
              ? 'Peer review is on, so employees will be asked to nominate peers.'
              : 'Peer review is off, so this collects self and manager assessments only.'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Re-launching later is safe — employees who already have an
            appraisal for this cycle are skipped rather than duplicated — but a
            launch cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLaunchModal(false)}
              disabled={launching}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLaunch}
              disabled={launching}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              <PiRocketLaunch className="me-1.5 h-4 w-4" />
              {launching ? 'Launching…' : 'Launch cycle'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        size="sm"
      >
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900">
            Close this cycle?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Any feedback still outstanding (not yet submitted) will be marked
            expired and can no longer be submitted. This cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCloseModal(false)}
              disabled={closing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClose}
              disabled={closing}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {closing ? 'Closing…' : 'Close cycle'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
