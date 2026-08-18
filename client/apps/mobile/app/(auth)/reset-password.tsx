import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '../../components/auth-button.tsx';
import { AuthField } from '../../components/auth-field.tsx';
import { resetPassword } from '../../lib/auth-api.ts';
import { validateResetForm, type FieldErrors } from '../../lib/auth-forms.ts';

/**
 * The target of the Universal Link / App Link on
 * https://www.drinksharbour.com/reset-password?token=…
 *
 * The token arrives as a query param either from that link or, in development,
 * from drinksharbour://reset-password?token=… which needs no association files.
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError('');
    if (!token) {
      setFormError('This reset link is incomplete. Please request a new one.');
      return;
    }

    const found = validateResetForm({ newPassword, confirmPassword });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const result = await resetPassword(token, newPassword);
    setBusy(false);

    if (result.ok) {
      router.replace('/login');
      return;
    }
    setFormError(result.message);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <Stack.Screen options={{ title: 'New password' }} />
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-6 text-2xl font-semibold text-gray-900">Choose a new password</Text>

        <AuthField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          error={errors.newPassword}
          autoComplete="new-password"
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <AuthField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          autoComplete="new-password"
          secureTextEntry
          placeholder="Repeat it"
        />

        {formError ? <Text className="mb-4 text-sm text-red-600">{formError}</Text> : null}

        <AuthButton label="Set new password" onPress={onSubmit} busy={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}
