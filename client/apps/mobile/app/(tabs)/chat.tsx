import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchGreeting,
  sendChatQuery,
  type CartProposalItem,
  type QuickReply,
} from '../../lib/chatbot-api.ts';
import {
  clearChatSession,
  readChatSession,
  writeChatSession,
  type ChatMessage,
} from '../../lib/chat-session.ts';
import { isAffirmative, isNegative } from '../../lib/chat-replies.ts';
import { buildCartConfirmation, clampProposedQuantity, describeAddedLine } from '../../lib/chat-cart.ts';
import { fetchProductBySlug } from '../../lib/catalog-api.ts';
import { useCart } from '../../lib/cart-context.tsx';
import { ChatMessageBody } from '../../components/chat/chat-message-body.tsx';
import { CartProposalBar } from '../../components/chat/cart-proposal-bar.tsx';

/**
 * The Chat tab — the port of `ChatbotWidget.tsx` (1150 lines).
 *
 * Text only. Image and document upload need `expo-image-picker` /
 * `expo-document-picker`, which are not installed; the server still accepts
 * both on the same endpoint, so wiring them later changes only this screen.
 *
 * The web's keyboard/visual-viewport gymnastics are pure browser and are
 * replaced by `KeyboardAvoidingView`. "Talk to a human" is not wired here —
 * `/api/chatbot/escalate` sends real mail, is rate-limited 5 per 10 minutes,
 * and needs an email-capture form that is its own piece of work.
 */

const THINKING = 'Thinking…';

const quickReplyText = (reply: QuickReply): string =>
  typeof reply === 'string' ? reply : reply.query;
const quickReplyLabel = (reply: QuickReply): string =>
  typeof reply === 'string' ? reply : reply.label;

export default function ChatScreen() {
  const { addToCart } = useCart();
  const restored = readChatSession();

  const [messages, setMessages] = useState<ChatMessage[]>(restored.messages);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(restored.quickReplies);
  const [pendingCart, setPendingCart] = useState<CartProposalItem[] | null>(restored.pendingCart);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const retry = useRef<(() => void) | null>(null);

  // Mirror to the session store on every change, so switching tabs — which
  // unmounts this screen — does not lose the conversation.
  useEffect(() => {
    writeChatSession({ messages, quickReplies, pendingCart });
  }, [messages, quickReplies, pendingCart]);

  // Opening greeting, once, and only into an empty conversation.
  useEffect(() => {
    if (messages.length) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const result = await fetchGreeting();
      if (cancelled) return;

      if (result.ok) {
        setMessages([{ role: 'assistant', content: result.data.response, timestamp: Date.now() }]);
        setQuickReplies(result.data.quickReplies);
      } else {
        setError(result.error);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const ask = useCallback(
    async (text: string, history: ChatMessage[]) => {
      setError(null);
      setLoading(true);
      scrollToEnd();

      const result = await sendChatQuery(
        text,
        history.map((m) => ({ role: m.role, content: m.content }))
      );

      if (result.ok) {
        setMessages((previous) => [
          ...previous,
          { role: 'assistant', content: result.data.response, timestamp: Date.now() },
        ]);
        setQuickReplies(result.data.quickReplies);
        setPendingCart(result.data.cartProposal.length ? result.data.cartProposal : null);
        retry.current = null;
      } else {
        setError(result.error);
        retry.current = () => void ask(text, history);
      }

      setLoading(false);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  // ── Cart offer ────────────────────────────────────────────────────────────
  const confirmCart = useCallback(
    async (userText?: string) => {
      const items = pendingCart;
      if (!items?.length || adding) return;

      setAdding(true);
      setPendingCart(null);
      setQuickReplies([]);
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: userText || 'Yes, add to cart', timestamp: Date.now() },
      ]);
      scrollToEnd();

      const added: string[] = [];
      const failed: string[] = [];

      for (const item of items) {
        // The proposal carries no vendor or size ids — only a slug. The full
        // product is the only place `availableAt` lives, and that is what
        // `toCartLine` needs to pair a subProductId with its sizeId.
        const result = await fetchProductBySlug(item.slug);
        if (!result.ok) {
          failed.push(item.name);
          continue;
        }

        const product = result.data as Record<string, any>;
        const vendor = (product.availableAt ?? [])[0];
        const sizes = (vendor?.sizes ?? []).filter(
          (s: any) => (s?.pricing?.websitePrice || 0) > 0
        );
        const wanted = item.size?.toLowerCase() ?? null;
        const size =
          (wanted &&
            sizes.find(
              (s: any) =>
                (s.size || '').toLowerCase() === wanted ||
                (s.displayName || '').toLowerCase() === wanted
            )) ||
          sizes.find((s: any) => (s.stock ?? 0) > 0) ||
          sizes[0];

        if (!size || (size.stock ?? 0) <= 0) {
          failed.push(item.name);
          continue;
        }

        const label = size.size || size.displayName || size.name || item.size || '';
        const quantity = clampProposedQuantity(item.qty, size);
        const line = addToCart(product, { size: label, quantity });

        if (line) added.push(describeAddedLine(quantity, item.name, label));
        else failed.push(item.name);
      }

      setMessages((previous) => [
        ...previous,
        { role: 'assistant', content: buildCartConfirmation(added, failed), timestamp: Date.now() },
      ]);
      setAdding(false);
      scrollToEnd();
    },
    [pendingCart, adding, addToCart, scrollToEnd]
  );

  const declineCart = useCallback(
    (userText?: string) => {
      setPendingCart(null);
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: userText || 'No thanks', timestamp: Date.now() },
        {
          role: 'assistant',
          content: 'No problem! 👍 Anything else I can help you find?',
          timestamp: Date.now(),
        },
      ]);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  // ── Sending ───────────────────────────────────────────────────────────────
  const submit = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query || loading || adding) return;

      // A yes/no answering a live cart offer is settled locally and never
      // round-trips. Anything longer moves the conversation on and drops the
      // stale offer.
      if (pendingCart?.length) {
        if (isAffirmative(query)) {
          setInput('');
          void confirmCart(query);
          return;
        }
        if (isNegative(query)) {
          setInput('');
          declineCart(query);
          return;
        }
        setPendingCart(null);
      }

      const history = messages.slice(-10);
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: query, timestamp: Date.now() },
      ]);
      setInput('');
      setQuickReplies([]);
      void ask(query, history);
    },
    [loading, adding, pendingCart, messages, ask, confirmCart, declineCart]
  );

  const clear = useCallback(() => {
    clearChatSession();
    setMessages([]);
    setQuickReplies([]);
    setPendingCart(null);
    setError(null);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <View className="flex-row items-center gap-2">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-[#b20202]">
              <Text className="text-[9px] font-black text-white">DH</Text>
            </View>
            <Text className="text-base font-bold text-gray-900">Assistant</Text>
          </View>
          {messages.length ? (
            <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear chat">
              <Ionicons name="trash-outline" size={16} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="p-3 gap-2"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
        >
          {messages.map((message, i) => (
            <View
              key={`${message.timestamp}-${i}`}
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                message.role === 'user' ? 'self-end bg-[#b20202]' : 'self-start bg-gray-50'
              }`}
            >
              <ChatMessageBody text={message.content} tint={message.role} />
            </View>
          ))}

          {loading ? (
            <View className="flex-row items-center gap-2 self-start rounded-2xl bg-gray-50 px-3 py-2">
              <ActivityIndicator size="small" color="#b20202" />
              <Text className="text-sm text-gray-500">{THINKING}</Text>
            </View>
          ) : null}

          {error ? (
            <View className="self-start rounded-2xl bg-red-50 px-3 py-2">
              <Text className="text-sm text-gray-700">{error}</Text>
              {retry.current ? (
                <Pressable onPress={() => retry.current?.()} accessibilityRole="button" className="mt-1.5">
                  <Text className="text-sm font-semibold text-[#b20202]">Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {quickReplies.length && !pendingCart ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="max-h-14 border-t border-gray-100"
            contentContainerClassName="gap-2 px-3 py-2.5"
          >
            {quickReplies.map((reply, i) => (
              <Pressable
                key={i}
                onPress={() => submit(quickReplyText(reply))}
                accessibilityRole="button"
                className="rounded-full border border-gray-200 px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-gray-700">{quickReplyLabel(reply)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {pendingCart?.length ? (
          <CartProposalBar
            items={pendingCart}
            busy={adding}
            onConfirm={() => void confirmCart()}
            onDecline={() => declineCart()}
          />
        ) : null}

        <View className="flex-row items-end gap-2 border-t border-gray-100 px-3 py-2.5">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about a drink, a pairing, an event…"
            placeholderTextColor="#9ca3af"
            multiline
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => submit(input)}
            className="max-h-24 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800"
          />
          <Pressable
            onPress={() => submit(input)}
            disabled={!input.trim() || loading || adding}
            accessibilityRole="button"
            accessibilityLabel="Send"
            className={`h-10 w-10 items-center justify-center rounded-full ${
              input.trim() && !loading && !adding ? 'bg-[#b20202]' : 'bg-gray-200'
            }`}
          >
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
