import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

/**
 * Five 8px stars plus the review count.
 *
 * The web renders this ONLY when `averageRating > 0` — the old `rating || 4.5`
 * fallback drew four and a half gold stars next to "(0)". That guard lives in
 * the caller on both sides, deliberately: it is a decision about whether the row
 * exists, not about how it looks.
 */
const STARS = [1, 2, 3, 4, 5];

// amber-400 / gray-200
const FILLED = '#fbbf24';
const EMPTY = '#e5e7eb';

export function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const rounded = Math.round(rating);

  return (
    <View
      className="mt-1.5 flex-row items-center gap-1"
      accessibilityLabel={`Rating: ${rating} out of 5, ${reviewCount} reviews`}
    >
      <View className="flex-row items-center">
        {STARS.map((star) => (
          <Ionicons key={star} name="star" size={8} color={star <= rounded ? FILLED : EMPTY} />
        ))}
      </View>
      <Text className="text-[10px] text-gray-500">({reviewCount})</Text>
    </View>
  );
}
