import Link from 'next/link';
import { Button } from 'rizzui/button';
import { Title } from 'rizzui/typography';
import {
  PiHouseLineBold,
  PiLockKeyBold,
  PiArrowUpRightBold,
} from 'react-icons/pi';
import {
  PLAN_LABELS,
  PLAN_PRICES,
  type TenantPlan,
} from '@/config/plan-capabilities';

/**
 * Shown when the tenant's plan does not include the feature behind this route.
 *
 * NOT /access-denied, deliberately. A Growth tenant opening /accounting is a
 * sales opportunity, not an intruder — telling them "you do not have
 * permission, contact your administrator" is both wrong (their administrator
 * cannot help) and a wasted upgrade prompt. The role gate keeps
 * /access-denied; this is the plan gate's own answer.
 *
 * Rendered from two places, which is why it is a component and not just a
 * page: the /upgrade-required route (where the edge middleware redirects) and
 * app/layout.tsx's authoritative guard, which substitutes it for `children`
 * rather than redirecting.
 *
 * Imports from `rizzui/button` and `rizzui/typography` rather than the `rizzui`
 * barrel — the barrel breaks in a server component.
 */

function formatNaira(amount: number | null): string | null {
  if (amount === null) return null;
  if (amount === 0) return 'Free';
  return `₦${amount.toLocaleString('en-NG')}`;
}

export interface UpgradeRequiredProps {
  /** Human name of the blocked feature, e.g. "Accounting". */
  feature?: string;
  /** The plan the tenant is on now. */
  currentPlan?: string | null;
  /** Cheapest sold plan that unlocks it. */
  upgradeTo?: string | null;
}

export default function UpgradeRequired({
  feature,
  currentPlan,
  upgradeTo,
}: UpgradeRequiredProps) {
  const currentLabel = currentPlan
    ? (PLAN_LABELS[currentPlan as TenantPlan] ?? currentPlan)
    : null;
  const targetLabel = upgradeTo
    ? (PLAN_LABELS[upgradeTo as TenantPlan] ?? upgradeTo)
    : null;
  const targetPrice = upgradeTo
    ? formatNaira(PLAN_PRICES[upgradeTo as TenantPlan] ?? null)
    : null;

  return (
    <div className="flex grow items-center px-6 py-16 xl:px-10">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <PiLockKeyBold className="text-3xl" />
        </span>

        <Title
          as="h1"
          className="text-2xl font-bold leading-normal text-gray-1000 lg:text-3xl"
        >
          {feature
            ? `${feature} is not on your plan`
            : 'Not included in your plan'}
        </Title>

        <p className="mt-3 text-sm leading-loose text-gray-500 lg:mt-5 lg:text-base lg:leading-loose">
          {currentLabel ? (
            <>
              Your business is on the <strong>{currentLabel}</strong> plan
              {targetLabel ? (
                <>
                  , and {feature ? feature.toLowerCase() : 'this feature'} is
                  included from <strong>{targetLabel}</strong>
                  {targetPrice ? ` (${targetPrice}/month)` : ''} upwards.
                </>
              ) : (
                '.'
              )}
            </>
          ) : (
            <>
              This feature is not included in your current subscription
              {targetLabel ? (
                <>
                  {' '}
                  — it is available from <strong>{targetLabel}</strong>
                  {targetPrice ? ` (${targetPrice}/month)` : ''} upwards.
                </>
              ) : (
                '.'
              )}
            </>
          )}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/*
            Billing lives in settings. That route is deliberately never
            plan-gated: gating the page that shows a tenant their plan behind
            that same plan is how you strand somebody who wants to pay you.
          */}
          <Link href="/settings/billing">
            <Button size="xl" as="span" className="h-12 px-5 xl:h-14 xl:px-7">
              {targetLabel ? `Upgrade to ${targetLabel}` : 'View plans'}
              <PiArrowUpRightBold className="ml-1.5 text-lg" />
            </Button>
          </Link>
          <Link href="/">
            <Button
              size="xl"
              as="span"
              variant="outline"
              className="h-12 px-4 xl:h-14 xl:px-6"
            >
              <PiHouseLineBold className="mr-1.5 text-lg" />
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
