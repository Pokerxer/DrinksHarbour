'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiWarningCircle } from 'react-icons/pi';
import {
  fetchAppraisal,
  type Appraisal,
  type AppraisalAccess,
  type AppraisalFeedback,
  type AppraisalSection,
  type ComparisonRow,
} from '@/services/appraisal.service';
import AppraisalSubjectView from './appraisal-subject-view';
import AppraisalManagerView from './appraisal-manager-view';

interface DetailData {
  appraisal: Appraisal;
  feedback: AppraisalFeedback[];
  /**
   * The cycle's template. Both views need it to resolve each answer's
   * `questionId` to its label — without it they can only number the questions,
   * which makes the feedback unreadable.
   */
  sections: AppraisalSection[];
  access: AppraisalAccess;
  /** Peers whose nomination has been approved (not yet necessarily responded). */
  approvedPeerCount: number;
  /** Approved peers who have actually submitted feedback. */
  peerResponseCount: number;
  /**
   * Per-rating-question self/manager/peer comparison, built server-side from
   * the ALREADY-PROJECTED feedback. Threaded to both views: the aggregate is
   * safe for the subject, and `peerBreakdown` is `null` on their copy because
   * the server stripped each peer row's reviewer before building it — not
   * because anything here hides it.
   */
  comparison: ComparisonRow[];
}

// Not a shared/reusable component on purpose — the real `/access-denied`
// route (app/(other-pages)/access-denied/page.tsx) is a full page shell
// (hero image, "Back to home" button) meant for a route-level 403, not for
// embedding inside a screen that has already fetched data. This is the
// "simple inline message" the brief allows when no embeddable component
// exists.
function InlineNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <PiWarningCircle className="h-8 w-8 text-gray-400" />
      </div>
      <h1 className="text-base font-semibold text-gray-700">
        Can&rsquo;t open this appraisal
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
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-50" />
        ))}
      </div>
    </div>
  );
}

/**
 * Fetches the appraisal once and dispatches on `access.relation`. This is the
 * ONLY branch point in the whole detail screen: AppraisalSubjectView and
 * AppraisalManagerView are separate components, not `if (relation === …)`
 * branches inside one file, specifically so the subject's rendering path has
 * no code path that could ever read a `feedback.reviewer` — not a guard that
 * happens to hide it today, an absence a future edit can't accidentally
 * remove.
 *
 * In practice `GET /api/appraisals/:id` 403s (and this component's fetch
 * throws) before `access` is ever computed for relations 'reviewer' and
 * 'none' (see server/controllers/appraisal.controller.js#getAppraisal) — the
 * server only returns a body once `access.canRead` is true, which is only
 * ever true for 'subject' (once released), 'manager', and 'hr'. The
 * catch-all branch below is kept anyway: `AppraisalRelation` still has 5
 * members, and this file must not rely on "the current server never sends
 * that" to stay safe.
 */
export default function AppraisalDetail({ id }: { id: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAppraisal(id);
        if (cancelled) return;
        setData(result);
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : 'Failed to load this appraisal';
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

  function handleUpdate(appraisal: Appraisal) {
    setData((prev) => (prev ? { ...prev, appraisal } : prev));
  }

  /**
   * Re-fetches the whole detail payload rather than patching `appraisal`
   * alone. approvePeers/backfillPeers change more than the appraisal
   * document: state moves (pending_peer_approval → collecting), which
   * changes `access.canApprovePeers`/`canBackfillPeers`/`canSummarise` too,
   * and new peer feedback rows appear. `handleUpdate` stays as it is for
   * saveSummary/release/acknowledge, whose responses are already the
   * updated Appraisal and need no wider refresh. Not gated on `cancelled`
   * like the initial load's effect — this only ever runs after the
   * component is already mounted and interactive.
   */
  async function refresh() {
    try {
      const result = await fetchAppraisal(id);
      setData(result);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not refresh this appraisal'
      );
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <InlineNotice
        message={
          error ||
          'This appraisal could not be found, or you do not have permission to view it.'
        }
      />
    );
  }

  const {
    appraisal,
    feedback,
    sections,
    access,
    approvedPeerCount,
    peerResponseCount,
    comparison,
  } = data;

  if (access.relation === 'subject') {
    return (
      <AppraisalSubjectView
        appraisal={appraisal}
        feedback={feedback}
        sections={sections}
        approvedPeerCount={approvedPeerCount}
        peerResponseCount={peerResponseCount}
        comparison={comparison}
        onUpdate={handleUpdate}
      />
    );
  }

  if (access.relation === 'manager' || access.relation === 'hr') {
    return (
      <AppraisalManagerView
        appraisal={appraisal}
        feedback={feedback}
        sections={sections}
        access={access}
        comparison={comparison}
        onUpdate={handleUpdate}
        onRefresh={refresh}
      />
    );
  }

  return (
    <InlineNotice message="You do not have permission to view this appraisal." />
  );
}
