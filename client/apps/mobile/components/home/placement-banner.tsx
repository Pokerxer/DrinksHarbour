import { useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  bannerImageUrl,
  fetchBanners,
  trackBannerClick,
  trackBannerImpression,
  type RawBanner,
} from '../../lib/catalog-api.ts';
import {
  contentPosition,
  placementAspectRatio,
  placementCtaSkin,
  placementTextAlign,
} from '../../lib/banner.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { useBlock } from './use-block.ts';
import { RemoteImage } from '../ui/remote-image.tsx';

/**
 * Section 5 — `Banner/PlacementBanner.tsx`, `placement=home_secondary`,
 * `variant="hero"`, `limit=1`, wrapper `container mx-auto px-3 py-4`.
 *
 * Only the hero variant is ported: it is the only one the homepage mounts. The
 * compact / footer / sidebar variants belong to checkout and the footer and have
 * no home-screen equivalent to be missing from.
 *
 * `home_secondary` is a 3:1 strip, not the 21:9 hero shape — that mapping is
 * `PLACEMENT_ASPECT` and it lives in lib/banner.ts.
 */

const PLACEMENT = 'home_secondary';
const HORIZONTAL_PADDING = 12; // `px-3`

export function PlacementBanner({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchBanners(PLACEMENT, 1), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const banner: RawBanner | undefined = items[0];

  // One impression per banner, exactly as the web's `trackedRef` set does.
  useEffect(() => {
    if (banner?._id) trackBannerImpression(banner._id);
  }, [banner?._id]);

  const position = useMemo(
    () => contentPosition(banner?.contentPosition ?? 'center'),
    [banner?.contentPosition]
  );

  const mode = blockRender(state);
  // The web returns null while loading too — no skeleton, no reserved space.
  if (mode !== 'content' || !banner) return null;

  const textAlign = placementTextAlign(banner.contentPosition ?? 'center');
  const cta = placementCtaSkin(banner.ctaStyle);
  // `/ 100` reproduces a web bug on purpose — see the note in hero-banner.tsx.
  // The schema stores 0..1; both web components divide by 100 anyway.
  const overlay = (banner.overlayOpacity ?? 0) / 100;
  const imageUrl = bannerImageUrl(banner);
  const textColor = banner.textColor || '#ffffff';
  const priority = banner.priority;

  const onPress = () => {
    trackBannerClick(banner._id);
    router.push('/shop');
  };

  return (
    <View className="py-4" style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
      <View
        className="relative overflow-hidden rounded-2xl border bg-gray-900"
        style={{
          aspectRatio: placementAspectRatio(banner.placement || PLACEMENT),
          borderColor: 'rgba(229,231,235,0.5)',
        }}
      >
        {imageUrl ? (
          <RemoteImage uri={imageUrl} className="absolute inset-0 h-full w-full" />
        ) : (
          <View
            className="absolute inset-0"
            style={{ backgroundColor: banner.backgroundColor || '#1A1A2E' }}
          />
        )}

        {overlay > 0 ? (
          <View className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
        ) : null}

        {/* Positioned content */}
        <View className="absolute inset-0 gap-2 p-5" style={position}>
          {banner.subtitle ? (
            <Text
              className="text-sm font-medium"
              style={{ color: `${textColor}cc`, textAlign }}
            >
              {banner.subtitle}
            </Text>
          ) : null}

          <Text className="text-xl font-black" style={{ color: textColor, textAlign }}>
            {banner.title}
          </Text>

          {banner.description ? (
            <Text
              className="text-sm"
              style={{ color: `${textColor}99`, textAlign, maxWidth: 448 }}
            >
              {banner.description}
            </Text>
          ) : null}

          {banner.ctaText ? (
            <Pressable
              onPress={onPress}
              className="flex-row items-center gap-1.5 rounded-xl px-5 py-2.5"
              style={{
                backgroundColor: cta.backgroundColor,
                borderColor: cta.borderColor,
                borderWidth: cta.borderWidth ?? 0,
              }}
            >
              <Text
                className="text-sm font-bold"
                style={{
                  color: cta.textColor,
                  textDecorationLine: cta.underline ? 'underline' : 'none',
                }}
              >
                {banner.ctaText}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={cta.textColor} />
            </Pressable>
          ) : null}
        </View>

        {/* Priority badge — urgent / high only */}
        {priority === 'urgent' || priority === 'high' ? (
          <View
            className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full px-2 py-0.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <View
              className={`h-1.5 w-1.5 rounded-full ${
                priority === 'urgent' ? 'bg-red-400' : 'bg-orange-400'
              }`}
            />
            <Text className="text-[10px] font-bold text-white">{priority}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
