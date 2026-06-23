'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

type SortKey = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',     label: 'Newest First' },
  { key: 'oldest',     label: 'Oldest First' },
  { key: 'price_asc',  label: 'Price: Low → High' },
  { key: 'price_desc', label: 'Price: High → Low' },
  { key: 'name',       label: 'Name A–Z' },
];

function getItemPrice(item: any): number {
  return item.priceRange?.min ?? item.price ?? 0;
}

export default function WishlistPage() {
  const router = useRouter();
  const { wishlistState, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();

  const [mounted, setMounted]             = useState(false);
  const [loadingId, setLoadingId]         = useState<string | null>(null);
  const [addingAll, setAddingAll]         = useState(false);
  const [showClear, setShowClear]         = useState(false);
  const [toast, setToast]                 = useState<{ text: string; type: 'success' | 'remove' } | null>(null);
  const [sort, setSort]                   = useState<SortKey>('newest');

  useEffect(() => { setMounted(true); }, []);

  const showToast = (text: string, type: 'success' | 'remove' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const items = wishlistState?.wishlistArray || [];

  const sorted = useMemo(() => {
    const arr = [...items];
    switch (sort) {
      case 'newest':     return arr.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
      case 'oldest':     return arr.sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0));
      case 'price_asc':  return arr.sort((a, b) => getItemPrice(a) - getItemPrice(b));
      case 'price_desc': return arr.sort((a, b) => getItemPrice(b) - getItemPrice(a));
      case 'name':       return arr.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      default:           return arr;
    }
  }, [items, sort]);

  const handleAddToCart = async (item: any) => {
    const id = item._id || item.id;
    setLoadingId(id);
    try {
      addToCart({
        ...item,
        quantity: 1,
        selectedSize: item.selectedSize || item.sizes?.[0]?.size || '',
        selectedSizeId: item.selectedSizeId || item.sizes?.[0]?._id || '',
        selectedSubProductId: item.selectedSubProductId || item._id || '',
        selectedProductId: item.selectedProductId || item._id || '',
        selectedVendor: item.selectedVendor || '',
        selectedVendorId: item.selectedVendorId || '',
        selectedColor: '',
        cartItemId: `${id}-${Date.now()}`,
      });
      removeFromWishlist(id);
      showToast(`${item.name} added to cart!`);
    } catch {}
    finally { setLoadingId(null); }
  };

  const handleAddAllToCart = async () => {
    setAddingAll(true);
    const inStock = items.filter(i => i.availability?.status !== 'out_of_stock');
    for (const item of inStock) {
      const id = item._id || item.id;
      addToCart({
        ...item,
        quantity: 1,
        selectedSize: item.sizes?.[0]?.size || '',
        selectedSizeId: item.sizes?.[0]?._id || '',
        selectedSubProductId: item._id || '',
        selectedProductId: item._id || '',
        selectedVendor: '',
        selectedVendorId: '',
        selectedColor: '',
        cartItemId: `${id}-${Date.now()}`,
      });
      removeFromWishlist(id);
    }
    setAddingAll(false);
    showToast(`${inStock.length} item${inStock.length !== 1 ? 's' : ''} added to cart!`);
  };

  const handleRemove = (id: string, name: string) => {
    removeFromWishlist(id);
    showToast(`${name} removed`, 'remove');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -48 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${
              toast.type === 'remove'
                ? 'bg-gray-900 text-white'
                : 'bg-gradient-to-br from-red-700 to-red-900 text-white'
            }`}
          >
            {toast.type === 'remove'
              ? <Icon.PiTrashBold size={16} />
              : <Icon.PiShoppingCartBold size={16} />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Clear confirm modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={() => setShowClear(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full"
            >
              <div className="w-14 h-14 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon.PiTrashBold size={26} />
              </div>
              <h3 className="text-lg font-black text-gray-900 text-center">Clear wishlist?</h3>
              <p className="text-sm text-gray-500 text-center mt-1.5 mb-5">
                This will remove all {items.length} saved item{items.length !== 1 ? 's' : ''}. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClear(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-red-200 hover:text-red-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { clearWishlist(); setShowClear(false); showToast('Wishlist cleared', 'remove'); }}
                  className="flex-1 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-xl text-sm font-bold hover:from-red-800 hover:to-red-950 transition-all"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="container mx-auto max-w-6xl px-4 py-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Icon.PiHeartBold size={18} className="text-red-400" />
                <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">Saved Items</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">My Wishlist</h1>
              {mounted && items.length > 0 && (
                <p className="text-red-200 text-sm mt-1.5">
                  {items.length} item{items.length !== 1 ? 's' : ''} saved
                </p>
              )}
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleAddAllToCart}
                  disabled={addingAll || items.every(i => i.availability?.status === 'out_of_stock')}
                  className="flex items-center gap-2 bg-white text-red-800 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  {addingAll
                    ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-700 rounded-full animate-spin" />
                    : <Icon.PiShoppingCartBold size={15} />}
                  Add All to Cart
                </button>
                <button
                  onClick={() => setShowClear(true)}
                  className="flex items-center gap-2 border border-white/20 text-white/70 px-4 py-2.5 rounded-xl font-semibold text-sm hover:border-white/40 hover:text-white transition-all"
                >
                  <Icon.PiTrashBold size={14} /> Clear
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-10">
            <path d="M0 40L1440 40L1440 10C1200 36 960 46 720 32C480 18 240 0 0 10L0 40Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8 pb-16">

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center"
          >
            <div className="w-20 h-20 bg-red-50 text-red-300 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Icon.PiHeartBreakBold size={38} />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Your wishlist is empty</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-7">
              Save items you love by tapping the heart icon on any product. They will appear here.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-7 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
            >
              <Icon.PiStorefrontBold size={16} /> Browse Products
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <p className="text-sm text-gray-500 font-medium">
                {items.length} saved item{items.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Icon.PiSortAscendingBold size={14} className="text-gray-400" />
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortKey)}
                  className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-300 cursor-pointer"
                >
                  {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Grid */}
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {sorted.map((item: any) => {
                  const id          = item._id || item.id;
                  const outOfStock  = item.availability?.status === 'out_of_stock';
                  const price       = getItemPrice(item);
                  const image       = item.thumbImage?.[0] || item.image || item.images?.[0]?.url || item.images?.[0];
                  const isLoading   = loadingId === id;

                  return (
                    <motion.div
                      key={id}
                      layout
                      initial={{ opacity: 0, scale: 0.93 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all overflow-hidden flex flex-col"
                    >
                      {/* Image */}
                      <div
                        className="relative bg-gray-50 overflow-hidden cursor-pointer"
                        style={{ paddingBottom: '130%' }}
                        onClick={() => router.push(`/product/${item.slug}`)}
                      >
                        {image ? (
                          <Image
                            src={image}
                            alt={item.name}
                            fill
                            className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Icon.PiImageBold size={32} className="text-gray-200" />
                          </div>
                        )}

                        {/* Badges */}
                        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                          {outOfStock && (
                            <span className="text-[10px] font-bold bg-gray-800 text-white px-2 py-0.5 rounded-full">
                              Out of Stock
                            </span>
                          )}
                          {!outOfStock && item.onSale && (
                            <span className="text-[10px] font-bold bg-red-700 text-white px-2 py-0.5 rounded-full">
                              Sale
                            </span>
                          )}
                          {item.abv && (
                            <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                              {item.abv}% ABV
                            </span>
                          )}
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); handleAddToCart(item); }}
                              disabled={isLoading || outOfStock}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-gray-900 text-[11px] font-bold rounded-xl hover:bg-red-50 hover:text-red-700 transition-all disabled:opacity-50"
                            >
                              {isLoading
                                ? <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
                                : <><Icon.PiShoppingCartBold size={12} /> Add to Cart</>}
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleRemove(id, item.name); }}
                              className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all flex-shrink-0"
                            >
                              <Icon.PiTrashBold size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3.5 flex flex-col flex-1">
                        {(item.brand?.name || item.category?.name) && (
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                            {item.brand?.name || item.category?.name}
                          </p>
                        )}
                        <h3
                          className="text-sm font-black text-gray-900 leading-snug line-clamp-2 cursor-pointer group-hover:text-red-700 transition-colors flex-1 mb-2"
                          onClick={() => router.push(`/product/${item.slug}`)}
                        >
                          {item.name}
                        </h3>

                        {/* Price */}
                        <div className="flex items-center gap-2">
                          {price > 0 ? (
                            <>
                              <span className="font-black text-gray-900 text-sm">{fmt(price)}</span>
                              {item.priceRange?.max && item.priceRange.max > price && (
                                <span className="text-[11px] text-gray-400 line-through">{fmt(item.priceRange.max)}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-gray-400">Price on request</span>
                          )}
                        </div>

                        {/* Mobile add to cart */}
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={isLoading || outOfStock}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-red-700 hover:text-white hover:border-red-700 transition-all disabled:opacity-40 sm:hidden"
                        >
                          {isLoading
                            ? <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                            : outOfStock
                            ? 'Out of Stock'
                            : <><Icon.PiShoppingCartBold size={12} /> Add to Cart</>}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* Continue shopping */}
            <div className="mt-10 flex items-center justify-between flex-wrap gap-4">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-red-700 transition-colors"
              >
                <Icon.PiArrowLeftBold size={14} /> Continue Shopping
              </Link>
              <Link
                href="/cart"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
              >
                <Icon.PiShoppingCartBold size={15} /> View Cart
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
