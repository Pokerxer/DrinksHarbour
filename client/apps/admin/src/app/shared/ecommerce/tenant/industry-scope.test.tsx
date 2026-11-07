// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { LegalFields } from './form-legal';
import {
  BUSINESS_TYPE_OPTIONS,
  INDUSTRIES_EDIT_OPTIONS,
} from './form-options';
import { tenantFormValues } from './tenant-form-values';
import { businessTypeValues, tenantFormSchema } from '@/validators/create-tenant.schema';
import type { AdminTenant } from '@/services/tenant.service';
import { INDUSTRIES } from '@/utils/industries';

afterEach(cleanup);

function Form({
  defaultValues,
  withTenant = false,
}: {
  defaultValues: Record<string, unknown>;
  withTenant?: boolean;
}) {
  const methods = useForm<any>({ defaultValues });
  return (
    <FormProvider {...methods}>
      {withTenant && <LegalFields />}
      <output aria-label="Current industries">
        {JSON.stringify(methods.watch('industries') ?? [])}
      </output>
    </FormProvider>
  );
}

const LEGACY_VALUES = [
  'Wine Merchant',
  'Spirit Importer',
  'Beverage Brand',
  'Liquor Store',
  'Bar / Lounge',
  // Server enum has ALWAYS allowed 'Nightclub / Club' — the client validator
  // historically dropped it and admin edits of such tenants failed. Re-pinned
  // after the 2026-11-02 fix so it can never regress.
  'Nightclub / Club',
  'Restaurant',
  'Hotel',
  'Distributor',
  'Other',
] as const;

const NEW_BUSINESS_TYPES = [
  'Fashion Retail',
  'Electronics Retail',
  'Beauty & Skincare',
  'Home & Living',
  'General Retail',
] as const;

describe('tenant editor industry taxonomy scope (additive 2026-11-02)', () => {
  it('extends the business-type options additively, legacy options verbatim', () => {
    expect(businessTypeValues.slice(0, 10)).toEqual(LEGACY_VALUES);
    expect(businessTypeValues.slice(10)).toEqual(NEW_BUSINESS_TYPES);
    for (const value of businessTypeValues.slice(-5)) {
      expect(BUSINESS_TYPE_OPTIONS.some((o) => o.value === value)).toBe(true);
    }
  });

  it('offers every canonical industry in the industries editor', () => {
    expect(INDUSTRIES_EDIT_OPTIONS.map((o) => o.value)).toEqual([
      'beverage',
      'hospitality',
      'food-service',
      'electronics',
      'fashion',
      'beauty',
      'home',
    ]);
    for (const value of INDUSTRIES) {
      const parsed = tenantFormSchema.safeParse({
        name: 'Acme Liquors',
        slug: 'acme-liquors',
        industries: [value],
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('accepts an empty profile (legacy) and rejects unknown industries', () => {
    expect(
      tenantFormSchema.safeParse({ name: 'Acme', slug: 'acme', industries: [] })
        .success
    ).toBe(true);
    expect(
      tenantFormSchema.safeParse({ name: 'Acme', slug: 'acme' }).success
    ).toBe(true);
    const bad = tenantFormSchema.safeParse({
      name: 'Acme',
      slug: 'acme',
      industries: ['software'],
    });
    expect(bad.success).toBe(false);
  });

  it('shows the industries editor only with a business type or a saved profile', () => {
    // Without a business type and no saved industries the field stays hidden
    const plain = render(<Form defaultValues={{ industries: [] }} withTenant />);
    expect(plain.queryByLabelText('Industries')).toBeNull();
    expect(plain.getByLabelText('Current industries').textContent).toBe('[]');
    plain.unmount();

    const businessTyped = render(
      <Form
        defaultValues={{
          businessType: 'Wine Merchant',
          industries: [],
        }}
        withTenant
      />
    );
    expect(businessTyped.getByLabelText('Industries')).not.toBeNull();
    businessTyped.unmount();
  });

  it('prefills tenant edit values from the saved profile', () => {
    const tenant = {
      businessType: 'Fashion Retail',
      industries: ['fashion'],
    } as AdminTenant;
    expect(tenantFormValues(tenant).industries).toEqual(['fashion']);
    // Legacy tenants without the additive field keep an empty profile.
    expect(tenantFormValues({ name: 'x' } as AdminTenant).industries).toEqual(
      []
    );
  });
});
