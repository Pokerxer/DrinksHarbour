import { z } from 'zod';
import { messages } from '@/config/messages';
import { validateEmail, validatePassword, validateConfirmPassword,
} from '@/utils/validators/common-rules';

const resetPasswordSchemaBase = z.object({ 
  email: validateEmail,
  password: validatePassword, 
  confirmPassword: validateConfirmPassword, 
});

export const resetPasswordSchema = resetPasswordSchemaBase
  .refine((data) => data.password === data.confirmPassword, { 
    message: messages.passwordsDidNotMatch,
    path: ['confirmPassword'],
  });

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
