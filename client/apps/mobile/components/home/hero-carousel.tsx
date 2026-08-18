import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { fetchBanners } from '../../lib/catalog-api.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { Carousel } from '../ui/carousel.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

const HERO_HEIGHT = 200;

/**
 * Block 2 — the hero.
 *
 * catalog-api already drops banners with no artwork, so every slide reaching
 * here has an image. A banner's linkUrl is a WEB path; until the mobile route
 * map covers those, a tap goes to Shop rather than nowhere.
 */
export function HeroCarousel({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchBanners('home_hero'), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="px-4 py-2">
        <Skeleton className="h-[200px] w-full" />
      </View>
    );
  }

  return (
    <View className="py-2">
      <Carousel
        data={items}
        height={HERO_HEIGHT}
        keyExtractor={(banner) => banner._id}
        renderItem={(banner) => (
          <Pressable className="flex-1 px-4" onPress={() => router.push('/shop')}>
            <View className="flex-1 overflow-hidden rounded-xl bg-gray-50">
              <RemoteImage uri={banner.image} className="h-full w-full" />
              {banner.title ? (
                <View className="absolute bottom-0 left-0 right-0 bg-gray-1000/45 px-3 py-2">
                  <Text numberOfLines={1} className="text-sm font-semibold text-white">
                    {banner.title}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
