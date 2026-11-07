import { createRequire } from 'node:module';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AGE_RESTRICTED_HOSPITALITY_TYPES,
  hospitalityProductTypeOptions,
  hospitalityProductTypeValues,
} from './hospitality-product-types';
import { productTypes } from '@/app/shared/ecommerce/product/create-edit/form-utils';
import { productTypes as tenantTypes } from '@/app/shared/ecommerce/sub-product/create-edit/form-utils';
import { productFormSchema } from '@/validators/create-product.schema';
import {
  NON_BEVERAGE_PRODUCT_TYPES,
  isBeverageProductType,
} from './product-types';

const countByGroup = (group: string) =>
  hospitalityProductTypeOptions.filter((option) => option.category === group).length;

// ── Server canon (landed by the peer session on feat/plan-entitlements-billing)
// Mirror tests MUST compare against the actual landed server values, so the
// parity suite below reads server/constants/*.js at test time. If the peer has
// not landed yet, the parity block is skipped (reported as try-state) while the
// contract-line tests above still run.
const require = createRequire(import.meta.url);
const SERVER_CONSTANTS = path.resolve(
  __dirname,
  '../../../../../server/constants'
);

type ServerCanon = {
  loaded: boolean;
  allServerValues: string[];
  serverLabels: Map<string, string>;
  serverNonBeverage: string[];
};

function loadServerCanon(): ServerCanon {
  const empty: ServerCanon = {
    loaded: false,
    allServerValues: [],
    serverLabels: new Map(),
    serverNonBeverage: [],
  };
  try {
    const general = require(path.join(SERVER_CONSTANTS, 'generalProductTypes.js'));
    const product = require(path.join(SERVER_CONSTANTS, 'productTypes.js'));
    const serverLabels = new Map<string, string>();
    const addObjects = (list: Array<{ value: string; label?: string }>) =>
      list?.forEach?.((entry) => {
        if (entry?.value) serverLabels.set(entry.value, String(entry.label ?? ''));
      });
    // generalProductTypes.js: generalTypes + retailTypes + hospitalityTypes +
    // foodserviceTypes (landed by the peer 2026-11-02).
    for (const key of [
      'generalTypes',
      'retailTypes',
      'hospitalityTypes',
      'foodserviceTypes',
    ]) {
      addObjects(general?.[key]);
    }
    const allServerValues = new Set<string>([
      ...serverLabels.keys(),
      ...(product?.PRODUCT_TYPE_VALUES ?? []),
      ...(general?.generalTypes?.map((t: { value: string }) => t.value) ?? []),
      ...(product?.expandedProductTypeValues ?? []),
      // Fallback against alternative landing shapes (plain string arrays).
      ...(product?.NON_BEVERAGE_TYPES ?? []),
    ]);
    return {
      loaded: true,
      allServerValues: [...allServerValues],
      serverLabels,
      serverNonBeverage: product?.NON_BEVERAGE_TYPES ?? [],
    };
  } catch {
    return empty;
  }
}

let serverCanon: ServerCanon;

describe('hospitality/foodservice product types (contract + server mirror)', () => {
  beforeEach(() => {
    serverCanon = loadServerCanon();
  });

  it('registers 14 foodservice and 10 hospitality types', () => {
    expect(countByGroup('Foodservice')).toBe(14);
    expect(countByGroup('Hospitality')).toBe(10);
    expect(hospitalityProductTypeValues).toHaveLength(24);
  });

  it('uses the contract labels exactly', () => {
    expect(hospitalityProductTypeOptions.map((o) => o.label)).toEqual([
      'Fresh Produce',
      'Meat & Poultry',
      'Seafood',
      'Dairy & Eggs',
      'Bakery & Bread',
      'Dry Goods & Staples',
      'Frozen Foods',
      'Condiments & Spices',
      'Disposables & Packaging',
      'Cleaning Chemicals & Sanitisers',
      'Commercial Kitchen Smallwares',
      'Tabletop & Bar Service',
      'Janitorial Supplies',
      'Commercial Kitchen & Bar Equipment',
      'Shisha & Hookah',
      'Shisha Flavour (Molasses)',
      'Charcoal & Heating',
      'Cigars & Tobacco',
      'Shisha Parts & Accessories',
      'Cigar Cutters & Lighters',
      'Humidors & Cigar Cases',
      'Venue Apparel',
      'Branded Drinkware',
      'Venue Gift Packs',
    ]);
  });

  it('offers and accepts every hospitality value in both product flows', () => {
    for (const value of hospitalityProductTypeValues) {
      expect(productTypes.some((option) => option.value === value)).toBe(true);
      expect(tenantTypes.some((option) => option.value === value)).toBe(true);
      expect(productFormSchema.shape.type.safeParse(value).success).toBe(true);
    }
  });

  it('hides beverage-info for all catering types in both flows (non-beverage mirror)', () => {
    for (const value of hospitalityProductTypeValues) {
      expect(NON_BEVERAGE_PRODUCT_TYPES.has(value)).toBe(true);
      expect(isBeverageProductType(value)).toBe(false);
    }
    // displaySteps in the product create/edit form is driven by
    // isBeverageProductType via NON_BEVERAGE_PRODUCT_TYPES — so the Beverage
    // Info step is filtered out for every hospitality type exactly the way it
    // is for the retail verticals.
    const nonAlcoholicShouldStay = isBeverageProductType('juice');
    expect(nonAlcoholicShouldStay).toBe(true);
  });

  it('names the age-restricted subset without adding a new client gate', () => {
    expect(AGE_RESTRICTED_HOSPITALITY_TYPES).toHaveLength(3);
    for (const value of AGE_RESTRICTED_HOSPITALITY_TYPES) {
      expect(hospitalityProductTypeValues).toContain(value);
    }
  });

  describe.skipIf(!loadServerCanon().loaded)(
    'server parity (compare against landed server values)',
    () => {
      beforeEach(() => {
        serverCanon = loadServerCanon();
      });

      it('every client value is registered server-side and is non-beverage', () => {
        expect(serverCanon.loaded).toBe(true);
        for (const value of hospitalityProductValueList()) {
          expect(serverCanon.allServerValues).toContain(value);
          // Server NON_BEVERAGE_TYPES authority: drink-only UI must stay hidden
          expect(serverCanon.serverNonBeverage).toContain(value);
        }
      });

      it('every client label matches the server label for the same value', () => {
        for (const option of hospitalityProductTypeOptions) {
          const serverLabel = serverCanon.serverLabels.get(option.value);
          if (serverLabel && serverLabel !== '') {
            expect(serverLabel).toBe(option.label);
          }
        }
      });

      it('server has no extra hospitality_* or foodservice_* types the client lacks', () => {
        const clientValues = new Set<string>(hospitalityProductValueList());
        for (const value of serverCanon.allServerValues) {
          const isNewVertical =
            value.startsWith('hospitality_') || value.startsWith('foodservice_');
          if (isNewVertical) expect(clientValues.has(value)).toBe(true);
        }
      });
    }
  );
});

function hospitalityProductValueList(): string[] {
  return [...hospitalityProductTypeValues];
}
