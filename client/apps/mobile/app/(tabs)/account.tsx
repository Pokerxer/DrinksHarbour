import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-0">
      <View className="flex-1 items-center justify-center">
        <Text className="text-xl font-semibold text-gray-900">Account</Text>
      </View>
    </SafeAreaView>
  );
}
