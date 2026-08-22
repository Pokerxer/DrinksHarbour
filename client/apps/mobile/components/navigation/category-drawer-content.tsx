import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  fetchAllCategories,
  fetchAllSubCategories,
  getRootCategories,
  getSubcategories,
  type Category,
  type SubCategory,
} from 'commerce-core';
import { filterRoots, parentOf, searchSubcategories } from '../../lib/category-drawer.ts';
import { CategoryChip } from '../ui/category-chip.tsx';
import { Gradient } from '../ui/gradient.tsx';

/**
 * The inside of the categories drawer — `apps/platform/src/components/
 * Navigation/MobileBottomNav.tsx:185-433`, section for section:
 *
 *   header → search field → EITHER flat results (while searching)
 *                           OR the split browse panel (42% roots | subs)
 *
 * The sliding panel, the backdrop and the swipe-to-close live next door in
 * `category-drawer.tsx`; this file is only what is printed on the panel.
 *
 * Fetching is `commerce-core`'s, shared with the web — the same 5-minute cache,
 * the same root/sub grouping — so the two cannot drift.
 */
export function CategoryDrawerContent({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');

  // Fetch on open, exactly as the web does — nothing is loaded for a drawer
  // that has never been shown.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    Promise.all([fetchAllCategories(), fetchAllSubCategories()]).then(([cats, subs]) => {
      if (cancelled) return;
      setAllCategories(cats);
      setAllSubCategories(subs);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // The drawer keeps its data between opens, but not its place in it — the web
  // clears both the query and the active category on close.
  useEffect(() => {
    if (visible) return;
    setActiveCategory(null);
    setQuery('');
  }, [visible]);

  const rootCategories = useMemo(
    () => getRootCategories(allCategories, allSubCategories),
    [allCategories, allSubCategories]
  );
  const roots = useMemo(() => filterRoots(rootCategories, query), [rootCategories, query]);
  const subResults = useMemo(
    () => searchSubcategories(allSubCategories, query),
    [allSubCategories, query]
  );
  const subcategories = useMemo(
    () => (activeCategory ? getSubcategories(activeCategory, allSubCategories) : []),
    [activeCategory, allSubCategories]
  );

  /** Every link in here closes the drawer before navigating, as on the web. */
  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href as never);
    },
    [onClose, router]
  );

  const searching = query.trim().length > 0;
  const resultCount = roots.length + subResults.length;

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-orange-50">
            <Ionicons name="grid" size={15} color="#f97316" />
          </View>
          <Text className="text-base font-bold text-gray-900">Categories</Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close categories"
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <Ionicons name="close" size={18} color="#6b7280" />
        </Pressable>
      </View>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <View className="border-b border-gray-100 px-4 py-2.5">
        <View className="relative justify-center">
          <View className="absolute left-3 z-10">
            <Ionicons name="search" size={15} color="#9ca3af" />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories…"
            placeholderTextColor="#9ca3af"
            autoCorrect={false}
            returnKeyType="search"
            className="rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-700"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
              className="absolute right-2.5 z-10"
            >
              <Ionicons name="close" size={14} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searching ? (
        /* ── Flat results ──────────────────────────────────────────────── */
        <ScrollView className="flex-1 p-3" keyboardShouldPersistTaps="handled">
          <Text
            className="mb-3 text-xs font-semibold uppercase text-gray-400"
            style={{ letterSpacing: 1 }}
          >
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </Text>

          {resultCount === 0 ? (
            <View className="items-center justify-center py-12">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Ionicons name="search" size={24} color="#9ca3af" />
              </View>
              <Text className="mt-3 text-center text-sm text-gray-500">
                No categories match “{query}”
              </Text>
            </View>
          ) : (
            <View className="gap-1.5">
              {roots.map((cat) => (
                <Pressable
                  key={cat._id}
                  onPress={() => go(`/shop?category=${cat.slug}`)}
                  className="flex-row items-center gap-3 rounded-xl border border-gray-100 p-2.5"
                >
                  <CategoryChip cat={cat} size={40} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
                      {cat.name}
                    </Text>
                    {(cat.productCount ?? 0) > 0 ? (
                      <Text className="text-[11px] text-gray-400">{cat.productCount} products</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
                </Pressable>
              ))}

              {subResults.map((sub) => {
                const parent = parentOf(sub, rootCategories);
                return (
                  <Pressable
                    key={sub._id}
                    onPress={() =>
                      go(`/shop?category=${parent?.slug ?? ''}&subcategory=${sub.slug}`)
                    }
                    className="flex-row items-center gap-3 rounded-xl border border-gray-100 p-2.5"
                  >
                    <CategoryChip cat={sub} size={40} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
                        {sub.name}
                      </Text>
                      <Text numberOfLines={1} className="text-[11px] text-gray-400">
                        {parent?.name ?? 'Category'} · {sub.productCount ?? 0} products
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        /* ── Split browse panel ────────────────────────────────────────── */
        <View className="flex-1 flex-row">
          {/* Left — roots */}
          <View className="w-[42%] border-r border-gray-100 bg-gray-50">
            <ScrollView className="flex-1 py-1.5">
              {loading ? (
                <View className="items-center py-10">
                  <ActivityIndicator color="#f97316" />
                </View>
              ) : roots.length === 0 ? (
                <Text className="px-3 py-10 text-center text-sm text-gray-500">
                  No categories found
                </Text>
              ) : (
                roots.map((cat) => {
                  const active = activeCategory?._id === cat._id;
                  return (
                    <Pressable
                      key={cat._id}
                      onPress={() => setActiveCategory(cat)}
                      className={`w-full flex-row items-center gap-2.5 px-3 py-2.5 ${
                        active
                          ? 'border-l-2 border-orange-500 bg-white'
                          : 'border-l-2 border-transparent'
                      }`}
                    >
                      <CategoryChip cat={cat} size={36} active={active} />
                      <View className="min-w-0 flex-1">
                        <Text
                          numberOfLines={1}
                          className={`text-xs font-semibold ${
                            active ? 'text-orange-600' : 'text-gray-800'
                          }`}
                        >
                          {cat.name}
                        </Text>
                        {(cat.productCount ?? 0) > 0 ? (
                          <Text className="text-[10px] text-gray-400">
                            {cat.productCount} item{cat.productCount !== 1 ? 's' : ''}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View className="border-t border-gray-200 bg-white p-2.5">
              <Pressable
                onPress={() => go('/shop')}
                className="flex-row items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5"
              >
                <Ionicons name="storefront-outline" size={14} color="#ffffff" />
                <Text className="text-xs font-bold text-white">All Products</Text>
              </Pressable>
            </View>
          </View>

          {/* Right — subcategories */}
          <View className="flex-1 bg-white">
            {activeCategory ? (
              <ScrollView className="flex-1 p-3">
                <View className="mb-3 flex-row items-center gap-3">
                  <CategoryChip cat={activeCategory} size={44} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-bold text-gray-900">
                      {activeCategory.name}
                    </Text>
                    {activeCategory.tagline ? (
                      <Text numberOfLines={1} className="text-[11px] text-gray-500">
                        {activeCategory.tagline}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Pressable
                  onPress={() => go(`/shop?category=${activeCategory.slug}`)}
                  className="mb-4 flex-row items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5"
                >
                  <Text className="text-xs font-bold text-white">Shop {activeCategory.name}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                </Pressable>

                {subcategories.length > 0 ? (
                  <>
                    <Text
                      className="mb-2.5 text-[10px] font-bold uppercase text-gray-400"
                      style={{ letterSpacing: 1 }}
                    >
                      Subcategories
                    </Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {subcategories.map((sub) => (
                        <Pressable
                          key={sub._id}
                          onPress={() =>
                            go(`/shop?category=${activeCategory.slug}&subcategory=${sub.slug}`)
                          }
                          style={{ width: '47%' }}
                          className="items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2 py-3"
                        >
                          <CategoryChip cat={sub} size={32} />
                          <View className="items-center">
                            <Text className="text-center text-xs font-medium leading-tight text-gray-700">
                              {sub.name}
                            </Text>
                            {(sub.productCount ?? 0) > 0 ? (
                              <Text className="mt-0.5 text-[10px] text-gray-400">
                                {sub.productCount}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : !loading ? (
                  <View className="items-center justify-center py-10">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <MaterialCommunityIcons name="package-variant" size={22} color="#9ca3af" />
                    </View>
                    <Text className="mt-2.5 text-xs text-gray-500">No subcategories yet</Text>
                    <Pressable onPress={() => go(`/shop?category=${activeCategory.slug}`)}>
                      <Text className="mt-3 text-xs font-semibold text-orange-600">
                        Browse {activeCategory.name} →
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <View className="flex-1 items-center justify-center p-6">
                <View className="h-16 w-16 overflow-hidden rounded-2xl">
                  <Gradient name="drawerPrompt" style={{ flex: 1 }}>
                    <View className="h-full w-full items-center justify-center">
                      <MaterialCommunityIcons name="gesture-tap" size={28} color="#fb923c" />
                    </View>
                  </Gradient>
                </View>
                <Text className="mt-3 text-sm font-bold text-gray-800">Pick a category</Text>
                <Text className="mt-1 max-w-[200px] text-center text-xs text-gray-500">
                  Tap a category on the left to browse its subcategories
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </>
  );
}
