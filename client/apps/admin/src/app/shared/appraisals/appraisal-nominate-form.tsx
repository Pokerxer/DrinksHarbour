'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal, MultiSelect, Text, Title } from 'rizzui';
import {
  PiCalendarBlank,
  PiCheckCircle,
  PiUsersThree,
  PiWarningCircle,
  PiWarningOctagon,
} from 'react-icons/pi';
import {
  getEligiblePeers,
  getNomination,
  nominatePeers,
  type NominationView,
  type PersonRef,
} from '@/services/appraisal.service';
import { deadlineTone } from './my-appraisals-utils';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

/** Order-insensitive: picking the same people in another order is not a change. */
function signatureOf(ids: string[]): string {
  return [...ids].sort().join(',');
}

function formatDeadline(deadline?: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * ── Never render per-name status once `state !== 'nominating'` ─────────────
 *
 * `getNomination` deliberately narrows to `{ state, approvedCount }` for
 * every state past `nominating` — the server does not say which of the
 * subject's proposed peers were approved or rejected, and this component
 * must not try to reconstruct that from anything else it has (e.g. by
 * diffing `myProposals` against a later fetch). Render the count and
 * nothing more. The discriminated union on `NominationView` makes reading
 * `myProposals` outside the `'nominating'` branch a compile error, so this
 * comment documents intent rather than working around a hole in the types.
 */
export default function AppraisalNominateForm({
  appraisalId,
}: {
  appraisalId: string;
}) {
  const [view, setView] = useState<NominationView | null>(null);
  const [peers, setPeers] = useState<PersonRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /**
   * The selection the server holds, so leaving with picks that were never
   * saved asks first. Peers are only persisted by an explicit "Save draft" —
   * choosing five colleagues and clicking a nav tab used to lose all of it.
   */
  const [savedSelection, setSavedSelection] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [nomination, eligiblePeers] = await Promise.all([
          getNomination(appraisalId),
          getEligiblePeers(appraisalId),
        ]);
        if (cancelled) return;
        setView(nomination);
        setPeers(eligiblePeers);
        if (nomination.state === 'nominating') {
          const seeded = nomination.myProposals.map((p) => p.user._id);
          setSelected(seeded);
          setSavedSelection(signatureOf(seeded));
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : 'Failed to load this screen'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appraisalId]);

  // Above every early return below, so the hook order is unconditional. The
  // predicate carries the state check instead: only a live `nominating` view
  // has an editable selection to lose.
  useUnsavedChangesGuard(
    view?.state === 'nominating' &&
      savedSelection !== null &&
      !submitting &&
      !savingDraft &&
      signatureOf(selected) !== savedSelection,
    'Your peer nominations have not been saved. Leave without saving?'
  );

  /**
   * Save without submitting. The appraisal stays in `nominating`, so unlike
   * handleSubmit below there is nothing irreversible to protect the employee
   * from — a failure here really is just a failed save, and saying so is
   * correct. The view is re-fetched so `myProposals` reflects what the server
   * actually stored rather than what this component believes it sent.
   */
  async function handleSaveDraft() {
    setSavingDraft(true);
    const sending = signatureOf(selected);
    try {
      await nominatePeers(appraisalId, selected, { submit: false });
      setSavedSelection(sending);
      toast.success('Draft saved — you can finish this later');
      setView(await getNomination(appraisalId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save your draft');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    const sending = signatureOf(selected);
    try {
      await nominatePeers(appraisalId, selected);
      // Only after the server took it. Disarming before the call would drop
      // the unsaved-work guard on a REJECTED submit, which is exactly when the
      // list is still unpersisted and most worth protecting.
      setSavedSelection(sending);
    } catch (e) {
      // Server 400 messages here are written for end users — surface them
      // verbatim rather than a generic fallback.
      toast.error(
        e instanceof Error ? e.message : 'Could not submit your nominations'
      );
      setSubmitting(false);
      return;
    }

    // Past this point the nomination IS saved and the appraisal has already
    // advanced to pending_peer_approval. A failure of the re-fetch below must
    // never be reported as a failed submission: telling the employee it did
    // not work would send them to retry, and the retry would 403 (canNominate
    // is gated on state === 'nominating'), which reads as a permissions bug
    // rather than "you already did this".
    toast.success('Your nominations have been submitted');
    try {
      // Re-fetch rather than fabricate the post-submit state locally — the
      // server is authoritative on what state this lands in and, from here
      // on, on what it's willing to tell the subject about it.
      setView(await getNomination(appraisalId));
    } catch {
      toast.error(
        'Submitted, but this page could not refresh. Reload to see it.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="h-6 w-64 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-50" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-gray-50" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <PiWarningCircle className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm text-gray-500">
          This nomination screen could not be loaded.
        </p>
      </div>
    );
  }

  if (view.state !== 'nominating') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
        <div>
          <Title as="h1" className="text-xl font-semibold text-gray-900">
            Peer nominations
          </Title>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm font-medium text-green-700">
          <PiCheckCircle className="h-5 w-5 shrink-0" />
          <span>
            Your nominations have been submitted — {view.approvedCount}{' '}
            {view.approvedCount === 1 ? 'peer has' : 'peers have'} been approved
            to review you so far.
          </span>
        </div>
      </div>
    );
  }

  const { min, max, deadline, myProposals } = view;
  const deadlineLabel = formatDeadline(deadline);
  // Toned like every other deadline in the module rather than flat grey — an
  // employee whose nomination window closes tomorrow gets no useful signal
  // from the same colour it wore a month out.
  const tone = deadlineTone(deadline);
  const count = selected.length;
  const overMax = count > max;
  const outOfRange = count < min || overMax;
  const busy = submitting || savingDraft;
  const rangeLabel =
    min === max ? `exactly ${min}` : `between ${min} and ${max}`;

  const options = peers.map((p) => ({
    label: p.employeeProfile?.work?.jobTitle
      ? `${personName(p)} — ${p.employeeProfile.work.jobTitle}`
      : personName(p),
    value: p._id,
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <Title as="h1" className="text-xl font-semibold text-gray-900">
          Nominate your peer reviewers
        </Title>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
          <PiUsersThree className="h-4 w-4 shrink-0" />
          Choose {rangeLabel} colleagues to give you feedback.
        </p>
        {deadlineLabel && (
          <p
            className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
              tone === 'overdue'
                ? 'text-red-600'
                : tone === 'soon'
                  ? 'text-amber-600'
                  : 'text-gray-400'
            }`}
          >
            {tone === 'overdue' ? (
              <PiWarningOctagon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <PiCalendarBlank className="h-3.5 w-3.5 shrink-0" />
            )}
            {tone === 'overdue'
              ? `Nominations were due ${deadlineLabel}`
              : `Nominate by ${deadlineLabel}`}
          </p>
        )}
      </div>

      <MultiSelect
        label="Peer reviewers"
        options={options}
        value={selected}
        onChange={setSelected}
        searchable
        clearable
        placeholder="Search for colleagues…"
        disabled={busy}
      />

      {/* Live now that drafts exist: a saved-but-unsubmitted list leaves the
          appraisal in `nominating`, so returning to this screen pre-seeds the
          selection above from myProposals. */}
      {myProposals.length > 0 && (
        <Text className="text-xs text-gray-400">
          Pre-selected from proposals already recorded against this appraisal.
        </Text>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
        {/* Three states, not two: over the maximum is an error the server
            will refuse either way, while under the minimum is merely
            incomplete — still saveable as a draft, so flagging it red would
            call a legitimate intermediate state a mistake. It does still
            block Submit, so it must say so rather than leave a disabled
            button unexplained. */}
        <p
          className={`text-xs font-medium ${
            overMax
              ? 'text-red-600'
              : count < min
                ? 'text-amber-600'
                : 'text-gray-400'
          }`}
        >
          {count} selected (choose {rangeLabel})
          {count < min && ' — save a draft now, or add more to submit'}
        </p>
        <div className="flex items-center gap-2">
          {/* Deliberately NOT disabled by `outOfRange`: an incomplete list is
              exactly what a draft is for. Only the maximum blocks it, because
              the server refuses an over-cap draft too. */}
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={busy || overMax}
          >
            {savingDraft ? 'Saving…' : 'Save draft'}
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={busy || outOfRange}
            className="bg-[#b20202] hover:bg-[#9f0101]"
          >
            {submitting ? 'Submitting…' : 'Submit nominations'}
          </Button>
        </div>
      </div>

      <Text className="text-xs text-gray-400">
        Submitting is final — it sends your list to your manager for approval
        and you will not be able to change it afterwards.
      </Text>

      {/* This screen told the employee submitting was final and then fired on
          a single click — the last one-way door in the module without a
          confirmation, and the only one aimed at someone who is not an admin. */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
      >
        <div className="p-6">
          <Title as="h3" className="text-base font-semibold text-gray-900">
            Submit these {count} {count === 1 ? 'nomination' : 'nominations'}?
          </Title>
          <Text className="mt-2 text-sm text-gray-500">
            Your list goes to your manager for approval. You will not be able to
            change it afterwards — use “Save draft” instead if you are still
            deciding.
          </Text>
          <ul className="mt-4 flex flex-col gap-1">
            {selected.map((id) => (
              <li
                key={id}
                className="flex items-center gap-1.5 text-sm text-gray-700"
              >
                <PiUsersThree className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {personName(peers.find((p) => p._id === id))}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                await handleSubmit();
              }}
              disabled={submitting}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {submitting ? 'Submitting…' : 'Submit nominations'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
