import { describe, expect, test } from 'vitest';

const {
  validateEmail,
  validatePassword,
  validateName,
  validatePhoneNumber,
  validateVerificationCode,
  validateLoginForm,
  validateRegisterForm,
  validateResetForm,
  toUserMessage,
} = await import('./auth-forms.ts');

describe('validatePassword', () => {
  test('accepts a password the server accepts', () => {
    expect(validatePassword('Str0ng!Pass')).toBeNull();
  });

  // The server rule is /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  // — unanchored, with no + or $, so it constrains only the first character
  // after the lookaheads. The obvious anchored rewrite would reject passwords
  // the server happily accepts, locking users out of their own account on the
  // reset screen. Mirror the server; never tighten it.
  test('accepts characters outside the server class after the first position', () => {
    expect(validatePassword('Str0ng!Pass✓')).toBeNull();
  });

  test('rejects a password under 8 characters', () => {
    expect(validatePassword('Ab1!def')).toMatch(/8 characters/);
  });

  test('rejects a password with no uppercase', () => {
    expect(validatePassword('str0ng!pass')).toMatch(/uppercase/);
  });

  test('rejects a password with no digit', () => {
    expect(validatePassword('Strong!Pass')).toMatch(/number/);
  });

  test('rejects a password with no special character', () => {
    expect(validatePassword('Str0ngPass')).toMatch(/special/);
  });
});

describe('validateEmail', () => {
  test('accepts an ordinary address', () => {
    expect(validateEmail('ada@example.com')).toBeNull();
  });

  test('rejects a missing @', () => {
    expect(validateEmail('ada.example.com')).toMatch(/valid email/);
  });

  test('rejects an empty value', () => {
    expect(validateEmail('')).toMatch(/valid email/);
  });
});

describe('validateName', () => {
  // Nothing on the server enforces this — validate is inert at all 109 route
  // positions, and registerUser calls firstName.trim() unguarded, so an empty
  // value 500s rather than returning a message.
  test('rejects an empty name', () => {
    expect(validateName('', 'First name')).toBe('First name is required');
  });

  test('rejects a name over 50 characters', () => {
    expect(validateName('a'.repeat(51), 'Last name')).toMatch(/50 characters/);
  });

  test('accepts a normal name', () => {
    expect(validateName('Adaeze', 'First name')).toBeNull();
  });
});

describe('validatePhoneNumber', () => {
  test('is optional — an empty value is fine', () => {
    expect(validatePhoneNumber('')).toBeNull();
  });

  test('accepts the local format', () => {
    expect(validatePhoneNumber('07035609301')).toBeNull();
  });

  test('accepts the international format', () => {
    expect(validatePhoneNumber('+2347035609301')).toBeNull();
  });

  test('rejects a number that is not Nigerian', () => {
    expect(validatePhoneNumber('12025550123')).toMatch(/Nigerian/);
  });
});

describe('validateVerificationCode', () => {
  test('accepts six digits', () => {
    expect(validateVerificationCode('483920')).toBeNull();
  });

  test('rejects five digits', () => {
    expect(validateVerificationCode('48392')).toMatch(/6 digits/);
  });

  test('rejects six non-digits', () => {
    expect(validateVerificationCode('4839ab')).toMatch(/6 digits/);
  });
});

describe('form validators', () => {
  test('a valid login form has no errors', () => {
    expect(validateLoginForm({ email: 'ada@example.com', password: 'Str0ng!Pass' })).toEqual({});
  });

  test('login reports both fields at once', () => {
    const errors = validateLoginForm({ email: 'nope', password: '' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'password']);
  });

  test('a valid register form has no errors', () => {
    expect(
      validateRegisterForm({
        firstName: 'Ada',
        lastName: 'Obi',
        email: 'ada@example.com',
        password: 'Str0ng!Pass',
        phoneNumber: '',
        dateOfBirth: '',
      })
    ).toEqual({});
  });

  test('register reports every bad field', () => {
    const errors = validateRegisterForm({
      firstName: '',
      lastName: '',
      email: 'nope',
      password: 'weak',
      phoneNumber: '12025550123',
      dateOfBirth: '',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'password',
      'phoneNumber',
    ]);
  });

  test('reset requires the two passwords to match', () => {
    const errors = validateResetForm({
      newPassword: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pasz',
    });
    expect(errors.confirmPassword).toMatch(/match/);
  });

  test('a matching valid reset has no errors', () => {
    expect(
      validateResetForm({ newPassword: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' })
    ).toEqual({});
  });
});

describe('toUserMessage', () => {
  test('a transport failure names the connection, not a status code', () => {
    expect(toUserMessage(null, null)).toMatch(/connection/i);
  });

  // The throttle messages already name the wait. Login is 20/15min, register
  // and forgot-password 5/hr, MFA verify 10/15min, refresh 30/15min — per IP,
  // so ordinary users behind carrier NAT reach them.
  test('429 passes the server throttle message through', () => {
    const msg = toUserMessage(429, {
      message: 'Too many login attempts from this IP. Please try again later.',
    });
    expect(msg).toBe('Too many login attempts from this IP. Please try again later.');
  });

  // Lockout carries a countdown and is a different failure from a wrong
  // password. Flattening both into "login failed" hides the wait.
  test('403 lockout passes through verbatim', () => {
    const msg = toUserMessage(403, {
      message: 'Account is locked due to multiple failed login attempts. Try again in 12 minutes.',
    });
    expect(msg).toMatch(/12 minutes/);
  });

  test('400 uses the server message', () => {
    expect(toUserMessage(400, { message: 'Invalid email or password' })).toBe(
      'Invalid email or password'
    );
  });

  test('a status with no message never leaks a bare status code', () => {
    const msg = toUserMessage(500, {});
    expect(msg).not.toMatch(/500/);
    expect(msg.length).toBeGreaterThan(0);
  });
});
