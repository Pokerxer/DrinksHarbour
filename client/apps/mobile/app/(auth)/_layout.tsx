import { Stack } from 'expo-router';

// A stack outside the tab bar: auth screens should not show tabs beneath them.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: true, headerBackTitle: 'Back' }} />;
}
