'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, MultiSelect } from 'rizzui';
import { PiUserCircle, PiUsersThree } from 'react-icons/pi';
import {
  approvePeers,
  getEligiblePeers,
  type PeerNomination,
  type PersonRef,
} from '@/services/appraisal.service';

function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

/**
 * The manager's side of peer nomination: approve/reject each proposed peer,
 * optionally add someone the subject didn't propose, and submit.
 *
 * Rendered only while `access.canApprovePeers` (state `pending_peer_approval`
 * — see the parent, appraisal-manager-view.tsx); that flag already encodes
 * the state check, so this component does not re-derive it from
 * `appraisal.state` itself.
 */
export default function AppraisalPeerApproval({
  appraisalId,
  nominations,
  onDone,
}: {
  appraisalId: string;
  nominations: PeerNomination[];
  onDone: () => void | Promise<void>;
}) {
  // Only 'proposed' entries are open decisions. A defensive filter, not a
  // load-bearing one: this screen is only reached while `pending_peer_approval`
  // is current, and nothing can be 'approved'/'rejected' yet at that point.
  const proposed = useMemo(
    () => nominations.filter((n) => n.status === 'proposed'),
    [nominations]
  );

  // Every proposed nominee defaults to 'approve' — the common case is
  // approving the list the subject already put together, and a manager who
  // wants to reject one toggles it off rather than starting from a blank
  // slate. Approving nobody is still legal: toggling every row to 'reject'
  // sends an empty `approve` array, which the server accepts (see
  // appraisal.controller.js#approvePeers) — nothing here disables submit on
  // that basis.
  const [decisions, setDecisions] = useState<
    Record<string, 'approve' | 'reject'>
  >(() => Object.fromEntries(proposed.map((n) => [n.user, 'approve'])));
  const [eligiblePeers, setEligiblePeers] = useState<PersonRef[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPeers(true);
      try {
        const eligible = await getEligiblePeers(appraisalId);
        if (!cancelled) setEligiblePeers(eligible);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : 'Could not load eligible peers'
          );
        }
      } finally {
        if (!cancelled) setLoadingPeers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appraisalId]);

  const peerById = useMemo(
    () => new Map(eligiblePeers.map((p) => [p._id, p])),
    [eligiblePeers]
  );
  // Every nominee (any status), not just the open 'proposed' ones — a name
  // already nominated has no reason to also appear in "add someone else".
  const nominatedIds = useMemo(
    () => new Set(nominations.map((n) => n.user)),
    [nominations]
  );
  const addOptions = eligiblePeers
    .filter((p) => !nominatedIds.has(p._id))
    .map((p) => ({
      label: p.employeeProfile?.work?.jobTitle
        ? `${personName(p)} — ${p.employeeProfile.work.jobTitle}`
        : personName(p),
      value: p._id,
    }));

  function toggle(userId: string, decision: 'approve' | 'reject') {
    setDecisions((prev) => ({ ...prev, [userId]: decision }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    // Every proposed id is sent back as EITHER approve or reject, never left
    // out of both — applyNominationDecisions (server) only updates ids
    // present in one of the two sets, so an id in neither would stay
    // 'proposed' forever once the appraisal has moved past
    // pending_peer_approval.
    const approve = proposed
      .filter((n) => decisions[n.user] !== 'reject')
      .map((n) => n.user);
    const reject = proposed
      .filter((n) => decisions[n.user] === 'reject')
      .map((n) => n.user);
    try {
      const result = await approvePeers(appraisalId, {
        approve,
        reject,
        add: addSelected,
      });
      toast.success(
        result.peersAdded > 0
          ? `Peer decisions saved — ${result.peersAdded} reviewer${
              result.peersAdded === 1 ? '' : 's'
            } added`
          : 'Peer decisions saved'
      );
      setAddSelected([]);
      await onDone();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not save peer decisions'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // No `return null` here even when `proposed` is empty. `nominatePeers`
  // accepts an empty list whenever `effectiveNominationMin` is 0 — legal when
  // the cycle's peerCountMin is 0, or the tenant has no eligible peers — and
  // still transitions to `pending_peer_approval`. If this panel rendered
  // nothing in that case, `canSummarise` is false in that state and nothing
  // else can call `approvePeers`: the appraisal would be stuck short of
  // `collecting` with no recourse. The zero-proposals list below and the
  // add-someone-else picker are always available; only the copy adapts.
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <PiUsersThree className="h-4 w-4 text-[#b20202]" />
        Approve peer reviewers
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {proposed.length === 0
          ? 'No peers were proposed. Approving nobody is fine — the appraisal moves on with no peer reviewers — or add someone yourself below.'
          : 'Decide who reviews this appraisal. Rejecting everyone is fine — the appraisal moves on with no peer reviewers.'}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {proposed.map((n) => {
          const person = peerById.get(n.user);
          const decision = decisions[n.user] ?? 'approve';
          return (
            <div
              key={n.user}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2"
            >
              <p className="flex min-w-0 items-center gap-1.5 text-sm text-gray-900">
                <PiUserCircle className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="truncate">{loadingPeers ? 'Loading…' : personName(person)}</span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant={decision === 'approve' ? 'solid' : 'outline'}
                  onClick={() => toggle(n.user, 'approve')}
                  disabled={submitting}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant={decision === 'reject' ? 'solid' : 'outline'}
                  color="danger"
                  onClick={() => toggle(n.user, 'reject')}
                  disabled={submitting}
                >
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <MultiSelect
          label="Add someone else"
          options={addOptions}
          value={addSelected}
          onChange={setAddSelected}
          searchable
          clearable
          placeholder="Search for colleagues…"
          disabled={submitting || loadingPeers}
        />
      </div>

      <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-[#b20202] hover:bg-[#9f0101]"
        >
          {submitting ? 'Saving…' : 'Save peer decisions'}
        </Button>
      </div>
    </div>
  );
}
