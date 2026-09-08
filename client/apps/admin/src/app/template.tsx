import React from 'react';
import { headers } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { getErmStatus } from '@/services/erm.service';
import { checkPlanAccess, routeRequirementFor } from '@/config/plan-capabilities';
import { TENANT_ROLES } from '@/types/authorization';
import ReadOnlyBanner from '@/components/read-only-banner';
import UpgradeRequired from '@/app/shared/upgrade-required/upgrade-required';
import LiveErmTenant from '@/context/LiveErmTenant';

/** Templates render on navigation; shared layouts do not. Never use a cached
 * JWT or public storefront projection to decide a paid tenant's capabilities.
 * The API remains the authority for every data operation.
 */
export default async function AccessTemplate({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname');
  if (!pathname) return children; // Public auth, kiosk and pairing pages.
  const user = await getAuthenticatedUser();
  if (!user || !TENANT_ROLES.includes(user.role)) return children;
  const status = await getErmStatus(user.token!);
  if (!status) {
    // Billing and account recovery stay reachable on an API outage.
    if (!routeRequirementFor(pathname)) return children;
    return <div className="p-6" role="alert">
      <h1 className="text-xl font-semibold">Unable to check your subscription</h1>
      <p className="mt-2">Please try again. Your plan has not been changed.</p>
      <a className="mt-4 inline-block underline" href={pathname}>Try again</a>
      <a className="ml-4 underline" href="/settings/billing">Subscription & Billing</a>
    </div>;
  }
  const degraded = status.entitlementReason === 'trial_expired' ||
    ['canceled', 'incomplete', 'incomplete_expired'].includes(status.subscriptionStatus);
  const effectivePlan = degraded ? 'free_trial' : status.plan;
  const access = checkPlanAccess({ path: pathname, role: user.role,
    plan: effectivePlan, capabilities: status.capabilities });
  return <LiveErmTenant status={status} plan={effectivePlan}>
    <ReadOnlyBanner message={status.writesAllowed ? null : status.entitlementMessage ?? null} />
    {access.allowed ? children : <UpgradeRequired feature={access.requirement?.label}
      currentPlan={status.plan} upgradeTo={access.upgradeTo} />}
  </LiveErmTenant>;
}
