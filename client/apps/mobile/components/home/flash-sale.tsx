import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { fetchOnSaleProducts, type RawProduct } from '../../lib/catalog-api.ts';
import { earliestSaleEnd, timeLeftUntil } from '../../lib/countdown.ts';
import {
  formatSoldCount,
  getBestSale,
  isFlashSaleSection,
  stockInfoOf,
  withDiscountFirst,
} from '../../lib/flash-sale.ts';
import { blockRender, type BlockState } from '../../lib/home-blocks.ts';
import { Gradient } from '../ui/gradient.tsx';
import { formatNaira } from '../ui/price.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';
import { StockStatus } from '../ui/stock-status.tsx';
import { useBlock } from './use-block.ts';

/**
 * Section 2 — `Home1/FlashSale.tsx`.
 *
 * `/api/products?onSale=true&limit=20&inStock=false`. There is no promotions
 * endpoint; promotion.routes.js exposes only /stats, /calculate-discount,
 * /validate-code, /code/:code and /subproduct/:id. The web block calls exactly
 * this query. Do not "fix" it.
 *
 * At phone width the web's Swiper sits on its `320: slidesPerView: 2`
 * breakpoint, and its header "View All" link is `hidden sm:flex` — so the only
 * View All here is the `sm:hidden` pill at the bottom, as on the web.
 */

const GUTTER = 16; // px-4
const GAP = 12; // spaceBetween={12}
const SLIDES_PER_VIEW = 2;

const pad = (n: number) => String(n).padStart(2, '0');

// ─── Countdown ────────────────────────────────────────────────────────────────

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-center">
      <View
        className="h-9 w-9 items-center justify-center rounded-lg border"
        style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)' }}
      >
        <Text className="text-sm font-black text-white">{pad(value)}</Text>
      </View>
      <Text className="mt-0.5 text-[9px] font-medium uppercase text-white/70">{label}</Text>
    </View>
  );
}

function Colon() {
  return <Text className="mb-3 text-base font-black text-white opacity-80">:</Text>;
}

function CountdownTimer({ endsAt, onExpire }: { endsAt: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = timeLeftUntil(endsAt, now);
  const expired = left.expired;

  // Reload the rail once, on the tick that crosses the deadline — the web's
  // `onExpire` guard (`expiredRef`) exists for the same reason.
  useEffect(() => {
    if (expired) onExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (expired) {
    return (
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
        <Text className="text-xs text-white/80">Sale Ended</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-end gap-1">
      {left.days > 0 ? (
        <>
          <TimeBox value={left.days} label="Days" />
          <Colon />
        </>
      ) : null}
      <TimeBox value={left.hours} label="Hrs" />
      <Colon />
      <TimeBox value={left.minutes} label="Min" />
      <Colon />
      <TimeBox value={left.seconds} label="Sec" />
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function FlashSaleCard({ product, width }: { product: RawProduct; width: number }) {
  const sale = getBestSale(product);
  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || null;

  const isFlash = sale.saleType === 'flash_sale';
  const isFixed = sale.saleType === 'fixed';

  const { totalStock, availableStock } = stockInfoOf(product);
  const totalSold = (product.totalSold as number | undefined) ?? 0;
  const slug = typeof product.slug === 'string' ? product.slug : '';

  const badgeGradient = isFlash ? 'badgeFlash' : isFixed ? 'badgeFixed' : 'badgePercent';
  const badgeText =
    sale.discountLabel ||
    (isFixed
      ? `${formatNaira(sale.originalPrice - sale.currentPrice)} OFF`
      : `${sale.discountPct}% OFF`);

  return (
    <Link href={slug ? `/product/${slug}` : '/shop'} asChild>
      <Pressable
        style={{ width }}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
      >
        {/* Image */}
        <View className="relative aspect-square">
          <Gradient name="imagePlate" style={{ position: 'absolute', inset: 0 }} />
          {imageUrl ? (
            <RemoteImage uri={imageUrl} contentFit="contain" className="h-full w-full p-2" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="image-outline" size={44} color="#d1d5db" />
            </View>
          )}

          {sale.hasDiscount ? (
            <View className="absolute left-0 top-0 overflow-hidden rounded-br-xl">
              <Gradient name={badgeGradient}>
                <View className="flex-row items-center gap-0.5 px-2 py-1">
                  {isFlash ? <Ionicons name="flash" size={9} color="#ffffff" /> : null}
                  <Text className="text-[10px] font-black text-white">{badgeText}</Text>
                </View>
              </Gradient>
            </View>
          ) : null}

          {isFlash ? (
            <View className="absolute right-0 top-0 m-1 h-6 w-6 items-center justify-center rounded-full bg-orange-500">
              <Ionicons name="flash" size={12} color="#ffffff" />
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View className="p-2.5">
          <Text
            numberOfLines={2}
            style={{ minHeight: 32 }}
            className="text-[11px] font-semibold leading-tight text-gray-800"
          >
            {typeof product.name === 'string' ? product.name : ''}
          </Text>

          <View className="mt-1.5">
            <StockStatus
              stock={sale.stock}
              totalStock={totalStock ?? 100}
              availableStock={availableStock ?? sale.stock ?? 100}
              showProgress
            />
          </View>

          <View className="mt-2 flex-row items-center justify-between gap-1">
            <View className="flex-shrink">
              <Text className="text-sm font-black leading-tight text-red-500">
                {formatNaira(sale.currentPrice)}
              </Text>
              {sale.hasDiscount && sale.originalPrice > sale.currentPrice ? (
                <Text className="text-[10px] leading-tight text-gray-400 line-through">
                  {formatNaira(sale.originalPrice)}
                </Text>
              ) : null}
            </View>

            <View className="overflow-hidden rounded-xl">
              <Gradient name="badgeFlash">
                <View className="h-10 w-10 items-center justify-center">
                  <Ionicons name="cart-outline" size={15} color="#ffffff" />
                </View>
              </Gradient>
            </View>
          </View>

          {totalSold > 0 ? (
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons name="flame" size={10} color="#fb923c" />
              <Text className="text-[9px] text-gray-400">{formatSoldCount(totalSold)} sold</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const VEIL = 'rgba(255,255,255,0.2)';

function SkeletonCard({ width }: { width: number }) {
  return (
    <View style={{ width, backgroundColor: VEIL }} className="overflow-hidden rounded-2xl">
      <View className="aspect-square" style={{ backgroundColor: VEIL }} />
      <View className="gap-2 p-2.5">
        <View className="h-3 w-4/5 rounded" style={{ backgroundColor: VEIL }} />
        <View className="h-3 w-3/5 rounded" style={{ backgroundColor: VEIL }} />
        <View className="mt-3 h-4 w-1/2 rounded" style={{ backgroundColor: VEIL }} />
      </View>
    </View>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function FlashSale({ onState }: { onState: (state: BlockState) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const load = useCallback(() => fetchOnSaleProducts(), []);
  const { items, state, reload } = useBlock(load);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  const products = useMemo(() => withDiscountFirst(items), [items]);
  const isFlash = useMemo(() => isFlashSaleSection(items), [items]);
  // Anchored once per payload, not per tick — recomputing against a moving `now`
  // would let the deadline drift forward forever.
  const endsAt = useMemo(() => earliestSaleEnd(products, Date.now()), [products]);

  const cardWidth = (width - GUTTER * 2 - GAP * (SLIDES_PER_VIEW - 1)) / SLIDES_PER_VIEW;

  const mode = blockRender(state);
  if (mode === 'hidden') return null;

  const label = isFlash ? 'Flash Sale' : 'On Sale Now';
  const sublabel = isFlash ? 'Lightning deals — ends soon!' : 'Limited time offers';

  return (
    <Gradient name="flashSaleSection" className="relative overflow-hidden py-5">
      {/* Decorative glow blobs. The web blurs these (`blur-3xl`); RN has no
          filter, so they are drawn flat at a lower opacity instead. */}
      <View
        pointerEvents="none"
        className="absolute -left-8 -top-8 h-48 w-48 rounded-full"
        style={{ backgroundColor: 'rgba(250,204,21,0.12)' }}
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-8 -right-8 h-64 w-64 rounded-full"
        style={{ backgroundColor: 'rgba(185,28,28,0.18)' }}
      />

      <View className="px-4">
        {/* Header */}
        <View className="mb-4 flex-row flex-wrap items-center justify-between gap-4">
          <View className="flex-row items-center gap-3">
            <View className="relative">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-white">
                <Ionicons name="flash" size={22} color="#f97316" />
              </View>
              <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-orange-500 bg-yellow-400" />
            </View>
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="text-xl font-black leading-tight text-white">{label}</Text>
                <View className="rounded-full bg-yellow-400 px-2 py-0.5">
                  <Text className="text-[10px] font-black text-red-700">LIVE</Text>
                </View>
              </View>
              <Text className="text-xs leading-tight text-white/75">{sublabel}</Text>
            </View>
          </View>

          <View
            className="flex-row items-center gap-2 rounded-2xl border px-3 py-2"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.7)" />
            {mode === 'content' ? (
              <CountdownTimer endsAt={endsAt} onExpire={reload} />
            ) : (
              <View className="h-9 w-24 rounded" style={{ backgroundColor: VEIL }} />
            )}
          </View>
        </View>

        {/* Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // `-mx-4 px-4`: the rail bleeds to the screen edge but starts inset.
          style={{ marginHorizontal: -GUTTER }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP, paddingBottom: 8 }}
        >
          {mode === 'skeleton'
            ? [0, 1, 2].map((i) => <SkeletonCard key={i} width={cardWidth} />)
            : products.map((product) => (
                <FlashSaleCard key={String(product._id)} product={product} width={cardWidth} />
              ))}
        </ScrollView>

        {/* Mobile "View All" */}
        {mode === 'content' ? (
          <View className="mt-3 items-center">
            <Pressable
              onPress={() => router.push('/shop')}
              className="flex-row items-center gap-1.5 rounded-xl px-4 py-2"
              style={{ backgroundColor: VEIL }}
            >
              <Text className="text-sm font-bold text-white">
                View All {products.length}+ Deals
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Gradient>
  );
}
