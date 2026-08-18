import '../global.css';

import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureCommerceCore } from 'commerce-core';

import { setOnSessionExpired } from '../lib/api-client.ts';
import { AuthProvider } from '../lib/auth-context.tsx';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set — copy .env.example to .env and set it'
  );
}

configureCommerceCore({ apiBaseUrl });

export default function RootLayout() {
  // api-client owns refresh; when it gives up, this is how the UI finds out.
  // Without it an expired session leaves a signed-in shell making requests
  // that will never succeed.
  useEffect(() => {
    setOnSessionExpired(() => router.replace('/login'));
    return () => setOnSessionExpired(null);
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
