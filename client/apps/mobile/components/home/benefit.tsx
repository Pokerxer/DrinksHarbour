import { useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { BlockState } from '../../lib/home-blocks.ts';
import { Gradient } from '../ui/gradient.tsx';

/**
 * Section 6 — `Home1/Benefit.tsx`, mounted as `<Benefit className="py-8" />`.
 *
 * Static copy, no request. It still reports a BlockState so Home's "did
 * everything fail" check has one interface across every section; it is
 * permanently ready with four items, so it can never be why Home looks empty.
 *
 * The phone branch is the `lg:hidden` horizontal snap-scroll of four cards. The
 * `hidden lg:grid` variant — with its hover glow, step numbers and animated
 * stat counters — has no phone-width counterpart on the web and is not ported.
 */

const GUTTER = 16; // `container px-4`

interface BenefitItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Tailwind classes, same values as the web item. */
  titleColor: string;
  tileColor: string;
}

const BENEFITS: BenefitItem[] = [
  {
    icon: <MaterialCommunityIcons name="glass-wine" size={36} color="#dc2626" />,
    title: 'Premium Selection',
    description:
      'Curated collection of fine wines, craft beers, and premium spirits from world-renowned producers',
    titleColor: 'text-red-600',
    tileColor: 'bg-red-50',
  },
  {
    icon: <MaterialCommunityIcons name="truck-fast-outline" size={36} color="#2563eb" />,
    title: 'Express Delivery',
    description:
      'Lightning-fast delivery across Nigeria with temperature-controlled packaging for perfect quality',
    titleColor: 'text-blue-600',
    tileColor: 'bg-blue-50',
  },
  {
    icon: <Ionicons name="shield-checkmark-outline" size={36} color="#059669" />,
    title: 'Age Verified',
    description:
      'Secure age verification system ensuring all deliveries comply with regulations',
    titleColor: 'text-emerald-600',
    tileColor: 'bg-emerald-50',
  },
  {
    icon: <MaterialCommunityIcons name="medal-outline" size={36} color="#d97706" />,
    title: 'Quality Guaranteed',
    description:
      'Every bottle inspected and authenticated. Money-back guarantee on all purchases',
    titleColor: 'text-amber-600',
    tileColor: 'bg-amber-50',
  },
];

const TRUST_BADGES: Array<{ icon: React.ReactNode; text: string }> = [
  { icon: <Ionicons name="lock-closed-outline" size={14} color="#10b981" />, text: 'Secure' },
  { icon: <Ionicons name="card-outline" size={14} color="#10b981" />, text: 'Easy Pay' },
  { icon: <MaterialCommunityIcons name="thermometer" size={14} color="#10b981" />, text: 'Temp Safe' },
  { icon: <Ionicons name="calendar-outline" size={14} color="#10b981" />, text: '24/7' },
];

/** Six particles at the web's own left/top percentages (Benefit.tsx:146-159). */
const PARTICLES = Array.from({ length: 6 }, (_, i) => ({
  left: `${15 + i * 15}%`,
  top: `${20 + (i % 3) * 25}%`,
  color: i % 3 === 0 ? 'rgba(248,113,113,0.5)' : i % 3 === 1 ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)',
}));

const READY: BlockState = { phase: 'ready', itemCount: BENEFITS.length };

export function Benefit({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();

  useEffect(() => {
    onState(READY);
  }, [onState]);

  // `w-[80vw] max-w-[320px]`
  const cardWidth = Math.min(320, width * 0.8);

  return (
    <View className="relative overflow-hidden py-8">
      {/* Dynamic background */}
      <Gradient name="benefitSection" style={{ position: 'absolute', inset: 0 }} />

      {/* Decorative blobs. `blur-3xl` has no RN equivalent, so these are flat
          circles at a reduced opacity rather than soft gradients. */}
      <View
        pointerEvents="none"
        className="absolute -left-20 -top-20 h-96 w-96 rounded-full"
        style={{ backgroundColor: 'rgba(254,202,202,0.28)' }}
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-10 -right-10 h-80 w-80 rounded-full"
        style={{ backgroundColor: 'rgba(167,243,208,0.22)' }}
      />

      {PARTICLES.map((particle, i) => (
        <View
          key={i}
          pointerEvents="none"
          className="absolute h-2 w-2 rounded-full"
          style={{
            left: particle.left as `${number}%`,
            top: particle.top as `${number}%`,
            backgroundColor: particle.color,
          }}
        />
      ))}

      {/* Header */}
      <View className="mb-8 items-center" style={{ paddingHorizontal: GUTTER }}>
        <Text className="mb-3 text-center text-2xl font-black text-gray-900">Why Choose Us</Text>
        <Text className="text-center text-sm text-gray-500">
          Premium quality with <Text className="font-semibold text-red-600">fast delivery</Text> and{' '}
          <Text className="font-semibold text-emerald-600">guaranteed authenticity</Text>
        </Text>
      </View>

      {/* Cards — horizontal snap scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 16}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 16 }}
      >
        {BENEFITS.map((benefit) => (
          <View
            key={benefit.title}
            style={{ width: cardWidth }}
            className="rounded-2xl border border-gray-100 bg-white/80 p-5"
          >
            <View className="flex-row items-start gap-4">
              <View
                className={`h-12 w-12 items-center justify-center rounded-xl ${benefit.tileColor}`}
              >
                {benefit.icon}
              </View>
              <View className="flex-1">
                <Text className={`mb-1 text-base font-bold ${benefit.titleColor}`}>
                  {benefit.title}
                </Text>
                <Text numberOfLines={2} className="text-xs leading-relaxed text-gray-500">
                  {benefit.description}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Trust badges */}
      <View
        className="mt-8 flex-row flex-wrap items-center justify-center gap-2"
        style={{ paddingHorizontal: GUTTER }}
      >
        {TRUST_BADGES.map((badge) => (
          <View
            key={badge.text}
            className="flex-row items-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-1.5"
          >
            {badge.icon}
            <Text className="text-[10px] text-gray-600">{badge.text}</Text>
          </View>
        ))}
      </View>

      {/* Bottom CTA */}
      <View className="mt-8 items-center" style={{ paddingHorizontal: GUTTER }}>
        <Pressable onPress={() => router.push('/shop')} className="overflow-hidden rounded-full">
          <Gradient name="benefitCta">
            <View className="flex-row items-center gap-2 px-6 py-2.5">
              <Ionicons name="bag-outline" size={18} color="#ffffff" />
              <Text className="text-sm font-bold text-white">Shop Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </View>
          </Gradient>
        </Pressable>

        <Text className="mt-3 text-xs text-gray-400">
          Free delivery on orders over ₦2,000,000
        </Text>
      </View>
    </View>
  );
}
