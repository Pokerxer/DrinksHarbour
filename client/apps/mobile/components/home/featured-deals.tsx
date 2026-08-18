import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { fetchTrendingProducts } from '../../lib/catalog-api.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { toProductCardViews } from '../../lib/product-view.ts';
import { ProductCard } from '../ui/product-card.tsx';
import { SectionHeader } from '../ui/section-header.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

/** Block 4 — trending, presented as deals to match the web block's framing. */
export function FeaturedDeals({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchTrendingProducts(), []);
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
        <SectionHeader title="Featured deals" />
        <View className="flex-row gap-3 px-4">
          <Skeleton className="h-56 w-40" />
          <Skeleton className="h-56 w-40" />
        </View>
      </View>
    );
  }

  return (
    <View className="py-4">
      <SectionHeader title="Featured deals" onSeeAll={() => router.push('/shop')} />
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
