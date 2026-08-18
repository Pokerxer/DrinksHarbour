/**
 * Validation and error copy for the auth screens.
 *
 * This is not decoration. validation.middleware.js:36 returns next()
 * immediately for every bare `validate` middleware — 109 route positions, 0 in
 * factory form — so express-validator's errors are discarded server-wide. The
 * service layer independently covers email format, password strength and
 * duplicate email; it does NOT cover names, phone format, or the code shape.
 * For those fields this module is the only validation in the path.
 */

export type FieldErrors = Record<string, string>;

export interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  dateOfBirth: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIGERIAN_PHONE = /^(\+?234|0)[7-9][01]\d{8}$/;
const SIX_DIGITS = /^\d{6}$/;

export function validateEmail(value: string): string | null {
  return EMAIL.test(value.trim()) ? null : 'Please provide a valid email';
}

/**
 * Mirrors the server rule, which is deliberately reproduced as separate
 * lookahead checks rather than one regex.
 *
 * The server's rule is unanchored — no `+`, no `$` — so after the four
 * lookaheads it constrains only the FIRST character. Writing the obvious
 * anchored version here would reject passwords the server accepts, which on
 * the reset screen means locking a user out of their own account.
 */
export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter';
  if (!/\d/.test(value)) return 'Password must contain a number';
  if (!/[@$!%*?&]/.test(value)) return 'Password must contain a special character (@$!%*?&)';
  if (!/^[A-Za-z\d@$!%*?&]/.test(value)) {
    return 'Password must start with a letter, number, or one of @$!%*?&';
  }
  return null;
}

export function validateName(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required`;
  if (trimmed.length > 50) return `${label} cannot exceed 50 characters`;
  return null;
}

/** Optional field: blank is valid. Anything present must be a Nigerian number. */
export function validatePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return NIGERIAN_PHONE.test(trimmed)
    ? null
    : 'Please provide a valid Nigerian phone number (e.g. 07035609301)';
}

export function validateVerificationCode(value: string): string | null {
  return SIX_DIGITS.test(value.trim()) ? null : 'The code is 6 digits';
}

function collect(entries: Array<[string, string | null]>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, message] of entries) {
    if (message) errors[field] = message;
  }
  return errors;
}

export function validateLoginForm(v: { email: string; password: string }): FieldErrors {
  return collect([
    ['email', validateEmail(v.email)],
    ['password', v.password ? null : 'Password is required'],
  ]);
}

export function validateRegisterForm(v: RegisterFormValues): FieldErrors {
  return collect([
    ['firstName', validateName(v.firstName, 'First name')],
    ['lastName', validateName(v.lastName, 'Last name')],
    ['email', validateEmail(v.email)],
    ['password', validatePassword(v.password)],
    ['phoneNumber', validatePhoneNumber(v.phoneNumber)],
  ]);
}

export function validateResetForm(v: {
  newPassword: string;
  confirmPassword: string;
}): FieldErrors {
  return collect([
    ['newPassword', validatePassword(v.newPassword)],
    [
      'confirmPassword',
      v.newPassword === v.confirmPassword ? null : 'The two passwords do not match',
    ],
  ]);
}

const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = "Can't reach DrinksHarbour. Check your connection.";

/**
 * `status` is null for a transport failure — fetch rejected, so there is no
 * response at all. Never surface a bare status code to a customer.
 */
export function toUserMessage(status: number | null, payload: unknown): string {
  if (status === null) return OFFLINE;

  const message =
    payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
      ? ((payload as { message: string }).message).trim()
      : '';

  // 429 already names the wait; 403 lockout already carries a countdown.
  return message || GENERIC;
}
