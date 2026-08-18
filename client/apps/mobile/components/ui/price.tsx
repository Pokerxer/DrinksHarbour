import { Text, View } from 'react-native';

/**
 * Money, rendered one way.
 *
 * commerce-core exists so mobile and web cannot disagree about what a bottle
 * costs. The amounts arriving here have already been through
 * pickDefaultVariant / resolvePackPricing upstream — this component's only job
 * is presentation, and it must never do arithmetic of its own.
 */

const NAIRA = '₦';

export function formatNaira(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return '';
  return `${NAIRA}${Math.round(amount).toLocaleString('en-NG')}`;
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
} as const;

export function Price({
  amount,
  originalAmount = null,
  size = 'md',
}: {
  amount: number | null;
  originalAmount?: number | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (amount === null) {
    // A product with no resolvable price shows nothing rather than "₦0".
    return null;
  }

  return (
    <View className="flex-row items-baseline gap-2">
      <Text className={`${SIZES[size]} font-semibold text-gray-900`}>{formatNaira(amount)}</Text>
      {originalAmount !== null && originalAmount > amount ? (
        <Text className="text-xs text-gray-400 line-through">{formatNaira(originalAmount)}</Text>
      ) : null}
    </View>
  );
}
