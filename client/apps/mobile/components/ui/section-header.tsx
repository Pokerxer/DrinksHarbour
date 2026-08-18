import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export function SectionHeader({
  title,
  onSeeAll,
  accessory,
}: {
  title: string;
  onSeeAll?: () => void;
  accessory?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-3">
      <Text className="text-lg font-semibold text-gray-900">{title}</Text>

      <View className="flex-row items-center gap-3">
        {accessory}
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text className="text-sm font-medium text-primary">See all</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
