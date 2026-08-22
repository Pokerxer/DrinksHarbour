import { Pressable, ScrollView, Text } from 'react-native';

/**
 * The type-ahead chip strip, fed by `GET /api/products/suggestions`.
 *
 * **This section does not exist on the web.** `ModalSearchContext.tsx` computes
 * `suggestions` with a 250ms debounce and a recents+popular fallback, and no
 * component consumes any of it — `ModalSearch.tsx` renders no suggestions at
 * all. The endpoint is live and dead there. Rendering it here is a deliberate
 * mobile-only divergence, requested explicitly; it is NOT a parity break to be
 * cleaned up, and the web should NOT be "fixed" to match. See
 * `RESUME-mobile-home-web-parity.md` §0e.
 *
 * Which terms to show is decided by `resolveSuggestions` in
 * `lib/search-defaults.ts` — the tested part. This file only lays them out.
 */

interface SearchSuggestionsProps {
  suggestions: string[];
  onSelectTerm: (term: string) => void;
}

export function SearchSuggestions({ suggestions, onSelectTerm }: SearchSuggestionsProps) {
  if (!suggestions.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Without this a tap only dismisses the keyboard and the chip never fires.
      keyboardShouldPersistTaps="handled"
      className="border-b border-gray-100"
      // `contentContainerClassName` IS NativeWind-registered (→ contentContainerStyle).
      contentContainerClassName="gap-2 px-3 py-2"
    >
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSelectTerm(suggestion)}
          accessibilityRole="button"
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5"
        >
          <Text numberOfLines={1} className="text-xs font-medium text-gray-600">
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
