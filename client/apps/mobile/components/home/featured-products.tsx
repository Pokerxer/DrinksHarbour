import { useCallback, useEffect, useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { fetchFeaturedProducts } from '../../lib/catalog-api.ts';
import {
  featuredStats,
  isSizeOutOfStock,
  mapFeaturedProducts,
  priceForSize,
  type FeaturedProductView,
} from '../../lib/featured-product.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { Gradient } from '../ui/gradient.tsx';
import { formatNaira } from '../ui/price.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';
import { StarRating } from '../ui/star-rating.tsx';
import { StockStatus } from '../ui/stock-status.tsx';
import { useBlock } from './use-block.ts';

/**
 * Section 4 — `Home1/FeaturedProducts/`.
 *
 * The visual anchor of the page: a tall amber-washed section with a centred
 * header, a three-stat strip, the 2-column grid, and a pill CTA.
 *
 * The grid is a wrapping View rather than a FlatList — this sits inside the Home
 * ScrollView, and a nested vertical VirtualizedList logs a hard warning and
 * breaks scroll handoff. The list is bounded at 8 by the endpoint's limit.
 *
 * The cart and wishlist buttons render at full fidelity but navigate to the
 * product instead of mutating state: the mobile app has no CartContext or
 * WishlistContext yet.
 */

const TITLE = 'Featured Products';
const SUBTITLE = 'Handpicked selections from our premium collection';
const LIMIT = 8;

const PAGE_PADDING = 12; // page `container px-3`
const SECTION_PADDING = 16; // section `container px-4`
const GAP = 8; // `gap-2`

const AMBER_500 = '#f59e0b';
const AMBER_600 = '#d97706';
const EMERALD_600 = '#059669';

// ─── Header ───────────────────────────────────────────────────────────────────

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-10 w-10 overflow-hidden rounded-full">
        <Gradient name="amberPill" style={{ flex: 1 }}>
          <View className="h-full w-full items-center justify-center">{icon}</View>
        </Gradient>
      </View>
      <View>
        <Text className="font-bold text-gray-900">{value}</Text>
        <Text className="text-xs text-gray-500">{label}</Text>
      </View>
    </View>
  );
}

function FeaturedHeader({
  count,
  avgRating,
  tenantsCount,
}: {
  count: number;
  avgRating: number;
  tenantsCount: number;
}) {
  return (
    <View className="mb-12 items-center">
      <View className="mb-4 overflow-hidden rounded-full">
        <Gradient name="amberPill">
          <View className="flex-row items-center gap-2 px-4 py-2">
            <Ionicons name="star" size={14} color={AMBER_500} />
            <Text
              className="text-xs font-bold uppercase text-amber-700"
              style={{ letterSpacing: 1 }}
            >
              Premium Selection
            </Text>
          </View>
        </Gradient>
      </View>

      <Text
        className="mb-3 text-center text-3xl font-black text-gray-900"
        style={{ letterSpacing: -0.5 }}
      >
        {TITLE}
      </Text>

      <Text className="text-center text-base text-gray-500">{SUBTITLE}</Text>

      {count > 0 ? (
        <View className="mt-6 flex-row items-center justify-center gap-6">
          <Stat
            icon={<Ionicons name="sparkles" size={18} color={AMBER_600} />}
            value={count}
            label="Featured"
          />
          <View className="h-10 w-px bg-gray-200" />
          <Stat
            icon={<Ionicons name="star" size={18} color={AMBER_500} />}
            value={avgRating.toFixed(1)}
            label="Avg rating"
          />
          <View className="h-10 w-px bg-gray-200" />
          <Stat
            icon={<Ionicons name="storefront" size={18} color={EMERALD_600} />}
            value={tenantsCount}
            label="Tenants"
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function FeaturedProductCard({ view, width }: { view: FeaturedProductView; width: number }) {
  const selectedSize = view.sizes?.[0] ?? null;
  const { price, originPrice } = priceForSize(selectedSize, view.price);
  const soldOut = view.totalStock <= 0 || isSizeOutOfStock(selectedSize);
  const showCompare = view.sale && originPrice > price;

  return (
    <Link href={`/product/${view.slug}`} asChild>
      <Pressable
        style={{ width }}
        className="overflow-hidden rounded-xl border border-gray-100 bg-white"
      >
        <View className="relative aspect-square overflow-hidden bg-gray-50">
          {view.imageUrl ? (
            <RemoteImage
              uri={view.imageUrl}
              contentFit="contain"
              className="h-full w-full p-2"
              // The web also desaturates a sold-out image (`grayscale`); RN has
              // no filter, so only the fade carries over.
              style={soldOut ? { opacity: 0.4 } : undefined}
            />
          ) : (
            <Gradient name="imageBroken" style={{ flex: 1 }}>
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="image-outline" size={40} color="#d1d5db" />
              </View>
            </Gradient>
          )}

          {/* Featured ribbon */}
          <View className="absolute left-0 top-0 overflow-hidden rounded-br-lg">
            <Gradient name="featuredRibbon">
              <View className="flex-row items-center gap-1 px-2 py-1">
                <MaterialCommunityIcons name="crown" size={9} color="#111827" />
                <Text
                  className="text-[10px] font-bold uppercase text-gray-900"
                  style={{ letterSpacing: 0.5 }}
                >
                  Featured
                </Text>
              </View>
            </Gradient>
          </View>

          {/* Discount badge, sitting under the ribbon */}
          {view.sale && view.discount > 0 ? (
            <View className="absolute left-0 top-7 overflow-hidden rounded-br-lg">
              <Gradient name="dealBadgePercent">
                <View className="px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-white">{view.discount}% OFF</Text>
                </View>
              </Gradient>
            </View>
          ) : null}

          {/* Wishlist */}
          <View className="absolute right-1.5 top-1.5 h-8 w-8 items-center justify-center rounded-full bg-white/90">
            <Ionicons name="heart-outline" size={14} color="#4b5563" />
          </View>

          {soldOut ? (
            <View className="absolute inset-0 items-center justify-center">
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: 'rgba(17,24,39,0.85)' }}
              >
                <Text
                  className="text-[10px] font-bold uppercase text-white"
                  style={{ letterSpacing: 1.5 }}
                >
                  Sold out
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View className="p-2.5">
          <Text
            numberOfLines={2}
            style={{ minHeight: 32 }}
            className="text-xs font-medium leading-tight text-gray-800"
          >
            {view.name}
          </Text>

          {view.averageRating > 0 ? (
            <StarRating rating={view.averageRating} reviewCount={view.reviewCount} />
          ) : null}

          <View className="mt-1.5">
            <StockStatus stock={view.totalStock} showProgress />
          </View>

          <View className="mt-2 flex-row items-center justify-between gap-2">
            <View className="flex-shrink flex-row flex-wrap items-baseline gap-1">
              <Text className="text-sm font-bold text-gray-900">{formatNaira(price)}</Text>
              {showCompare ? (
                <Text className="text-[10px] text-gray-400 line-through">
                  {formatNaira(originPrice)}
                </Text>
              ) : null}
            </View>

            <View
              className={`h-10 w-10 items-center justify-center rounded-lg ${
                soldOut ? 'bg-gray-300' : 'bg-amber-500'
              }`}
            >
              <Ionicons name="cart-outline" size={16} color="#ffffff" />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FeaturedSkeleton({ width, padding }: { width: number; padding: number }) {
  return (
    <View className="py-16" style={{ paddingHorizontal: padding }}>
      <View className="mb-12 items-center">
        <View className="mb-4 flex-row items-center gap-2 rounded-full bg-amber-100 px-4 py-2">
          <Ionicons name="star" size={14} color={AMBER_500} />
          <Text className="text-xs font-bold text-amber-700">Premium Selection</Text>
        </View>
        <View className="h-12 w-56 rounded-xl bg-gray-200" />
      </View>
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {Array.from({ length: LIMIT }).map((_, i) => (
          <View
            key={i}
            style={{ width }}
            className="overflow-hidden rounded-xl border border-gray-100"
          >
            <View className="aspect-square bg-gray-200" />
            <View className="gap-2 p-2.5">
              <View className="h-3 w-3/4 rounded bg-gray-200" />
              <View className="h-2 w-1/2 rounded bg-gray-200" />
              <View className="h-3 w-1/4 rounded bg-gray-200" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function FeaturedProducts({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const load = useCallback(() => fetchFeaturedProducts(LIMIT), []);
  const { items, state } = useBlock(load);

  // Defense-in-depth: only honour products the API explicitly flagged
  // `isFeatured`. A payload that quietly ignores the filter must not turn this
  // into a second "all products" grid.
  const views = useMemo(() => mapFeaturedProducts(items, Date.now()), [items]);
  const stats = useMemo(() => featuredStats(views), [views]);

  // `itemCount` is the FILTERED count, not the payload's: the web returns null
  // when nothing survives `filterFeatured`, and this must hide for the same
  // reason rather than report a rail it will not draw.
  useEffect(() => {
    onState(
      state.phase === 'ready' ? { phase: 'ready', itemCount: views.length } : state
    );
  }, [state, views.length, onState]);

  const padding = PAGE_PADDING + SECTION_PADDING;
  const cardWidth = (width - padding * 2 - GAP) / 2;

  const mode = blockRender({
    ...state,
    itemCount: state.phase === 'ready' ? views.length : state.itemCount,
  });
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="bg-white py-4">
        <FeaturedSkeleton width={cardWidth} padding={padding} />
      </View>
    );
  }

  return (
    <View className="bg-white py-4">
      <Gradient name="featuredSection" className="overflow-hidden py-16">
        <View style={{ paddingHorizontal: padding }}>
          <FeaturedHeader
            count={stats.count}
            avgRating={stats.avgRating}
            tenantsCount={stats.tenantsCount}
          />

          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {views.map((view) => (
              <FeaturedProductCard key={view._id} view={view} width={cardWidth} />
            ))}
          </View>

          {/* CTA */}
          <View className="mt-12 items-center">
            <Pressable
              onPress={() => router.push('/shop')}
              className="overflow-hidden rounded-full"
            >
              <Gradient name="featuredCta">
                <View className="flex-row items-center gap-2.5 px-8 py-4">
                  <Text className="font-bold text-gray-900">View all featured products</Text>
                  <Ionicons name="chevron-forward" size={18} color="#111827" />
                </View>
              </Gradient>
            </Pressable>
          </View>
        </View>
      </Gradient>
    </View>
  );
}
