import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// tabBarActiveTintColor takes a colour value, not a class name, so these cannot
// be NativeWind tokens. The literals are the resolved values of the shared
// theme's --gray-900 (17 17 17) and --gray-400 (146 146 146), so the tab bar
// still matches the web palette. If those tokens change in global.css, change
// these too.
const ACTIVE_TINT = '#111111';
const INACTIVE_TINT = '#929292';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
