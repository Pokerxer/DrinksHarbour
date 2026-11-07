import { expect, it } from 'vitest';
import { buildOverrides } from './pricing';
import { inspectRows } from './workspace';
import type { PriceLine, ReviewListing } from './types';
import { tenantFormSchema } from '@/validators/create-tenant.schema';
const listing: ReviewListing = {
  _id: 'sp',
  status: 'active',
  tenant: {
    revenueModel: 'selling_price_markup',
    sellingPriceMarkupPercentage: 20,
  },
};
const line: PriceLine = {
  id: 'base',
  label: 'Base',
  currency: 'NGN',
  packThreshold: null,
  pricing: {
    revenueModel: 'selling_price_markup',
    tenantSellingPrice: 100000,
    platformCostPrice: 100000,
    platformSellingPrice: 125000,
    costPrice: 90000,
  },
};
it('accepts selling-price markup default including explicit zero, rejects invalid rates', () => {
  expect(
    tenantFormSchema.safeParse({
      name: 'Shop',
      slug: 'shop',
      revenueModel: 'selling_price_markup',
      sellingPriceMarkupPercentage: 20,
    }).success
  ).toBe(true);
  for (const rate of [-1, 501, Infinity])
    expect(
      tenantFormSchema.safeParse({
        name: 'Shop',
        slug: 'shop',
        sellingPriceMarkupPercentage: rate,
      }).success
    ).toBe(false);
});
it('default reset sends an explicit reset instead of freezing the suggested amount', () => {
  const draft = { normal: '120000', pack: '', inherit: 'true' };
  expect(buildOverrides([line], { base: draft }, listing)).toEqual({
    useTenantDefault: true,
  });
  expect(buildOverrides([{ ...line, id: 's' }], { s: draft }, listing)).toEqual(
    { sizes: [{ id: 's', useTenantDefault: true }] }
  );
});
it('reset remains dirty even when current override matches current tenant default', () => {
  const draft = { normal: '125000', pack: '', inherit: 'true' };
  expect(
    inspectRows([line], { base: draft }, listing, {
      platform: '',
      tenant: '',
    })[0].changed
  ).toBe(true);
});
