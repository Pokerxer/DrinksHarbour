import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import {
  fetchBestsellers,
  fetchNewArrivals,
  fetchPersonalRecommendations,
  fetchTrendingProducts,
  type CatalogResult,
  type RawProduct,
} from '../../lib/catalog-api.ts';
import type { BlockState } from '../../lib/home-blocks.ts';
import { toRecommendedCardViews } from '../../lib/recommendations.ts';
import { readSession } from '../../lib/token-store.ts';
import { RecommendedCard } from '../ui/recommended-card.tsx';

/**
 * Section 7 — `Shop/RecommendedForYou.tsx`, `maxItems=12`.
 *
 * Four tabs over four endpoints, a refresh control, and the two scroll nudges
 * that are `md:hidden` on the web — i.e. visible at phone width, which is why
 * they are here.
 *
 * "Recommended For You" for a signed-out visitor IS trending: the web tries
 * `/api/user/recommendations` only when authenticated and falls back to
 * `/api/products/trending` either way. Authentication is decided from the
 * keychain session rather than a `/api/auth/me` round-trip — the mobile app
 * already holds the answer.
 */

const MAX_ITEMS = 12;
const GUTTER = 16; // `container px-4`

type SectionKey = 'recommended' | 'trending' | 'bestsellers' | 'newArrivals';

interface SectionConfig {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tileClass: string;
}

const SECTION_MAP: Record<SectionKey, SectionConfig> = {
  recommended: {
    title: 'Recommended For You',
    subtitle: 'Based on your browsing history',
    icon: <Ionicons name="sparkles" size={20} color="#e11d48" />,
    tileClass: 'bg-rose-100',
  },
  trending: {
    title: 'Trending Now',
    subtitle: 'Popular with other shoppers',
    icon: <Ionicons name="trending-up" size={20} color="#059669" />,
    tileClass: 'bg-emerald-100',
  },
  bestsellers: {
    title: 'Best Sellers',
    subtitle: 'Most purchased items',
    icon: <MaterialCommunityIcons name="fire" size={20} color="#ea580c" />,
    tileClass: 'bg-orange-100',
  },
  newArrivals: {
    title: 'New Arrivals',
    subtitle: 'Fresh additions to our catalog',
    icon: <Ionicons name="sparkles" size={20} color="#7c3aed" />,
    tileClass: 'bg-violet-100',
  },
};

const SECTION_KEYS: SectionKey[] = ['recommended', 'trending', 'bestsellers', 'newArrivals'];

/**
 * `recommended` is the only key with a fallback chain — personalised first,
 * trending behind it. The others are a single endpoint each.
 */
async function loadSection(section: SectionKey, authed: boolean): Promise<RawProduct[]> {
  const attempts: Array<() => Promise<CatalogResult<RawProduct[]>>> =
    section === 'recommended'
      ? authed
        ? [
            () => fetchPersonalRecommendations(MAX_ITEMS),
            () => fetchTrendingProducts(MAX_ITEMS),
          ]
        : [() => fetchTrendingProducts(MAX_ITEMS)]
      : section === 'trending'
        ? [() => fetchTrendingProducts(MAX_ITEMS)]
        : section === 'bestsellers'
          ? [() => fetchBestsellers(MAX_ITEMS)]
          : [() => fetchNewArrivals(MAX_ITEMS)];

  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok && result.data.length > 0) return result.data;
  }
  return [];
}

export function RecommendedForYou({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [section, setSection] = useState<SectionKey>('recommended');
  const [products, setProducts] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [authed, setAuthed] = useState(false);

  const run = useCallback(async (key: SectionKey, isAuthed: boolean) => {
    setHasError(false);
    const found = await loadSection(key, isAuthed);
    setProducts(found);
    setHasError(found.length === 0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await readSession();
      if (cancelled) return;
      const isAuthed = !!session;
      setAuthed(isAuthed);

      await run('recommended', isAuthed);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [run]);

  const views = useMemo(
    () => toRecommendedCardViews(products, Date.now(), MAX_ITEMS),
    [products]
  );

  // Unlike every other block this one never hides: the web renders its "Nothing
  // here yet" panel in place, so an empty result is still content on screen.
  useEffect(() => {
    onState(
      loading
        ? { phase: 'loading', itemCount: 0 }
        : { phase: 'ready', itemCount: Math.max(views.length, 1) }
    );
  }, [loading, views.length, onState]);

  const changeSection = useCallback(
    (key: SectionKey) => {
      if (key === section) return;
      setSection(key);
      setLoading(true);
      void run(key, authed).finally(() => setLoading(false));
    },
    [section, authed, run]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void run(section, authed).finally(() => setRefreshing(false));
  }, [section, authed, run]);

  const config = SECTION_MAP[section];
  // `w-[calc(50vw-24px)] max-w-[200px]`
  const cardWidth = Math.min(200, width / 2 - 24);

  const header = (
    <View className="mb-4 gap-3">
      <View className="flex-row items-center gap-3">
        <View className={`rounded-xl p-2.5 ${config.tileClass}`}>{config.icon}</View>
        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900" style={{ letterSpacing: -0.3 }}>
            {config.title}
          </Text>
          <Text className="text-sm text-gray-500">{config.subtitle}</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 self-end">
        <Pressable
          onPress={refresh}
          disabled={refreshing || loading}
          accessibilityLabel="Refresh recommendations"
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={{ opacity: refreshing || loading ? 0.4 : 1 }}
        >
          <Ionicons name="refresh" size={20} color="#6b7280" />
        </Pressable>
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ x: 0, animated: true })}
          accessibilityLabel="Scroll left"
          className="h-11 w-11 items-center justify-center rounded-lg"
        >
          <Ionicons name="chevron-back" size={20} color="#6b7280" />
        </Pressable>
        <Pressable
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          accessibilityLabel="Scroll right"
          className="h-11 w-11 items-center justify-center rounded-lg"
        >
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </Pressable>
      </View>
    </View>
  );

  const tabs = (
    <View className="mb-5 flex-row flex-wrap gap-2">
      {SECTION_KEYS.map((key) => {
        const active = key === section;
        return (
          <Pressable
            key={key}
            onPress={() => changeSection(key)}
            className={`rounded-full px-4 py-1.5 ${active ? 'bg-gray-900' : 'bg-gray-100'}`}
          >
            <Text
              className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-600'}`}
            >
              {SECTION_MAP[key].title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View className="border-t border-gray-100 bg-white py-8">
      <View style={{ paddingHorizontal: GUTTER }}>
        {header}
        {tabs}

        {loading ? (
          <View className="flex-row gap-3">
            {[0, 1].map((i) => (
              <View key={i} style={{ width: cardWidth }}>
                <View className="aspect-square rounded-2xl bg-gray-100" />
                <View className="mt-3 gap-2 px-1">
                  <View className="h-3 w-3/4 rounded bg-gray-100" />
                  <View className="h-3 w-1/3 rounded bg-gray-100" />
                </View>
              </View>
            ))}
          </View>
        ) : hasError || views.length === 0 ? (
          <View className="items-center py-16">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="cube-outline" size={32} color="#9ca3af" />
            </View>
            <Text className="mb-2 text-lg font-semibold text-gray-900">Nothing here yet</Text>
            <Text className="mb-6 text-center text-gray-500">
              We couldn&apos;t load recommendations right now. Try refreshing or browse our full
              catalog.
            </Text>
            <View className="flex-row items-center justify-center gap-3">
              <Pressable
                onPress={refresh}
                className="flex-row items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5"
              >
                <Ionicons name="refresh" size={16} color="#ffffff" />
                <Text className="font-medium text-white">Try Again</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/shop')}
                className="rounded-xl bg-gray-100 px-5 py-2.5"
              >
                <Text className="font-medium text-gray-700">Browse Shop</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
            >
              {views.map((view) => (
                <RecommendedCard key={view.id} view={view} width={cardWidth} />
              ))}
            </ScrollView>

            {products.length >= MAX_ITEMS ? (
              <View className="mt-6 items-center">
                <Pressable
                  onPress={() => router.push('/shop')}
                  className="flex-row items-center gap-2 rounded-xl bg-gray-900 px-6 py-3"
                >
                  <Text className="font-medium text-white">View All Products</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
