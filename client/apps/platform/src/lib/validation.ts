// Shared auth validation helpers — used by login, register, forgot-password,
// reset-password, verify-email, and my-account/security so password strength
// and email-format rules are consistent across every auth surface.

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// At least 8 chars, one upper, one lower, one digit, one special (@$!%*?&)
export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export const STRONG_PASSWORD_RULE =
  'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)';

export function validateEmail(email: string): string | null {
  if (!email || !email.trim()) return 'Email is required';
  if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
  return null;
}

export function validateStrongPassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!strongPasswordRegex.test(password)) return STRONG_PASSWORD_RULE;
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

// Convert any Nigerian phone format to E.164 (+234XXXXXXXXXX)
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234')) return `+${digits}`;          // already international
  if (digits.startsWith('0'))   return `+234${digits.slice(1)}`; // local 0XXXXXXXXXX
  return `+234${digits}`;                                       // bare XXXXXXXXXX
}

export function validateNigerianPhone(raw: string): string | null {
  if (!raw) return null; // optional field
  const digits = raw.replace(/\D/g, '');
  if (!/^\+?234[7-9][01]\d{8}$/.test(`+${digits}`) && !/^0[7-9][01]\d{8}$/.test(raw)) {
    return 'Please enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)';
  }
  return null;
}

// Password strength meter (0–4): length, lower+upper, digit, special
export function getPasswordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[@$!%*?&]/.test(password)) score++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}