import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Benefit } from '../../components/home/benefit.tsx';
import { FeaturedDeals } from '../../components/home/featured-deals.tsx';
import { FeaturedProducts } from '../../components/home/featured-products.tsx';
import { FlashSale } from '../../components/home/flash-sale.tsx';
import { HeroBanner } from '../../components/home/hero-banner.tsx';
import { PlacementBanner } from '../../components/home/placement-banner.tsx';
import { RecommendedForYou } from '../../components/home/recommended-for-you.tsx';
import {
  HOME_BLOCK_ORDER,
  isHomeEmpty,
  isHomeSettled,
  type BlockState,
  type HomeBlockId,
} from '../../lib/home-blocks.ts';

/**
 * Home — `apps/platform/src/app/page.tsx`, section for section.
 *
 * The page shell is `bg-gray-100 min-h-screen` and the sections supply their own
 * white/gradient backgrounds, so the gray shows only in the seams. There is no
 * app-name header on the web homepage and there is none here — the hero is the
 * first thing on screen.
 *
 * This screen issues no requests of its own; it only collects each section's
 * state so it can tell "a rail is missing" (normal) from "nothing loaded at all"
 * (worth a retry button). `remountKey` is how retry works: bumping it remounts
 * every section, and each re-runs its own fetch on mount — simpler and more
 * honest than threading seven reload callbacks up here.
 */
export default function HomeScreen() {
  const [states, setStates] = useState<Partial<Record<HomeBlockId, BlockState>>>({});
  const [remountKey, setRemountKey] = useState(0);

  /**
   * One callback per section, built ONCE.
   *
   * Each section's onState effect lists onState in its deps, so a fresh arrow
   * per render would re-fire every effect on every render. Building the map in
   * useMemo keeps each identity stable for the life of the screen.
   *
   * The setStates updater still returns `previous` unchanged when nothing moved,
   * so a section re-reporting an identical state cannot spin the render loop.
   */
  const report = useMemo(() => {
    const handlers = {} as Record<HomeBlockId, (state: BlockState) => void>;

    for (const id of HOME_BLOCK_ORDER) {
      handlers[id] = (state: BlockState) =>
        setStates((previous) =>
          previous[id]?.phase === state.phase && previous[id]?.itemCount === state.itemCount
            ? previous
            : { ...previous, [id]: state }
        );
    }

    return handlers;
  }, []);

  /**
   * The pull-to-refresh spinner.
   *
   * This screen owns no fetch, so there is no loading flag to hand
   * `RefreshControl` — which is why it used to be hardcoded `refreshing={false}`
   * and the indicator vanished the instant the finger lifted. The honest signal
   * is already being collected: `isHomeSettled` is true only once all seven
   * blocks have reported and none is still loading.
   *
   * `refreshing` has to be a real state rather than `!isHomeSettled(states)`,
   * because on first load nothing has been pulled and the spinner must stay
   * away. It is raised by `retry` and lowered only by the effect below.
   */
  const [refreshing, setRefreshing] = useState(false);
  const settled = isHomeSettled(states);

  useEffect(() => {
    if (refreshing && settled) setRefreshing(false);
  }, [refreshing, settled]);

  const retry = useCallback(() => {
    setRefreshing(true);
    setStates({});
    setRemountKey((n) => n + 1);
  }, []);

  const empty = isHomeEmpty(states);

  return (
    // No `top` edge: AppHeader sits above this screen and already consumes the
    // status-bar inset. Claiming it here too would leave a gray band under the
    // header.
    <SafeAreaView className="flex-1 bg-gray-100" edges={[]}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={retry} tintColor="#f97316" />
        }
      >
        {empty ? (
          <View className="items-center gap-3 px-8 py-24">
            <Text className="text-center text-base text-gray-700">
              We could not load the store just now.
            </Text>
            <Pressable onPress={retry} className="rounded-lg bg-gray-900 px-5 py-3">
              <Text className="text-sm font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {/*
          Hidden rather than unmounted when empty: the sections must stay mounted
          to keep reporting, otherwise unmounting them would clear the very
          states that decided Home was empty and the retry screen would flicker.
        */}
        <View key={remountKey} className={empty ? 'hidden' : ''}>
          <HeroBanner onState={report.hero} />
          <FlashSale onState={report.flashSale} />
          <FeaturedDeals onState={report.featuredDeals} />
          <FeaturedProducts onState={report.featuredProducts} />
          <PlacementBanner onState={report.secondaryBanner} />
          <Benefit onState={report.benefits} />
          <RecommendedForYou onState={report.recommended} />
        </View>

        {/* `<div className="h-[60px] lg:hidden" />` — the web's bottom spacer for
            its floating mobile category button. Here it clears the tab bar. */}
        <View className="h-[60px]" />
      </ScrollView>
    </SafeAreaView>
  );
}
