import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '../../../components/auth-button.tsx';
import { AuthField } from '../../../components/auth-field.tsx';
import { useAuth } from '../../../lib/auth-context.tsx';

export default function MfaChallengeScreen() {
  const { completeMfaLogin } = useAuth();
  const { pendingMfaToken } = useLocalSearchParams<{ pendingMfaToken?: string }>();
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError('');
    if (!pendingMfaToken) {
      setFormError('That sign-in attempt has expired. Please sign in again.');
      return;
    }
    // Backup codes are 8 characters and not numeric, so this is deliberately
    // laxer than validateVerificationCode — the server accepts 6-8 here.
    if (code.trim().length < 6) {
      setFormError('Enter the 6-digit code from your authenticator, or a backup code.');
      return;
    }

    setBusy(true);
    const result = await completeMfaLogin(pendingMfaToken, code.trim());
    setBusy(false);

    if (result.kind === 'session') {
      router.replace('/');
      return;
    }
    setFormError(result.kind === 'error' ? result.message : 'Verification failed.');
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <Stack.Screen options={{ title: 'Two-factor' }} />
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-2xl font-semibold text-gray-900">Enter your code</Text>
        <Text className="mb-6 text-sm text-gray-600">
          Open your authenticator app, or use one of your backup codes.
        </Text>

        <AuthField
          label="Authentication code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoComplete="one-time-code"
          keyboardType="default"
          placeholder="483920"
        />

        {formError ? <Text className="mb-4 text-sm text-red-600">{formError}</Text> : null}

        <AuthButton label="Verify" onPress={onSubmit} busy={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}
