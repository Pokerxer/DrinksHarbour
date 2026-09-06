'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// The plans, as sold on the vendor pricing page.
//
// CANONICAL SOURCE for what a tenant may reach. Two things live here:
//
//   * the ordinal limits (skuLimit, staffLimit, commissionRate) — these ARE a
//     ladder, and isPlanAtLeast/PLAN_ORDER are the right tool for them;
//   * `features[]` — the CAPABILITY SET, which is NOT a ladder. See below.
//
// WHY A SET AND NOT A RANK. The pricing page's FEATURE_COMPARISON table
// (client/apps/platform/src/app/vendors/register/data.ts) is non-monotonic in
// two rows:
//
//   "POS (single outlet)"  is false for pro / enterprise / venue
//   "Basic CRM"            is false for enterprise / venue
//
// In both the `false` means SUPERSEDED — those plans get the multi-outlet POS
// and the advanced CRM instead — not WITHHELD. Any gate of the shape
// `rank(tenantPlan) >= rank('starter')` therefore locks Pro tenants out of the
// POS and Enterprise tenants out of CRM: paying customers losing features that
// work today. Gate on capabilities, and where a feature has tiers, accept ANY
// of them (see ROUTE_CAPABILITIES on the client, which uses anyOf).
//
// RECONCILIATION — which source wins. For the 15 rows FEATURE_COMPARISON
// covers, THE COMPARISON TABLE WINS and `features[]` below is pinned to it by
// server/__tests__/planCapabilities.test.js, which fails if either drifts.
// Plans may additionally carry capabilities the table does not mention (they
// come from the PLAN_TIERS marketing cards: guest_crm, custom_integrations,
// priority_support, pos_realtime); those are listed in EXTRA_CAPABILITIES so a
// typo cannot masquerade as one.
//
// Two divergences were found and corrected when this was written:
//   1. `storefront` was absent from every plan though the table grants
//      "Branded storefront" to all six.
//   2. `venue` carried pos_realtime but not pos_multi, though the table grants
//      venue "POS (multi outlet)". Venue now has both.
// ─────────────────────────────────────────────────────────────────────────────

/** Every capability the comparison table defines, keyed by its row label. */
const COMPARISON_ROW_CAPABILITY = {
  'Branded storefront': 'storefront',
  'Inventory management': 'inventory',
  'Order processing': 'orders',
  'POS (single outlet)': 'pos_single',
  'POS (multi outlet)': 'pos_multi',
  'Sales invoicing': 'sales_invoicing',
  'Basic CRM': 'crm_basic',
  'Advanced CRM': 'crm_advanced',
  'Purchase orders': 'purchase_orders',
  'Multi-location': 'multi_location',
  'Advanced reports': 'advanced_reports',
  'API access': 'api_access',
  'Table management': 'table_management',
  'Event booking': 'event_booking',
  'Bar inventory (real-time)': 'bar_inventory',
};

/**
 * Capabilities sold on the PLAN_TIERS cards but absent from the comparison
 * table. Allowed in `features[]`; ignored by the drift test. Anything in
 * `features[]` that is in neither map is a typo and the test says so.
 */
const EXTRA_CAPABILITIES = [
  'pos_realtime',
  'guest_crm',
  'custom_integrations',
  'priority_support',
];

const ERM_PLANS = {
  free_trial: {
    label: 'Free Trial',
    priceMonthly: 0,
    skuLimit: 50,
    staffLimit: 1,
    commissionRate: 0.13,
    paystackPlanCode: null,
    features: ['storefront', 'inventory', 'orders', 'pos_single'],
    addOnsAllowed: false,
  },
  starter: {
    label: 'Starter',
    priceMonthly: 15000,
    skuLimit: 100,
    staffLimit: 1,
    commissionRate: 0.13,
    paystackPlanCode: process.env.PAYSTACK_PLAN_STARTER,
    features: ['storefront', 'inventory', 'orders', 'pos_single', 'sales_invoicing'],
    addOnsAllowed: false,
  },
  growth: {
    label: 'Growth',
    priceMonthly: 35000,
    skuLimit: 500,
    staffLimit: 3,
    commissionRate: 0.11,
    paystackPlanCode: process.env.PAYSTACK_PLAN_GROWTH,
    features: ['storefront', 'inventory', 'orders', 'pos_single', 'sales_invoicing', 'crm_basic', 'purchase_orders'],
    addOnsAllowed: false,
  },
  pro: {
    label: 'Pro',
    priceMonthly: 65000,
    skuLimit: 2000,
    staffLimit: 10,
    commissionRate: 0.10,
    paystackPlanCode: process.env.PAYSTACK_PLAN_PRO,
    features: ['storefront', 'inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_basic', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access'],
    addOnsAllowed: true,
  },
  enterprise: {
    label: 'Enterprise',
    priceMonthly: 85000,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: process.env.PAYSTACK_PLAN_ENTERPRISE,
    features: ['storefront', 'inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'custom_integrations', 'priority_support'],
    addOnsAllowed: true,
  },
  venue: {
    label: 'Venue',
    priceMonthly: 150000,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: process.env.PAYSTACK_PLAN_VENUE,
    // pos_multi is required by the comparison table; pos_realtime is the venue
    // extra on top of it. Dropping either breaks a different consumer.
    features: ['storefront', 'inventory', 'orders', 'pos_multi', 'pos_realtime', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'table_management', 'guest_crm', 'event_booking', 'bar_inventory'],
    addOnsAllowed: true,
  },

  // ── custom ────────────────────────────────────────────────────────────────
  // `custom` is in the Tenant.plan enum but was in neither PLAN_ORDER nor this
  // map, so `PLAN_ORDER.indexOf('custom')` was -1 and isPlanAtLeast('custom',
  // anything) was FALSE — a custom tenant was refused by every server plan
  // gate. Meanwhile the admin client's PLAN_RANK scored custom 6, the HIGHEST,
  // so the menu offered it everything. The two sides failed in opposite
  // directions; this entry is what makes them agree.
  //
  // It is NOT priced or sold — it is the negotiated-contract escape hatch, so
  // it carries no paystackPlanCode. The enterprise capability set is the
  // DEFAULT; a tenant may narrow or widen it with `Tenant.customCapabilities`,
  // which entitlements.service.js applies.
  custom: {
    label: 'Custom',
    priceMonthly: null,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: null,
    features: ['storefront', 'inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'custom_integrations', 'priority_support'],
    addOnsAllowed: true,
  },
};

/**
 * The PRICE ladder — used for skuLimit/staffLimit comparisons and for naming
 * the cheapest plan that unlocks a capability on the upgrade screen.
 *
 * `custom` is deliberately absent: it is not a rung, it is off the ladder.
 * isPlanAtLeast handles it explicitly rather than letting indexOf return -1.
 */
const PLAN_ORDER = ['free_trial', 'starter', 'growth', 'pro', 'enterprise', 'venue'];

const ADD_ON_PRICES = {
  extra_shop: 12000,
  extra_warehouse: 20000,
};

/**
 * How long a brand-new tenant's trial runs. Lived as a bare `14` inside the
 * vendor-registration controller, which was the ONLY creation path that set
 * `trialEndsAt` at all — a tenant created from the platform admin form got
 * `subscriptionStatus: 'trialing'` with no end date, and
 * entitlements.service.js treats a missing `trialEndsAt` as "never expires".
 * Stamped in the Tenant pre-save hook now, so every path gets it.
 */
const TRIAL_DAYS = 14;

/**
 * Stamp a trial end date on a brand-new trialing tenant.
 *
 * The body of the Tenant pre-save hook, kept here as a plain function so it can
 * be tested without a database — the hook is the one line that calls it.
 * Mutates and returns the document.
 */
function applyTrialWindow(doc, now = new Date()) {
  if (!doc || !doc.isNew) return doc;
  if (doc.subscriptionStatus !== 'trialing') return doc;
  if (doc.trialEndsAt) return doc;
  doc.trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return doc;
}

/**
 * The two add-ons the pricing page sells. One of each is included in every
 * plan for free; these are the paid units on top (plan.middleware.js computes
 * `1 + sum(addOns[type].quantity)`).
 *
 * Each is its own Paystack plan, billed as its own subscription, so a tenant
 * can drop one extra warehouse without touching the base plan or the other
 * add-on. `Tenant.addOns[].paystackSubscriptionCode` is what ties a row back
 * to the subscription that pays for it — that is how a `subscription.disable`
 * webhook knows to remove one add-on row instead of cancelling the tenant.
 */
const ADD_ONS = {
  extra_shop: {
    label: 'Extra shop',
    noun: 'shop',
    priceMonthly: ADD_ON_PRICES.extra_shop,
    paystackPlanCode: process.env.PAYSTACK_PLAN_EXTRA_SHOP,
  },
  extra_warehouse: {
    label: 'Extra warehouse',
    noun: 'warehouse',
    priceMonthly: ADD_ON_PRICES.extra_warehouse,
    paystackPlanCode: process.env.PAYSTACK_PLAN_EXTRA_WAREHOUSE,
  },
};

const ADD_ON_TYPES = Object.keys(ADD_ONS);

function getAddOnConfig(type) {
  return ADD_ONS[type] ?? null;
}

/** Paid units of `type` this tenant holds. Zero for plans that cannot buy. */
function addOnQuantity(tenant, type) {
  const rows = Array.isArray(tenant?.addOns) ? tenant.addOns : [];
  return rows
    .filter((row) => row.type === type)
    .reduce((sum, row) => sum + (row.quantity || 1), 0);
}

/**
 * How many of `type` this tenant may have in total: the one free unit every
 * plan includes, plus whatever it is paying for. Plans without `addOnsAllowed`
 * get the free unit and nothing more, however many rows are on the document.
 */
function addOnAllowance(tenant, type) {
  const plan = getPlanConfig(tenant?.plan);
  return 1 + (plan.addOnsAllowed ? addOnQuantity(tenant, type) : 0);
}

/**
 * How many POS shops count against the extra_shop allowance.
 *
 * EVERY ROW COUNTS, including one flagged `active: false`. See README §5 for
 * the rule and why it is this way round: deactivating is not deleting, and the
 * four sold limits used to disagree about that — this one filtered on `active`
 * while the SKU, staff and warehouse counts did not, so the same tenant could
 * free a shop slot by toggling a flag but not a warehouse slot.
 *
 * The way to free a shop slot is `DELETE /api/pos/shops/:shopId`, which really
 * removes the subdocument.
 *
 * It is a function here, beside addOnAllowance, for the same reason that one
 * is: `checkShopLimit` enforces this number and `GET /api/erm/status` reports
 * it, and two copies would drift until the billing screen offered a slot the
 * gate refuses.
 */
function countedShops(tenant) {
  return (tenant?.posSettings?.shops || []).length;
}

function getPlanConfig(planKey) {
  return ERM_PLANS[planKey] ?? ERM_PLANS.free_trial;
}

function getCommissionRate(planKey) {
  return getPlanConfig(planKey).commissionRate;
}

/**
 * Ordinal comparison on the price ladder. Only meaningful for the ordinal
 * limits — do NOT use it to gate a feature (see the header). `custom` sits off
 * the ladder and satisfies every threshold; an unknown plan satisfies none.
 */
function isPlanAtLeast(tenantPlan, minPlan) {
  if (tenantPlan === 'custom') return true;
  const have = PLAN_ORDER.indexOf(tenantPlan);
  const need = PLAN_ORDER.indexOf(minPlan);
  if (have === -1 || need === -1) return false;
  return have >= need;
}

/** Capability set for a plan key, as a plain array. */
function getPlanCapabilities(planKey) {
  return getPlanConfig(planKey).features;
}

/**
 * The cheapest plan granting `capability`, for "upgrade to X to unlock this"
 * copy. Walks the price ladder, so `custom` is never suggested. Returns null
 * when no sold plan has it.
 */
function cheapestPlanWith(capability) {
  return PLAN_ORDER.find((key) => ERM_PLANS[key].features.includes(capability)) ?? null;
}

module.exports = {
  ERM_PLANS,
  PLAN_ORDER,
  ADD_ON_PRICES,
  ADD_ONS,
  ADD_ON_TYPES,
  TRIAL_DAYS,
  applyTrialWindow,
  COMPARISON_ROW_CAPABILITY,
  EXTRA_CAPABILITIES,
  getAddOnConfig,
  addOnQuantity,
  addOnAllowance,
  countedShops,
  getPlanConfig,
  getCommissionRate,
  isPlanAtLeast,
  getPlanCapabilities,
  cheapestPlanWith,
};
