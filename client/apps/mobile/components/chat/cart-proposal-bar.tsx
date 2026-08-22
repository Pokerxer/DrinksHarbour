import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { formatNaira } from '../ui/price.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';
import type { CartProposalItem } from '../../lib/chatbot-api.ts';

/**
 * The confirm bar for the assistant's cart offer (`ChatbotWidget.tsx:1010-1080`).
 *
 * The server parses the model's `CART_JSON` line into `cartProposal[]`; this
 * shows what would go in and asks. A typed "yes"/"no" is matched locally by
 * `lib/chat-replies.ts` and reaches the same two handlers, so the bar and the
 * text input can never disagree about what was agreed.
 */
export function CartProposalBar({
  items,
  busy,
  onConfirm,
  onDecline,
}: {
  items: CartProposalItem[];
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);

  return (
    <View className="border-t border-gray-100 bg-white px-3 py-2.5">
      <Text className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        Add to cart?
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2.5">
        <View className="flex-row gap-2">
          {items.map((item) => (
            <View
              key={`${item.id}-${item.size ?? ''}`}
              className="w-36 rounded-xl border border-gray-100 p-2"
            >
              <View className="mb-1.5 h-16 w-full overflow-hidden rounded-lg bg-gray-50">
                <RemoteImage uri={item.image} contentFit="contain" className="h-full w-full" />
              </View>
              <Text numberOfLines={2} className="text-[11px] font-medium text-gray-800">
                {item.name}
              </Text>
              <Text className="mt-0.5 text-[10px] text-gray-400">
                {[item.size, `× ${item.qty || 1}`].filter(Boolean).join(' · ')}
              </Text>
              <Text className="mt-0.5 text-xs font-bold text-[#b20202]">
                {formatNaira(item.price)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onDecline}
          disabled={busy}
          accessibilityRole="button"
          className="rounded-xl border border-gray-200 px-4 py-2.5"
        >
          <Text className="text-sm font-medium text-gray-600">No thanks</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          accessibilityRole="button"
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
            busy ? 'bg-gray-300' : 'bg-[#b20202]'
          }`}
        >
          {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
          <Text className="text-sm font-bold text-white">
            Add {items.length === 1 ? 'it' : 'all'} · {formatNaira(total)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
