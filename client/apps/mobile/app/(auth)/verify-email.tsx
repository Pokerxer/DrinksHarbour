import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '../../components/auth-button.tsx';
import { AuthField } from '../../components/auth-field.tsx';
import { resendVerification, verifyEmail } from '../../lib/auth-api.ts';
import { validateVerificationCode } from '../../lib/auth-forms.ts';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const found = validateVerificationCode(code);
    setCodeError(found ?? '');
    setFormError('');
    setNotice('');
    if (found) return;

    setBusy(true);
    const result = await verifyEmail(email.trim(), code.trim());
    setBusy(false);

    if (result.ok) {
      router.replace('/');
      return;
    }
    setFormError(result.message);
  }

  async function onResend() {
    setFormError('');
    setNotice('');
    const result = await resendVerification(email.trim());
    if (result.ok) setNotice('A new code is on its way.');
    else setFormError(result.message);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <Stack.Screen options={{ title: 'Verify email' }} />
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-2xl font-semibold text-gray-900">Verify your email</Text>
        <Text className="mb-6 text-sm text-gray-600">
          We sent a 6-digit code to your inbox. It expires in 10 minutes.
        </Text>

        <AuthField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AuthField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          error={codeError}
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={6}
          placeholder="483920"
        />

        {formError ? <Text className="mb-4 text-sm text-red-600">{formError}</Text> : null}
        {notice ? <Text className="mb-4 text-sm text-gray-600">{notice}</Text> : null}

        <AuthButton label="Verify" onPress={onSubmit} busy={busy} />

        <Pressable accessibilityRole="button" onPress={onResend} className="mt-6">
          <Text className="text-sm text-gray-900 underline">Send me a new code</Text>
        </Pressable>

        {/* Nothing in this phase gates on isEmailVerified, so skipping is real. */}
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} className="mt-3">
          <Text className="text-sm text-gray-600 underline">Skip for now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
