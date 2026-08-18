import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { resolvePackPricing } from 'commerce-core';
import { fetchProductBySlug, type RawProduct } from '../../lib/catalog-api.ts';
import { productImageUrl } from '../../lib/product-view.ts';
import { Price } from '../../components/ui/price.tsx';
import { RemoteImage } from '../../components/ui/remote-image.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';

interface SizeOption {
  size: string;
  stock: number;
  price: number | null;
  originalPrice: number | null;
  packUnitPrice: number | null;
  packThreshold: number | null;
  packSavingsPct: number | null;
  onSale: boolean;
  maxOrderQuantity: number | null;
}

/**
 * Read the vendor's sizes off the raw product.
 *
 * /api/products/slug/:slug is the only endpoint that publishes pack fields
 * (the quickview-pack-pricing memory), which is why detail uses it rather than
 * reusing a list projection.
 */
function readSizes(product: RawProduct | null): SizeOption[] {
  const vendor = (product?.availableAt as Array<Record<string, any>> | undefined)?.[0];
  const sizes = Array.isArray(vendor?.sizes) ? vendor.sizes : [];

  return sizes.map((raw: Record<string, any>) => ({
    size: typeof raw?.size === 'string' ? raw.size : '',
    stock: typeof raw?.stock === 'number' ? raw.stock : 0,
    price: typeof raw?.pricing?.websitePrice === 'number' ? raw.pricing.websitePrice : null,
    originalPrice:
      typeof raw?.pricing?.originalWebsitePrice === 'number'
        ? raw.pricing.originalWebsitePrice
        : null,
    packUnitPrice:
      typeof raw?.pricing?.packUnitPrice === 'number' ? raw.pricing.packUnitPrice : null,
    packThreshold: typeof raw?.packThreshold === 'number' ? raw.packThreshold : null,
    packSavingsPct:
      typeof raw?.pricing?.packSavingsPct === 'number' ? raw.pricing.packSavingsPct : null,
    onSale: !!raw?.pricing?.isOnSale,
    maxOrderQuantity: typeof raw?.maxOrderQuantity === 'number' ? raw.maxOrderQuantity : null,
  }));
}

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [product, setProduct] = useState<RawProduct | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState(0);

  const load = useCallback(async () => {
    if (!slug) {
      setPhase('error');
      return;
    }

    setPhase('loading');
    const result = await fetchProductBySlug(slug);

    if (!result.ok) {
      setPhase('error');
      return;
    }

    setProduct(result.data);
    // First in-stock size, matching pickDefaultVariant's rule.
    const sizes = readSizes(result.data);
    const firstInStock = sizes.findIndex((s) => s.stock > 0);
    setSelected(firstInStock >= 0 ? firstInStock : 0);
    setPhase('ready');
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const sizes = useMemo(() => readSizes(product), [product]);
  const active = sizes[selected] ?? null;

  /**
   * Pack pricing at quantity 1 — the offer is shown, not applied. Quantity
   * belongs to the cart, which is Phase 4.
   */
  const pack = useMemo(
    () =>
      active
        ? resolvePackPricing({
            packUnitPrice: active.packUnitPrice,
            packThreshold: active.packThreshold,
            packSavingsPct: active.packSavingsPct,
            unitPrice: active.price ?? 0,
            quantity: 1,
            stock: active.stock,
            maxOrderQuantity: active.maxOrderQuantity,
            onSale: active.onSale,
          })
        : null,
    [active]
  );

  if (phase === 'loading') {
    return (
      <View className="flex-1 gap-4 bg-gray-0 p-4">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
      </View>
    );
  }

  // Detail is one of the two places the user IS told something went wrong
  // (design §7) — this screen has no purpose without its product.
  if (phase === 'error' || !product) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-gray-0 px-8">
        <Text className="text-center text-base text-gray-700">
          We could not load this product.
        </Text>
        <Pressable onPress={() => void load()} className="rounded-lg bg-primary px-5 py-3">
          <Text className="text-sm font-semibold text-primary-foreground">Try again</Text>
        </Pressable>
      </View>
    );
  }

  const inStock = (active?.stock ?? 0) > 0;

  return (
    <ScrollView className="flex-1 bg-gray-0">
      <RemoteImage uri={productImageUrl(product)} className="h-80 w-full" contentFit="contain" />

      <View className="gap-4 p-4">
        <Text className="text-xl font-semibold text-gray-900">
          {typeof product.name === 'string' ? product.name : ''}
        </Text>

        <Price
          amount={pack?.effectiveUnitPrice ?? active?.price ?? null}
          originalAmount={active?.originalPrice ?? null}
          size="lg"
        />

        {pack?.hasPackPricing ? (
          <View className="rounded-lg bg-green-lighter px-3 py-2">
            <Text className="text-xs text-green-dark">
              Buy {pack.packThreshold} or more and pay less per bottle.
            </Text>
          </View>
        ) : null}

        {sizes.length > 1 ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">Size</Text>
            <View className="flex-row flex-wrap gap-2">
              {sizes.map((option, index) => (
                <Pressable
                  key={`${option.size}-${index}`}
                  onPress={() => setSelected(index)}
                  className={`rounded-lg border px-3 py-2 ${
                    index === selected ? 'border-gray-900 bg-gray-900' : 'border-gray-200 bg-gray-0'
                  }`}
                >
                  <Text
                    className={`text-sm ${index === selected ? 'text-gray-0' : 'text-gray-800'}`}
                  >
                    {option.size}
                    {option.stock > 0 ? '' : ' — sold out'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text className="text-sm text-gray-600">
          {typeof product.description === 'string' ? product.description : ''}
        </Text>

        {/*
          Deliberately disabled. The button exists so the layout is honest about
          what this screen will become; cart state is Phase 4 and no amount of
          tapping should imply otherwise.
        */}
        <Pressable disabled className="mt-2 items-center rounded-lg bg-gray-200 px-5 py-4">
          <Text className="text-sm font-semibold text-gray-500">
            {inStock ? 'Add to cart — coming soon' : 'Out of stock'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
