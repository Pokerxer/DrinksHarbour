import { describe, expect, test, vi } from 'vitest';

/**
 * The bug this pins down: every image in the app was invisible.
 *
 * NativeWind only turns `className` into `style` for components it has been
 * told about. `react-native-css-interop` registers the RN core components and
 * exactly one third-party library (react-native-safe-area-context) — NOT
 * `expo-image`, and NOT `expo-linear-gradient`. So `className` on either was
 * passed down as an unknown prop and dropped on the floor.
 *
 * Every RemoteImage call site sizes itself with className alone (`h-full w-full`,
 * `h-40 w-full`, `h-6 w-6`, `h-80 w-full`), so dropping it left each image with
 * no width and no height — laid out at zero, painting nothing. The `!uri`
 * placeholder is a plain <View>, which IS registered, which is why the grey
 * plates showed while the photographs never did.
 */

const calls = [];
const IMAGE = { __id: 'expo-image/Image' };
const LINEAR_GRADIENT = { __id: 'expo-linear-gradient/LinearGradient' };

vi.mock('nativewind', () => ({
  cssInterop: vi.fn((component, mapping) => void calls.push({ component, mapping })),
}));
vi.mock('expo-image', () => ({ Image: IMAGE }));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: LINEAR_GRADIENT }));

await import('./nativewind-interop.ts');

describe('nativewind interop registration', () => {
  test('teaches NativeWind that expo-image accepts className', () => {
    const entry = calls.find((c) => c.component === IMAGE);
    expect(entry, 'expo-image was never registered — every image renders at zero size').toBeTruthy();
    expect(entry.mapping).toEqual({ className: 'style' });
  });

  test('teaches NativeWind that expo-linear-gradient accepts className', () => {
    const entry = calls.find((c) => c.component === LINEAR_GRADIENT);
    expect(entry, 'expo-linear-gradient was never registered').toBeTruthy();
    expect(entry.mapping).toEqual({ className: 'style' });
  });

  test('registers on import alone, so importing it once at the root is enough', () => {
    // No exported setup function to forget to call.
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
