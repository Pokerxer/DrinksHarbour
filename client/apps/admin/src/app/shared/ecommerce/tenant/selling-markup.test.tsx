// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { RevenueFields } from './form-revenue';
import { tenantFormValues } from './tenant-form-values';
import type { TenantFormInput } from '@/validators/create-tenant.schema';
import type { AdminTenant } from '@/services/tenant.service';
afterEach(cleanup);
function Form() {
  const methods = useForm<TenantFormInput>({ defaultValues: { revenueModel: 'selling_price_markup', sellingPriceMarkupPercentage: 20 } });
  return <FormProvider {...methods}><RevenueFields /><output aria-label="Current percentage">{methods.watch('sellingPriceMarkupPercentage')}</output></FormProvider>;
}
it('edits the selling-price percentage without suggesting additional commission or cost markup', () => {
  render(<Form />);
  const field = screen.getByLabelText('Selling-price markup %');
  expect((field as HTMLInputElement).value).toBe('20');
  expect(screen.queryByLabelText('Commission %')).toBeNull();
  expect(screen.queryByLabelText('Markup %')).toBeNull();
  fireEvent.change(field, { target: { value: '25' } });
  expect(screen.getByLabelText('Current percentage').textContent).toBe('25');
});
it('existing tenant edit values retain a zero default instead of replacing it with another rate', () => {
  const tenant = { revenueModel: 'selling_price_markup', sellingPriceMarkupPercentage: 0 } as AdminTenant;
  expect(tenantFormValues(tenant).sellingPriceMarkupPercentage).toBe(0);
  expect(tenantFormValues({ ...tenant, sellingPriceMarkupPercentage: 20 }).sellingPriceMarkupPercentage).toBe(20);
});
