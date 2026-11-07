import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { legacyBeverageTypeOptions } from './legacy-beverage-types';
import { productTypes } from '@/app/shared/ecommerce/product/create-edit/form-utils';
const require = createRequire(import.meta.url);
const {
  legacyBeverageTypes,
  legacyAlcoholicTypes,
} = require('../../../../../server/constants/legacyBeverageTypes');

describe('legacy beverage choices', () => {
  it('mirrors the server vocabulary and alcohol classification', () => {
    expect(
      legacyBeverageTypeOptions.map((option) => option.value).sort()
    ).toEqual([...legacyBeverageTypes].sort());
    expect(
      legacyBeverageTypeOptions
        .filter((option) => option.category === 'Alcoholic')
        .map((option) => option.value)
        .sort()
    ).toEqual([...legacyAlcoholicTypes].sort());
  });
  it('offers every legacy value once in the editor', () => {
    for (const value of legacyBeverageTypes)
      expect(
        productTypes.filter((option) => option.value === value)
      ).toHaveLength(1);
  });
});

it('accepts legacy types in product form validation', async () => {
  const { productFormSchema } = await import(
    '@/validators/create-product.schema'
  );
  for (const type of ['champagne', 'lager', 'whisky', 'oat_milk']) {
    const result = productFormSchema.safeParse({ type });
    if (!result.success)
      expect(
        result.error.issues.filter((issue) => issue.path[0] === 'type')
      ).toEqual([]);
  }
});
