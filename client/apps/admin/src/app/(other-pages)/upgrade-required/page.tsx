import UpgradeRequired from '@/app/shared/upgrade-required/upgrade-required';

/**
 * Where src/middleware.ts sends a tenant whose plan does not cover the route.
 *
 * Sits under (other-pages) beside /access-denied — the two are siblings: one
 * refuses a role, the other refuses a plan. Query params are set by the
 * middleware (`feature`, `plan`, `from`); all are optional, so a hand-typed
 * /upgrade-required still renders something sensible rather than throwing.
 */
export default async function UpgradeRequiredPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return (
    <UpgradeRequired
      feature={first(params.feature)}
      currentPlan={first(params.current)}
      upgradeTo={first(params.plan)}
    />
  );
}
