import { Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { useAuth } from '../../lib/auth-context.tsx';

export default function AccountScreen() {
  const { user, isLoading, isAuthenticated, biometricEnabled, setBiometricEnabled, signOut } =
    useAuth();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-0" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-600">Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-gray-0" edges={['bottom']}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-xl font-semibold text-gray-900">You are signed out</Text>
          <Link href="/login" className="text-base text-gray-900 underline">
            Sign in
          </Link>
          <Link href="/register" className="text-base text-gray-900 underline">
            Create an account
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0" edges={['bottom']}>
      <View className="flex-1 gap-6 p-6">
        <View>
          <Text className="text-xl font-semibold text-gray-900">
            {user?.displayName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
          </Text>
          <Text className="text-sm text-gray-600">{user?.email}</Text>
        </View>

        {/* Temporary home. The permanent one is /my-account/security, Phase 5. */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-base text-gray-900">Unlock with biometrics</Text>
            <Text className="text-sm text-gray-600">
              Ask for Face ID or a fingerprint when the app starts.
            </Text>
          </View>
          <Switch value={biometricEnabled} onValueChange={setBiometricEnabled} />
        </View>

        {user?.isEmailVerified === false ? (
          <Link href="/verify-email" className="text-base text-gray-900 underline">
            Verify your email
          </Link>
        ) : null}

        <Pressable accessibilityRole="button" onPress={signOut}>
          <Text className="text-base text-red-600">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
