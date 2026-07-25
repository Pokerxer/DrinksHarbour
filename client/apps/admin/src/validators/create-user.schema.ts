import { z } from 'zod';
import { messages } from '@/config/messages';
import { validateEmail } from './common-rules';
import {
  ASSIGNABLE_ROLES,
  TENANT_SCOPED_ROLES,
} from '@/services/adminUser.service';

// Mirrors the server-side rules on POST /api/users so the operator sees the
// problem before the round trip rather than after it. The template's
// `permissions` and `status` fields are gone: permissions are derived from the
// role (ROLE_PERMISSIONS) and the service always creates an active user.
export const createUserSchema = z
  .object({
    firstName: z.string().min(1, { message: 'First name is required' }).max(50),
    lastName: z.string().min(1, { message: 'Last name is required' }).max(50),
    email: validateEmail,
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        {
          message:
            'Password needs an uppercase letter, a lowercase letter, a number and a special character',
        }
      ),
    role: z
      .string()
      .min(1, { message: messages.roleIsRequired })
      .refine((role) => ASSIGNABLE_ROLES.includes(role as never), {
        message: messages.roleIsRequired,
      }),
    tenant: z.string().optional(),
  })
  // Tenant-scoped roles are rejected server-side without a tenant to scope them
  // to, so ask for one up front.
  .refine(
    (data) =>
      !TENANT_SCOPED_ROLES.includes(data.role as never) || !!data.tenant,
    { message: 'Select a tenant for this role', path: ['tenant'] }
  );

// generate form types from zod validation schema
export type CreateUserInput = z.infer<typeof createUserSchema>;
