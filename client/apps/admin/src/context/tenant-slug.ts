// Which tenant this admin page is branded for.
//
// The tenant used to come from the subdomain alone: `<slug>.drinksharbour.com`
// sets an `x-tenant-slug` header in middleware and the root layout looks the
// tenant up from it. But most tenant staff sign in at admin.drinksharbour.com
// (and every developer at localhost), where there is no subdomain — so
// `useTenant().tenant` was null for them and everything that prints the shop's
// name fell back to the platform's. The employee badge is the case where that
// is most obviously wrong: it is a card printed by a shop, for that shop's own
// staff, and it said DRINKSHARBOUR across the top.
//
// The signed-in user's tenant is the missing half. It is on the session already
// (`tenantSlug`, resolved at login from the populated tenant), so no new lookup
// is invented here — only the decision about which of the two to trust.
//
// Split out from the layout that calls it because a server component cannot be
// rendered under this Vitest setup (`environment: 'node'`, no jsdom), and the
// failure mode is silent: a wrong answer here prints somebody else's name on a
// card, or an empty band, and neither throws.

export interface TenantSlugSources {
  /** From the `x-tenant-slug` header — set by middleware from the subdomain. */
  hostSlug?: string | null;
  /** `session.user.tenantSlug` — the tenant the signed-in user works for. */
  sessionTenantSlug?: string | null;
}

function clean(value?: string | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The tenant slug to load branding for, or null when there is no tenant at all.
 *
 * The subdomain wins over the session deliberately. It is how a platform admin
 * pivots into one tenant, and a tenant user who lands on somebody else's
 * subdomain never gets here — middleware redirects them to /access-denied
 * before the layout renders.
 */
export function resolveTenantSlug({
  hostSlug,
  sessionTenantSlug,
}: TenantSlugSources): string | null {
  return clean(hostSlug) ?? clean(sessionTenantSlug);
}
