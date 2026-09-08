'use client';
import { useEffect, useRef, useState } from 'react';
import {
  initSubscribe,
  cancelSubscription,
  manageSubscription,
  changePlan,
  renewSubscription,
  getPendingPlanChange,
  type PendingPlanChange,
  type ErmStatus,
} from '@/services/erm.service';
export function useBillingActions(status: ErmStatus, token: string) {
  const actionLock = useRef(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlanChange | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);
  const [pendingError, setPendingError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setCheckingPending(true);
    setPendingError('');
    getPendingPlanChange(token, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPending(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setPendingError(
            e instanceof Error ? e.message : 'Unable to check plan changes.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingPending(false);
      });
    return () => controller.abort();
  }, [token, revision]);
  const changesBlocked =
    checkingPending || Boolean(pendingError) || Boolean(pending);

  async function handleManage() {
    if (status.canManageBilling !== true || loadingPlan || cancelling) return;
    if (actionLock.current) return;
    actionLock.current = true;
    setLoadingPlan('manage');
    setError(null);
    try {
      const { authorizationUrl } = await manageSubscription(token);
      window.location.href = authorizationUrl;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to open payment settings'
      );
      actionLock.current = false;
      setLoadingPlan(null);
    }
  }

  async function handleSelectPlan(planKey: string) {
    if (
      status.canManageBilling !== true ||
      loadingPlan ||
      cancelling ||
      changesBlocked
    )
      return;
    if (actionLock.current) return;
    actionLock.current = true;
    setLoadingPlan(planKey);
    setError(null);
    try {
      if (status.hasSubscription) {
        if (planKey === status.plan) await renewSubscription(token);
        else await changePlan(planKey, token);
        window.location.reload();
        return;
      }
      const { authorizationUrl } = await initSubscribe(planKey, token);
      window.location.href = authorizationUrl;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to update billing. Please retry.'
      );
      setCheckingPending(true);
      setRevision((v) => v + 1);
      actionLock.current = false;
      setLoadingPlan(null);
    }
  }

  async function handleCancel() {
    if (
      status.canManageBilling !== true ||
      loadingPlan ||
      cancelling ||
      changesBlocked
    )
      return;
    if (
      !confirm(
        'Cancel your subscription? You will lose access at the end of the billing period.'
      )
    )
      return;
    if (actionLock.current) return;
    actionLock.current = true;
    setCancelling(true);
    setError(null);
    try {
      await cancelSubscription(token);
      window.location.reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to update billing. Please retry.'
      );
      actionLock.current = false;
      setCancelling(false);
    }
  }

  return {
    loadingPlan,
    cancelling,
    error,
    pending,
    checkingPending,
    pendingError,
    setRevision,
    selectedPlan,
    setSelectedPlan,
    changesBlocked,
    handleManage,
    handleSelectPlan,
    handleCancel,
  };
}
