import { useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCart } from '../../lib/cart-context.tsx';
import { effectiveUnitPrice, type CartLine } from '../../lib/cart-core.ts';
import { formatNaira } from '../../components/ui/price.tsx';
import { RemoteImage } from '../../components/ui/remote-image.tsx';

/**
 * The cart.
 *
 * THERE IS NO CHECKOUT SCREEN IN THIS APP. The CTA says so rather than
 * dead-ending on a route that does not exist — the same honesty the Chat tab
 * used before it had a chatbot. Everything up to that point is real: lines
 * hydrate per identity, quantities sync to the server, and pack pricing applies.
 */
export default function CartScreen() {
  const router = useRouter();
  const { lines, cartTotal, cartCount, removeFromCart, setQuantity, validateCart, validation } =
    useCart();

  // Re-check stock and price whenever the cart is opened with something in it.
  // A cart loaded from a week-old mirror can easily be out of date.
  useEffect(() => {
    if (lines.length) void validateCart();
    // Deliberately once per mount, not per keystroke of quantity — validateCart
    // changes identity with `lines`, and depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verdictFor = useCallback(
    (line: CartLine) => validation[`${line.subProductId}-${line.sizeId ?? ''}`],
    [validation]
  );

  if (!lines.length) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cart-outline" size={40} color="#d1d5db" />
          <Text className="mt-3 text-base font-semibold text-gray-900">Your cart is empty</Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            Browse the shop or ask the assistant for a recommendation.
          </Text>
          <Pressable
            onPress={() => router.push('/search' as never)}
            accessibilityRole="button"
            className="mt-5 rounded-xl bg-[#b20202] px-5 py-2.5"
          >
            <Text className="text-sm font-semibold text-white">Find a drink</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <View className="border-b border-gray-100 px-4 py-3">
        <Text className="text-lg font-bold text-gray-900">
          Cart <Text className="text-sm font-normal text-gray-500">({cartCount})</Text>
        </Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-3">
          {lines.map((line) => {
            const verdict = verdictFor(line);
            const unit = effectiveUnitPrice(line);
            const packApplied =
              line.packUnitPrice !== null &&
              line.packThreshold !== null &&
              line.quantity >= line.packThreshold;

            return (
              <View
                key={line.cartItemId}
                className="mb-2 flex-row gap-3 rounded-xl border border-gray-100 p-3"
              >
                <View className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  <RemoteImage uri={line.imageUrl} contentFit="contain" className="h-full w-full" />
                </View>

                <View className="min-w-0 flex-1">
                  <Text numberOfLines={2} className="text-sm font-medium text-gray-900">
                    {line.name}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-gray-400">
                    {[line.size, line.vendorName].filter(Boolean).join(' · ')}
                  </Text>

                  {verdict && !verdict.available ? (
                    <Text className="mt-1 text-[11px] font-semibold text-[#b20202]">
                      No longer available
                    </Text>
                  ) : null}

                  <View className="mt-1.5 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-bold text-gray-900">{formatNaira(unit)}</Text>
                      {packApplied ? (
                        <View className="rounded-full bg-emerald-50 px-1.5 py-0.5">
                          <Text className="text-[10px] font-semibold text-emerald-700">
                            Pack rate
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="flex-row items-center gap-1">
                      <Pressable
                        onPress={() => setQuantity(line.cartItemId, line.quantity - 1)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease quantity of ${line.name}`}
                        className="h-7 w-7 items-center justify-center rounded-lg bg-gray-100"
                      >
                        <Ionicons name="remove" size={14} color="#374151" />
                      </Pressable>
                      <Text className="w-7 text-center text-sm font-semibold text-gray-900">
                        {line.quantity}
                      </Text>
                      <Pressable
                        onPress={() => setQuantity(line.cartItemId, line.quantity + 1)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase quantity of ${line.name}`}
                        className="h-7 w-7 items-center justify-center rounded-lg bg-gray-100"
                      >
                        <Ionicons name="add" size={14} color="#374151" />
                      </Pressable>
                      <Pressable
                        onPress={() => removeFromCart(line.cartItemId)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.name}`}
                        className="ml-1 h-7 w-7 items-center justify-center"
                      >
                        <Ionicons name="trash-outline" size={15} color="#9ca3af" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="border-t border-gray-100 p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-gray-500">Subtotal</Text>
          <Text className="text-lg font-bold text-gray-900">{formatNaira(cartTotal)}</Text>
        </View>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Checkout',
              'Checkout is not in the app yet — finish this order on drinksharbour.com. Your cart is saved to your account.'
            )
          }
          accessibilityRole="button"
          className="items-center rounded-xl bg-[#b20202] py-3"
        >
          <Text className="text-sm font-bold text-white">Checkout</Text>
        </Pressable>
        <Text className="mt-2 text-center text-[11px] text-gray-400">
          Delivery and any discounts are calculated at checkout.
        </Text>
      </View>
    </SafeAreaView>
  );
}
