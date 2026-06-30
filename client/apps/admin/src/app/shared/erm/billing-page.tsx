'use client';

import { useState } from 'react';
import { Button } from 'rizzui/button';
import { PiWarningCircleDuotone } from 'react-icons/pi';
import { initSubscribe, cancelSubscription } from '@/services/erm.service';
import CurrentPlanWidget from './current-plan-widget';
import PricingCards from './pricing-cards';
import type { ErmPlan, ErmStatus } from '@/services/erm.service';

export default function BillingPage({
  plans,
  status,
  token,
}: {
  plans: ErmPlan[];
  status: ErmStatus;
  token: string;
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPlan(planKey: string) {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const { authorizationUrl } = await initSubscribe(planKey, token);
      window.location.href = authorizationUrl;
    } catch (e: any) {
      setError(e.message);
      setLoadingPlan(null);
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        'Cancel your subscription? You will lose access at the end of the billing period.'
      )
    )
      return;
    setCancelling(true);
    setError(null);
    try {
      await cancelSubscription(token);
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setCancelling(false);
    }
  }

  const canCancel =
    ['active', 'trialing', 'past_due'].includes(status.subscriptionStatus) &&
    status.plan !== 'free_trial';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Subscription & Billing
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your ERM plan. Higher tiers reduce your marketplace commission
          rate.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <PiWarningCircleDuotone className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {status.subscriptionStatus === 'past_due' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <PiWarningCircleDuotone className="h-4 w-4 shrink-0" />
          Your last payment failed. Please update your payment method to keep
          your ERM features active.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-1">
          <CurrentPlanWidget status={status} />
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-red-600 hover:border-red-300 hover:bg-red-50"
              isLoading={cancelling}
              onClick={handleCancel}
            >
              Cancel subscription
            </Button>
          )}
        </div>
        <div className="lg:col-span-3">
          <PricingCards
            plans={plans}
            currentPlan={status.plan}
            onSelectPlan={handleSelectPlan}
            loading={loadingPlan}
          />
        </div>
      </div>
    </div>
  );
}
