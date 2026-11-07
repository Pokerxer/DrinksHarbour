import type { CatalogBusiness } from '@/utils/catalog-business';

export type BusinessVariant = {
  _id?: string;
  size?: string;
  displayName?: string;
  colorName?: string;
  optionName?: string;
  unitType?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    diameter?: number;
  };
  shelfLifeDays?: number;
  volumeMl?: number;
  weightGrams?: number;
  unitsPerPack?: number;
  minOrderQuantity?: number;
  servingsPerUnit?: number;
  venueServing?: { saleUnit?: string; mode?: string };
};

const positive = (value?: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function businessVariantFacts(
  size: BusinessVariant,
  business: CatalogBusiness
): string[] {
  const facts: string[] = [];
  if (size.optionName) facts.push(size.optionName);
  if (size.unitType) facts.push(`Unit: ${size.unitType.replaceAll('_', ' ')}`);
  if (positive(size.unitsPerPack))
    facts.push(`${size.unitsPerPack} units per pack`);

  if (
    ['beverage', 'beauty', 'food-service', 'hospitality'].includes(business)
  ) {
    if (positive(size.volumeMl)) facts.push(`${size.volumeMl} ml`);
    if (positive(size.weightGrams)) facts.push(`${size.weightGrams} g`);
  }
  if (
    ['home', 'electronics', 'fashion', 'food-service', 'hospitality'].includes(
      business
    )
  ) {
    const measurements = Object.entries(size.dimensions || {})
      .filter(([, value]) => positive(value))
      .map(([axis, value]) => `${axis}: ${value}`);
    if (measurements.length)
      facts.push(`Dimensions (cm): ${measurements.join(' · ')}`);
  }
  if (
    ['beauty', 'food-service'].includes(business) &&
    positive(size.shelfLifeDays)
  ) {
    facts.push(`Shelf life: ${size.shelfLifeDays} days`);
  }
  if (
    ['food-service', 'hospitality'].includes(business) &&
    positive(size.minOrderQuantity)
  ) {
    facts.push(`Minimum order: ${size.minOrderQuantity}`);
  }
  if (['beverage', 'food-service', 'hospitality'].includes(business)) {
    if (positive(size.servingsPerUnit))
      facts.push(`${size.servingsPerUnit} servings per unit`);
    if (size.venueServing?.saleUnit)
      facts.push(
        `Served by the ${size.venueServing.saleUnit.replaceAll('_', ' ')}`
      );
  }
  return facts;
}
