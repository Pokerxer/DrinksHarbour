import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { fetchBanners } from '../../lib/catalog-api.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { RemoteImage } from '../ui/remote-image.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

/**
 * Block 6 — a single promotional banner. Unlike the hero this does not page;
 * if the placement returns several, the first is the one with the highest
 * display priority as the server ordered it.
 */
export function SecondaryBanner({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchBanners('home_secondary'), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="px-4 py-4">
        <Skeleton className="h-32 w-full" />
      </View>
    );
  }

  const banner = items[0];

  return (
    <View className="px-4 py-4">
      <Pressable
        className="h-32 overflow-hidden rounded-xl bg-gray-50"
        onPress={() => router.push('/shop')}
      >
        <RemoteImage uri={banner.image} className="h-full w-full" />
        {banner.title ? (
          <View className="absolute bottom-0 left-0 right-0 bg-gray-1000/45 px-3 py-2">
            <Text numberOfLines={1} className="text-sm font-semibold text-white">
              {banner.title}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
