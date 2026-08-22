import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { RecommendedCardView } from '../../lib/recommendations.ts';
import { Gradient } from './gradient.tsx';
import { formatNaira } from './price.tsx';
import { RemoteImage } from './remote-image.tsx';

/**
 * `Product/Card` at `type="grid"`, phone branch.
 *
 * The web card is 1,575 lines because most of it is desktop: hover tooltips, the
 * quick-shop vendor/size panel, the sale marquee, vendor avatars — all of it
 * behind `hidden lg:*`. What a phone actually renders is this: the rounded-2xl
 * thumb, the ranked badge, the stacked action column, the name, the ABV/origin
 * line and the price. The `hidden sm:block` sold/available bar is not rendered
 * at this width and is not here.
 *
 * The three action buttons navigate rather than mutate — there is no
 * CartContext or WishlistContext in the mobile app yet.
 */

const BADGE_GRADIENT = {
  flash_sale: 'dealBadgeFlash',
  fixed: 'dealBadgeFixed',
  percentage: 'dealBadgePercent',
} as const;

function ActionButton({ icon }: { icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
    >
      <Ionicons name={icon} size={18} color="#4b5563" />
    </View>
  );
}

export function RecommendedCard({ view, width }: { view: RecommendedCardView; width: number }) {
  const saleBadge =
    view.badge === 'flash_sale' || view.badge === 'fixed' || view.badge === 'percentage'
      ? BADGE_GRADIENT[view.badge]
      : null;

  return (
    <Link href={`/product/${view.slug}`} asChild>
      <Pressable style={{ width }}>
        <View className="relative overflow-hidden rounded-2xl bg-gray-50">
          <View className="aspect-square">
            {view.imageUrl ? (
              <RemoteImage uri={view.imageUrl} contentFit="contain" className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="image-outline" size={44} color="#d1d5db" />
              </View>
            )}
          </View>

          {/* Ranked badge — flash > fixed > percentage > product badge */}
          <View className="absolute left-2 right-2 top-2 flex-row flex-wrap gap-1">
            {saleBadge ? (
              <View className="overflow-hidden rounded">
                <Gradient name={saleBadge}>
                  <View className="flex-row items-center gap-0.5 px-1 py-0.5">
                    {view.badge === 'flash_sale' ? (
                      <Ionicons name="flash" size={7} color="#ffffff" />
                    ) : null}
                    <Text className="text-[8px] font-bold text-white">{view.badgeLabel}</Text>
                  </View>
                </Gradient>
              </View>
            ) : null}

            {view.badge === 'product_badge' && view.badgeLabel ? (
              <View
                className="rounded-full px-2 py-1"
                style={{ backgroundColor: view.badgeColor ?? '#10B981' }}
              >
                <Text className="text-[10px] font-bold text-white">{view.badgeLabel}</Text>
              </View>
            ) : null}

            {view.isOutOfStock ? (
              <View
                className="rounded px-1.5 py-0.5"
                style={{ backgroundColor: 'rgba(17,24,39,0.9)' }}
              >
                <Text className="text-[8px] font-bold text-white">OUT OF STOCK</Text>
              </View>
            ) : null}
          </View>

          {/* Stacked action column */}
          <View className="absolute right-2 top-2 gap-2">
            {view.isOutOfStock ? null : <ActionButton icon="cart-outline" />}
            <ActionButton icon="heart-outline" />
            <ActionButton icon="eye-outline" />
          </View>

          {view.isOutOfStock ? (
            <View
              className="absolute inset-0 items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}
            >
              <View
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: 'rgba(17,24,39,0.85)' }}
              >
                <Text className="text-xs font-bold text-white">Out of Stock</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View className="mt-3 px-1">
          <Text numberOfLines={2} className="text-sm font-medium leading-tight text-gray-900">
            {view.name}
          </Text>

          {view.abv !== null || view.origin !== null ? (
            <View className="mt-0.5 flex-row items-center gap-2">
              {view.abv !== null ? (
                <Text className="text-[10px] font-medium text-gray-400">{view.abv}% ABV</Text>
              ) : null}
              {view.abv !== null && view.origin !== null ? (
                <Text className="text-[10px] text-gray-300">·</Text>
              ) : null}
              {view.origin !== null ? (
                <Text numberOfLines={1} className="text-[10px] text-gray-400">
                  {view.origin}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="mt-2 flex-row items-center gap-1.5">
            <Text
              className={`text-sm font-bold ${
                view.showStrikethrough ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {formatNaira(view.price)}
            </Text>
            {view.showStrikethrough && view.originalPrice !== null ? (
              <Text className="text-[10px] text-gray-400 line-through">
                {formatNaira(view.originalPrice)}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
