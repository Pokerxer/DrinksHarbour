import { View } from 'react-native';

/**
 * A block's loading state. Deliberately static — a shimmer needs Reanimated
 * driving eight rails at once on a cold start, which is exactly when the phone
 * is busiest.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`rounded-md bg-gray-100 ${className}`} />;
}
