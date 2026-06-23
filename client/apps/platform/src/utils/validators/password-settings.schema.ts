import { z } from 'zod';
import { messages } from '@/config/messages';
import { validatePassword, validateNewPassword, validateConfirmPassword,
} from '@/utils/validators/common-rules';

const passwordFormSchemaBase = z.object({ 
  currentPassword: validatePassword,
  newPassword: validateNewPassword, 
  confirmedPassword: validateConfirmPassword, 
});

export const passwordFormSchema = passwordFormSchemaBase
  .refine((data) => data.newPassword === data.confirmedPassword, { 
    message: messages.passwordsDidNotMatch,
    path: ['confirmedPassword'],
  });

export type PasswordFormTypes = z.infer<typeof passwordFormSchema>;
