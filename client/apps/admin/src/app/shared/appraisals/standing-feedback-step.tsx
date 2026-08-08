'use client';

// "Who on my team is doing well, and who needs support" — an OPTIONAL step on
// the employee's own self-assessment (Phase 5 §9.5).
//
// ── Two things this screen has to be honest about ──────────────────────────
//  1. It is ATTRIBUTED. Unlike peer feedback, the author's name is on it. An
//     employee writing about a colleague is entitled to know that before they
//     write, not after — so the disclosure is the first thing on the card, not
//     a footnote.
//  2. Only the OWNER reads it. Not their manager, not HR, not the colleague.
//     Saying "confidential" would be vague to the point of misleading; naming
//     the single reader is what lets someone decide what to write.
//
// Saying nothing is a legitimate answer and the default. Nobody is nudged
// toward filling it in, and leaving every colleague on "No comment" saves an
// empty report rather than being blocked.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { PiCaretRight, PiLifebuoy, PiThumbsUp, PiUsersThree } from 'react-icons/pi';
import {
  fetchStandingForm,
  saveStandingFeedback,
  type PersonRef,
  type StandingEntry,
  type StandingValue,
} from '@/services/appraisal.service';

const personName = (p: PersonRef) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Colleague';

/** Local, editable shape: `null` standing means "no comment on this person". */
type Draft = Record<string, { standing: StandingValue | null; note: string }>;

export default function StandingFeedbackStep({
  feedbackId,
  readOnly,
}: {
  /** The author's OWN self feedback row — this step belongs to that form. */
  feedbackId: string;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<PersonRef[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const form = await fetchStandingForm(feedbackId);
        if (cancelled) return;
        // No colleagues (no department, or a department of one) means there is
        // nothing to say. The step hides entirely rather than rendering an
        // empty list that reads as a bug.
        setAvailable(form.candidates.length > 0);
        setCandidates(form.candidates);
        const seeded: Draft = {};
        for (const c of form.candidates) seeded[c._id] = { standing: null, note: '' };
        for (const e of form.entries) {
          seeded[e.subject] = { standing: e.standing, note: e.note || '' };
        }
        setDraft(seeded);
      } catch {
        // Silent, and the step disappears. This is an optional extra on a form
        // the employee must be able to finish; an error banner here would read
        // as something blocking their self-assessment.
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedbackId]);

  if (loading || !available) return null;

  const chosen = Object.values(draft).filter((d) => d.standing !== null).length;

  function setStanding(id: string, standing: StandingValue) {
    setDraft((prev) => ({
      ...prev,
      // Clicking the standing already selected clears it — the way back to
      // "no comment" without hunting for a third button.
      [id]: {
        ...prev[id],
        standing: prev[id]?.standing === standing ? null : standing,
      },
    }));
  }

  function setNote(id: string, note: string) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], note } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Only people actually given a standing are sent. A note typed and then
      // set back to "no comment" is dropped rather than saved against nothing.
      const entries: StandingEntry[] = Object.entries(draft)
        .filter(([, d]) => d.standing !== null)
        .map(([subject, d]) => ({
          subject,
          standing: d.standing as StandingValue,
          ...(d.note.trim() ? { note: d.note.trim() } : {}),
        }));
      await saveStandingFeedback(feedbackId, entries);
      toast.success(
        entries.length === 0
          ? 'Saved — you have not flagged anyone.'
          : `Saved for ${entries.length} colleague${entries.length === 1 ? '' : 's'}.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not save this. Try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <PiUsersThree className="h-4 w-4 text-gray-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              How is your team doing?
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Optional
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-gray-400">
            {chosen === 0
              ? 'Flag anyone in your department who is doing well or needs support.'
              : `${chosen} colleague${chosen === 1 ? '' : 's'} flagged.`}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="shrink-0 text-gray-400"
        >
          <PiCaretRight className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 py-4 sm:px-5">
              {/* Named reader, named author. Both, before the first input. */}
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-900">
                  Read by the business owner only — with your name on it
                </p>
                <p className="mt-1 text-xs leading-relaxed text-blue-800/80">
                  Not shown to the person you write about, not to your manager,
                  and not to HR. It is never part of anyone’s appraisal.
                  Leaving this blank is a normal answer.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {candidates.map((person) => {
                  const row = draft[person._id] || { standing: null, note: '' };
                  return (
                    <div
                      key={person._id}
                      className="rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {personName(person)}
                        </span>
                        <div className="flex gap-1.5">
                          <StandingButton
                            active={row.standing === 'doing_well'}
                            disabled={readOnly || saving}
                            onClick={() => setStanding(person._id, 'doing_well')}
                            tone="emerald"
                            icon={<PiThumbsUp className="h-3.5 w-3.5" />}
                            label="Doing well"
                          />
                          <StandingButton
                            active={row.standing === 'needs_support'}
                            disabled={readOnly || saving}
                            onClick={() =>
                              setStanding(person._id, 'needs_support')
                            }
                            tone="amber"
                            icon={<PiLifebuoy className="h-3.5 w-3.5" />}
                            label="Needs support"
                          />
                        </div>
                      </div>

                      {/* The note only appears once a standing is picked: a box
                          beside every name invites filler on people the author
                          has nothing to say about. */}
                      {row.standing ? (
                        <textarea
                          rows={2}
                          value={row.note}
                          disabled={readOnly || saving}
                          maxLength={1000}
                          onChange={(e) => setNote(person._id, e.target.value)}
                          placeholder={
                            row.standing === 'doing_well'
                              ? 'What have they done? A specific example helps.'
                              : 'What would help them? Be concrete.'
                          }
                          className="mt-2.5 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-[#b20202]/40 focus:outline-none focus:ring-2 focus:ring-[#b20202]/15 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {!readOnly ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202] disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save team feedback'}
                </button>
              ) : (
                <p className="mt-4 text-xs italic text-gray-400">
                  Your self-assessment is submitted, so this can no longer be
                  changed.
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StandingButton({
  active,
  disabled,
  onClick,
  tone,
  icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: 'emerald' | 'amber';
  icon: React.ReactNode;
  label: string;
}) {
  // Full class strings, never interpolated fragments — Tailwind's scanner only
  // sees literals, and a `bg-${tone}-500` would be purged from the build.
  const on =
    tone === 'emerald'
      ? 'bg-emerald-500 text-white ring-emerald-500'
      : 'bg-amber-500 text-white ring-amber-500';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
        active ? on : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
