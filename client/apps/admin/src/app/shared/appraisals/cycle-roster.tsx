'use client';

// shared/appraisals/cycle-roster.tsx — HR's per-employee view of one cycle.
//
// ── HR-ONLY, BY MOUNT POINT ─────────────────────────────────────────────────
//
// `RosterRow.outstanding` NAMES PEER REVIEWERS while an appraisal is
// `collecting`. That is safe here only because `GET /api/appraisal-cycles/
// :id/roster` sits on the admin-gated cycle router, which the subject of an
// appraisal cannot reach. This component must therefore only ever be rendered
// from a cycle page. Do not import it from an appraisal detail view — the
// subject is not allowed to learn who is reviewing them.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Dropdown, Modal } from 'rizzui';
import {
  PiArrowClockwise,
  PiBellRinging,
  PiCaretDownBold,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  ApiError,
  fetchCycleRoster,
  sendNudge,
  type NudgeReason,
  type RosterRow,
} from '@/services/appraisal.service';
import AppraisalStateBadge from './state-badge';
import { personName } from './my-appraisals-utils';

type Outstanding = RosterRow['outstanding'][number];

const PAGE_SIZE = 50;

/**
 * What the outstanding person actually has to do. Typed as a total record over
 * `NudgeReason`, so adding a sixth reason server-side fails the build here
 * rather than rendering a raw enum string at HR.
 */
const REASON_LABEL: Record<NudgeReason, string> = {
  nominate: 'Nominate peers',
  approve_peers: 'Approve peers',
  feedback: 'Give feedback',
  summarise: 'Write the summary',
  acknowledge: 'Acknowledge',
};

/**
 * "2d ago" for the last-nudge line. Returns null — not "NaNd ago" — for an
 * unparseable instant, so the caller renders nothing at all rather than
 * telling HR something false about when they last chased this person.
 * `now` is injectable for the same reason `deadlineTone`'s is.
 */
export function nudgedAgo(
  value?: string | null,
  now = Date.now()
): string | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatRetryAfter(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** ✓ / — for the self and manager columns. */
function SubmittedMark({
  entry,
}: {
  entry: { status: string; submittedAt: string | null } | null;
}) {
  if (!entry) return <span className="text-gray-300">—</span>;
  if (entry.status === 'submitted')
    return <span className="font-semibold text-green-600">✓</span>;
  if (entry.status === 'declined')
    return <span className="text-xs font-medium text-amber-600">Declined</span>;
  if (entry.status === 'expired')
    return <span className="text-xs font-medium text-gray-400">Expired</span>;
  return <span className="text-gray-300">—</span>;
}

export default function CycleRoster({ cycleId }: { cycleId: string }) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keyed by appraisal + target + reason: one row can have several outstanding
  // people, and chasing one must not disable the controls beside the others.
  const [sending, setSending] = useState<string | null>(null);
  /** `null` = every row; otherwise only rows with this outstanding reason. */
  const [reasonFilter, setReasonFilter] = useState<NudgeReason | null>(null);
  /** Progress of a bulk remind, or null when none is running. */
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(
    null
  );
  /** The channel awaiting confirmation, or null when no dialog is open. */
  const [confirmBulk, setConfirmBulk] = useState<'app' | 'email' | null>(null);
  /** Set by "Stop" (and by unmounting) to end a run between sends. */
  const bulkAbortRef = useRef(false);
  const unmountedRef = useRef(false);

  // A bulk run is a loop of awaits, not a single cancellable request, so it
  // outlives the component unless something tells it to stop. Without this,
  // navigating away mid-run kept sending reminders and then tried to repaint
  // a table that no longer exists.
  useEffect(
    () => () => {
      unmountedRef.current = true;
      bulkAbortRef.current = true;
    },
    []
  );

  /**
   * Rows matching the reason filter, and for a filtered view each row's
   * `outstanding` narrowed to the matching entries — otherwise filtering to
   * "waiting on feedback" would still show, and bulk-remind, the people who
   * merely owe an acknowledgement on the same row.
   */
  const visibleRows = useMemo(() => {
    if (!reasonFilter) return rows;
    return rows
      .map((row) => ({
        ...row,
        outstanding: row.outstanding.filter((o) => o.reason === reasonFilter),
      }))
      .filter((row) => row.outstanding.length > 0);
  }, [rows, reasonFilter]);

  /** How many outstanding people each reason accounts for, on this page. */
  const reasonCounts = useMemo(() => {
    const counts = new Map<NudgeReason, number>();
    for (const row of rows) {
      for (const item of row.outstanding) {
        counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
      }
    }
    return counts;
  }, [rows]);

  const outstandingOnPage = useMemo(
    () =>
      visibleRows.flatMap((row) =>
        row.outstanding.map((item) => ({ row, item }))
      ),
    [visibleRows]
  );

  /**
   * Monotonic request token. Paging quickly used to let an earlier response
   * land after a later one and repaint the previous page's rows under the new
   * page number — every reply now checks it is still the newest before it
   * writes anything.
   */
  const requestRef = useRef(0);

  const load = useCallback(
    async (which: number) => {
      const token = (requestRef.current += 1);
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCycleRoster(cycleId, which, PAGE_SIZE);
        if (requestRef.current !== token) return;
        setRows(res.rows);
        setTotal(res.total);
      } catch (err) {
        if (requestRef.current !== token) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load the roster';
        setError(message);
      } finally {
        if (requestRef.current === token) setLoading(false);
      }
    },
    [cycleId]
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  async function runNudge(
    row: RosterRow,
    item: Outstanding,
    channel: 'app' | 'email',
    force = false
  ) {
    const key = `${row._id}:${item.target._id}:${item.reason}`;
    setSending(key);
    try {
      const result = await sendNudge(row._id, {
        target: item.target._id,
        reason: item.reason,
        channel,
        force,
      });
      // `emailSent` is false for a SUCCESSFUL app-only nudge too — the server
      // stores a requested-but-failed email as channel 'app' precisely because
      // the in-app reminder did land. So the failure signal is `emailError`,
      // never `!emailSent` on its own; branching on the latter would show a red
      // "the email failed" toast on every ordinary in-app reminder.
      // The second clause is belt-and-braces for an email that reports neither
      // sent nor errored: a green tick for an unsent email is exactly what
      // stops HR chasing, and this repo has already shipped a mailer that
      // failed silently while logging a success.
      const emailFailed =
        Boolean(result.emailError) ||
        (channel === 'email' && !result.emailSent);
      if (emailFailed) {
        toast.error(
          `Reminded in the app, but the email failed: ${
            result.emailError || 'the email did not send'
          }`
        );
      } else {
        toast.success('Reminder sent');
      }
      // The server is authoritative on `lastNudge` (and on whether this person
      // still owes anything at all), so re-read the page rather than patching
      // the row in place.
      await load(page);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NUDGE_TOO_SOON') {
        const when = formatRetryAfter(err.retryAfter);
        // Informational, not an error: nothing went wrong, the throttle simply
        // held. It carries the override because HR sometimes genuinely needs
        // to chase twice in a day.
        toast(
          (t) => (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-700">
                {err.message}
                {when ? ` You can remind again from ${when}.` : ''}
              </span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="text-xs font-semibold text-[#b20202] hover:underline"
                  onClick={() => {
                    toast.dismiss(t.id);
                    void runNudge(row, item, channel, true);
                  }}
                >
                  Send anyway
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-gray-400 hover:text-gray-600"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ),
          { duration: 8000 }
        );
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Could not send that reminder'
        );
      }
    } finally {
      setSending(null);
    }
  }

  /**
   * Chase everyone outstanding on this page in one go.
   *
   * Sequential, not `Promise.all`: each nudge writes an AppraisalNudge and may
   * send mail, and firing fifty at once is how you get rate-limited by your
   * own mail provider halfway through with no idea who got one.
   *
   * A 429 `NUDGE_TOO_SOON` is not a failure here — it means that person was
   * already chased inside the throttle window, which is exactly the outcome
   * the throttle exists to produce. It is counted separately and never
   * force-sent: overriding the throttle is a per-person decision, so it stays
   * on the individual control where HR can make it deliberately.
   */
  async function runBulkNudge(channel: 'app' | 'email') {
    const targets = outstandingOnPage;
    if (targets.length === 0) return;
    setConfirmBulk(null);
    bulkAbortRef.current = false;
    setBulk({ done: 0, total: targets.length });
    let sent = 0;
    let throttled = 0;
    let failed = 0;
    let emailFailures = 0;
    let stopped = false;
    // Indexed loop rather than `.entries()`: this project's tsconfig target
    // predates iterating an array iterator directly.
    for (let i = 0; i < targets.length; i += 1) {
      // Checked before each send, never mid-request: a reminder that has
      // already left cannot be recalled, so "Stop" means "send no more", and
      // the summary below reports how far it got rather than implying the
      // whole run was cancelled.
      if (bulkAbortRef.current) {
        stopped = true;
        break;
      }
      const { row, item } = targets[i];
      try {
        const result = await sendNudge(row._id, {
          target: item.target._id,
          reason: item.reason,
          channel,
        });
        sent += 1;
        if (result.emailError || (channel === 'email' && !result.emailSent)) {
          emailFailures += 1;
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'NUDGE_TOO_SOON') {
          throttled += 1;
        } else {
          failed += 1;
        }
      }
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
    bulkAbortRef.current = false;

    const parts = [`${sent} reminded`];
    if (throttled > 0) parts.push(`${throttled} already reminded recently`);
    if (emailFailures > 0) parts.push(`${emailFailures} email(s) failed`);
    if (failed > 0) parts.push(`${failed} failed`);
    if (stopped) parts.push(`stopped — ${targets.length - sent - throttled - failed} not contacted`);
    const summary = parts.join(' · ');
    if (failed > 0 || emailFailures > 0) toast.error(summary);
    else toast.success(summary);
    // The component may have unmounted mid-run (HR navigated away). Reloading
    // then would set state on a dead component and, worse, race the next
    // page's own load, so the token check inside `load` is not enough here.
    if (!unmountedRef.current) await load(page);
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">Roster</p>
        {total > 0 && (
          <p className="text-xs text-gray-400">
            {total} appraisal{total === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Who has done their part, and who is holding each appraisal up. Reminders
        go to that person in the app, optionally by email as well.
      </p>

      {/* Filter + bulk chase. Both act on the CURRENT PAGE, which is stated
          rather than implied: paging is server-side, so a filter that silently
          searched only 50 of 300 rows would be worse than one that says so. */}
      {!error && rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReasonFilter(null)}
            aria-pressed={reasonFilter === null}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              reasonFilter === null
                ? 'border-[#b20202]/30 bg-[#b20202]/[0.06] text-[#b20202]'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            All ({rows.length})
          </button>
          {(Object.keys(REASON_LABEL) as NudgeReason[])
            .filter((reason) => (reasonCounts.get(reason) ?? 0) > 0)
            .map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() =>
                  setReasonFilter((cur) => (cur === reason ? null : reason))
                }
                aria-pressed={reasonFilter === reason}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  reasonFilter === reason
                    ? 'border-[#b20202]/30 bg-[#b20202]/[0.06] text-[#b20202]'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {REASON_LABEL[reason]} ({reasonCounts.get(reason)})
              </button>
            ))}

          {bulk ? (
            <div className="ms-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 tabular-nums">
                Reminding {bulk.done}/{bulk.total}…
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  bulkAbortRef.current = true;
                }}
              >
                Stop
              </Button>
            </div>
          ) : (
            outstandingOnPage.length > 0 && (
              <Dropdown placement="bottom-end" className="ms-auto">
                <Dropdown.Trigger>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#b20202]/30 bg-[#b20202]/[0.04] px-3 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-[#b20202]/[0.08]">
                    <PiBellRinging className="h-3.5 w-3.5" />
                    Remind all {outstandingOnPage.length} outstanding
                    <PiCaretDownBold className="h-2.5 w-2.5" />
                  </span>
                </Dropdown.Trigger>
                <Dropdown.Menu className="w-64">
                  <Dropdown.Item onClick={() => setConfirmBulk('app')}>
                    Remind all in app
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setConfirmBulk('email')}>
                    Remind all in app + email
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            )
          )}
        </div>
      )}
      {!error && reasonFilter && (
        <p className="mt-2 text-[11px] text-gray-400">
          Showing {visibleRows.length} of {rows.length} rows on this page.
          Filtering and bulk reminders apply to the current page only.
        </p>
      )}

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <PiWarningCircle className="h-4 w-4 shrink-0 text-gray-400" />
            {error}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load(page)}
            disabled={loading}
          >
            <PiArrowClockwise className="me-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Manager</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2 pr-3 text-center">Self</th>
                <th className="py-2 pr-3 text-center">Manager</th>
                <th className="py-2 pr-3 text-center">Peers</th>
                <th className="py-2 pr-3">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 pr-3">
                        <div className="h-4 rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10">
                    <p className="text-center text-sm text-gray-400">
                      {reasonFilter
                        ? 'No rows on this page are waiting on that.'
                        : 'No appraisals have been launched for this cycle yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const nudged = nudgedAgo(row.lastNudge?.sentAt);
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
                      <td className="py-2.5 pr-3 text-center text-sm">
                        <SubmittedMark entry={row.self} />
                      </td>
                      <td className="py-2.5 pr-3 text-center text-sm">
                        <SubmittedMark entry={row.mgr} />
                      </td>
                      <td className="py-2.5 pr-3 text-center text-sm text-gray-600">
                        {row.peers.submitted}/{row.peers.approved}
                        {row.peers.declined > 0 && (
                          <span className="ms-1.5 text-xs text-gray-400">
                            ({row.peers.declined} declined)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {row.outstanding.length === 0 ? (
                          <span className="text-sm text-gray-300">—</span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {row.outstanding.map((item) => {
                              const key = `${row._id}:${item.target._id}:${item.reason}`;
                              const busy = sending === key;
                              return (
                                <div
                                  key={key}
                                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                                >
                                  <span className="text-sm text-gray-700">
                                    {personName(item.target)}
                                    <span className="ms-1.5 text-xs text-gray-400">
                                      {REASON_LABEL[item.reason]}
                                    </span>
                                  </span>
                                  <Dropdown placement="bottom-end">
                                    {/* Locked during a bulk run: this row is
                                        already in that queue, and a manual
                                        send here would chase the same person
                                        twice within seconds. */}
                                    <Dropdown.Trigger
                                      disabled={busy || bulk !== null}
                                    >
                                      {/* Dropdown.Trigger already renders a
                                          <button>, so this is a <span> — a
                                          nested button throws a hydration
                                          error. */}
                                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                                        <PiBellRinging className="h-3.5 w-3.5" />
                                        {busy ? 'Sending…' : 'Remind'}
                                        <PiCaretDownBold className="h-2.5 w-2.5 text-gray-400" />
                                      </span>
                                    </Dropdown.Trigger>
                                    <Dropdown.Menu className="w-56">
                                      <Dropdown.Item
                                        onClick={() =>
                                          void runNudge(row, item, 'app')
                                        }
                                      >
                                        Remind in app
                                      </Dropdown.Item>
                                      <Dropdown.Item
                                        onClick={() =>
                                          void runNudge(row, item, 'email')
                                        }
                                      >
                                        Remind in app + email
                                      </Dropdown.Item>
                                    </Dropdown.Menu>
                                  </Dropdown>
                                </div>
                              );
                            })}
                            {/* `lastNudge` is the latest reminder on the
                                APPRAISAL, not on any one target — the roster
                                keeps only the newest row per appraisal. So it
                                renders once, naming what was chased, rather
                                than being repeated beside every control as if
                                each person had been reminded. */}
                            {nudged && row.lastNudge && (
                              <span className="text-xs text-gray-400">
                                Last reminder:{' '}
                                {REASON_LABEL[row.lastNudge.reason]} ·{' '}
                                {row.lastNudge.channel === 'email'
                                  ? 'app + email'
                                  : 'app'}{' '}
                                · {nudged}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!error && lastPage > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="text-xs text-gray-400">
            Page {page} of {lastPage}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Confirmed like every other outbound action in this module. Sending up
          to a page's worth of reminders — and, on the email channel, that many
          actual emails — is not something to fire from a menu item. */}
      <Modal
        isOpen={confirmBulk !== null}
        onClose={() => setConfirmBulk(null)}
        size="sm"
      >
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900">
            Remind {outstandingOnPage.length}{' '}
            {outstandingOnPage.length === 1 ? 'person' : 'people'}?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {confirmBulk === 'email'
              ? 'Each of them gets an in-app reminder and an email.'
              : 'Each of them gets an in-app reminder.'}{' '}
            Anyone already reminded in the last 12 hours is skipped rather than
            chased again.
          </p>
          {reasonFilter && (
            <p className="mt-2 text-sm text-gray-500">
              Limited to the “{REASON_LABEL[reasonFilter]}” filter, on this page
              only.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmBulk(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void runBulkNudge(confirmBulk ?? 'app')}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              <PiBellRinging className="me-1.5 h-4 w-4" />
              Send reminders
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
