import { z } from 'zod';
import { messages } from '@/config/messages';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from './common-rules';

// form zod validation schema
export const signUpSchema = z.object({
  firstName: z.string().min(1, { message: messages.firstNameRequired }),
  lastName: z.string().optional(),
  email: validateEmail,
  phoneNumber: z.string().optional().refine(
    (val) => !val || /^\+?[1-9]\d{1,14}$/.test(val),
    { message: 'Please provide a valid phone number' }
  ),
  password: validatePassword,
  confirmPassword: validateConfirmPassword,
  isAgreed: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
});

// generate form types from zod validation schema
export type SignUpSchema = z.infer<typeof signUpSchema>;
