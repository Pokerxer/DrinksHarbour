/**
 * Plan entitlements for the admin dashboard.
 *
 * MIRROR, NOT A SECOND SOURCE. `PLAN_CAPABILITIES` below restates
 * `ERM_PLANS[*].features` from server/config/erm-plans.js, which is canonical.
 * server/__tests__/planCapabilities.test.js parses THIS file and fails if the
 * two disagree, and fails again if either disagrees with the pricing page's
 * FEATURE_COMPARISON. That is the same shape as ROLE_PERMISSIONS in
 * types/authorization.ts, pinned by server/__tests__/rolePermissionMap.test.js.
 *
 * The rules — what each plan gets, what `custom` means, how dunning degrades a
 * tenant, why platform staff are exempt — are written out in
 * server/config/README-plan-entitlements.md. Read that before changing this.
 *
 * WHY A SET AND NOT A RANK: FEATURE_COMPARISON is non-monotonic. "POS (single
 * outlet)" is false for pro/enterprise/venue and "Basic CRM" is false for
 * enterprise/venue, because those plans get the multi-outlet POS and the
 * advanced CRM instead. A `requiredPlan: 'starter'`-style rank gate therefore
 * locks Pro tenants out of the POS and Enterprise tenants out of CRM. Route
 * requirements are `anyOf` lists for exactly that reason.
 */

export type Capability =
  // Rows of FEATURE_COMPARISON
  | 'storefront'
  | 'inventory'
  | 'orders'
  | 'pos_single'
  | 'pos_multi'
  | 'sales_invoicing'
  | 'crm_basic'
  | 'crm_advanced'
  | 'purchase_orders'
  | 'multi_location'
  | 'advanced_reports'
  | 'api_access'
  | 'table_management'
  | 'event_booking'
  | 'bar_inventory'
  // Sold on the PLAN_TIERS cards but absent from the comparison table
  | 'pos_realtime'
  | 'guest_crm'
  | 'custom_integrations'
  | 'priority_support';

export type TenantPlan =
  | 'free_trial'
  | 'starter'
  | 'growth'
  | 'pro'
  | 'enterprise'
  | 'venue'
  | 'custom';

/** The price ladder. `custom` is off it deliberately — see the README. */
export const PLAN_ORDER: TenantPlan[] = [
  'free_trial',
  'starter',
  'growth',
  'pro',
  'enterprise',
  'venue',
];

export const PLAN_LABELS: Record<TenantPlan, string> = {
  free_trial: 'Free Trial',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
  venue: 'Venue',
  custom: 'Custom',
};

/** Naira per month. `custom` is negotiated, hence null. */
export const PLAN_PRICES: Record<TenantPlan, number | null> = {
  free_trial: 0,
  starter: 15000,
  growth: 35000,
  pro: 65000,
  enterprise: 85000,
  venue: 150000,
  custom: null,
};

export const PLAN_CAPABILITIES: Record<TenantPlan, Capability[]> = {
  free_trial: ['storefront', 'inventory', 'orders', 'pos_single'],
  starter: [
    'storefront',
    'inventory',
    'orders',
    'pos_single',
    'sales_invoicing',
  ],
  growth: [
    'storefront',
    'inventory',
    'orders',
    'pos_single',
    'sales_invoicing',
    'crm_basic',
    'purchase_orders',
  ],
  pro: [
    'storefront',
    'inventory',
    'orders',
    'pos_multi',
    'sales_invoicing',
    'crm_basic',
    'purchase_orders',
    'multi_location',
    'advanced_reports',
    'api_access',
  ],
  enterprise: [
    'storefront',
    'inventory',
    'orders',
    'pos_multi',
    'sales_invoicing',
    'crm_advanced',
    'purchase_orders',
    'multi_location',
    'advanced_reports',
    'api_access',
    'custom_integrations',
    'priority_support',
  ],
  venue: [
    'storefront',
    'inventory',
    'orders',
    'pos_multi',
    'pos_realtime',
    'sales_invoicing',
    'crm_advanced',
    'purchase_orders',
    'multi_location',
    'advanced_reports',
    'api_access',
    'table_management',
    'guest_crm',
    'event_booking',
    'bar_inventory',
  ],
  custom: [
    'storefront',
    'inventory',
    'orders',
    'pos_multi',
    'sales_invoicing',
    'crm_advanced',
    'purchase_orders',
    'multi_location',
    'advanced_reports',
    'api_access',
    'custom_integrations',
    'priority_support',
  ],
};

// ─── Umbrella requirements ───────────────────────────────────────────────────
// A feature that exists at several tiers. Gate on the umbrella, never on one
// tier, or the plans that hold a HIGHER tier get refused.

/** Any POS at all. Pro/Enterprise hold pos_multi; Venue adds pos_realtime. */
export const ANY_POS: Capability[] = [
  'pos_single',
  'pos_multi',
  'pos_realtime',
];
/** Any CRM at all. Growth/Pro hold crm_basic; Enterprise/Venue crm_advanced. */
export const ANY_CRM: Capability[] = ['crm_basic', 'crm_advanced'];

// ─── Route → requirement ─────────────────────────────────────────────────────

export interface RouteRequirement {
  /** URL prefix, matched on whole segments. */
  prefix: string;
  /** Holding ANY of these grants the route. Empty = not capability-gated. */
  anyOf: Capability[];
  /** Human name for the upgrade screen. */
  label: string;
  /**
   * Set INSTEAD of `anyOf` for a gate that predates this work and does not
   * follow from the pricing page. Kept at its existing threshold rather than
   * invented into a capability — see the exceptions note below.
   */
  legacyMinPlan?: TenantPlan;
}

/**
 * Longest-prefix wins. A route absent from this list is not plan-gated.
 *
 * DERIVED FROM THE PRICING (capability gates):
 *   /accounting, /store-analytics  → advanced_reports   (Advanced reports, Pro+)
 *   /sales, /invoice               → sales_invoicing    (Sales invoicing, Starter+)
 *   /purchases                     → purchase_orders    (Purchase orders, Growth+)
 *   /support, /contacts            → ANY_CRM            (Basic CRM, Growth+)
 *   /point-of-sale, /pos           → ANY_POS            (POS, every plan)
 *   /inventory, /warehouses        → inventory          (Inventory, every plan)
 *
 * RECORDED EXCEPTIONS (legacyMinPlan) — gates that already existed and that
 * FEATURE_COMPARISON says nothing about. They are preserved at their current
 * threshold rather than being given an invented capability, because inventing
 * one would mean inventing pricing:
 *   /analytics          starter     (basic analytics is not a priced row)
 *   /banners            starter     (not a priced row)
 *   /ecommerce/reviews  starter     (not a priced row)
 *   /roles-permissions  starter     (not a priced row)
 *   /logistics          enterprise  (logistics is not a priced feature)
 *
 * DELIBERATELY UNGATED: /products, /sub-products, /categories, /brands,
 * /employees, /appraisals, /settings, /profile, /blog, /tenants, /forms.
 * Catalogue and account surfaces are core, and /settings must stay reachable —
 * gating the page that shows a tenant their plan behind that same plan is how
 * you strand somebody who wants to pay you.
 *
 * NO ROUTE YET — sold, but with no admin surface to gate:
 *   api_access (Pro+)  there is no API-keys screen anywhere in this app; the
 *                      only /settings children are `billing` and the index.
 *                      When one lands it belongs here, gated on 'api_access'.
 *   table_management, event_booking, bar_inventory (Venue) live inside the POS
 *                      app rather than behind their own admin routes.
 * They stay in the capability table so it matches the pricing page; add
 * prefixes here when the screens exist.
 */
export const ROUTE_CAPABILITIES: RouteRequirement[] = [
  { prefix: '/accounting', anyOf: ['advanced_reports'], label: 'Accounting' },
  // No server guard to pair with this one, and none is missing: the
  // /store-analytics screens make no API calls at all — they are still on
  // template data. The route gate IS the whole enforcement here.
  {
    prefix: '/store-analytics',
    anyOf: ['advanced_reports'],
    label: 'Store Analytics',
  },
  { prefix: '/sales', anyOf: ['sales_invoicing'], label: 'Sales & Invoicing' },
  { prefix: '/invoice', anyOf: ['sales_invoicing'], label: 'Invoicing' },
  {
    prefix: '/purchases',
    anyOf: ['purchase_orders'],
    label: 'Purchase Orders',
  },
  { prefix: '/support', anyOf: ANY_CRM, label: 'Customer Support & CRM' },
  { prefix: '/contacts', anyOf: ANY_CRM, label: 'Contacts & CRM' },
  { prefix: '/point-of-sale', anyOf: ANY_POS, label: 'Point of Sale' },
  { prefix: '/pos', anyOf: ANY_POS, label: 'Point of Sale' },
  { prefix: '/inventory', anyOf: ['inventory'], label: 'Inventory' },
  { prefix: '/warehouses', anyOf: ['inventory'], label: 'Warehouses' },

  {
    prefix: '/analytics',
    anyOf: [],
    label: 'Analytics',
    legacyMinPlan: 'starter',
  },
  { prefix: '/banners', anyOf: [], label: 'Banners', legacyMinPlan: 'starter' },
  {
    prefix: '/ecommerce/reviews',
    anyOf: [],
    label: 'Reviews',
    legacyMinPlan: 'starter',
  },
  {
    prefix: '/roles-permissions',
    anyOf: [],
    label: 'Users & Roles',
    legacyMinPlan: 'starter',
  },
  {
    prefix: '/logistics',
    anyOf: [],
    label: 'Logistics',
    legacyMinPlan: 'enterprise',
  },
];

// ─── Matching and resolution ─────────────────────────────────────────────────

/**
 * `path` is `prefix` or sits underneath it, matching on whole URL segments.
 *
 * Same rule (and same reason) as `isUnder` in src/middleware.ts: a bare
 * `startsWith` also matches `/salesperson` for `/sales`, silently reserving a
 * namespace of URLs. Declared here rather than imported from middleware.ts so
 * this module stays free of next/server and can be unit-tested and parsed.
 */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** The most specific requirement covering `path`, or null when ungated. */
export function routeRequirementFor(path: string): RouteRequirement | null {
  let best: RouteRequirement | null = null;
  for (const entry of ROUTE_CAPABILITIES) {
    if (!isUnder(path, entry.prefix)) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }
  return best;
}

export function planRank(plan: string | undefined | null): number {
  // `custom` is off the ladder and satisfies every ordinal threshold.
  if (plan === 'custom') return PLAN_ORDER.length;
  const index = PLAN_ORDER.indexOf(plan as TenantPlan);
  return index === -1 ? -1 : index;
}

/** Ordinal comparison — for legacy thresholds and quotas only, never features. */
export function planAtLeast(
  plan: string | undefined | null,
  min: TenantPlan
): boolean {
  const have = planRank(plan);
  const need = PLAN_ORDER.indexOf(min);
  if (have === -1 || need === -1) return false;
  return have >= need;
}

/**
 * Capabilities a tenant actually holds.
 *
 * Mirrors services/entitlements.service.js. An unknown plan yields NOTHING
 * rather than the free_trial set: the server's resolver is the authority, and a
 * client that guesses generously here would render links the API then refuses.
 */
export function capabilitiesForPlan(
  plan: string | undefined | null,
  customCapabilities?: string[] | null
): Capability[] {
  if (plan === 'custom' && customCapabilities?.length) {
    return customCapabilities as Capability[];
  }
  return PLAN_CAPABILITIES[plan as TenantPlan] ?? [];
}

/** The cheapest SOLD plan granting `capability`, for upgrade copy. */
export function cheapestPlanWith(capability: Capability): TenantPlan | null {
  return (
    PLAN_ORDER.find((plan) => PLAN_CAPABILITIES[plan].includes(capability)) ??
    null
  );
}

/** The cheapest sold plan satisfying a whole requirement. */
export function cheapestPlanFor(
  requirement: RouteRequirement
): TenantPlan | null {
  if (requirement.legacyMinPlan) return requirement.legacyMinPlan;
  for (const plan of PLAN_ORDER) {
    if (
      requirement.anyOf.some((cap) => PLAN_CAPABILITIES[plan].includes(cap))
    ) {
      return plan;
    }
  }
  return null;
}

export interface PlanAccessInput {
  path: string;
  role: string | null | undefined;
  plan: string | undefined | null;
  customCapabilities?: string[] | null;
}

export interface PlanAccessResult {
  allowed: boolean;
  /** Null when allowed, or when the route is not plan-gated. */
  requirement: RouteRequirement | null;
  upgradeTo: TenantPlan | null;
}

/**
 * Platform staff have no tenant and therefore no plan, so their `undefined`
 * plan would rank as free_trial and lock them out of the very modules they
 * administer. They are exempt, checked FIRST.
 */
const PLATFORM_ROLES = ['super_admin', 'admin'];

export function checkPlanAccess({
  path,
  role,
  plan,
  customCapabilities,
}: PlanAccessInput): PlanAccessResult {
  if (role && PLATFORM_ROLES.includes(role)) {
    return { allowed: true, requirement: null, upgradeTo: null };
  }

  const requirement = routeRequirementFor(path);
  if (!requirement)
    return { allowed: true, requirement: null, upgradeTo: null };

  const allowed = requirement.legacyMinPlan
    ? planAtLeast(plan, requirement.legacyMinPlan)
    : requirement.anyOf.some((cap) =>
        capabilitiesForPlan(plan, customCapabilities).includes(cap)
      );

  return {
    allowed,
    requirement: allowed ? null : requirement,
    upgradeTo: allowed ? null : cheapestPlanFor(requirement),
  };
}
