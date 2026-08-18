import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { BlockState } from '../../lib/home-blocks.ts';

/**
 * Block 7 — static local copy, no request.
 *
 * It still reports a BlockState so the Home screen's "did everything fail"
 * check has a uniform interface across all eight blocks. It is permanently
 * ready with four items, so it can never be the reason Home looks empty.
 *
 * Copy mirrors apps/platform/src/components/Home1/Benefit.tsx so the two apps
 * make the same promises.
 */

const BENEFITS: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}> = [
  {
    icon: 'wine-outline',
    title: 'Premium Selection',
    description: 'Curated collection of fine wines, craft beers, and premium spirits',
  },
  {
    icon: 'flash-outline',
    title: 'Express Delivery',
    description: 'Fast delivery across Nigeria with temperature-controlled packaging',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Age Verified',
    description: 'Secure age verification ensuring all deliveries comply with regulations',
  },
  {
    icon: 'ribbon-outline',
    title: 'Quality Guaranteed',
    description: 'Every bottle inspected and authenticated. Money-back guarantee',
  },
];

const READY: BlockState = { phase: 'ready', itemCount: BENEFITS.length };

export function BenefitsStrip({ onState }: { onState: (state: BlockState) => void }) {
  useEffect(() => {
    onState(READY);
  }, [onState]);

  return (
    <View className="gap-4 bg-gray-50 px-4 py-6">
      {BENEFITS.map((benefit) => (
        <View key={benefit.title} className="flex-row items-start gap-3">
          <Ionicons name={benefit.icon} size={22} color="#111111" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900">{benefit.title}</Text>
            <Text className="text-xs text-gray-600">{benefit.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
