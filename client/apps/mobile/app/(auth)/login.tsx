import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack, router } from 'expo-router';

import { AuthButton } from '../../components/auth-button.tsx';
import { AuthField } from '../../components/auth-field.tsx';
import { useAuth } from '../../lib/auth-context.tsx';
import { validateLoginForm, type FieldErrors } from '../../lib/auth-forms.ts';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const found = validateLoginForm({ email, password });
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const result = await login(email, password);
    setBusy(false);

    if (result.kind === 'session') {
      router.replace('/');
      return;
    }
    if (result.kind === 'mfa') {
      // The pending token is a 5-minute JWT and never touches storage.
      router.push({
        pathname: '/login/mfa-challenge',
        params: { pendingMfaToken: result.pendingMfaToken },
      });
      return;
    }
    setFormError(result.message);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <Stack.Screen options={{ title: 'Sign in' }} />
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-6 text-2xl font-semibold text-gray-900">Welcome back</Text>

        <AuthField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AuthField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          autoComplete="current-password"
          secureTextEntry
          placeholder="Your password"
        />

        {formError ? <Text className="mb-4 text-sm text-red-600">{formError}</Text> : null}

        <AuthButton label="Sign in" onPress={onSubmit} busy={busy} />

        <View className="mt-6 gap-3">
          <Link href="/forgot-password" className="text-sm text-gray-900 underline">
            Forgot your password?
          </Link>
          <Link href="/register" className="text-sm text-gray-900 underline">
            Create an account
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
