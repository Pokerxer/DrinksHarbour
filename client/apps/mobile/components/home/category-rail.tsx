import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { fetchFeaturedCategories } from '../../lib/catalog-api.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { Chip } from '../ui/chip.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

/**
 * Block 1 — the category rail.
 *
 * `onState` lets the Home screen decide whether EVERY block came back empty
 * without any block knowing about its neighbours.
 */
export function CategoryRail({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchFeaturedCategories(), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="flex-row gap-2 px-4 py-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-20" />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 py-3"
    >
      {items.map((category) => (
        <Chip
          key={category._id}
          label={category.name}
          imageUrl={category.image}
          // Shop does not read this param yet (Phase 4). The tap still lands on
          // the right tab rather than dead-ending.
          onPress={() => router.push('/shop')}
        />
      ))}
    </ScrollView>
  );
}
