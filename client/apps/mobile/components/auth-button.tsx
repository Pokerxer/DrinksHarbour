import { ActivityIndicator, Pressable, Text } from 'react-native';

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}

export function AuthButton({ label, onPress, busy, disabled }: AuthButtonProps) {
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      className={`items-center rounded-lg px-4 py-4 ${inactive ? 'bg-gray-400' : 'bg-gray-900'}`}
    >
      {busy ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text className="text-base font-semibold text-white">{label}</Text>
      )}
    </Pressable>
  );
}
