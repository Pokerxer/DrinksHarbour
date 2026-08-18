import { Stack } from 'expo-router';

/** Outside (tabs), so detail pushes over the tab bar rather than becoming a tab. */
export default function ProductLayout() {
  return <Stack screenOptions={{ headerShown: true, headerTitle: '', headerBackTitle: 'Back' }} />;
}
