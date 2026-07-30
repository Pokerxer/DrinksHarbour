import { describe, expect, it } from 'vitest';
import { tenantFormSchema } from './create-tenant.schema';

const valid = {
  name: 'Acme Liquors',
  slug: 'acme-liquors',
};

describe('tenantFormSchema', () => {
  it('accepts a minimal tenant and applies defaults', () => {
    const result = tenantFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primaryColor).toBe('#1a202c');
      expect(result.data.enforceAgeVerification).toBe(true);
      expect(result.data.isSystemTenant).toBe(false);
    }
  });

  // The bug: the model allows growth/venue but the form's enum omitted them, so
  // editing such a tenant failed validation with no visible error and no save.
  it.each(['free_trial', 'starter', 'growth', 'pro', 'enterprise', 'venue', 'custom'])(
    'accepts the %s plan that the Tenant model allows',
    (plan) => {
      expect(tenantFormSchema.safeParse({ ...valid, plan }).success).toBe(true);
    }
  );

  it('rejects a plan the model does not define', () => {
    expect(tenantFormSchema.safeParse({ ...valid, plan: 'platinum' }).success).toBe(false);
  });

  it('treats an empty select as unset rather than an invalid enum', () => {
    const result = tenantFormSchema.safeParse({ ...valid, plan: '', businessType: '', idType: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.plan).toBeUndefined();
  });

  it('requires a rejection reason when the status is rejected', () => {
    const missing = tenantFormSchema.safeParse({ ...valid, status: 'rejected', rejectionReason: '  ' });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0].path).toEqual(['rejectionReason']);
    }

    expect(
      tenantFormSchema.safeParse({ ...valid, status: 'rejected', rejectionReason: 'Incomplete CAC docs' }).success
    ).toBe(true);
  });

  it('does not demand a rejection reason for other statuses', () => {
    expect(tenantFormSchema.safeParse({ ...valid, status: 'approved' }).success).toBe(true);
  });

  it('requires an owner name once an owner email is given', () => {
    const result = tenantFormSchema.safeParse({ ...valid, ownerEmail: 'owner@acme.com' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['ownerName']);

    expect(
      tenantFormSchema.safeParse({ ...valid, ownerEmail: 'owner@acme.com', ownerName: 'Chidi Okafor' }).success
    ).toBe(true);
  });

  it('requires a NAFDAC number only when NAFDAC applies', () => {
    expect(tenantFormSchema.safeParse({ ...valid, nafdacRequired: true }).success).toBe(false);
    expect(tenantFormSchema.safeParse({ ...valid, nafdacRequired: true, nafdacNumber: 'A1-2345' }).success).toBe(true);
    expect(tenantFormSchema.safeParse({ ...valid, nafdacRequired: false }).success).toBe(true);
  });

  it('keeps pack rates clearable with an empty string', () => {
    const result = tenantFormSchema.safeParse({
      ...valid,
      packMarkupPercentage: '',
      packCommissionPercentage: '',
      packRateMinUnits: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.packMarkupPercentage).toBe('');
  });

  it('validates CAC, TIN and account number formats but allows blanks', () => {
    expect(tenantFormSchema.safeParse({ ...valid, cacNumber: 'RC1234567' }).success).toBe(true);
    expect(tenantFormSchema.safeParse({ ...valid, cacNumber: '' }).success).toBe(true);
    expect(tenantFormSchema.safeParse({ ...valid, cacNumber: 'nope' }).success).toBe(false);

    expect(tenantFormSchema.safeParse({ ...valid, tin: '1234567890' }).success).toBe(true);
    expect(tenantFormSchema.safeParse({ ...valid, tin: '123' }).success).toBe(false);

    expect(tenantFormSchema.safeParse({ ...valid, bankAccountNumber: '0123456789' }).success).toBe(true);
    expect(tenantFormSchema.safeParse({ ...valid, bankAccountNumber: '123' }).success).toBe(false);
  });

  it('rejects a malformed slug', () => {
    expect(tenantFormSchema.safeParse({ ...valid, slug: 'Acme Liquors' }).success).toBe(false);
    expect(tenantFormSchema.safeParse({ ...valid, slug: 'acme-liquors-2' }).success).toBe(true);
  });
});
