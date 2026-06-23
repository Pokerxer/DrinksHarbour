import { z } from 'zod';

// Request a password-reset email — only an email is needed.
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
