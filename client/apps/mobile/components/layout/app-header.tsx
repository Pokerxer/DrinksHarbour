import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gradient } from '../ui/gradient.tsx';

/**
 * The app header — `apps/platform/src/components/Header/Header.tsx` at phone
 * width, which is a narrow slice of that file:
 *
 *   • the red→orange→red accent hairline (`h-0.5`, line 72)
 *   • the hamburger (`lg:hidden`, line 79)
 *   • the search pill (HeaderSearch, which is a BUTTON — it opens the modal
 *     rather than accepting text inline)
 *   • the bottom hairline (line 120)
 *
 * Everything else in that header is desktop-only: the logo is `hidden lg:block`
 * ("search bar takes its place" on mobile), `HeaderNav` is desktop nav, and
 * `HeaderActions` returns null on mobile — its own comment says cart and account
 * live in the bottom nav instead. So the mobile header really is: line, burger,
 * search, line.
 *
 * `variant` is not ported: every mobile screen uses the default white header,
 * and the transparent/dark variants exist for web pages this app does not have.
 */
export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} className="bg-white">
      {/* `bg-gradient-to-r from-red-600 via-orange-400 to-red-600` */}
      <Gradient name="headerAccent" style={{ height: 2 }} />

      <View className="flex-row items-center gap-4 px-4 py-3">
        <Pressable
          onPress={onOpenMenu}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open categories"
          className="rounded-lg p-2"
        >
          <Ionicons name="menu" size={22} color="#1f2937" />
        </Pressable>

        {/* HeaderSearch: a button, not an input — tapping it opens search. */}
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          accessibilityLabel="Search DrinksHarbour"
          className="flex-1 flex-row items-center gap-2.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-2.5"
        >
          <Ionicons name="search" size={16} color="#9ca3af" />
          <Text className="flex-1 text-sm text-gray-400">Search DrinksHarbour</Text>
        </Pressable>
      </View>

      <View className="h-px bg-gray-100" />
    </SafeAreaView>
  );
}
