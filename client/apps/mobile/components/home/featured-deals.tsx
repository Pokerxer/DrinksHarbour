import { useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { fetchHotDeals, type RawProduct } from '../../lib/catalog-api.ts';
import { calcPricing, dealStock, promotedFirst } from '../../lib/deal-pricing.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { Gradient } from '../ui/gradient.tsx';
import { formatNaira } from '../ui/price.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';
import { StarRating } from '../ui/star-rating.tsx';
import { StockStatus } from '../ui/stock-status.tsx';
import { useBlock } from './use-block.ts';

/**
 * Section 3 — "Hot Deals" (`Home1/FeaturedDeals.tsx`), inside the page's
 * `py-4 bg-white` / `container px-3` wrapper.
 *
 * Two horizontal insets stack on the web: the page's `px-3` and the block's own
 * `px-3`, so the grid sits 24px in from each edge. That is reproduced here
 * rather than "tidied" to one, because it is what the screen actually looks
 * like.
 */

const TITLE = 'Hot Deals';
const SUBTITLE = 'Limited time offers - Grab them fast!';
const LIMIT = 12;

const PAGE_PADDING = 12; // page `container px-3`
const BLOCK_PADDING = 12; // block `px-3`
const GAP = 8; // `gap-2`

// ─── Card ─────────────────────────────────────────────────────────────────────

function DealProductCard({ product, width }: { product: RawProduct; width: number }) {
  const pricing = calcPricing(product);
  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || null;
  const rating = (product.averageRating as number | undefined) || 0;
  const reviewCount = (product.reviewCount as number | undefined) || 0;
  const slug = typeof product.slug === 'string' ? product.slug : '';

  const badgeGradient = pricing.isFlashSale
    ? 'dealBadgeFlash'
    : pricing.isFixed
      ? 'dealBadgeFixed'
      : 'dealBadgePercent';

  return (
    <Link href={slug ? `/product/${slug}` : '/shop'} asChild>
      <Pressable
        style={{ width }}
        className="overflow-hidden rounded-xl border border-gray-100 bg-white"
      >
        <View className="relative aspect-square overflow-hidden bg-gray-50">
          {imageUrl ? (
            <RemoteImage uri={imageUrl} contentFit="contain" className="h-full w-full" />
          ) : (
            <Gradient name="imageBroken" style={{ flex: 1 }}>
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="image-outline" size={40} color="#d1d5db" />
              </View>
            </Gradient>
          )}

          {pricing.hasDiscount ? (
            <View className="absolute left-0 top-0 overflow-hidden rounded-br-lg">
              <Gradient name={badgeGradient}>
                <View className="flex-row items-center gap-1 px-2 py-1">
                  {pricing.isFlashSale ? <Ionicons name="flash" size={8} color="#ffffff" /> : null}
                  <Text className="text-[10px] font-bold text-white">
                    {pricing.isFixed
                      ? formatNaira(pricing.fixedAmountOff)
                      : `${pricing.discountPercent}% OFF`}
                  </Text>
                </View>
              </Gradient>
            </View>
          ) : null}
        </View>

        <View className="p-2.5">
          <Text
            numberOfLines={2}
            style={{ minHeight: 32 }}
            className="text-xs font-medium leading-tight text-gray-800"
          >
            {typeof product.name === 'string' ? product.name : ''}
          </Text>

          {/* Only for products that actually have a rating — the old
              `rating || 4.5` fallback drew 4.5 gold stars next to "(0)". */}
          {rating > 0 ? <StarRating rating={rating} reviewCount={reviewCount} /> : null}

          <View className="mt-1.5">
            <StockStatus stock={dealStock(product)} showProgress />
          </View>

          <View className="mt-2 flex-row items-center justify-between gap-2">
            <View className="flex-shrink flex-row flex-wrap items-baseline gap-1">
              <Text className="text-sm font-bold text-red-500">
                {formatNaira(pricing.currentPrice)}
              </Text>
              {pricing.hasDiscount ? (
                <Text className="text-[10px] text-gray-400 line-through">
                  {formatNaira(pricing.originalPrice)}
                </Text>
              ) : null}
            </View>

            <View className="h-10 w-10 items-center justify-center rounded-lg bg-orange-500">
              <Ionicons name="cart-outline" size={16} color="#ffffff" />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function SkeletonCard({ width }: { width: number }) {
  return (
    <View style={{ width }}>
      <View className="aspect-square rounded-t-xl bg-gray-200" />
      <View className="gap-2 p-2.5">
        <View className="h-3 w-3/4 rounded bg-gray-200" />
        <View className="h-2 w-1/2 rounded bg-gray-200" />
        <View className="h-3 w-1/4 rounded bg-gray-200" />
      </View>
    </View>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function FeaturedDeals({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const load = useCallback(() => fetchHotDeals(LIMIT), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  // Promoted deals lead the grid, then backfill; capped at `limit`.
  const products = useMemo(() => promotedFirst(items).slice(0, LIMIT), [items]);

  const cardWidth = (width - (PAGE_PADDING + BLOCK_PADDING) * 2 - GAP) / 2;

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="bg-white py-4">
        <View style={{ paddingHorizontal: PAGE_PADDING + BLOCK_PADDING }}>
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {Array.from({ length: LIMIT }).map((_, i) => (
              <SkeletonCard key={i} width={cardWidth} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white py-4">
      <View style={{ paddingHorizontal: PAGE_PADDING }}>
        {/* Header */}
        <View
          className="mb-3 flex-row items-center justify-between"
          style={{ paddingHorizontal: BLOCK_PADDING }}
        >
          <View>
            <Text className="text-base font-bold text-gray-900">{TITLE}</Text>
            <Text className="mt-0.5 text-xs text-gray-500">{SUBTITLE}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/shop')}
            hitSlop={8}
            className="flex-row items-center gap-0.5"
          >
            <Text className="text-xs font-medium text-orange-500">More</Text>
            <Ionicons name="chevron-forward" size={12} color="#f97316" />
          </Pressable>
        </View>

        {/* Grid */}
        <View
          className="flex-row flex-wrap"
          style={{ gap: GAP, paddingHorizontal: BLOCK_PADDING }}
        >
          {products.map((product) => (
            <DealProductCard key={String(product._id)} product={product} width={cardWidth} />
          ))}
        </View>

        {/* See All */}
        <View className="mt-4" style={{ paddingHorizontal: BLOCK_PADDING }}>
          <Pressable
            onPress={() => router.push('/shop')}
            className="w-full rounded-xl border-2 border-orange-500 bg-white py-3"
          >
            <Text className="text-center text-sm font-semibold text-orange-500">See All</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
