import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { fetchOnSaleProducts } from '../../lib/catalog-api.ts';
import { earliestSaleEnd, timeLeftUntil } from '../../lib/countdown.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { toProductCardViews } from '../../lib/product-view.ts';
import { ProductCard } from '../ui/product-card.tsx';
import { SectionHeader } from '../ui/section-header.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { useBlock } from './use-block.ts';

const pad = (n: number) => String(n).padStart(2, '0');

function Countdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = timeLeftUntil(endsAt, now);
  if (left.expired) return null;

  const label =
    left.days > 0
      ? `${left.days}d ${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`
      : `${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`;

  return (
    <View className="rounded bg-red px-2 py-1">
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </View>
  );
}

/**
 * Block 3 — flash sale.
 *
 * There is no promotions endpoint; this is /api/products?onSale=true, the same
 * call the web block makes. See catalog-api.ts.
 */
export function FlashSale({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const load = useCallback(() => fetchOnSaleProducts(), []);
  const { items, state } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const views = useMemo(() => toProductCardViews(items), [items]);
  // Anchored once per payload, not per tick — recomputing against a moving
  // `now` would let the deadline drift forward forever.
  const endsAt = useMemo(() => earliestSaleEnd(items, Date.now()), [items]);

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  if (mode === 'skeleton') {
    return (
      <View className="py-4">
        <SectionHeader title="Flash sale" />
        <View className="flex-row gap-3 px-4">
          <Skeleton className="h-56 w-40" />
          <Skeleton className="h-56 w-40" />
        </View>
      </View>
    );
  }

  return (
    <View className="py-4">
      <SectionHeader
        title="Flash sale"
        accessory={<Countdown endsAt={endsAt} />}
        onSeeAll={() => router.push('/shop')}
      />
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
