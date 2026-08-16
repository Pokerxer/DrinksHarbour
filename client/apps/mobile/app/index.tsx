import { Text, View } from 'react-native';
import { formatNaira, getApiBaseUrl } from 'commerce-core';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-gray-0">
      <Text className="text-xl font-semibold text-gray-900">DrinksHarbour</Text>
      <Text className="text-sm text-gray-500">API: {getApiBaseUrl()}</Text>
      <Text className="text-base text-foreground">Pack price: {formatNaira(54000)}</Text>
    </View>
  );
}
