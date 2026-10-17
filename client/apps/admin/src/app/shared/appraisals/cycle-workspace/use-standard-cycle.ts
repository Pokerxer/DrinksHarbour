'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  closeCycle,
  fetchCycle,
  fetchCycleProgress,
  launchCycle,
  skipPeers,
  type AppraisalCycle,
  type CycleProgress,
} from '@/services/appraisal.service';
type LaunchResult = Awaited<ReturnType<typeof launchCycle>>;
export default function useStandardCycle(id: string) {
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

  return {
    cycle,
    progress,
    loading,
    error,
    launching,
    launchResult,
    closing,
    showCloseModal,
    showLaunchModal,
    skippingId,
    setShowCloseModal,
    setShowLaunchModal,
    handleLaunch,
    handleClose,
    handleSkipPeers,
  };
}
