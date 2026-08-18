import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { fetchFeaturedProducts } from '../../lib/catalog-api.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { toProductCardViews } from '../../lib/product-view.ts';
import { ProductCard } from '../ui/product-card.tsx';
import { SectionHeader } from '../ui/section-header.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

const GUTTER = 16;
const GAP = 12;

/**
 * Block 5 — the visual anchor, and the only block laid out as a grid.
 *
 * A plain wrapping View rather than FlatList: this sits inside the Home
 * ScrollView, and a nested vertical VirtualizedList logs a hard warning and
 * breaks scroll handoff. The list is bounded at 12 by the endpoint's limit.
 */
export function FeaturedProducts({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const load = useCallback(() => fetchFeaturedProducts(), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const views = useMemo(() => toProductCardViews(items), [items]);
  const cardWidth = (width - GUTTER * 2 - GAP) / 2;

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="py-4">
        <SectionHeader title="Featured products" />
        <View className="flex-row gap-3 px-4">
          <Skeleton className="h-56 flex-1" />
          <Skeleton className="h-56 flex-1" />
        </View>
      </View>
    );
  }

  return (
    <View className="py-4">
      <SectionHeader title="Featured products" onSeeAll={() => router.push('/shop')} />
      <View className="flex-row flex-wrap px-4" style={{ gap: GAP }}>
        {views.map((view) => (
          <ProductCard key={view.id} view={view} width={cardWidth} />
        ))}
      </View>
    </View>
  );
}
