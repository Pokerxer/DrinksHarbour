import '../global.css';
// Side-effect import: registers expo-image and expo-linear-gradient with
// NativeWind. Without it `className` is dropped on both and every image in the
// app lays out at zero size. Must precede any screen.
import '../lib/nativewind-interop.ts';

import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureCommerceCore } from 'commerce-core';

import { setOnSessionExpired } from '../lib/api-client.ts';
import { resolveApiBaseUrl } from '../lib/api-base-url.ts';
import { AuthProvider } from '../lib/auth-context.tsx';
import { CartProvider } from '../lib/cart-context.tsx';

// A local address in .env means "the dev machine" — the literal IP written there
// goes stale every time this Mac changes network. `hostUri` is the address Expo
// is serving this bundle from, which IS the dev machine, so the host is derived
// rather than trusted. A public URL is passed through untouched.
const apiBaseUrl = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri
);

configureCommerceCore({ apiBaseUrl });

export default function RootLayout() {
  // api-client owns refresh; when it gives up, this is how the UI finds out.
  // Without it an expired session leaves a signed-in shell making requests
  // that will never succeed.
  useEffect(() => {
    setOnSessionExpired(() => router.replace('/login'));
    return () => setOnSessionExpired(null);
  }, []);

  // CartProvider nests INSIDE AuthProvider on purpose: the cart is keyed per
  // identity and reads `useAuth()` to decide whose cart to hydrate, and whose
  // to wipe when the identity changes.
  return (
    <AuthProvider>
      <CartProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </CartProvider>
    </AuthProvider>
  );
}
