import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { formatNaira } from '../ui/price.tsx';
import { RemoteImage } from '../ui/remote-image.tsx';
import { HighlightedText } from './highlighted-text.tsx';
import type { SearchResultView } from '../../lib/search-result-view.ts';

/**
 * One search result — the phone-width slice of `ModalSearch.tsx:644-776`.
 *
 * The desktop-only parts are deliberately absent: the `↑↓`-selected state, the
 * hover scale, the tap-to-expand quick-add (there is no quickview modal on
 * mobile) and the Fish Audio "Listen" button (no audio dependency is installed
 * — see the design doc's out-of-scope table).
 *
 * Everything shown is derived in `lib/search-result-view.ts`; this file only
 * decides what it looks like.
 */
export function SearchResultRow({
  view,
  query,
  onPress,
}: {
  view: SearchResultView;
  query: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.name}
      className="mb-2 flex-row gap-3 rounded-xl border-2 border-transparent p-3 active:bg-gray-50"
    >
      {/* ── Image, with the SALE flag and the out-of-stock scrim ── */}
      <View className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        <RemoteImage uri={view.imageUrl} contentFit="cover" className="h-full w-full" />
        {view.originalPrice !== null ? (
          <View className="absolute left-0.5 top-0.5 rounded bg-[#b20202] px-1 py-px">
            <Text className="text-[9px] font-bold leading-tight text-white">SALE</Text>
          </View>
        ) : null}
        {!view.inStock ? (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <Text className="px-1 text-center text-[9px] font-bold leading-tight text-white">
              Out of Stock
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Info ── */}
      <View className="min-w-0 flex-1">
        <HighlightedText
          text={view.name}
          query={query}
          numberOfLines={1}
          className="text-sm font-medium text-gray-900"
        />

        {view.categoryName || view.brandName ? (
          <Text numberOfLines={1} className="mt-0.5 text-[11px] text-gray-400">
            {view.categoryName ? (
              <HighlightedText text={view.categoryName} query={query} />
            ) : null}
            {view.categoryName && view.brandName ? ' · ' : null}
            {view.brandName ? <HighlightedText text={view.brandName} query={query} /> : null}
          </Text>
        ) : null}

        {/* Provenance — country · region · appellation · … The line that
            explains why a search for "médoc" returned this bottle. */}
        {view.facets.length > 0 ? (
          <View className="mt-1 flex-row items-center gap-1">
            <Ionicons name="globe-outline" size={11} color="#9ca3af" />
            <Text numberOfLines={1} className="flex-1 text-[11px] text-gray-500">
              {view.facets.map((facet, i) => (
                <Text key={facet.key}>
                  {i > 0 ? <Text className="text-gray-300"> · </Text> : null}
                  <HighlightedText
                    text={facet.value}
                    query={query}
                    className={
                      view.matchedFacetKeys.has(facet.key)
                        ? 'text-[11px] font-medium text-gray-700'
                        : 'text-[11px] text-gray-500'
                    }
                  />
                </Text>
              ))}
            </Text>
          </View>
        ) : null}

        {/* Why this matched, when nothing above already shows it */}
        {view.snippet ? (
          <Text numberOfLines={2} className="mt-1 text-[11px] leading-snug text-gray-500">
            <Text className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
              {view.snippet.label}{' '}
            </Text>
            <HighlightedText
              text={view.snippet.text}
              query={query}
              className="text-[11px] italic text-gray-500"
            />
          </Text>
        ) : null}

        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-bold text-[#b20202]">{formatNaira(view.price)}</Text>
          {view.originalPrice !== null ? (
            <Text className="text-xs text-gray-400 line-through">
              {formatNaira(view.originalPrice)}
            </Text>
          ) : null}
          {view.lowStock !== null ? (
            <View className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5">
              <Text className="text-[10px] text-amber-700">{view.lowStock} left</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}
