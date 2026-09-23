import { describe, expect, it } from 'vitest';

import { createUserSchema } from './create-user.schema';

const validUser = {
  firstName: 'Ada',
  lastName: 'Okoye',
  email: 'ada@example.com',
  password: 'Strong1!',
  confirmPassword: 'Strong1!',
  role: 'tenant_admin',
  tenant: 'tenant-123',
};

describe('createUserSchema', () => {
  it('accepts matching login passwords', () => {
    expect(createUserSchema.safeParse(validUser).success).toBe(true);
  });

  it('reports a mismatched confirmation on the confirmation field', () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      confirmPassword: 'Different1!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path[0] === 'confirmPassword'
      )).toBe(true);
    }
  });
});
