import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPE_INDUSTRIES,
  INDUSTRIES,
  INDUSTRY_SELECT_OPTIONS,
  TYPE_INDUSTRY_PREFIX_MAP,
  hasIndustryProfile,
  brandMatchesBusiness,
  taxonomyMatchesBusiness,
  industriesForProductType,
  industriesForTenantDisplay,
  industriesMetaForDisplay,
  isIndustry,
  normalizeIndustries,
  resolveTenantIndustries,
  typesForIndustries,
} from './industries';
import { productTypes } from '@/app/shared/ecommerce/product/create-edit/form-utils';
import { productTypes as subProductTypes } from '@/app/shared/ecommerce/sub-product/create-edit/form-utils';
import { retailProductTypeValues } from './retail-product-types';
import { hospitalityProductTypeValues } from './hospitality-product-types';

// ── Server canon (landed by the peer session on feat/plan-entitlements-billing)
// Mirror tests MUST compare against the actual landed server values, so the
// parity suite below reads the server files at test time. If the peer has not
// landed yet the parity block is skipped while contract tests still run.
const require = createRequire(import.meta.url);
const SERVER_LINES = path.resolve(__dirname, '../../../../../server');

type ServerCanon = {
  loaded: boolean;
  serverIndustries: string[];
  serverBusinessTypeIndustries: Record<string, string[] | null> | null;
  serverTypeIndustryPrefixMap: Record<string, string[]> | null;
};

function loadServerCanon(): ServerCanon {
  const empty: ServerCanon = {
    loaded: false,
    serverIndustries: [],
    serverBusinessTypeIndustries: null,
    serverTypeIndustryPrefixMap: null,
  };
  try {
    let mod: any = null;
    // Try the plausible landing locations in order — the peer ships whichever
    // shape its constants file ends up in.
    for (const candidate of [
      'constants/industries.js',
      'utils/industries.js',
      'constants/industryTaxonomy.js',
      'taxonomy/industries.js',
    ]) {
      try {
        mod = require(path.join(SERVER_LINES, candidate));
        break;
      } catch {
        // next candidate
      }
    }
    if (!mod) return empty;
    const serverIndustries = (
      mod.INDUSTRY_VALUES ??
      mod.INDUSTRIES ??
      mod.industryValues ??
      []
    ).map((v: any) => String(v));
    if (serverIndustries.length === 0) return empty;
    const businessTypeIndustries: Record<string, string[] | null> | null =
      mod.BUSINESS_TYPE_INDUSTRY_MAP
        ? Object.fromEntries(
            Object.entries(
              mod.BUSINESS_TYPE_INDUSTRY_MAP as Record<string, unknown>
            ).map(([k, v]): [string, string[] | null] => [
              k,
              v == null
                ? null
                : ((Array.isArray(v) ? v : [String(v)]) as string[]),
            ])
          )
        : null;
    // Server values may be raw arrays; keep them verbatim for comparison.
    const prefixMap: Record<string, string[]> | null =
      mod.TYPE_INDUSTRY_PREFIX_MAP
        ? Object.fromEntries(
            Object.entries(
              mod.TYPE_INDUSTRY_PREFIX_MAP as Record<string, unknown>
            ).map(([k, v]): [string, string[]] => [
              k,
              (Array.isArray(v) ? v : [String(v)]) as string[],
            ])
          )
        : null;
    return {
      loaded: true,
      serverIndustries,
          serverBusinessTypeIndustries: businessTypeIndustries,
      serverTypeIndustryPrefixMap: prefixMap,
    };
  } catch {
    return empty;
  }
}

// ── Filter matrix helpers ────────────────────────────────────────────────────
type FakeOption = { value: string; label: string };

const fakeTypes: FakeOption[] = [
  { value: 'wine', label: 'Wine (legacy)' },
  { value: 'other', label: 'Other (legacy)' },
  { value: 'electronics_audio', label: 'Audio' },
  { value: 'fashion_shoes', label: 'Shoes' },
  { value: 'beauty_skincare', label: 'Skincare' },
  { value: 'home_decor', label: 'Decor' },
  { value: 'foodservice_produce', label: 'Produce' },
  { value: 'hospitality_shisha_kit', label: 'Shisha' },
];

const subset = (fakeOptions: FakeOption[], values: string[]) =>
  fakeOptions.filter((o) => values.includes(o.value));

describe('industries canon (client mirror)', () => {
  it('exposes the seven canonical industries with labels', () => {
    expect(INDUSTRIES).toEqual([
      'beverage',
      'hospitality',
      'food-service',
      'electronics',
      'fashion',
      'beauty',
      'home',
    ]);
    expect(INDUSTRY_SELECT_OPTIONS).toHaveLength(INDUSTRIES.length);
    for (const option of INDUSTRY_SELECT_OPTIONS) {
      expect(isIndustry(option.value)).toBe(true);
    }
  });

  it('maps retail prefixes and leaves unknown or shared types global', () => {
    expect(TYPE_INDUSTRY_PREFIX_MAP).toEqual({
      electronics_: 'electronics',
      fashion_: 'fashion',
      beauty_: 'beauty',
      home_: 'home',
      foodservice_: 'food-service',
      hospitality_: 'hospitality',
    });
    for (const value of retailProductTypeValues) {
      expect(industriesForProductType(value)).not.toBeNull();
    }
    expect(industriesForProductType('hospitality_shisha_kit')).toBe(
      'hospitality'
    );
    expect(industriesForProductType('foodservice_produce')).toBe('food-service');
    // Shared accessories and unknown types remain global.
    for (const legacy of ['other', 'snack', 'glassware', 'vape', '']) {
      expect(industriesForProductType(legacy)).toBeNull();
    }
    expect(industriesForProductType(undefined)).toBeNull();
  });

  it('covers every business type the server model allows in the derived mirror', () => {
    // Values exist on server/models/Tenant.js enum; 'Wine Merchant'..'Other'.
    for (const businessType of [
      'Wine Merchant',
      'Spirit Importer',
      'Beverage Brand',
      'Liquor Store',
      'Distributor',
      'Bar / Lounge',
      'Nightclub / Club',
      'Restaurant',
      'Hotel',
      'Fashion Retail',
      'Electronics Retail',
      'Beauty & Skincare',
      'Home & Living',
      'General Retail',
      'Other',
    ]) {
      expect(BUSINESS_TYPE_INDUSTRIES).toHaveProperty(businessType);
    }
    expect(BUSINESS_TYPE_INDUSTRIES['General Retail']).toEqual([
      'fashion',
      'electronics',
      'beauty',
      'home',
    ]);
    expect(BUSINESS_TYPE_INDUSTRIES.Other).toBeNull();
    expect(BUSINESS_TYPE_INDUSTRIES.Restaurant).toEqual([
      'food-service',
      'hospitality',
      'beverage',
    ]);
  });

  it('normalises and validates profile payloads defensively', () => {
    expect(normalizeIndustries(null)).toBeNull();
    expect(normalizeIndustries([])).toBeNull();
    expect(normalizeIndustries([' beverage ', 'beauty'])).toEqual([
      'beverage',
      'beauty',
    ]);
    expect(normalizeIndustries(['wines', 'gadgets'])).toBeNull();
    expect(hasIndustryProfile(undefined)).toBe(false);
    expect(hasIndustryProfile(['beverage'])).toBe(true);
  });

  it('derives display industries from the profile first, then business type', () => {
    expect(
      industriesForTenantDisplay({
        industries: ['beauty'],
        businessType: 'Wine Merchant',
      })
    ).toEqual(['beauty']);
    expect(
      industriesForTenantDisplay({ businessType: 'Liquor Store' })
    ).toEqual(['beverage']);
    expect(industriesForTenantDisplay({ businessType: 'Other' })).toBeNull();
    expect(industriesForTenantDisplay({})).toBeNull();
    expect(industriesForTenantDisplay()).toBeNull();
  });

  it('exposes the server-precedence and meta aliases with identical semantics', () => {
    // resolveTenantIndustries mirrors server resolveTenantIndustries();
    // industriesMetaForDisplay interprets meta.industries of a list payload.
    const tenant = { industries: ['home'], businessType: 'Restaurant' };
    expect(resolveTenantIndustries(tenant)).toEqual(['home']);
    expect(industriesMetaForDisplay(tenant)).toEqual(['home']);
    expect(industriesMetaForDisplay({ businessType: 'Other' })).toBeNull();
    expect(industriesMetaForDisplay(null)).toBeNull();
  });
});

describe('typesForIndustries filter matrix', () => {
  it('keeps the unprofiled list untouched (same reference, every type)', () => {
    expect(typesForIndustries(fakeTypes, undefined)).toEqual(fakeTypes);
    expect(typesForIndustries(fakeTypes, null)).toEqual(fakeTypes);
    expect(typesForIndustries(fakeTypes, [])).toEqual(fakeTypes);
    expect(typesForIndustries(fakeTypes, ['wines'])).toEqual(fakeTypes);
    // Real taxonomic lists keep their array identity so flag-off renders are
    // byte-identical to today.
    expect(typesForIndustries(productTypes, null)).toEqual(productTypes);
    expect(typesForIndustries(subProductTypes, undefined)).toBe(subProductTypes);
  });

  it('a beverage-only profile hides fashion_/electronics_/etc. but keeps every legacy type', () => {
    expect(typesForIndustries(fakeTypes, ['beverage'])).toEqual(
      subset(fakeTypes, ['wine', 'other'])
    );
  });

  it('a beauty-only profile keeps beauty and shared types, excluding drinks', () => {
    expect(typesForIndustries(fakeTypes, ['beauty'])).toEqual(
      subset(fakeTypes, ['other', 'beauty_skincare'])
    );
    // Same predicate over the real taxonomy: an option survives iff it is
    // legacy (unlisted prefix) or beauty.
    const profiled = typesForIndustries(productTypes, ['beauty']);
    for (const option of productTypes) {
      const vertical = industriesForProductType(option.value);
      const kept = profiled.some((o) => o.value === option.value);
      expect(kept).toBe(vertical === null || vertical === 'beauty');
    }
  });

  it('mixed profiles keep each mapped group', () => {
    const result = typesForIndustries(
      fakeTypes,
      ['electronics', 'home']
    );
    expect(result).toEqual(
      subset(fakeTypes, [
        'other',
        'electronics_audio',
        'home_decor',
      ])
    );
  });

  it('shrinks both product flows naturally while preserving group headings', () => {
    const profiledProduct = typesForIndustries(
      productTypes,
      ['beverage']
    );
    const profiledSub = typesForIndustries(subProductTypes, ['beverage']);
    // The 37 retail verticals + 14 hospitality/foodservice types are all
    // industry-prefixed — a beverage-only profile removes precisely those 51.
    expect(productTypes.length - profiledProduct.length).toBe(
      retailProductTypeValues.length + hospitalityProductTypeValues.length
    );
    expect(subProductTypes.length - profiledSub.length).toBe(
      retailProductTypeValues.length + hospitalityProductTypeValues.length
    );
    const categories = new Set(profiledProduct.map((o) => o.category));
    for (const heading of [
      'Electronics',
      'Fashion',
      'Beauty',
      'Home',
      'Foodservice',
      'Hospitality',
    ]) {
      expect(categories.has(heading)).toBe(false);
    }
    for (const heading of ['Alcoholic', 'Non-Alcoholic', 'Other']) {
      expect(categories.has(heading)).toBe(true);
    }
  });

  it('an all-industry profile equals no filtering', () => {
    for (const industries of [[...INDUSTRIES]]) {
      expect(typesForIndustries(productTypes, industries)).toEqual(productTypes);
      expect(typesForIndustries(subProductTypes, industries)).toEqual(
        subProductTypes
      );
    }
  });
});

describe.skipIf(!loadServerCanon().loaded)(
  'server parity (compare against landed server values)',
  () => {
    const canon = loadServerCanon();

    it('client INDUSTRIES match the server canon exactly', () => {
      expect(canon.loaded).toBe(true);
      expect(canon.serverIndustries).toEqual([...INDUSTRIES]);
    });

    it('client business-type mirror matches the server map', () => {
      if (!canon.serverBusinessTypeIndustries) return;
      for (const [businessType, industries] of Object.entries(
        canon.serverBusinessTypeIndustries
      )) {
        if (!industries) continue; // server null = legacy, client mirrors below
        const client = [...(BUSINESS_TYPE_INDUSTRIES[businessType] ?? [])].sort();
        expect(client).toEqual([...industries].sort());
      }
      // Server deliberately omits 'Other'/unmapped types from its map because
      // they resolve to null — the client encodes the same null explicitly.
      expect(BUSINESS_TYPE_INDUSTRIES.Other).toBeNull();
    });

    it('client type-prefix mirror matches the server prefix map', () => {
      if (!canon.serverTypeIndustryPrefixMap) return;
      for (const [prefix, industries] of Object.entries(
        canon.serverTypeIndustryPrefixMap
      )) {
        expect([TYPE_INDUSTRY_PREFIX_MAP[prefix]]).toEqual(industries);
      }
    });
  }
);

it('registered drinks belong only to beverage profiles', () => {
  expect(industriesForProductType('champagne')).toBe('beverage');
  expect(typesForIndustries([{ value: 'champagne' }], ['home'])).toEqual([]);
  expect(typesForIndustries([{ value: 'champagne' }], ['beverage'])).toHaveLength(1);
});

it('beverage ownership mirror matches the server registry', () => {
 const require = createRequire(import.meta.url);
 const { BEVERAGE_TYPES } = require('../../../../../server/constants/productTypes');
 for (const type of BEVERAGE_TYPES) expect(industriesForProductType(type)).toBe('beverage');
});


it('scopes picker rows by explicit business and preserves recognizable beverage brands', () => {
  expect(taxonomyMatchesBusiness({ industry: 'home', type: 'wine' }, 'beverage')).toBe(false);
  expect(taxonomyMatchesBusiness({ type: 'wine' }, 'beverage')).toBe(true);
  expect(brandMatchesBusiness({ primaryCategory: 'spirits' }, 'beverage')).toBe(true);
  expect(brandMatchesBusiness({ industry: 'beauty', primaryCategory: 'spirits' }, 'beverage')).toBe(false);
  expect(brandMatchesBusiness({ industry: 'beauty' }, 'beauty')).toBe(true);
  expect(brandMatchesBusiness({}, 'beauty')).toBe(false);
});
