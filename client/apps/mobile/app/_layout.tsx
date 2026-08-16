import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureCommerceCore } from 'commerce-core';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set — copy .env.example to .env and set it'
  );
}

configureCommerceCore({ apiBaseUrl });

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
