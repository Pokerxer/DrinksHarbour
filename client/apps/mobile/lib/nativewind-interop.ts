import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

/**
 * Teach NativeWind about the two third-party components this app renders.
 *
 * NativeWind does not turn `className` into `style` for arbitrary components —
 * it only does so for ones registered with `cssInterop`. `react-native-css-interop`
 * ships registrations for the React Native core components and for exactly one
 * third-party library, `react-native-safe-area-context`. Anything else receives
 * `className` as an unrecognised prop and silently ignores it.
 *
 * That is not a cosmetic loss. Every `<RemoteImage>` gets its dimensions from
 * className alone (`h-full w-full`, `h-40 w-full`, `h-6 w-6`, `h-80 w-full`), so
 * an unregistered `expo-image` laid out at zero by zero and painted nothing —
 * while the `!uri` fallback, a plain `<View>`, kept rendering its grey plate.
 * The result was a store with no product photography anywhere in it.
 *
 * Imported for side effect from `app/_layout.tsx`, the root of the router, so
 * registration happens before any screen mounts. There is deliberately no
 * exported function: an import cannot be half-applied the way a forgotten
 * `setup()` call can.
 */

cssInterop(Image, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });
