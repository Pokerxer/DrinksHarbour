import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
import {
  BROWSE_CATEGORIES,
  POPULAR_SEARCHES,
  QUICK_ACTIONS,
} from '../../lib/search-defaults.ts';
import type { RecentSearch } from '../../lib/recent-searches.ts';

/**
 * What fills the search screen before anything is typed — the web's default
 * panel (`ModalSearch.tsx:837-934`), whose four sections are all visible at
 * phone width.
 *
 * Before this, the empty screen was a single grey line of copy.
 *
 * Grid columns are the web's phone branch: Quick Actions `grid-cols-2`,
 * Browse Categories `grid-cols-4`. NativeWind has no CSS grid, so both are
 * `flex-row flex-wrap` with fractional widths, which lays out identically for
 * a fixed, known number of tiles.
 */

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
      {children}
    </Text>
  );
}

/** The web shows this only at md+ (`hidden md:inline`), so it is phone-visible copy only. */
function timeAgo(timestamp: number, now: number): string {
  const s = Math.floor((now - timestamp) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SearchDefaultPanel({
  recents,
  onSelectTerm,
  onRemoveRecent,
  onClearRecents,
  onNavigate,
  now,
}: {
  recents: RecentSearch[];
  onSelectTerm: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecents: () => void;
  onNavigate: (href: string) => void;
  now: number;
}) {
  return (
    <View className="gap-5 p-4">
      {/* ── Quick Actions — 2 columns at phone width ── */}
      <View>
        <SectionTitle>Quick Actions</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => onNavigate(action.href)}
              accessibilityRole="button"
              className="w-[48%] items-center gap-1.5 rounded-xl border p-3"
              style={{ backgroundColor: action.background, borderColor: action.border }}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: action.tint }}
              >
                {/* `search-defaults.ts` must stay free of react-native imports
                    so it can be tested in vitest's `node` environment, so the
                    glyph name is typed as `string` there and narrowed here.
                    All four names were validated against the Ionicons glyphmap
                    — a wrong one renders a blank box and passes every gate. */}
                <Ionicons name={action.icon as IoniconName} size={18} color="#ffffff" />
              </View>
              <Text className="text-xs font-semibold" style={{ color: action.text }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Recent ── */}
      {recents.length > 0 ? (
        <View>
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Recent
            </Text>
            <Pressable onPress={onClearRecents} hitSlop={8} accessibilityRole="button">
              <Text className="text-[11px] text-gray-400">Clear all</Text>
            </Pressable>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {recents.slice(0, 6).map((recent) => (
              <View
                key={recent.query}
                className="flex-row items-center gap-1.5 rounded-full bg-gray-100 py-1.5 pl-2.5 pr-1.5"
              >
                <Ionicons name="time-outline" size={11} color="#9ca3af" />
                <Pressable onPress={() => onSelectTerm(recent.query)} accessibilityRole="button">
                  <Text numberOfLines={1} className="max-w-[120px] text-xs text-gray-700">
                    {recent.query}
                  </Text>
                </Pressable>
                <Text className="text-[10px] text-gray-400">{timeAgo(recent.timestamp, now)}</Text>
                {/* The web reveals this ✕ on hover; a phone has no hover, so it
                    is always visible. */}
                <Pressable
                  onPress={() => onRemoveRecent(recent.query)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${recent.query} from recent searches`}
                  className="h-4 w-4 items-center justify-center rounded-full"
                >
                  <Ionicons name="close" size={10} color="#6b7280" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Browse Categories — 4 columns ── */}
      <View>
        <SectionTitle>Browse Categories</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {BROWSE_CATEGORIES.map((category) => (
            <Pressable
              key={category.slug}
              onPress={() => onNavigate(`/shop?category=${category.slug}`)}
              accessibilityRole="button"
              className="w-[23%] items-center gap-1.5 rounded-xl border p-2.5"
              style={{ backgroundColor: category.background, borderColor: category.border }}
            >
              <Text className="text-2xl leading-none">{category.emoji}</Text>
              <Text
                numberOfLines={1}
                className="text-center text-[10px] font-semibold leading-tight"
                style={{ color: category.text }}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Trending Searches ── */}
      <View>
        <View className="mb-2.5 flex-row items-center gap-1.5">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Trending Searches
          </Text>
          <Ionicons name="flame" size={14} color="#b20202" />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {POPULAR_SEARCHES.map((term, i) => (
            <Pressable
              key={term}
              onPress={() => onSelectTerm(term)}
              accessibilityRole="button"
              className="flex-row items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5"
            >
              <View className="h-4 w-4 items-center justify-center rounded-full bg-gray-100">
                <Text className="text-[10px] font-bold text-gray-400">{i + 1}</Text>
              </View>
              <Text className="text-xs font-medium text-gray-600">{term}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
