'use client';

import { Button } from 'rizzui/button';
import { PiWarningCircleDuotone } from 'react-icons/pi';
import type { ErmPlan, ErmStatus } from '@/services/erm.service';
import { useBillingActions } from './use-billing-actions';
import PlanConfirmation from './plan-confirmation';
import CurrentPlanWidget from './current-plan-widget';
import PricingCards from './pricing-cards';
import AddOnsCard from './add-ons-card';
import SettingsPageHeader from '@/app/shared/settings/settings-page-header';

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
  const {
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
  } = useBillingActions(status, token);
  const canManageBilling = status.canManageBilling === true;
  const hasCurrentSubscription =
    status.hasSubscription === true &&
    ['active', 'trialing', 'past_due'].includes(status.subscriptionStatus);
  const canCancel =
    canManageBilling &&
    status.hasSubscription === true &&
    !status.cancelAtPeriodEnd &&
    ['active', 'trialing', 'past_due'].includes(status.subscriptionStatus) &&
    status.plan !== 'free_trial';

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SettingsPageHeader
        title="Subscription & billing"
        description="Review your plan, keep track of usage and manage payments. Choose the right tools for your business as it grows."
      >
        <span className="rounded-full border border-muted px-4 py-2 text-xs font-medium text-gray-600">
          Payments secured by Paystack · NGN
        </span>
      </SettingsPageHeader>
      {checkingPending && (
        <p role="status" className="text-sm text-gray-500">
          Checking scheduled plan changes…
        </p>
      )}
      {pendingError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 p-4 text-sm text-red-600"
        >
          <span>
            {pendingError} Plan changes are paused until this is checked.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRevision((v) => v + 1)}
          >
            Retry check
          </Button>
        </div>
      )}

      {!canManageBilling && (
        <p role="status" className="text-sm text-gray-600">
          Only your tenant owner or administrator can change billing. You can
          review your plan and usage here.
        </p>
      )}
      {status.cancelAtPeriodEnd && (
        <p role="status" className="text-sm text-amber-700">
          Cancellation scheduled. Your plan remains available until the billing
          period ends.
        </p>
      )}
      {hasCurrentSubscription && (
        <p className="text-sm text-gray-600">
          Plan changes start at the end of your paid period. There are no
          partial charges or credits; your current access remains until then.
        </p>
      )}
      {pending && (
        <p
          role="status"
          className="rounded-xl border border-muted bg-gray-50 p-4 text-sm"
        >
          Plan change to{' '}
          {plans.find((plan) => plan.key === pending.targetPlan)?.label ??
            pending.targetPlan}
          : {pending.state.replaceAll('_', ' ')}. Effective{' '}
          {new Date(pending.effectiveAt).toLocaleDateString()}.{' '}
          {pending.state === 'needs_review' &&
            'Contact support to reconcile the provider outcome before retrying.'}
        </p>
      )}
      {canManageBilling &&
        status.hasSubscription &&
        status.cancelAtPeriodEnd &&
        !pending && (
          <Button
            disabled={loadingPlan !== null || cancelling || changesBlocked}
            onClick={() => handleSelectPlan(status.plan)}
          >
            Enable renewal
          </Button>
        )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <CurrentPlanWidget status={status} />
          {canManageBilling && status.hasSubscription && (
            <Button
              className="w-full"
              size="sm"
              variant="outline"
              disabled={cancelling || loadingPlan !== null}
              isLoading={loadingPlan === 'manage'}
              onClick={handleManage}
            >
              Manage payment method
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-red-600 hover:border-red-300 hover:bg-red-50"
              disabled={loadingPlan !== null || changesBlocked}
              isLoading={cancelling}
              onClick={handleCancel}
            >
              Cancel subscription
            </Button>
          )}
        </div>
        <div className="min-w-0 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Find your next plan</h2>
            <p className="mt-1 text-sm text-gray-500">
              Monthly subscriptions, with marketplace commission shown for each
              tier.
            </p>
          </div>
          <PricingCards
            plans={plans}
            currentPlan={status.plan}
            onSelectPlan={setSelectedPlan}
            loading={loadingPlan}
            disabled={!canManageBilling || cancelling || changesBlocked}
            canReactivate={
              (!status.writesAllowed && !status.hasSubscription) ||
              ['canceled', 'incomplete', 'incomplete_expired'].includes(
                status.subscriptionStatus
              )
            }
          />
        </div>
      </div>
      <PlanConfirmation
        plan={plans.find((plan) => plan.key === selectedPlan)}
        hasSubscription={status.hasSubscription === true}
        busy={loadingPlan !== null || cancelling}
        blocked={changesBlocked}
        error={error}
        onConfirm={() => selectedPlan && void handleSelectPlan(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
      />
      <AddOnsCard status={status} token={token} />
    </div>
  );
}
