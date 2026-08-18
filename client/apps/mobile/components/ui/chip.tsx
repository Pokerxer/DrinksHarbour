import { Pressable, Text } from 'react-native';
import { RemoteImage } from './remote-image.tsx';

export function Chip({
  label,
  imageUrl = null,
  onPress,
}: {
  label: string;
  imageUrl?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-full border border-gray-200 bg-gray-0 px-3 py-2"
    >
      {imageUrl ? <RemoteImage uri={imageUrl} className="h-6 w-6 rounded-full" /> : null}
      <Text className="text-sm text-gray-800">{label}</Text>
    </Pressable>
  );
}
