'use client';

// Shift swaps — `/employees/swaps`.
//
// TWO GATES, AND THE SCREEN HAS TO SHOW BOTH
// -------------------------------------------
// `accepted` means the person taking the shift has said yes. `approved` means a
// manager has, and only that has actually moved the shift. They are separate
// colours and separate words ("Awaiting approval" vs "Approved") because a
// manager glancing at a board where they looked alike would think their queue
// was empty when a swap was still sitting in it, unmoved, with two people
// believing it was settled.
//
// Approval re-runs the roster's own eligibility check against the world as it
// is NOW, so a 409 here is normal rather than exceptional — between the accept
// and the approval somebody may have been rostered elsewhere or had leave
// approved. The refusal is rendered with the reason, not as "failed".
//
// An OPEN swap (no target) is an offer to the floor. `swapTargetLabel` says so
// in words; a blank cell would read as missing data rather than as the point.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiArrowsClockwise,
  PiArrowsLeftRightDuotone,
  PiCheck,
  PiHandshakeDuotone,
  PiPlus,
  PiProhibit,
  PiX,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import { FIELD, Field } from './org-config-page';
import { LAGOS_OFFSET_MINUTES, conflictLabel } from './shift-roster-utils';
import {
  shiftWindowLabel,
  staleSwapLabel,
  staleSwapReason,
  swapActions,
  swapStatusLabel,
  swapStatusTone,
  swapTargetLabel,
  type RequestAction,
} from './time-off-utils';
import {
  swapService,
  SWAP_STATUSES,
  TimeOffConflictError,
  type ShiftSwapRequest,
  type SwapShiftRef,
  type SwapStatus,
} from '@/services/timeOff.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { refId } from '@/services/orgStructure.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

interface SwapDraft {
  shift: string;
  /** '' = open to anyone holding the role. */
  targetEmployee: string;
  note: string;
}

const NEW_DRAFT: SwapDraft = { shift: '', targetEmployee: '', note: '' };

const ACTION_CLASS: Record<RequestAction['tone'], string> = {
  primary: 'bg-[#b20202] text-white hover:bg-[#8f0202] disabled:opacity-60',
  danger:
    'border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60',
  quiet:
    'border border-gray-200 text-gray-600 hover:text-gray-900 disabled:opacity-60',
};

export default function ShiftSwapsPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const myId = String(
    (session?.user as { id?: string; _id?: string })?.id ??
      (session?.user as { _id?: string })?._id ??
      ''
  );

  const [items, setItems] = useState<ShiftSwapRequest[]>([]);
  const [canDecide, setCanDecide] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SwapStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<SwapDraft | null>(null);
  const [mine, setMine] = useState<SwapShiftRef[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await swapService.list(
        { status: statusFilter || undefined },
        token
      );
      setItems(data.items);
      setCanDecide(Boolean(data.canDecide));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load swaps');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only fetched when the drawer opens: an unopened form should not cost two
  // requests on every visit to the board.
  useEffect(() => {
    if (!token || !draft) return;
    let cancelled = false;
    void swapService
      .myShifts(token)
      .then((r) => {
        if (!cancelled) setMine(r);
      })
      .catch(() => {
        if (!cancelled) setMine([]);
      });
    void employeeService
      .getEmployees(token, { status: 'active' })
      .then((r) => {
        if (!cancelled) setEmployees(r.data.employees);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, draft]);

  const pendingCount = useMemo(
    () => items.filter((i) => i.status === 'pending').length,
    [items]
  );
  const awaitingApproval = useMemo(
    () => items.filter((i) => i.status === 'accepted').length,
    [items]
  );

  async function offer() {
    if (!draft) return;
    if (!draft.shift) return toast.error('Choose the shift you want covered');

    setSaving(true);
    try {
      await swapService.create(
        {
          shift: draft.shift,
          targetEmployee: draft.targetEmployee || null,
          note: draft.note,
        },
        token
      );
      toast.success('Shift offered');
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not offer it');
    } finally {
      setSaving(false);
    }
  }

  async function act(request: ShiftSwapRequest, action: RequestAction) {
    setBusyId(request._id);
    setRefusal(null);
    try {
      if (action.action === 'cancel') {
        await swapService.cancel(request._id, token);
        toast.success('Withdrawn');
      } else if (action.action === 'accept') {
        await swapService.respond(request._id, 'accept', token);
        toast.success('Accepted — a manager still has to approve it');
      } else if (action.action === 'approve') {
        await swapService.decide(request._id, 'approve', token);
        toast.success('Approved — the shift has moved');
      } else if (action.action === 'reject') {
        // The same word from two sides: the target declining, and a manager
        // refusing. Which endpoint it is depends on who is looking.
        if (canDecide && request.status === 'accepted') {
          await swapService.decide(request._id, 'reject', token);
        } else {
          await swapService.respond(request._id, 'reject', token);
        }
        toast.success('Declined');
      }
      await load();
    } catch (err) {
      if (err instanceof TimeOffConflictError) {
        // Name the clash. "Failed" would leave a manager retrying an approval
        // that will keep being refused for the same reason.
        setRefusal(`${conflictLabel(err.code, err.message)} — ${err.message}`);
        toast.error(conflictLabel(err.code, err.message));
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not do that');
      }
    } finally {
      setBusyId(null);
    }
  }

  const stats = [
    { label: 'Open offers', value: String(pendingCount) },
    { label: 'Need approval', value: String(awaitingApproval) },
    { label: 'Total', value: String(items.length) },
  ];

  return (
    <div className="px-4 py-6 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202] text-white [&>svg]:h-5 [&>svg]:w-5">
            <PiArrowsLeftRightDuotone />
          </span>
          <div>
            <h1
              className={`${fraunces.className} text-2xl font-black text-gray-900`}
            >
              Shift swaps
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Cover offered, taken, and approved. Only an approval moves a
              shift.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.employees.timeOff}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
          >
            Time off
          </Link>
          <button
            type="button"
            onClick={() => setDraft({ ...NEW_DRAFT })}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
          >
            <PiPlus className="h-4 w-4" />
            Offer a shift
          </button>
        </div>
      </div>

      {/* Filters + headline numbers */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SwapStatus | '')}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Every status</option>
          {SWAP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {swapStatusLabel(s)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition-colors hover:text-gray-900"
        >
          <PiArrowsClockwise
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          {stats.map((s) => (
            <div key={s.label} className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {s.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-gray-900">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {refusal && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="flex-1 text-sm text-red-800">{refusal}</p>
          <button
            type="button"
            onClick={() => setRefusal(null)}
            aria-label="Dismiss"
            className="rounded-lg p-1 text-red-600 hover:bg-red-100"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* The board */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Offered by</th>
              <th className="px-4 py-3">Taken by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading && !items.length && (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center">
                  <PiHandshakeDuotone className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm font-medium text-gray-500">
                    Nobody has offered a shift
                  </p>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...NEW_DRAFT })}
                    className="mt-2 text-sm font-semibold text-[#b20202] hover:underline"
                  >
                    Offer one
                  </button>
                </td>
              </tr>
            )}

            {!loading &&
              items.map((item) => {
                const isMine = refId(item.requestedBy) === myId;
                const isTarget =
                  !!item.targetEmployee && refId(item.targetEmployee) === myId;
                const actions = swapActions(item, {
                  canDecide,
                  isMine,
                  isTarget,
                });
                // Only meaningful while the swap could still move forward; a
                // finished or withdrawn one is not "stale", it is done.
                const stale =
                  item.status === 'pending' || item.status === 'accepted'
                    ? staleSwapReason(item)
                    : null;
                const role =
                  item.shift && typeof item.shift !== 'string'
                    ? item.shift.role
                    : null;
                const requester =
                  item.requestedBy && typeof item.requestedBy !== 'string'
                    ? `${item.requestedBy.firstName ?? ''} ${item.requestedBy.lastName ?? ''}`.trim()
                    : 'Unknown';

                return (
                  <tr
                    key={item._id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {shiftWindowLabel(item.shift, OFFSET)}
                      </span>
                      {role && typeof role !== 'string' && (
                        <p className="text-xs text-gray-400">{role.name}</p>
                      )}
                      {item.note && (
                        <p className="text-xs text-gray-400">{item.note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {requester || 'Unknown'}
                      {isMine && (
                        <span className="ml-1 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {swapTargetLabel(item)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${swapStatusTone(
                          item.status
                        )}`}
                      >
                        {swapStatusLabel(item.status)}
                      </span>
                      {item.decisionNote && (
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {item.decisionNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Why the button went away. `swapActions` withdraws
                            accept/approve once the shift has moved on, and a
                            button that silently vanishes is indistinguishable
                            from one that was never there. */}
                        {stale && (
                          <span className="text-right text-[11px] text-amber-600">
                            {staleSwapLabel(stale)}
                          </span>
                        )}
                        {!actions.length && !stale && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                        {actions.map((a) => (
                          <button
                            key={a.action}
                            type="button"
                            disabled={busyId === item._id}
                            onClick={() => void act(item, a)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${ACTION_CLASS[a.tone]}`}
                          >
                            {(a.action === 'approve' ||
                              a.action === 'accept') && (
                              <PiCheck className="h-3.5 w-3.5" />
                            )}
                            {a.action === 'reject' && (
                              <PiProhibit className="h-3.5 w-3.5" />
                            )}
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Offer drawer */}
      <AnimatePresence>
        {draft && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDraft(null)}
              className="fixed inset-0 z-40 bg-gray-900/30"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-base font-bold text-gray-900">
                  Offer a shift
                </h2>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                >
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <Field
                  label="Which shift"
                  hint="(your published shifts still to come)"
                >
                  <select
                    className={FIELD}
                    value={draft.shift}
                    onChange={(e) =>
                      setDraft({ ...draft, shift: e.target.value })
                    }
                  >
                    <option value="">Choose a shift…</option>
                    {mine.map((s) => (
                      <option key={s._id} value={s._id}>
                        {shiftWindowLabel(s, OFFSET)}
                      </option>
                    ))}
                  </select>
                </Field>

                {!mine.length && (
                  <p className="-mt-2 text-xs text-gray-400">
                    You have no published upcoming shifts to offer. A draft
                    roster is not offerable until it is published.
                  </p>
                )}

                <Field
                  label="Offer it to"
                  hint="(leave open and anyone can take it)"
                >
                  <select
                    className={FIELD}
                    value={draft.targetEmployee}
                    onChange={(e) =>
                      setDraft({ ...draft, targetEmployee: e.target.value })
                    }
                  >
                    <option value="">Anyone who can work it</option>
                    {employees
                      .filter((e) => e._id !== myId)
                      .map((e) => (
                        <option key={e._id} value={e._id}>
                          {e.firstName} {e.lastName}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Note" hint="(why, if it helps)">
                  <textarea
                    className={FIELD}
                    rows={3}
                    value={draft.note}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                  />
                </Field>

                <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  Offering does not move the shift. Somebody has to take it, and
                  then a manager has to approve it — the roster is only changed
                  by that approval.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void offer()}
                  disabled={saving}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-60"
                >
                  {saving ? 'Offering…' : 'Offer shift'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
