import { industriesForProductType, type Industry } from './industries';
import { isBeverageProductType } from './product-types';
import { legacyBeverageTypeOptions } from './legacy-beverage-types';
import { expandedProductTypeOptions } from './expanded-product-types';

export type CatalogBusiness = Industry | 'all';
export const businessPresentation: Record<
  CatalogBusiness,
  { title: string; description: string; variants: string; fields: string[] }
> = {
  all: {
    title: 'Product catalog',
    description: 'Manage products across your businesses.',
    variants: 'Product options',
    fields: ['producer', 'originCountry'],
  },
  beverage: {
    title: 'Beverages',
    description: 'Browse drinks by style, origin and bottle or serving size.',
    variants: 'Bottles & serving sizes',
    fields: [
      'subType',
      'style',
      'producer',
      'originCountry',
      'region',
      'abv',
      'ingredients',
      'allergens',
    ],
  },
  beauty: {
    title: 'Beauty & Personal Care',
    description:
      'Organize skincare, cosmetics and personal care by formulation and available shades or pack sizes.',
    variants: 'Shades & pack sizes',
    fields: ['subType', 'ingredients', 'producer', 'originCountry'],
  },
  home: {
    title: 'Home & Living',
    description:
      'Organize furniture, décor and household essentials by collection and available sizes or finishes.',
    variants: 'Sizes & finishes',
    fields: ['subType', 'style', 'producer', 'originCountry'],
  },
  electronics: {
    title: 'Electronics',
    description:
      'Browse devices and accessories by product family and available configurations.',
    variants: 'Configurations & colors',
    fields: ['subType', 'producer', 'originCountry'],
  },
  fashion: {
    title: 'Fashion',
    description:
      'Organize clothing, footwear and accessories by style, size and color.',
    variants: 'Sizes & colors',
    fields: ['subType', 'style', 'producer', 'originCountry'],
  },
  'food-service': {
    title: 'Food Service Procurement',
    description:
      'Manage ingredients, kitchen supplies and equipment by purchasing unit and pack size.',
    variants: 'Purchase units & packs',
    fields: ['subType', 'ingredients', 'allergens', 'originCountry'],
  },
  hospitality: {
    title: 'Hospitality & Venue',
    description:
      'Manage guest amenities, linens and venue supplies by format and replenishment pack.',
    variants: 'Formats & replenishment packs',
    fields: ['subType', 'style', 'producer', 'originCountry'],
  },
};
const labels: Record<string, string> = {
  subType: 'Product family',
  style: 'Style / collection',
  producer: 'Manufacturer / producer',
  originCountry: 'Country of origin',
  region: 'Region',
  abv: 'ABV',
  ingredients: 'Ingredients',
  allergens: 'Allergens',
};
const knownBeverages = new Set(
  [...legacyBeverageTypeOptions, ...expandedProductTypeOptions].map(
    (option) => option.value
  )
);
export function catalogBusiness(type?: string | null): CatalogBusiness {
  return (
    industriesForProductType(type) ??
    (type && knownBeverages.has(type) && isBeverageProductType(type)
      ? 'beverage'
      : 'all')
  );
}
export function matchesBusiness(
  type: string | null | undefined,
  business: CatalogBusiness
): boolean {
  return business === 'all' || catalogBusiness(type) === business;
}
export function businessFacts(
  product: Record<string, unknown>
): [string, string][] {
  const business = catalogBusiness(
    typeof product.type === 'string' ? product.type : undefined
  );
  const facts: [string, string][] = businessPresentation[business].fields.map(
    (key) => {
      const raw = product[key];
      const value = Array.isArray(raw)
        ? raw.filter((v) => typeof v === 'string').join(', ')
        : typeof raw === 'number'
          ? `${raw}${key === 'abv' ? '%' : ''}`
          : typeof raw === 'string'
            ? raw.trim()
            : '';
      return [labels[key], value || 'Not recorded'];
    }
  );
  if (business === 'beverage') {
    const { volumeMl, vintage, ageStatement, flavorProfile, foodPairings } =
      product;
    if (typeof volumeMl === 'number' && volumeMl > 0)
      facts.push(['Volume', `${volumeMl} ml`]);
    if (typeof vintage === 'number' && vintage > 0)
      facts.push(['Vintage', String(vintage)]);
    if (typeof ageStatement === 'string' && ageStatement.trim())
      facts.push(['Age statement', ageStatement.trim()]);
    for (const [label, values] of [
      ['Flavour profile', flavorProfile],
      ['Food pairings', foodPairings],
    ] as const) {
      if (!Array.isArray(values)) continue;
      const value = values
        .filter((item) => typeof item === 'string' && item.trim())
        .join(', ');
      if (value) facts.push([label, value]);
    }
  }
  return facts;
}
