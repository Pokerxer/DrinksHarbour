import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSearchSuggestions, searchProducts, type SearchPage } from '../lib/catalog-api.ts';
import { queryTerms } from '../lib/search-highlight.ts';
import { toSearchResultView } from '../lib/search-result-view.ts';
import { resolveSuggestions } from '../lib/search-defaults.ts';
import { addRecent, clearRecents, removeRecent, type RecentSearch } from '../lib/recent-searches.ts';
import { loadRecents, saveRecents } from '../lib/recent-searches-store.ts';
import { SearchDefaultPanel } from '../components/search/search-default-panel.tsx';
import { SearchResultRow } from '../components/search/search-result-row.tsx';
import { SearchSuggestions } from '../components/search/search-suggestions.tsx';

/**
 * Search — the mobile stand-in for `components/Modal/ModalSearch.tsx`.
 *
 * A screen rather than a modal: the header's search control is a button on the
 * web too, and pushing a route gives the back gesture and the keyboard handling
 * for free.
 *
 * Deliberately DROPPED from the web modal, all desktop-only: the
 * `↑↓ navigate / ↵ open` footer, the ESC hint and the whole keyboard-navigation
 * effect (`hidden md:inline` or mouse/keyboard-only). Also absent because they
 * need native dependencies this app does not install: the Fish Audio "Listen"
 * button and voice search — and note the web already renders its mic
 * conditionally (`ModalSearch.tsx:535`), so on iOS at phone width the missing
 * mic is not a parity break at all.
 */

const DEBOUNCE_MS = 300;

/** The web context's own suggestion debounce (`ModalSearchContext.tsx:429`). */
const SUGGEST_DEBOUNCE_MS = 250;

const EMPTY: SearchPage = { products: [], total: 0, page: 1, totalPages: 0 };

/** The web's no-results suggestions (`ModalSearch.tsx:826`). */
const NO_RESULT_HINTS = ['France', 'Bordeaux', 'Speyside', 'Single Malt', 'Smoky'];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<SearchPage>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Guards against an older, slower response overwriting a newer one.
  const requestId = useRef(0);

  // Suggestions race the results independently — a shared guard would let the
  // slower of the two cancel the faster. Separate counter, separate timer.
  const suggestRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadRecents().then((stored) => {
      if (!cancelled) setRecents(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Recents are written on a committed search, never on a keystroke. */
  const commitRecent = useCallback((term: string) => {
    setRecents((previous) => {
      const next = addRecent(previous, term, Date.now());
      void saveRecents(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(async (term: string, nextPage: number) => {
    setSearching(true);
    const id = ++requestId.current;

    const result = await searchProducts(term, { page: nextPage });
    if (id !== requestId.current) return;

    if (result.ok) {
      setPage(result.data);
      setError(null);
    } else {
      setPage(EMPTY);
      setError(result.error);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (!term) {
      requestId.current += 1;
      setPage(EMPTY);
      setSearching(false);
      setError(null);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => void runSearch(term, 1), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  // Suggestions, on their own 250ms clock. `fetchSearchSuggestions` already
  // short-circuits below two characters, so no length guard belongs here.
  useEffect(() => {
    const term = query.trim();

    if (!term) {
      suggestRequestId.current += 1;
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        const id = ++suggestRequestId.current;
        const result = await fetchSearchSuggestions(term);
        if (id !== suggestRequestId.current) return;

        // `ok ? data : null` — null tells resolveSuggestions the request FAILED
        // rather than matched nothing, so a dead endpoint still leaves chips.
        setSuggestions(resolveSuggestions(result.ok ? result.data : null, term, recents));
      })();
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, recents]);

  const term = query.trim();

  // queryTerms is not cheap (folds + sorts) and every row needs the same array.
  const terms = useMemo(() => queryTerms(term), [term]);
  const views = useMemo(
    () => page.products.map((product) => toSearchResultView(product, terms)),
    [page.products, terms]
  );

  const goToShop = useCallback(
    (href: string) => {
      if (term) commitRecent(term);
      // `/shop` is still a stub screen. The URL is the exact one the web builds,
      // so this starts working the moment that screen exists.
      router.push(href as never);
    },
    [router, term, commitRecent]
  );

  const selectTerm = useCallback(
    (selected: string) => {
      setQuery(selected);
      commitRecent(selected);
    },
    [commitRecent]
  );

  const openProduct = useCallback(
    (slug: string) => {
      if (term) commitRecent(term);
      router.push(`/product/${slug}` as never);
    },
    [router, term, commitRecent]
  );

  const hasResults = views.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* ── Brand hairline — the modal's top stripe ── */}
      <View className="h-[3px] bg-[#b20202] opacity-40" />

      {/* ── Search bar ── */}
      <View className="border-b border-gray-100 px-3 py-2.5">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="p-1.5"
          >
            <Ionicons name="arrow-back" size={22} color="#1f2937" />
          </Pressable>

          <View className="relative flex-1 justify-center">
            <View className="absolute left-3 z-10">
              <Ionicons name="search" size={16} color="#9ca3af" />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Name, brand, country, region, appellation…"
              placeholderTextColor="#9ca3af"
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() =>
                term ? goToShop(`/shop?search=${encodeURIComponent(term)}`) : null
              }
              className="rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm text-gray-800"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                className="absolute right-3 z-10"
              >
                <Ionicons name="close-circle" size={16} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Result count strip — free now that the endpoint reports totals ── */}
        {term && !error ? (
          <View className="mt-2.5 flex-row items-center justify-between">
            <Text className="text-xs text-gray-500">
              {searching ? (
                <Text className="text-gray-400">Searching…</Text>
              ) : (
                <>
                  <Text className="font-semibold text-gray-800">{page.total}</Text>
                  <Text> product{page.total === 1 ? '' : 's'} found</Text>
                  {page.totalPages > 1 ? (
                    <Text className="text-gray-400">
                      {' '}
                      · page {page.page}/{page.totalPages}
                    </Text>
                  ) : null}
                </>
              )}
            </Text>
            {!searching && hasResults ? (
              <Pressable
                onPress={() => goToShop(`/shop?search=${encodeURIComponent(term)}`)}
                hitSlop={8}
                accessibilityRole="button"
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-semibold text-[#b20202]">View all</Text>
                <Ionicons name="arrow-forward" size={12} color="#b20202" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ── Suggestion chips — mobile only; the web computes these and renders
          nothing. Deliberate, see the component's header. ── */}
      {term ? <SearchSuggestions suggestions={suggestions} onSelectTerm={selectTerm} /> : null}

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {!term ? (
          <SearchDefaultPanel
            recents={recents}
            now={Date.now()}
            onSelectTerm={selectTerm}
            onRemoveRecent={(t) =>
              setRecents((previous) => {
                const next = removeRecent(previous, t);
                void saveRecents(next);
                return next;
              })
            }
            onClearRecents={() => {
              const next = clearRecents();
              setRecents(next);
              void saveRecents(next);
            }}
            onNavigate={(href) => router.push(href as never)}
          />
        ) : searching ? (
          <View className="items-center py-20">
            <ActivityIndicator color="#b20202" />
          </View>
        ) : error ? (
          <View className="items-center px-8 py-16">
            <Ionicons name="warning-outline" size={28} color="#f87171" />
            <Text className="mb-4 mt-3 text-center text-sm font-medium text-gray-600">{error}</Text>
            <Pressable
              onPress={() => void runSearch(term, 1)}
              accessibilityRole="button"
              className="rounded-xl bg-[#b20202] px-5 py-2"
            >
              <Text className="text-sm font-semibold text-white">Try Again</Text>
            </Pressable>
          </View>
        ) : !hasResults ? (
          <View className="items-center px-6 py-10">
            <Ionicons name="search" size={30} color="#d1d5db" />
            <Text className="mb-1 mt-3 text-center text-sm font-semibold text-gray-700">
              No results for “{term}”
            </Text>
            <Text className="mb-5 text-center text-xs text-gray-400">
              You can search by country, region, appellation, producer or tasting notes — try one of
              these
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {NO_RESULT_HINTS.map((hint) => (
                <Pressable
                  key={hint}
                  onPress={() => selectTerm(hint)}
                  accessibilityRole="button"
                  className="rounded-full bg-gray-100 px-3 py-1.5"
                >
                  <Text className="text-xs font-medium text-gray-700">{hint}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View className="p-3">
            {views.map((view) => (
              <SearchResultRow
                key={view.id}
                view={view}
                query={term}
                onPress={() => openProduct(view.slug)}
              />
            ))}

            <Pressable
              onPress={() => goToShop(`/shop?search=${encodeURIComponent(term)}`)}
              accessibilityRole="button"
              className="mt-2 items-center rounded-xl bg-[#b20202] py-3"
            >
              <Text className="text-sm font-bold text-white">See all results for “{term}”</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
