import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack, router } from 'expo-router';

import { AuthButton } from '../../components/auth-button.tsx';
import { AuthField } from '../../components/auth-field.tsx';
import { useAuth } from '../../lib/auth-context.tsx';
import { validateRegisterForm, type FieldErrors } from '../../lib/auth-forms.ts';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    dateOfBirth: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values) => (text: string) =>
    setValues((current) => ({ ...current, [key]: text }));

  async function onSubmit() {
    const found = validateRegisterForm(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const result = await register(values);
    setBusy(false);

    if (result.kind === 'session') {
      // Signed in already — the server issues a session at registration and
      // email verification does not gate anything in this phase.
      router.replace({ pathname: '/verify-email', params: { email: values.email.trim() } });
      return;
    }
    setFormError(result.kind === 'error' ? result.message : 'Registration failed.');
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <Stack.Screen options={{ title: 'Create account' }} />
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-6 text-2xl font-semibold text-gray-900">Create your account</Text>

        <AuthField
          label="First name"
          value={values.firstName}
          onChangeText={set('firstName')}
          error={errors.firstName}
          autoComplete="given-name"
          placeholder="Ada"
        />
        <AuthField
          label="Last name"
          value={values.lastName}
          onChangeText={set('lastName')}
          error={errors.lastName}
          autoComplete="family-name"
          placeholder="Obi"
        />
        <AuthField
          label="Email"
          value={values.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AuthField
          label="Password"
          value={values.password}
          onChangeText={set('password')}
          error={errors.password}
          autoComplete="new-password"
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <AuthField
          label="Phone number (optional)"
          value={values.phoneNumber}
          onChangeText={set('phoneNumber')}
          error={errors.phoneNumber}
          autoComplete="tel"
          keyboardType="phone-pad"
          placeholder="07035609301"
        />

        {formError ? <Text className="mb-4 text-sm text-red-600">{formError}</Text> : null}

        <AuthButton label="Create account" onPress={onSubmit} busy={busy} />

        <Link href="/login" className="mt-6 text-sm text-gray-900 underline">
          I already have an account
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
