'use client';

import { useState } from 'react';
import { Button } from 'rizzui/button';
import { PiWarningCircleDuotone } from 'react-icons/pi';
import { initSubscribe, cancelSubscription } from '@/services/erm.service';
import CurrentPlanWidget from './current-plan-widget';
import PricingCards from './pricing-cards';
import AddOnsCard from './add-ons-card';
import type { ErmPlan, ErmStatus } from '@/services/erm.service';

/**
 * Shown only when the API did not send `entitlementMessage` at all.
 *
 * DEPLOY ORDERING, WHICH IS THE WHOLE REASON THIS CONSTANT EXISTS.
 * `entitlementMessage` is a new field on `GET /api/erm/status`. If this client
 * ships before the API does, `status.entitlementMessage` is `undefined` and
 * rendering it bare produced an **empty amber box** — a warning shaped like a
 * warning that says nothing, which is worse than the hand-written sentence it
 * replaced. `ReadOnlyBanner` degrades safely already (a null message renders
 * nothing); this page could not, because it keys the box off `writesAllowed`.
 *
 * It mirrors the server's `READ_ONLY_FALLBACK` and is deliberately the generic,
 * reason-free sentence: it is the one string that cannot become *wrong* for a
 * particular reason, only vague. Everything reason-specific still comes from
 * the server's `readOnlyMessage`, which stays the single source (README §4).
 * This is a deploy-window fallback, not a second copy of the policy.
 */
const ENTITLEMENT_MESSAGE_FALLBACK =
  'Your subscription is not in good standing. Your account is read-only until billing is resolved.';

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

      {/* A read-only account is the one state where the user needs to be told
          exactly what is happening: they can still see everything and can still
          pay from this page, but every other screen refuses to save.
          `entitlementMessage` is written by the server's `readOnlyMessage` —
          the same function that fills the 403 body, and the same string the
          toast on every other screen shows — so the two cannot disagree. This
          used to be three hand-written sentences here, which is precisely how
          they drifted from the ones the gates were sending. */}
      {!status.writesAllowed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <PiWarningCircleDuotone className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {status.entitlementMessage ?? ENTITLEMENT_MESSAGE_FALLBACK}
          </span>
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
