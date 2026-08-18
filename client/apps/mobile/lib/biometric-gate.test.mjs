import { beforeEach, describe, expect, test, vi } from 'vitest';

let hasHardware = true;
let isEnrolled = true;
let authResult = { success: true };
let throwOn = null;

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(async () => {
    if (throwOn === 'hardware') throw new Error('module unavailable');
    return hasHardware;
  }),
  isEnrolledAsync: vi.fn(async () => {
    if (throwOn === 'enrolled') throw new Error('module unavailable');
    return isEnrolled;
  }),
  authenticateAsync: vi.fn(async () => {
    if (throwOn === 'authenticate') throw new Error('module unavailable');
    return authResult;
  }),
}));

const { shouldPrompt, readCapability, authenticate } = await import('./biometric-gate.ts');

describe('shouldPrompt', () => {
  // The full truth table. A device check cannot be run on this machine — there
  // is no simulator and no Android SDK — so the decision is a pure function
  // and this is the part that is actually verified.
  const cases = [
    [{ hasHardware: true, isEnrolled: true }, true, true],
    [{ hasHardware: true, isEnrolled: true }, false, false],
    [{ hasHardware: true, isEnrolled: false }, true, false],
    [{ hasHardware: false, isEnrolled: true }, true, false],
    [{ hasHardware: false, isEnrolled: false }, true, false],
    [{ hasHardware: false, isEnrolled: false }, false, false],
  ];

  for (const [cap, optedIn, expected] of cases) {
    test(`hardware=${cap.hasHardware} enrolled=${cap.isEnrolled} optedIn=${optedIn} → ${expected}`, () => {
      expect(shouldPrompt(cap, optedIn)).toBe(expected);
    });
  }
});

describe('readCapability', () => {
  beforeEach(() => {
    hasHardware = true;
    isEnrolled = true;
    throwOn = null;
  });

  test('reports what the device says', async () => {
    hasHardware = true;
    isEnrolled = false;
    expect(await readCapability()).toEqual({ hasHardware: true, isEnrolled: false });
  });

  // Biometrics must never produce a lockout. A module that throws has to read
  // as "no biometrics", which routes to password login — not as an error the
  // caller has to handle.
  test('a throwing native module reads as no capability', async () => {
    throwOn = 'hardware';
    expect(await readCapability()).toEqual({ hasHardware: false, isEnrolled: false });
  });
});

describe('authenticate', () => {
  beforeEach(() => {
    authResult = { success: true };
    throwOn = null;
  });

  test('true when the prompt succeeds', async () => {
    expect(await authenticate()).toBe(true);
  });

  test('false when the user cancels', async () => {
    authResult = { success: false, error: 'user_cancel' };
    expect(await authenticate()).toBe(false);
  });

  test('false rather than a throw when the module fails', async () => {
    throwOn = 'authenticate';
    expect(await authenticate()).toBe(false);
  });
});
