import { beverageIndustryTypes } from './beverage-industry-types';
// Keep in sync with the server canon (peer session on the same branch). The
// retail/hospitality/product-types mirrors read server/constants at test time;
// this industries mirror does the same via `industries.test.ts` (skips the
// parity block until the server file has landed).
//
// INDUSTRY is the canonical vocabulary for industry-scoping categories and
// product types. `null` everywhere below means "legacy / global" — no scope:
// Unknown/shared types, 'Other' business type, absent Tenant.industries and blank
// Category.industry ALL mean the entity is visible/treated as all-industry.

export const INDUSTRIES = [
  'beverage',
  'hospitality',
  'food-service',
  'electronics',
  'fashion',
  'beauty',
  'home',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

/** Widened values for form options / payload transport. */
export const industryValues: readonly Industry[] = INDUSTRIES;

export const INDUSTRY_SELECT_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: 'beverage', label: 'Beverages' },
    { value: 'hospitality', label: 'Hospitality' },
    { value: 'food-service', label: 'Food Service' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'beauty', label: 'Beauty & Skincare' },
    { value: 'home', label: 'Home & Living' },
  ];

// ── Business-type → industries mirror (derived display) ──────────────────────
// Only used to display industries when a tenant has no explicit profile.
// `Tenant.industries` (when set) is the sole filtering authority — deriving the
// filter from businessType would silently change filtering for unprofiled
// tenants. `null` = all industries (legacy/global display).
export const BUSINESS_TYPE_INDUSTRIES: Readonly<
  Record<string, readonly Industry[] | null>
> = {
  'Wine Merchant': ['beverage'],
  'Spirit Importer': ['beverage'],
  'Beverage Brand': ['beverage'],
  'Liquor Store': ['beverage'],
  Distributor: ['beverage'],
  'Bar / Lounge': ['beverage', 'hospitality', 'food-service'],
  'Nightclub / Club': ['beverage', 'hospitality', 'food-service'],
  Restaurant: ['food-service', 'hospitality', 'beverage'],
  Hotel: ['food-service', 'hospitality', 'beverage'],
  'Fashion Retail': ['fashion'],
  'Electronics Retail': ['electronics'],
  'Beauty & Skincare': ['beauty'],
  'Home & Living': ['home'],
  'General Retail': ['fashion', 'electronics', 'beauty', 'home'],
  // Legacy/global: every value the model allows but has no restricted scope.
  Other: null,
};

// ── Product-type prefix → industry mirror ────────────────────────────────────
// Mirror of the server prefix rules (see generalProductTypes.js comment on
// RETAIL_TYPE_PREFIXES + the foodservice_/hospitality_ supply round). Any type
// in the beverage registry resolves to beverage; unknown/shared types stay
// global. Prefixed types belong to the corresponding business. Order does not matter —
// no prefix is a prefix of another.
export const TYPE_INDUSTRY_PREFIX_MAP: Readonly<
  Record<string, Industry>
> = {
  electronics_: 'electronics',
  fashion_: 'fashion',
  beauty_: 'beauty',
  home_: 'home',
  foodservice_: 'food-service',
  hospitality_: 'hospitality',
};

/** The industry a product type belongs to, or `null` for legacy/global types. */
export function industriesForProductType(
  type?: string | null
): Industry | null {
  if (!type) return null;
  if (beverageIndustryTypes.has(type)) return 'beverage';
  for (const [prefix, industry] of Object.entries(TYPE_INDUSTRY_PREFIX_MAP)) {
    if (type.startsWith(prefix)) return industry;
  }
  return null;
}

/** True when the given value is an accepted INDUSTRY value. */
export function isIndustry(value: string): value is Industry {
  return (INDUSTRIES as readonly string[]).includes(value);
}

/**
 * Take a tenant-side `industries` payload (array of canonical values in any
 * casing/whitespace shape) and normalise it to a valid, deduplicated list.
 * Unknown values are dropped defensively; an all-unknown payload normalises to
 * `null` (no filtering) rather than hiding every vertical type.
 */
export function normalizeIndustries(
  industries?: readonly string[] | null
): readonly Industry[] | null {
  if (!Array.isArray(industries) || industries.length === 0) return null;
  const seen = new Set<Industry>();
  for (const raw of industries) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim() as Industry;
    if (isIndustry(value)) seen.add(value);
  }
  return seen.size > 0 ? [...seen] : null;
}

/**
 * Coarse profile check: does this tenant have an industry profile at all?
 * Unprofiled / legacy tenants must see the taxonomy exactly as today.
 */
export function hasIndustryProfile(
  industries?: readonly string[] | null
): boolean {
  return normalizeIndustries(industries) !== null;
}

/**
 * Filter a product-type option list down to the tenant's industries.
 *
 * Signature `(productTypes, industries)` per the root canon.
 *
 * - `null`/undefined/empty/unprofiled → NO filtering: the exact same array is
 *   returned by reference, so flag-off renders are byte-identical.
 * - Types whose value matches a `TYPE_INDUSTRY_PREFIX_MAP` prefix are only
 *   visible when their industry is in the profile.
 * - Recognized drinks belong to beverage; only unknown/shared types remain global.
 * - Option objects are passed through untouched, so group headings, labels and
 *   ordering are preserved; only the option count drops.
 */
export function typesForIndustries<
  T extends { value: string },
>(
  productTypes: readonly T[],
  industries: readonly string[] | null | undefined
): readonly T[] {
  const profiled = normalizeIndustries(industries);
  if (!profiled) return productTypes;
  const allowed = new Set<string>(profiled);
  return productTypes.filter((option) => {
    const industry = industriesForProductType(option.value);
    return industry === null || allowed.has(industry);
  });
}

/**
 * Industries for display chips on the tenant detail page: the explicit
 * `Tenant.industries` profile when present, otherwise the business-type
 * derivation. `null` (or an unprofiled/unmapped business type) means
 * legacy/global — render "All industries" or nothing; callers decide.
 */
export function industriesForTenantDisplay(tenant?: {
  industries?: readonly string[] | null;
  businessType?: string | null;
} | null): readonly Industry[] | null {
  const explicit = normalizeIndustries(tenant?.industries);
  if (explicit) return explicit;
  if (typeof tenant?.businessType !== 'string' || !tenant.businessType.trim()) {
    return null;
  }
  const businessType = tenant.businessType.trim();
  if (businessType in BUSINESS_TYPE_INDUSTRIES) {
    return BUSINESS_TYPE_INDUSTRIES[businessType] ?? null;
  }
  return null;
}

/**
 * Mirror of the server's `resolveTenantIndustries()` (constants/industries.js):
 * the effective industry profile that scoping applies to a tenant. Precedence
 * is deliberately identical to the server — an explicit saved `industries`
 * array wins, then derivation from `businessType`, then nothing (null = never
 * filter). This is the ONLY place profile resolution happens client-side so
 * every consumer sees the same predicate the server applies.
 */
export const resolveTenantIndustries = industriesForTenantDisplay;

/**
 * The `meta.industries` a list payload reported, interpreted for display/use.
 * The server-filtered category/subcategory list endpoints respond additive
 * `meta.industries` (the applied profile, or null when nothing was applied —
 * flag OFF, anonymous, platform admin or unprofiled tenant). Consumers use
 * this to show which scope was applied or to mirror-filter without extra
 * calls; null means "nothing was applied — legacy full view".
 */
export const industriesMetaForDisplay = resolveTenantIndustries;

/** Human labels for an applied-scope echo, ready to join in a UI footnote. */
export function industriesMetaLabel(meta: string[] | null | undefined): string | null {
  if (!meta || meta.length === 0) return null;
  return meta
    .map((value) => INDUSTRY_SELECT_OPTIONS.find((o) => o.value === value)?.label ?? value)
    .join(', ');
}

/** Explicit ownership takes precedence over legacy product-type metadata. */
export function taxonomyMatchesBusiness(
  row: { industry?: string | null; type?: string },
  business: string
): boolean {
  return (row.industry || industriesForProductType(row.type)) === business;
}

export function brandMatchesBusiness(
  brand: { industry?: string; primaryCategory?: string; brandType?: string },
  business: string
): boolean {
  if (brand.industry) return brand.industry === business;
  return business === 'beverage' && (
    /^(beer|wine|spirits|liqueurs|cocktails|coffee|tea|soft_drinks|water|juice|energy_drinks|sports_drinks|mixers|champagne)$/.test(brand.primaryCategory || '') ||
    /brew|winery|vineyard|distill|spirits|beverage|drinks|coffee|tea_company|water_brand|champagne|juice|wine_estate/.test(brand.brandType || '')
  );
}
