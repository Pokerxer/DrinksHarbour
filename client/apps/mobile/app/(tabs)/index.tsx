import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BenefitsStrip } from '../../components/home/benefits-strip.tsx';
import { CategoryRail } from '../../components/home/category-rail.tsx';
import { FeaturedDeals } from '../../components/home/featured-deals.tsx';
import { FeaturedProducts } from '../../components/home/featured-products.tsx';
import { FlashSale } from '../../components/home/flash-sale.tsx';
import { HeroCarousel } from '../../components/home/hero-carousel.tsx';
import { Recommended } from '../../components/home/recommended.tsx';
import { SecondaryBanner } from '../../components/home/secondary-banner.tsx';
import {
  HOME_BLOCK_ORDER,
  isHomeEmpty,
  type BlockState,
  type HomeBlockId,
} from '../../lib/home-blocks.ts';

/**
 * Home.
 *
 * Eight independent blocks in the order HOME_BLOCK_ORDER declares. This screen
 * issues no requests of its own — it only collects each block's state so it can
 * tell the difference between "a rail is missing" (normal) and "nothing loaded
 * at all" (worth a retry button).
 *
 * `remountKey` is how retry works: bumping it remounts every block, and each
 * block re-runs its own fetch on mount. That is simpler and more honest than
 * threading eight reload callbacks up to this screen.
 */
export default function HomeScreen() {
  const [states, setStates] = useState<Partial<Record<HomeBlockId, BlockState>>>({});
  const [remountKey, setRemountKey] = useState(0);

  /**
   * One callback per block, built ONCE.
   *
   * Each block's onState effect lists onState in its deps, so a fresh arrow per
   * render would re-fire all eight effects on every render. Building the map in
   * useMemo keeps each identity stable for the life of the screen.
   *
   * The setStates updater still returns `previous` unchanged when nothing moved,
   * so a block re-reporting an identical state cannot spin the render loop.
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

  const retry = useCallback(() => {
    setStates({});
    setRemountKey((n) => n + 1);
  }, []);

  const empty = isHomeEmpty(states);

  return (
    <SafeAreaView className="flex-1 bg-gray-0" edges={['top']}>
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={false} onRefresh={retry} />}
      >
        <View className="px-4 pb-1 pt-2">
          <Text className="text-2xl font-semibold text-gray-900">DrinksHarbour</Text>
        </View>

        {empty ? (
          <View className="items-center gap-3 px-8 py-24">
            <Text className="text-center text-base text-gray-700">
              We could not load the store just now.
            </Text>
            <Pressable onPress={retry} className="rounded-lg bg-primary px-5 py-3">
              <Text className="text-sm font-semibold text-primary-foreground">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {/*
          Hidden rather than unmounted when empty: the blocks must stay mounted
          to keep reporting, otherwise unmounting them would clear the very
          states that decided Home was empty and the retry screen would flicker.
        */}
        <View key={remountKey} className={empty ? 'hidden' : ''}>
          <CategoryRail onState={report.categories} />
          <HeroCarousel onState={report.hero} />
          <FlashSale onState={report.flashSale} />
          <FeaturedDeals onState={report.featuredDeals} />
          <FeaturedProducts onState={report.featuredProducts} />
          <SecondaryBanner onState={report.secondaryBanner} />
          <BenefitsStrip onState={report.benefits} />
          <Recommended onState={report.recommended} />
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
