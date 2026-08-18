import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
}

/**
 * Pure. This is the whole decision, and the only part testable on a machine
 * with no simulator and no Android SDK.
 */
export function shouldPrompt(cap: BiometricCapability, userOptedIn: boolean): boolean {
  return cap.hasHardware && cap.isEnrolled && userOptedIn;
}

/**
 * Never throws. Design §4 requires that biometrics can never lock anyone out,
 * so an unavailable module has to read as "no biometrics" — which routes to
 * password login — rather than as an error every caller must handle.
 */
export async function readCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return { hasHardware, isEnrolled };
  } catch {
    return { hasHardware: false, isEnrolled: false };
  }
}

/** Never throws. A cancel, a failure and a broken module are all just `false`. */
export async function authenticate(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock DrinksHarbour',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return result.success === true;
  } catch {
    return false;
  }
}
