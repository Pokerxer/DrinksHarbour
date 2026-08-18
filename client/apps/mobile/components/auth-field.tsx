import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface AuthFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function AuthField({ label, error, ...inputProps }: AuthFieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-gray-900">{label}</Text>
      <TextInput
        className={`rounded-lg border px-3 py-3 text-base text-gray-900 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        placeholderTextColor="#929292"
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
