'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useCompare } from '@/context/CompareContext';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { ProductType } from '@/types/product.types';
import { resolveProductPrice, resolveProductOriginPrice } from '@/utils/product.utils';
import Rate from '@/components/Other/Rate';

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

const getProductId = (p: ProductType): string => p._id || p.id || '';

const getImageUrl = (p: ProductType): string | null => {
  const first = p.images?.[0];
  if (!first) return p.primaryImage?.url || null;
  return typeof first === 'string' ? first : first.url || null;
};

const getRating = (p: ProductType): number => Number(p.rating ?? p.rate ?? 0) || 0;

// Total available stock across vendors, or null when the product carries no stock info.
const getStock = (p: ProductType): number | null => {
  if (Array.isArray(p.availableAt) && p.availableAt.length > 0) {
    return p.availableAt.reduce(
      (sum, v) => sum + (v.sizes || []).reduce((s, sz) => s + (sz.stock || 0), 0),
      0,
    );
  }
  if (p.availability) return p.availability.inStock ? (p.availability.totalStock || 1) : 0;
  return typeof p.quantity === 'number' ? p.quantity : null;
};

// Unknown stock (null) is treated as purchasable.
const isInStock = (p: ProductType): boolean => {
  const s = getStock(p);
  return s == null ? true : s > 0;
};

const getBadge = (p: ProductType) => {
  if (p.sale && resolveProductOriginPrice(p) && resolveProductOriginPrice(p)! > resolveProductPrice(p)) return { text: 'Sale', className: 'bg-red-500' };
  if (p.badge?.text) return { text: p.badge.text, className: 'bg-emerald-500' };
  if (p.new) return { text: 'New', className: 'bg-blue-500' };
  return null;
};

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

type Field = {
  key: string;
  label: string;
  // Plain-text representation, used for both display and "differences only" equality.
  text: (p: ProductType) => string;
  // Optional richer cell renderer (falls back to `text`).
  render?: (p: ProductType) => React.ReactNode;
  // For "best value" highlighting: which direction wins, and how to read the number.
  better?: 'low' | 'high';
  numeric?: (p: ProductType) => number | null;
};

const ComparePage = () => {
  const {
    compareState,
    removeFromCompare,
    clearCompare,
    compareCount,
    refreshCompareData,
    isRefreshing,
  } = useCompare();
  const { addToCart, updateQuantity, getCartItemId, cartState } = useCart();
  const { openModalCart } = useModalCartContext();

  const [currency, setCurrency] = useState('₦');
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  const products = compareState.compareArray;

  // Read currency symbol once, and pull fresh price/stock on mount.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrency(localStorage.getItem('currency_symbol') || '₦');
    }
    refreshCompareData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPrice = useCallback(
    (price: number | undefined | null): string => {
      if (price == null || isNaN(price)) return `${currency}0`;
      return `${currency}${Math.round(price).toLocaleString('en-NG')}`;
    },
    [currency],
  );

  // -------------------------------------------------------------------------
  // Add to cart (mirrors the product card's first-available-size resolution)
  // -------------------------------------------------------------------------
  const handleAddToCart = useCallback(
    (product: ProductType) => {
      const vendor = product.availableAt?.[0];
      const vendorSizes = vendor?.sizes || [];
      const firstAvailable = vendorSizes.find((s) => (s.stock || 0) > 0) || vendorSizes[0];
      const sizeToUse = firstAvailable?.size || product.sizes?.[0]?.size || '';
      const vendorName = vendor?.tenant?.name || '';
      const vendorId = vendor?.tenant?._id || '';
      const sizeId = firstAvailable?._id || '';
      const subProductId = vendor?._id || '';

      const cartItemId = getCartItemId(getProductId(product), sizeToUse, vendorName, '');
      const existing = cartState.cartArray.find((i) => i.cartItemId === cartItemId);
      if (existing) {
        updateQuantity(cartItemId, (existing.quantity || 1) + 1);
      } else {
        addToCart(product, sizeToUse, '', vendorName, vendorId, undefined, sizeId, subProductId);
      }

      setAddedId(getProductId(product));
      openModalCart();
      window.setTimeout(() => setAddedId(null), 1500);
    },
    [addToCart, updateQuantity, getCartItemId, cartState.cartArray, openModalCart],
  );

  // -------------------------------------------------------------------------
  // Fields
  // -------------------------------------------------------------------------
  const fields: Field[] = useMemo(
    () => [
      {
        key: 'price',
        label: 'Price',
        text: (p) => formatPrice(resolveProductPrice(p)),
        render: (p) => {
          const price = resolveProductPrice(p);
          const origin = resolveProductOriginPrice(p);
          return (
            <div>
              <span className="font-bold text-gray-900">{formatPrice(price)}</span>
              {origin && origin > price && (
                <span className="ml-2 text-sm text-gray-400 line-through">
                  {formatPrice(origin)}
                </span>
              )}
            </div>
          );
        },
        better: 'low',
        numeric: (p) => resolveProductPrice(p) || null,
      },
      {
        key: 'discount',
        label: 'Discount',
        text: (p) => (p.discount ? `${p.discount}% OFF` : '—'),
        better: 'high',
        numeric: (p) => (p.discount ? Number(p.discount) : null),
      },
      {
        key: 'rating',
        label: 'Rating',
        text: (p) => (getRating(p) ? `${getRating(p)} (${p.reviewCount || 0})` : '—'),
        render: (p) =>
          getRating(p) ? (
            <div className="flex items-center gap-2">
              <Rate currentRate={getRating(p)} size={14} />
              <span className="text-sm text-gray-600">({p.reviewCount || 0})</span>
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          ),
        better: 'high',
        numeric: (p) => getRating(p) || null,
      },
      { key: 'abv', label: 'ABV', text: (p) => (p.abv ? `${p.abv}% ABV` : 'Non-Alcoholic') },
      { key: 'volumeMl', label: 'Volume', text: (p) => (p.volumeMl ? `${p.volumeMl}ml` : '—') },
      { key: 'type', label: 'Type', text: (p) => p.type || '—' },
      { key: 'category', label: 'Category', text: (p) => p.category?.name || '—' },
      { key: 'brand', label: 'Brand', text: (p) => p.brand?.name || '—' },
      { key: 'originCountry', label: 'Origin', text: (p) => p.originCountry || '—' },
      { key: 'region', label: 'Region', text: (p) => p.region || '—' },
      { key: 'producer', label: 'Producer', text: (p) => p.producer || '—' },
      {
        key: 'flavors',
        label: 'Flavors',
        text: (p) => (p.flavors?.length ? p.flavors.map((f) => f.name).join(', ') : '—'),
      },
      {
        key: 'tastingNotes',
        label: 'Tasting Notes',
        text: (p) => {
          const n = p.tastingNotes;
          if (!n) return '—';
          const all = [...(n.aroma || []), ...(n.palate || []), ...(n.finish || [])];
          return all.length ? all.join(', ') : '—';
        },
      },
      {
        key: 'availability',
        label: 'Availability',
        text: (p) => (isInStock(p) ? 'In Stock' : 'Out of Stock'),
        render: (p) =>
          isInStock(p) ? (
            <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500" /> In Stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Out of Stock
            </span>
          ),
      },
      {
        key: 'description',
        label: 'Description',
        text: (p) => p.shortDescription || p.description || 'No description available.',
        render: (p) => (
          <p className="text-sm text-gray-600 line-clamp-4">
            {p.shortDescription || p.description || 'No description available.'}
          </p>
        ),
      },
    ],
    [formatPrice],
  );

  // -------------------------------------------------------------------------
  // Best-value winners (unique min/max per numeric field)
  // -------------------------------------------------------------------------
  const bestByField = useMemo(() => {
    const map: Record<string, string> = {};
    if (products.length < 2) return map;
    fields.forEach((f) => {
      if (!f.better || !f.numeric) return;
      const vals = products
        .map((p) => ({ id: getProductId(p), v: f.numeric!(p) }))
        .filter((x) => x.v != null && !isNaN(x.v as number)) as { id: string; v: number }[];
      if (vals.length < 2) return;
      const target = f.better === 'low'
        ? Math.min(...vals.map((x) => x.v))
        : Math.max(...vals.map((x) => x.v));
      const winners = vals.filter((x) => x.v === target);
      if (winners.length === 1 && target > 0) map[f.key] = winners[0].id;
    });
    return map;
  }, [products, fields]);

  const bestChip = (key: string): string | null => {
    if (key === 'price') return 'Best price';
    if (key === 'rating') return 'Top rated';
    if (key === 'discount') return 'Biggest saving';
    return 'Best';
  };

  // -------------------------------------------------------------------------
  // Visible fields (respecting "differences only")
  // -------------------------------------------------------------------------
  const visibleFields = useMemo(() => {
    if (!showDiffOnly || products.length < 2) return fields;
    return fields.filter((f) => {
      const first = f.text(products[0]);
      return products.some((p) => f.text(p) !== first);
    });
  }, [fields, products, showDiffOnly]);

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  if (compareCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl mx-auto text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Icon.PiScales size={48} className="text-gray-400" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">No Products to Compare</h1>
            <p className="text-gray-600 mb-8">
              Add products to your comparison list to see them side-by-side. Visit the shop to
              explore our selection of beverages.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon.PiShoppingCart size={20} />
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const gridTemplate = { gridTemplateColumns: `minmax(120px,180px) repeat(${products.length}, minmax(0,1fr))` };

  // Reusable add-to-cart button
  const CartButton = ({ product }: { product: ProductType }) => {
    const stocked = isInStock(product);
    const justAdded = addedId === getProductId(product);
    if (!stocked) {
      return (
        <button
          disabled
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
        >
          <Icon.PiProhibit size={16} /> Out of Stock
        </button>
      );
    }
    return (
      <button
        onClick={() => handleAddToCart(product)}
        className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          justAdded ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {justAdded ? (
          <>
            <Icon.PiCheck size={16} /> Added
          </>
        ) : (
          <>
            <Icon.PiShoppingCart size={16} /> Add to Cart
          </>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center">
                <Icon.PiScales size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Compare Products</h1>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  {compareCount} product{compareCount !== 1 ? 's' : ''} selected
                  {isRefreshing && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Icon.PiArrowsClockwise size={13} className="animate-spin" /> updating…
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {products.length >= 2 && (
                <button
                  onClick={() => setShowDiffOnly((v) => !v)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showDiffOnly
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon.PiFunnel size={16} />
                  <span className="hidden sm:inline">Differences only</span>
                  <span className="sm:hidden">Diff</span>
                </button>
              )}
              <button
                onClick={clearCompare}
                className="flex items-center gap-2 px-3 md:px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Icon.PiTrash size={16} />
                <span className="hidden sm:inline">Clear All</span>
              </button>
              <Link
                href="/shop"
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                <Icon.PiPlus size={16} />
                <span className="hidden sm:inline">Add More</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* ---------------------------------------------------------------- */}
        {/* DESKTOP: side-by-side table                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Product headers */}
          <div className="grid border-b border-gray-200" style={gridTemplate}>
            <div className="p-4 bg-gray-50 border-r border-gray-200" />
            {products.map((product, index) => {
              const badge = getBadge(product);
              const img = getImageUrl(product);
              return (
                <motion.div
                  key={getProductId(product)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="relative p-4 border-r border-gray-200 last:border-r-0"
                >
                  <button
                    onClick={() => removeFromCompare(getProductId(product))}
                    aria-label={`Remove ${product.name}`}
                    className="absolute top-3 right-3 z-10 w-7 h-7 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                  >
                    <Icon.PiX size={14} />
                  </button>

                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-4">
                    {img ? (
                      <Image
                        src={img}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={40} className="text-gray-400" />
                      </div>
                    )}
                    {badge && (
                      <div className={`absolute top-2 left-2 px-2 py-1 ${badge.className} text-white text-xs font-bold rounded-lg`}>
                        {badge.text}
                      </div>
                    )}
                  </div>

                  <Link href={`/product/${product.slug || getProductId(product)}`}>
                    <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 hover:text-amber-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  {product.brand?.name && (
                    <p className="text-sm text-gray-500">{product.brand.name}</p>
                  )}
                  <CartButton product={product} />
                </motion.div>
              );
            })}
          </div>

          {/* Attribute rows */}
          {visibleFields.map((field, i) => (
            <div
              key={field.key}
              className={`grid border-b border-gray-100 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              style={gridTemplate}
            >
              <div className="p-4 font-medium text-gray-700 bg-gray-50 border-r border-gray-200 flex items-center text-sm">
                {field.label}
              </div>
              {products.map((product) => {
                const isBest = bestByField[field.key] === getProductId(product);
                return (
                  <div
                    key={`${getProductId(product)}-${field.key}`}
                    className={`p-4 border-r border-gray-100 last:border-r-0 flex items-center text-sm relative ${
                      isBest ? 'ring-2 ring-inset ring-green-400/60 bg-green-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {field.render ? field.render(product) : field.text(product)}
                      {isBest && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[11px] font-semibold rounded">
                          <Icon.PiCheckCircle size={12} /> {bestChip(field.key)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {showDiffOnly && visibleFields.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              These products share the same values across all attributes.
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* MOBILE: stacked per-product cards                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="md:hidden space-y-5">
          {products.map((product) => {
            const badge = getBadge(product);
            const img = getImageUrl(product);
            return (
              <motion.div
                key={getProductId(product)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="flex gap-4 p-4 border-b border-gray-100 relative">
                  <button
                    onClick={() => removeFromCompare(getProductId(product))}
                    aria-label={`Remove ${product.name}`}
                    className="absolute top-3 right-3 w-7 h-7 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center"
                  >
                    <Icon.PiX size={14} />
                  </button>
                  <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                    {img ? (
                      <Image src={img} alt={product.name} fill className="object-cover" sizes="96px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={28} className="text-gray-400" />
                      </div>
                    )}
                    {badge && (
                      <div className={`absolute top-1 left-1 px-1.5 py-0.5 ${badge.className} text-white text-[10px] font-bold rounded`}>
                        {badge.text}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <Link href={`/product/${product.slug || getProductId(product)}`}>
                      <h3 className="font-bold text-gray-900 line-clamp-2">{product.name}</h3>
                    </Link>
                    {product.brand?.name && <p className="text-xs text-gray-500">{product.brand.name}</p>}
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(resolveProductPrice(product))}</p>
                  </div>
                </div>

                <dl className="divide-y divide-gray-100">
                  {visibleFields.map((field) => {
                    const isBest = bestByField[field.key] === getProductId(product);
                    return (
                      <div
                        key={field.key}
                        className={`flex items-start justify-between gap-4 px-4 py-2.5 ${isBest ? 'bg-green-50/60' : ''}`}
                      >
                        <dt className="text-xs font-medium text-gray-500 flex-shrink-0 pt-0.5">{field.label}</dt>
                        <dd className="text-sm text-gray-900 text-right flex items-center gap-2 flex-wrap justify-end">
                          {field.render ? field.render(product) : field.text(product)}
                          {isBest && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded">
                              <Icon.PiCheckCircle size={11} /> {bestChip(field.key)}
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                <div className="p-4 pt-2">
                  <CartButton product={product} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Add-more hint when only one product */}
        {compareCount < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon.PiInfo size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Add More Products to Compare</h3>
                <p className="text-gray-600 mb-4">
                  Add at least one more product to unlock side-by-side comparison and best-value
                  highlights. We recommend comparing 2–4 products.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
                >
                  <Icon.PiPlus size={18} />
                  Add Products to Compare
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
