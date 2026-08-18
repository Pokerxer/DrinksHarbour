import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { fetchBestsellers } from '../../lib/catalog-api.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { toProductCardViews } from '../../lib/product-view.ts';
import { ProductCard } from '../ui/product-card.tsx';
import { SectionHeader } from '../ui/section-header.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

/**
 * Block 8 — bestsellers standing in for personalisation.
 *
 * There is no recommendation endpoint. Bestsellers is the signed-out fallback
 * the web uses; personalisation is a later phase, and the section title is
 * written so it will not need to change when that lands.
 */
export function Recommended({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchBestsellers(), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const views = useMemo(() => toProductCardViews(items), [items]);

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="py-4">
        <SectionHeader title="Recommended for you" />
        <View className="flex-row gap-3 px-4">
          <Skeleton className="h-56 w-40" />
          <Skeleton className="h-56 w-40" />
        </View>
      </View>
    );
  }

  return (
    <View className="py-4">
      <SectionHeader title="Recommended for you" onSeeAll={() => router.push('/shop')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {views.map((view) => (
          <ProductCard key={view.id} view={view} />
        ))}
      </ScrollView>
    </View>
  );
}
