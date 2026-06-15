'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Empty, SearchNotFoundIcon, Button } from 'rizzui';
import {
  PiMagnifyingGlassBold,
  PiX,
  PiArrowsClockwise,
  PiBarcode,
  PiCheckCircle,
  PiWarningCircle,
  PiTag,
  PiPackage,
} from 'react-icons/pi';
import POSProductCard from '@/app/shared/point-of-sale/components/pos-product-card';
import POSComboPicker from '@/app/shared/point-of-sale/components/pos-combo-picker';
import {
  POSProduct,
  POSCombo,
  POSCartItem,
} from '@/app/shared/point-of-sale/types';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  getProducts as getProductsOffline,
  getProductsWithLocalStock,
} from '@/app/shared/point-of-sale/offline/api';
import { useOnlineStatus } from '@/app/shared/point-of-sale/offline/use-online-status';
import {
  usePOSAuth,
  usePOSUI,
  usePOSSaleSignal,
  usePOSCart,
  usePOSPricelist,
  usePOSCombos,
  usePOSProducts,
  usePOSActiveShop,
} from '@/app/shared/point-of-sale/store';
import { applyPricelistToProduct } from '@/app/shared/point-of-sale/utils';
import { useBarcodeScanner } from '@/app/shared/point-of-sale/hooks/useBarcodeScanner';
import toast from 'react-hot-toast';

type ProductGridProps = {
  onAddToCart: (
    product: POSProduct,
    sizeId?: string,
    quantity?: number
  ) => void;
};

type ScanResult =
  | { status: 'ok'; label: string }
  | { status: 'err'; label: string }
  | null;

function formatCategoryLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="aspect-square w-full animate-pulse bg-gray-100" />
      <div className="space-y-2 px-3 pb-3 pt-2.5">
        <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="mt-1 h-5 w-20 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ── Scan feedback banner ──────────────────────────────────────────────────────
function ScanBanner({
  result,
  onDismiss,
}: {
  result: ScanResult;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  const ok = result.status === 'ok';
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
    >
      {ok ? (
        <PiCheckCircle className="h-5 w-5 shrink-0" />
      ) : (
        <PiWarningCircle className="h-5 w-5 shrink-0" />
      )}
      {result.label}
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto opacity-70 hover:opacity-100"
      >
        <PiX className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Combo card ────────────────────────────────────────────────────────────────
function ComboCard({ combo, onOpen }: { combo: POSCombo; onOpen: () => void }) {
  // Collect up to 4 product thumbnails from all choice lines
  const images = combo.choiceLines
    .flatMap((l) =>
      (l.items || []).map((it: any) => {
        const sp = it.subProduct;
        return (
          sp?.product?.images?.[0]?.thumbnail ||
          sp?.product?.images?.[0]?.url ||
          ''
        );
      })
    )
    .filter(Boolean)
    .slice(0, 4) as string[];

  const groupLabels = combo.choiceLines.map((l) => l.label).filter(Boolean);

  const priceNode =
    combo.priceMode === 'fixed' ? (
      <span className="font-black text-[#b20202]">
        ₦{combo.price.toLocaleString()}
      </span>
    ) : combo.priceMode === 'markup_on_cost' ? (
      <span className="font-bold text-blue-600">
        +{combo.markupPercentage ?? 0}%
      </span>
    ) : combo.priceMode === 'discount_off_selling' ? (
      <span className="font-bold text-emerald-600">
        −{combo.discountPercentage ?? 0}%
      </span>
    ) : (
      <span className="text-gray-400">Dynamic</span>
    );

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-all hover:border-[#b20202]/40 hover:shadow-md active:scale-[0.97]"
    >
      {/* Image area — collage if we have images, gradient placeholder otherwise */}
      <div className="relative aspect-square w-full overflow-hidden">
        {images.length >= 2 ? (
          <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-gray-100">
            {Array.from({ length: Math.min(images.length, 4) }).map((_, i) => (
              <div key={i} className="relative overflow-hidden bg-gray-100">
                <img
                  src={images[i]}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        ) : images.length === 1 ? (
          <img
            src={images[0]}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="to-[#b20202]/4 flex h-full w-full items-center justify-center bg-gradient-to-br from-[#b20202]/10">
            <PiPackage className="h-10 w-10 text-[#b20202]/40" />
          </div>
        )}

        {/* Price badge — bottom right */}
        <div className="absolute bottom-2 right-2 rounded-xl bg-white/90 px-2 py-0.5 text-xs shadow-sm backdrop-blur-sm">
          {priceNode}
        </div>

        {/* "Combo" label — top left */}
        <div className="absolute left-2 top-2 rounded-lg bg-[#b20202] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          Combo
        </div>
      </div>

      {/* Info */}
      <div className="px-3 pb-3 pt-2.5">
        <p className="line-clamp-1 text-xs font-bold text-gray-900">
          {combo.name}
        </p>
        {groupLabels.length > 0 && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-400">
            {groupLabels.join(' · ')}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {combo.choiceLines.slice(0, 3).map((l, i) => (
            <span
              key={i}
              className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500"
            >
              {l.label || `Group ${i + 1}`}
            </span>
          ))}
          {combo.choiceLines.length > 3 && (
            <span className="text-[9px] text-gray-400">
              +{combo.choiceLines.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function POSProductGrid({ onAddToCart }: ProductGridProps) {
  const [allProducts, setAllProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const { combos, setCombos } = usePOSCombos();
  const { setProducts: setGlobalProducts } = usePOSProducts();
  const [combosLoading, setCombosLoading] = useState(false);
  const [activeComboPicker, setActiveComboPicker] = useState<POSCombo | null>(
    null
  );

  // 'combos' is a virtual category injected into the pills
  const [showCombos, setShowCombos] = useState(false);

  const isOnline = useOnlineStatus();
  const { token } = usePOSAuth();
  const { searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } =
    usePOSUI();
  const { saleCounter } = usePOSSaleSignal();
  const { selectedPricelist } = usePOSPricelist();
  const { items: cartItems, addItem } = usePOSCart();
  const searchRef = useRef<HTMLInputElement>(null);
  const lastSaleCartRef = useRef(cartItems);
  useEffect(() => {
    lastSaleCartRef.current = cartItems;
  }, [cartItems]);

  const { activeShop } = usePOSActiveShop();

  const fetchProducts = useCallback(
    async (silent = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const products = isOnline
          ? await getProductsOffline(token, activeShop?._id)
          : await getProductsWithLocalStock();
        setAllProducts((products || []) as unknown as POSProduct[]);
        setGlobalProducts((products || []) as unknown as POSProduct[]);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to load products'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, isOnline, activeShop?._id]
  );

  // Initial load, and refetch whenever the active shop (and thus its bound
  // warehouse) changes.
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch combos on mount
  useEffect(() => {
    if (!token) return;
    setCombosLoading(true);
    posApi
      .getCombos(token)
      .then((data) => setCombos(data.combos || []))
      .catch(() => {
        /* silent — combos are optional */
      })
      .finally(() => setCombosLoading(false));
  }, [token]);

  // After every completed sale: optimistically decrement local stock, then silently re-fetch
  const prevSaleCounter = useRef(0);
  useEffect(() => {
    if (saleCounter === 0 || saleCounter === prevSaleCounter.current) return;
    prevSaleCounter.current = saleCounter;

    // Optimistic update: immediately decrement stock in the local product list
    const soldItems = lastSaleCartRef.current;
    if (soldItems.length > 0) {
      setAllProducts((prev) =>
        prev.map((product) => {
          const soldLine = soldItems.find(
            (ci) => ci.subProductId === product._id
          );
          if (!soldLine) return product;

          if (soldLine.sizeId) {
            // Decrement the matching size's availableStock
            return {
              ...product,
              sizes: (product.sizes || []).map((s) =>
                s._id === soldLine.sizeId
                  ? {
                      ...s,
                      availableStock: Math.max(
                        0,
                        s.availableStock - soldLine.quantity
                      ),
                    }
                  : s
              ),
            };
          } else {
            // No-size product
            return {
              ...product,
              availableStock: Math.max(
                0,
                product.availableStock - soldLine.quantity
              ),
            };
          }
        })
      );
    }

    // Then silently sync with the real DB values (no spinner)
    fetchProducts(true);
  }, [saleCounter, fetchProducts]);

  // ── Barcode scan handler ────────────────────────────────────────────────────
  const handleScan = useCallback(
    (code: string) => {
      const q = code.trim().toUpperCase();
      if (!q) return;

      // Search every loaded product's sizes for matching barcode or SKU.
      // Apply pricelist here so the price added to cart matches what the grid shows.
      for (const raw of allProducts) {
        const product = applyPricelistToProduct(raw, selectedPricelist);

        // No-size product
        if (!product.sizes?.length || product.sellWithoutSizeVariants) {
          if (product.sku?.toUpperCase() === q) {
            if (product.availableStock <= 0) {
              setScanResult({
                status: 'err',
                label: `Out of stock: ${product.product?.name}`,
              });
              return;
            }
            onAddToCart(product, undefined, 1);
            setScanResult({
              status: 'ok',
              label: `Added: ${product.product?.name || product.sku || 'Product'}`,
            });
            setFlashId(product._id);
            setTimeout(() => setFlashId(null), 1200);
            return;
          }
        }

        // Sized product
        if (product.sizes?.length) {
          for (const size of product.sizes) {
            const matchSku = size.sku?.toUpperCase() === q;
            const matchBarcode = size.barcode?.toUpperCase() === q;
            if (matchSku || matchBarcode) {
              if (size.availableStock <= 0) {
                setScanResult({
                  status: 'err',
                  label: `Out of stock: ${product.product?.name} – ${size.displayName}`,
                });
                return;
              }
              onAddToCart(product, size._id, 1);
              setScanResult({
                status: 'ok',
                label: `Added: ${product.product?.name} – ${size.displayName}`,
              });
              setFlashId(product._id);
              setTimeout(() => setFlashId(null), 1200);
              return;
            }
          }
        }
      }

      setScanResult({ status: 'err', label: `No match for: ${code}` });
      setSearchQuery(code);
      searchRef.current?.focus();
    },
    [allProducts, selectedPricelist, onAddToCart, setSearchQuery]
  );

  useBarcodeScanner(handleScan);

  // ── Client-side filter + search ─────────────────────────────────────────────
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          allProducts.map((p) => p.product?.type).filter(Boolean) as string[]
        )
      ).sort(),
    [allProducts]
  );

  const products = useMemo(() => {
    let list = allProducts;
    if (selectedCategory)
      list = list.filter((p) => p.product?.type === selectedCategory);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.product?.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.product?.brand?.name?.toLowerCase().includes(q) ||
          p.sizes?.some(
            (s) =>
              s.displayName?.toLowerCase().includes(q) ||
              s.sku?.toLowerCase().includes(q) ||
              s.barcode?.toLowerCase().includes(q)
          )
      );
    }

    // Apply pricelist pricing in-memory (display only — doesn't modify DB)
    if (selectedPricelist) {
      list = list.map((p) => applyPricelistToProduct(p, selectedPricelist));
    }

    return list;
  }, [allProducts, selectedCategory, searchQuery, selectedPricelist]);

  const isFiltered =
    !showCombos && (!!selectedCategory || !!searchQuery.trim());

  // Handle adding all combo items to cart
  function handleComboAdd(items: POSCartItem[]) {
    if (!items.length) return;
    items.forEach((item) => addItem(item));
    toast.success(
      `${items.length} item${items.length > 1 ? 's' : ''} added from combo`,
      { icon: '🎁' }
    );
    setActiveComboPicker(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-10 bg-gray-50 pb-3 pt-1">
        {/* Scan feedback */}
        {scanResult && (
          <div className="mb-2">
            <ScanBanner
              result={scanResult}
              onDismiss={() => setScanResult(null)}
            />
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <PiMagnifyingGlassBold className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              // Manual barcode/SKU search on Enter
              if (e.key === 'Enter' && searchQuery.trim()) {
                handleScan(searchQuery.trim());
                e.preventDefault();
              }
            }}
            placeholder="Search by name, brand, SKU, barcode…"
            className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-24 text-sm shadow-sm outline-none transition-all focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/10"
          />
          {/* Barcode hint */}
          <div className="absolute right-10 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[10px] font-medium text-gray-300">
            <PiBarcode className="h-4 w-4" />
            <span>Scan ready</span>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category pills + count + refresh */}
        <div className="flex items-center gap-2">
          <div className="scrollbar-none flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
            {/* All products pill */}
            <button
              type="button"
              onClick={() => {
                setShowCombos(false);
                setSelectedCategory('');
              }}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !showCombos && !selectedCategory
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
              {!loading && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    !showCombos && !selectedCategory
                      ? 'bg-white/25 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {allProducts.length}
                </span>
              )}
            </button>

            {/* Combos pill — only shown when combos exist */}
            {(combos.length > 0 || combosLoading) && (
              <button
                type="button"
                onClick={() => {
                  setShowCombos(true);
                  setSelectedCategory('');
                }}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  showCombos
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Combos
                {!combosLoading && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      showCombos
                        ? 'bg-white/25 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {combos.length}
                  </span>
                )}
              </button>
            )}

            {/* Product category pills */}
            {!showCombos &&
              categories.map((cat) => {
                const count = allProducts.filter(
                  (p) => p.product?.type === cat
                ).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#b20202] text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {formatCategoryLabel(cat)}
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        selectedCategory === cat
                          ? 'bg-white/25 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!loading && !showCombos && (
              <span className="text-[11px] font-medium text-gray-400">
                {isFiltered
                  ? `${products.length} / ${allProducts.length}`
                  : `${allProducts.length} items`}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchProducts()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
              title="Refresh"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Active pricelist banner ── */}
      {selectedPricelist && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <PiTag className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            Pricelist: <strong>{selectedPricelist.name}</strong> — prices
            adjusted
          </span>
        </div>
      )}

      {/* ── Combo grid ── */}
      {showCombos && (
        <div className="flex-1 overflow-y-auto">
          {combosLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : combos.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
              <PiPackage className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">No combos available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {combos.map((combo) => (
                <ComboCard
                  key={combo._id}
                  combo={combo}
                  onOpen={() => setActiveComboPicker(combo)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Product grid ── */}
      {!showCombos && (
        <div className="flex-1 overflow-y-auto">
          {!isOnline && (
            <div className="mb-2 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              Offline — showing cached stock levels
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchProducts()}
              >
                Retry
              </Button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <Empty
                image={<SearchNotFoundIcon />}
                text={
                  searchQuery
                    ? `No results for "${searchQuery}"${selectedCategory ? ` in ${formatCategoryLabel(selectedCategory)}` : ''}`
                    : selectedCategory
                      ? `No products in ${formatCategoryLabel(selectedCategory)}`
                      : 'No products available'
                }
                className="justify-center"
              />
              {isFiltered && (
                <div className="flex gap-2">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Clear search
                    </button>
                  )}
                  {selectedCategory && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('')}
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Show all categories
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((product) => (
                <POSProductCard
                  key={product._id}
                  product={product}
                  onAddToCart={onAddToCart}
                  flash={flashId === product._id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Combo picker modal ── */}
      {activeComboPicker && (
        <POSComboPicker
          combo={activeComboPicker}
          onAdd={handleComboAdd}
          onClose={() => setActiveComboPicker(null)}
        />
      )}
    </div>
  );
}
