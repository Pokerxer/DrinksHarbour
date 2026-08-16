import { Text, View } from 'react-native';
import { formatNaira, getApiBaseUrl } from 'commerce-core';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text>DrinksHarbour</Text>
      <Text>API: {getApiBaseUrl()}</Text>
      <Text>Pack price: {formatNaira(54000)}</Text>
    </View>
  );
}
