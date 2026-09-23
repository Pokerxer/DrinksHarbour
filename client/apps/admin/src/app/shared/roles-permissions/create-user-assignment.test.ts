import { describe, expect, it } from 'vitest';

import { resolveCreateUserAssignment } from './create-user-assignment';

describe('resolveCreateUserAssignment', () => {
  it('locks tenant-admin creation to the tenant from the edit page', () => {
    expect(
      resolveCreateUserAssignment(
        { role: 'super_admin', tenant: 'another-tenant' },
        { role: 'tenant_admin', tenantId: 'tenant-123' }
      )
    ).toEqual({ role: 'tenant_admin', tenant: 'tenant-123' });
  });

  it('keeps the selected assignment in the general user modal', () => {
    expect(
      resolveCreateUserAssignment({ role: 'admin', tenant: undefined })
    ).toEqual({ role: 'admin', tenant: undefined });
  });
});
