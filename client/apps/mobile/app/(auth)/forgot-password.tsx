import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { AuthButton } from '../../components/auth-button.tsx';
import { AuthField } from '../../components/auth-field.tsx';
import { requestPasswordReset } from '../../lib/auth-api.ts';
import { validateEmail } from '../../lib/auth-forms.ts';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const found = validateEmail(email);
    setError(found ?? '');
    setFormError('');
    if (found) return;

    setBusy(true);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);

    // The server answers the same way whether or not the account exists, and
    // so does this screen. Reporting "no such account" would turn the form
    // into an account-enumeration oracle.
    if (result.ok) setSent(true);
    else setFormError(result.message);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <Stack.Screen options={{ title: 'Reset password' }} />
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        {sent ? (
          <>
            <Text className="mb-2 text-2xl font-semibold text-gray-900">Check your email</Text>
            <Text className="text-sm text-gray-600">
              If an account exists for {email.trim()}, we have sent a link to reset the password.
            </Text>
          </>
        ) : (
          <>
            <Text className="mb-2 text-2xl font-semibold text-gray-900">Forgot your password?</Text>
            <Text className="mb-6 text-sm text-gray-600">
              Enter your email and we will send you a reset link.
            </Text>

            <AuthField
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={error}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />

            {formError ? <Text className="mb-4 text-sm text-red-600">{formError}</Text> : null}

            <AuthButton label="Send reset link" onPress={onSubmit} busy={busy} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
