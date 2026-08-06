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

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Dropdown } from 'rizzui';
import {
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

  const load = useCallback(
    async (which: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCycleRoster(cycleId, which, PAGE_SIZE);
        setRows(res.rows);
        setTotal(res.total);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load the roster';
        setError(message);
      } finally {
        setLoading(false);
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

      {error ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-gray-500">
          <PiWarningCircle className="h-4 w-4 shrink-0 text-gray-400" />
          {error}
        </p>
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10">
                    <p className="text-center text-sm text-gray-400">
                      No appraisals have been launched for this cycle yet.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
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
                                    <Dropdown.Trigger disabled={busy}>
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
    </div>
  );
}
