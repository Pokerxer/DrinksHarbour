import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { contentPosition, textAlignOf, type BannerView } from '../../lib/banner.ts';
import { CustomGradient, Gradient } from '../ui/gradient.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';

/**
 * One hero slide, sized to exactly one page of the carousel.
 *
 * Extracted from `hero-banner.tsx` when the hero became a horizontal paging
 * ScrollView: every slide is now mounted side by side rather than one at a time,
 * so a slide has to carry its own explicit width. Nothing else about it changed —
 * the gradient stack, the overlay and the CTA are the same markup they were.
 */

/** `#1A1A2E` + `f2` etc — the web appends the alpha byte to the slide colour. */
const alpha = (hex: string, byte: string) => `${hex}${byte}`;

export function HeroSlide({
  slide,
  width,
  height,
  onCtaPress,
}: {
  slide: BannerView;
  width: number;
  height: number;
  onCtaPress: (slide: BannerView) => void;
}) {
  const bg = slide.backgroundColor;
  const position = useMemo(() => contentPosition(slide.contentPosition), [slide.contentPosition]);
  const align = textAlignOf(slide.textAlignment);

  return (
    <View style={{ width, height }} className="overflow-hidden">
      {/* Background image — or the slide's flat colour when it has no artwork. */}
      {slide.imageUrl ? (
        <RemoteImage uri={slide.imageUrl} className="absolute inset-0 h-full w-full" />
      ) : (
        <View style={{ backgroundColor: bg }} className="absolute inset-0" />
      )}

      {/*
        `/ 100` REPRODUCES A WEB BUG ON PURPOSE. models/Banner.js:137-141 declares
        overlayOpacity as 0..1 (live data: 0.4, 0.5), but HeroBanner.tsx:287 and
        PlacementBanner.tsx:136 both divide by 100 — so the web paints
        rgba(0,0,0,0.004), an overlay nobody can see. Dividing correctly here
        would make every mobile banner visibly darker than the same banner on the
        web, which is the opposite of parity. Fix both apps together, or neither.
      */}
      {slide.overlayOpacity > 0 ? (
        <View
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${slide.overlayOpacity / 100})` }}
        />
      ) : null}

      {/* Cinematic treatment. The web stacks four layers; the two radial ones
          (warm glow, vignette) have no RN equivalent and are approximated with
          directional linears. */}
      <CustomGradient
        pointerEvents="none"
        className="absolute inset-0"
        direction="r"
        colors={[alpha(bg, 'f2'), alpha(bg, 'b3'), alpha(bg, '40'), alpha(bg, '00')]}
        locations={[0, 0.32, 0.6, 0.78]}
      />
      <CustomGradient
        pointerEvents="none"
        className="absolute inset-0"
        direction="bl"
        colors={['rgba(245,176,66,0.22)', 'rgba(245,176,66,0)']}
        locations={[0, 0.45]}
      />
      <CustomGradient
        pointerEvents="none"
        className="absolute inset-0"
        direction="t"
        colors={[alpha(bg, 'e6'), alpha(bg, '00')]}
        locations={[0, 0.38]}
      />
      <CustomGradient
        pointerEvents="none"
        className="absolute inset-0"
        direction="t"
        colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)']}
        locations={[0, 0.35]}
      />

      {/* Content */}
      <View className="flex-1 px-5" style={position}>
        <View style={{ maxWidth: Math.min(width - 40, 672) }}>
          {slide.subtitle ? (
            <View
              className="mb-4 flex-row items-center gap-2 self-start rounded-full border px-4 py-2"
              style={{
                backgroundColor: 'rgba(251,191,36,0.12)',
                borderColor: 'rgba(252,211,77,0.25)',
              }}
            >
              <Ionicons name="sparkles" size={13} color="#fcd34d" />
              <Text className="text-sm font-semibold" style={{ color: '#fef3c7' }}>
                {slide.subtitle}
              </Text>
            </View>
          ) : null}

          <Text
            className="mb-3 text-3xl font-black text-white"
            style={{ textAlign: align, lineHeight: 32, letterSpacing: -0.5 }}
          >
            {slide.title}
          </Text>

          {slide.description ? (
            <Text
              className="mb-6 text-base text-white/80"
              style={{ textAlign: align, lineHeight: 24, maxWidth: 512 }}
            >
              {slide.description}
            </Text>
          ) : null}

          {slide.ctaText ? (
            <HeroCta
              text={slide.ctaText}
              style={slide.ctaStyle}
              onPress={() => onCtaPress(slide)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function HeroCta({
  text,
  style,
  onPress,
}: {
  text: string;
  style: string;
  onPress: () => void;
}) {
  const body = (
    <View className="flex-row items-center gap-2 px-8 py-4">
      <Text className="text-sm font-bold text-white">{text}</Text>
      <Ionicons name="arrow-forward" size={16} color="#ffffff" />
    </View>
  );

  if (style === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        className="self-start overflow-hidden rounded-full border"
        style={{ borderColor: 'rgba(251,191,36,0.3)' }}
      >
        <Gradient name="heroCta">{body}</Gradient>
      </Pressable>
    );
  }

  if (style === 'secondary') {
    return (
      <Pressable
        onPress={onPress}
        className="self-start rounded-full border"
        style={{
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderColor: 'rgba(252,211,77,0.35)',
        }}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} className="self-start rounded-full">
      {body}
    </Pressable>
  );
}
