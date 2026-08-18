import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { ProductCardView } from '../../lib/product-view.ts';
import { Price } from './price.tsx';
import { RemoteImage } from './remote-image.tsx';

/**
 * The most-reused unit in the app. Pure layout — every value it shows was
 * derived by toProductCardView, which is unit-tested; this file has no logic to
 * get wrong.
 */
export function ProductCard({ view, width = 160 }: { view: ProductCardView; width?: number }) {
  return (
    <Link href={`/product/${view.slug}`} asChild>
      <Pressable style={{ width }} className="gap-2">
        <View className="relative overflow-hidden rounded-lg bg-gray-50">
          <RemoteImage uri={view.imageUrl} className="h-40 w-full" />

          {view.discountPct !== null ? (
            <View className="absolute left-2 top-2 rounded bg-red px-1.5 py-0.5">
              <Text className="text-xs font-semibold text-white">-{view.discountPct}%</Text>
            </View>
          ) : null}

          {!view.inStock ? (
            <View className="absolute inset-0 items-center justify-center bg-gray-1000/40">
              <Text className="text-xs font-semibold text-white">Out of stock</Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={2} className="text-sm text-gray-800">
          {view.name}
        </Text>

        <Price amount={view.price} originalAmount={view.originalPrice} size="sm" />
      </Pressable>
    </Link>
  );
}
