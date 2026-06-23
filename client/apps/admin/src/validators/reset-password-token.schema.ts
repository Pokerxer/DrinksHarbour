import { z } from 'zod';

// Mirrors the server-side rules in `userService.resetPassword`:
// min 8 chars + one lowercase, one uppercase, one number, one special char.
export const resetPasswordTokenSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/\d/, 'Include at least one number')
      .regex(/[@$!%*?&]/, 'Include at least one special character (@$!%*?&)'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordTokenSchema = z.infer<typeof resetPasswordTokenSchema>;
