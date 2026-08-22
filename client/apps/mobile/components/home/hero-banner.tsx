import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  bannerImageUrl,
  fetchBanners,
  trackBannerClick,
  trackBannerImpression,
  type RawBanner,
} from '../../lib/catalog-api.ts';
import {
  FALLBACK_HERO_SLIDES,
  HERO_AUTOPLAY_MS,
  HERO_DEFAULT_BACKGROUND,
  type BannerView,
} from '../../lib/banner.ts';
import {
  pageIndexFromOffset,
  pageOffset,
  shouldAutoplay,
  wrapIndex,
} from '../../lib/hero-carousel.ts';
import type { BlockState } from '../../lib/home-blocks.ts';
import { Gradient } from '../ui/gradient.tsx';
import { HeroSlide } from './hero-slide.tsx';

/**
 * Section 1 — `Banner/HeroBanner.tsx`, `placement=home_hero limit=5`.
 *
 * Everything structural is here: the fallback slides, the 6s autoplay, the
 * arrows, the amber pill indicators, the progress bar, and impression/click
 * tracking. What is NOT here is framer-motion's parallax dolly + rack-focus
 * transition — three animated depth layers per slide is a battery decision, not
 * a layout one, and the phone slides instead.
 *
 * The `hidden sm:flex` trust pills are absent because they are absent from the
 * platform at this width.
 *
 * **The swipe.** Slides live in a horizontal `pagingEnabled` ScrollView rather
 * than behind a hand-rolled pan gesture. Paging gives native momentum, the
 * native rubber-band at both ends, and pause-on-touch for free — no velocity
 * thresholds to invent and no new dependency. The one thing it cannot do is
 * wrap: `goTo` still wraps modulo-N (the web's behaviour, and autoplay depends
 * on it), so last→first is a `scrollTo` jump rather than a slide, at exactly one
 * boundary. Cloning slides to fake infinity would double-count banner
 * impressions and desync the dots.
 *
 * The arrows, dots and progress bar sit **outside** the ScrollView, absolutely
 * positioned over it, so all three keep working unchanged.
 */

/** `h-[46vh] min-h-[333px] max-h-[560px]` */
function heroHeight(windowHeight: number): number {
  return Math.min(560, Math.max(333, windowHeight * 0.46));
}

function toBannerView(raw: RawBanner): BannerView {
  return {
    _id: raw._id,
    title: raw.title,
    subtitle: raw.subtitle || null,
    description: raw.description || null,
    ctaText: raw.ctaText || null,
    ctaLink: raw.ctaLink || null,
    ctaStyle: raw.ctaStyle || 'primary',
    linkType: raw.linkType || null,
    backgroundColor: raw.backgroundColor || HERO_DEFAULT_BACKGROUND,
    textColor: raw.textColor || null,
    overlayOpacity: raw.overlayOpacity ?? 0,
    textAlignment: raw.textAlignment || 'left',
    contentPosition: raw.contentPosition || 'center',
    imageUrl: bannerImageUrl(raw),
    mobileImageUrl: null,
    priority: raw.priority || null,
    autoplayInterval: raw.autoplay?.interval || HERO_AUTOPLAY_MS,
    isFallback: false,
  };
}

export function HeroBanner({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width, height: windowHeight } = useWindowDimensions();
  const height = heroHeight(windowHeight);

  const [banners, setBanners] = useState<BannerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  /** True from the moment a finger lands until the carousel settles again. */
  const [interacting, setInteracting] = useState(false);
  const seenImpressions = useRef<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await fetchBanners('home_hero', 5);
      if (cancelled) return;
      if (result.ok && result.data.length > 0) setBanners(result.data.map(toBannerView));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The hero never disappears: with no banners it shows the fallback pair, so it
  // reports content the moment it stops loading.
  const slides = banners.length > 0 ? banners : FALLBACK_HERO_SLIDES;

  useEffect(() => {
    onState(
      loading
        ? { phase: 'loading', itemCount: 0 }
        : { phase: 'ready', itemCount: slides.length }
    );
  }, [loading, slides.length, onState]);

  const slide = slides[Math.min(index, slides.length - 1)];
  const interval = slide?.autoplayInterval ?? HERO_AUTOPLAY_MS;
  const autoplay = shouldAutoplay({ loading, slideCount: slides.length, interacting });

  /** The one way the index moves other than a swipe: arrows, dots, autoplay. */
  const goTo = useCallback(
    (next: number) => {
      const target = wrapIndex(next, slides.length);
      setIndex(target);
      scrollRef.current?.scrollTo({ x: pageOffset(target, width), animated: true });
    },
    [slides.length, width]
  );

  // Auto-advance. Suspended while a finger is down, and restarted from a full
  // interval once it lifts — so a slide never changes under the hand that is
  // swiping it.
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => goTo(index + 1), interval);
    return () => clearTimeout(timer);
  }, [autoplay, goTo, index, interval]);

  // Rotating changes the page width, which would otherwise leave the carousel
  // resting between two slides.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: pageOffset(index, width), animated: false });
    // Only on a width change: re-running this on every index change would fight
    // goTo's own animated scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  // One impression per real banner per mount, when it first becomes visible.
  useEffect(() => {
    if (loading || !slide || slide.isFallback) return;
    if (seenImpressions.current.has(slide._id)) return;
    seenImpressions.current.add(slide._id);
    trackBannerImpression(slide._id);
  }, [loading, slide]);

  // Autoplay progress bar. Restarted per slide; `width` cannot use the native
  // driver, which is why this is a plain Animated.Value rather than Reanimated.
  // It is gated on the same `autoplay` boolean as the timer above — a bar that
  // keeps filling under a stationary slide is worse than no bar at all.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!autoplay) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: interval,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [autoplay, index, interval, progress]);

  const onCtaPress = useCallback(
    (pressed: BannerView) => {
      trackBannerClick(pressed._id);
      // Banner links are WEB paths. Until the mobile route map covers them, Shop
      // is the honest destination — better than a dead press.
      router.push('/shop');
    },
    [router]
  );

  /**
   * Where the carousel came to rest. Read from the momentum end rather than the
   * drag end: at the moment the finger lifts, the offset is wherever it happened
   * to be, and paging decides the destination from velocity — so rounding there
   * makes the dots jump to one slide and back over the ~200ms snap.
   */
  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(pageIndexFromOffset(event.nativeEvent.contentOffset.x, width, slides.length));
      setInteracting(false);
    },
    [slides.length, width]
  );

  if (loading) {
    return (
      <View
        style={{ height, backgroundColor: HERO_DEFAULT_BACKGROUND }}
        className="w-full items-center justify-center overflow-hidden"
      >
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (!slide) return null;

  return (
    <View
      style={{ height }}
      className="w-full overflow-hidden"
      accessibilityRole="none"
      accessibilityLabel="Promotional banners"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={slides.length > 1}
        showsHorizontalScrollIndicator={false}
        // A paging scroll settles on its own; the deceleration rate only decides
        // how far a flick carries before it snaps.
        decelerationRate="fast"
        onScrollBeginDrag={() => setInteracting(true)}
        // The drag end only lifts the autoplay hold. A paging release normally
        // ends in onMomentumScrollEnd, but a release that is already page-aligned
        // can finish with no momentum phase at all — and `interacting` left true
        // would mean autoplay never resumes.
        onScrollEndDrag={() => setInteracting(false)}
        onMomentumScrollEnd={settle}
        style={{ height }}
      >
        {slides.map((s) => (
          <HeroSlide
            key={s._id}
            slide={s}
            width={width}
            height={height}
            onCtaPress={onCtaPress}
          />
        ))}
      </ScrollView>

      {/* Nav arrows */}
      {slides.length > 1 ? (
        <>
          <HeroArrow side="left" onPress={() => goTo(index - 1)} />
          <HeroArrow side="right" onPress={() => goTo(index + 1)} />
        </>
      ) : null}

      {/* Dots */}
      {slides.length > 1 ? (
        // `box-none`: the row spans the full width, so without it the strip of
        // screen at the dots' height would swallow every swipe that started there.
        <View
          pointerEvents="box-none"
          className="absolute bottom-8 left-0 right-0 flex-row items-center justify-center gap-2"
        >
          {slides.map((s, i) => (
            <Pressable
              key={s._id}
              onPress={() => goTo(i)}
              hitSlop={8}
              accessibilityLabel={`Go to slide ${i + 1} of ${slides.length}`}
              className={`h-2 rounded-full ${i === index ? 'w-7 bg-amber-400' : 'w-2 bg-white/35'}`}
            />
          ))}
        </View>
      ) : null}

      {/* Progress bar */}
      {slides.length > 1 ? (
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10"
        >
          <Animated.View
            style={{
              height: '100%',
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }}
          >
            <Gradient name="heroProgress" style={{ flex: 1 }} />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function HeroArrow({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={side === 'left' ? 'Previous slide' : 'Next slide'}
      className={`absolute ${side === 'left' ? 'left-4' : 'right-4'} h-11 w-11 items-center justify-center rounded-full border`}
      // `top-1/2 -translate-y-1/2` — NativeWind has no percentage translate, so
      // the -22 (half of h-11) is written out.
      style={{
        top: '50%',
        marginTop: -22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderColor: 'rgba(252,211,77,0.25)',
      }}
    >
      <Ionicons
        name={side === 'left' ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color="#ffffff"
      />
    </Pressable>
  );
}
