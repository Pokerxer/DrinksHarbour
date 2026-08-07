'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Input, Select, Switch, Text } from 'rizzui';
import {
  PiArrowRight,
  PiCalendarBlank,
  PiClipboardText,
  PiPlusBold,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  createCycle,
  fetchCycles,
  fetchTemplates,
  type AppraisalCycle,
  type AppraisalTemplateDoc,
} from '@/services/appraisal.service';

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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.bg}`}
    >
      {meta.label}
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

function NewCycleForm({
  onCreated,
}: {
  onCreated: (cycle: AppraisalCycle) => void;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchTemplates();
        if (cancelled) return;
        setTemplates(rows);
        // Default to the tenant's default form, which is what the server would
        // have fallen back to anyway — so the picker shows HR the same choice
        // the server would make silently.
        const fallback = rows.find((t) => t.isDefault) ?? rows[0];
        if (fallback) setTemplateFamily(fallback.family);
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
    const blocked = nameError || deadlineError;
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
      setName('');
      setNominationDeadline('');
      setFeedbackDeadline('');
      setPeerReviewEnabled(true);
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
            Cycle name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. H2 2026 review"
            disabled={submitting}
          />
        </div>
        {/* Only shown while peer review is on — see handleSubmit. */}
        {peerReviewEnabled && (
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">
              Nomination deadline
            </label>
            <Input
              type="date"
              value={nominationDeadline}
              onChange={(e) => setNominationDeadline(e.target.value)}
              max={feedbackDeadline || undefined}
              disabled={submitting}
            />
          </div>
        )}
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
            Feedback deadline
          </label>
          <Input
            type="date"
            value={feedbackDeadline}
            onChange={(e) => setFeedbackDeadline(e.target.value)}
            min={nominationDeadline || undefined}
            disabled={submitting}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting || Boolean(nameError || deadlineError)}
          className="bg-[#b20202] hover:bg-[#9f0101] sm:w-auto"
        >
          <PiPlusBold className="me-1.5 h-4 w-4" />
          {submitting ? 'Creating…' : 'New cycle'}
        </Button>
      </div>

      {deadlineError ? (
        <Text className="-mt-1 text-xs font-medium text-red-600">
          {deadlineError}
        </Text>
      ) : null}

      {templateOptions.length > 0 ? (
        <div className="max-w-md">
          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
            Review form
          </label>
          <Select
            value={
              templateOptions.find((o) => o.value === templateFamily) ??
              templateOptions[0]
            }
            options={templateOptions}
            onChange={(o: { value: string; label: string }) =>
              setTemplateFamily(o.value)
            }
            disabled={submitting}
          />
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
    </form>
  );
}

export default function CyclesList() {
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchCycles();
        if (!cancelled) setCycles(rows);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to load review cycles'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(cycle: AppraisalCycle) {
    setCycles((prev) => [cycle, ...prev]);
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8 md:px-10 lg:px-14">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Review cycles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create and launch performance review cycles across the company.
        </p>
      </div>

      <NewCycleForm onCreated={handleCreated} />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Launched</th>
                <th className="px-5 py-3">Deadline</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : cycles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                        <PiWarningCircle className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-700">
                        No cycles yet
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Create your first review cycle above to get started.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                cycles.map((c) => (
                  <tr
                    key={c._id}
                    className="transition-colors hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-3.5">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <PiClipboardText className="h-4 w-4 text-gray-400" />
                        {c.name}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <CycleStatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {formatDate(c.launchedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <PiCalendarBlank className="h-3.5 w-3.5 text-gray-400" />
                        {formatDate(c.feedbackDeadline)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/appraisals/cycles/${c._id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#b20202] hover:underline"
                      >
                        Open
                        <PiArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
