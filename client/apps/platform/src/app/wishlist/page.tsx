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

const PRIORITY_CFG = {
  high: { label: 'High',  bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    dot: 'bg-red-500' },
  medium: { label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-600',  border: 'border-amber-200',  dot: 'bg-amber-400' },
  low:  { label: 'Low',   bg: 'bg-stone-50',  text: 'text-stone-500',  border: 'border-stone-200',  dot: 'bg-stone-300' },
  gift: { label: 'Gift',  bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', dot: 'bg-purple-400' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveItem(serverItem: any) {
  const p = serverItem.product || {};
  const sp = serverItem.addedFromSubproduct || {};
  const tenant = sp.tenant || {};
  const image = p.images?.[0]?.url || p.images?.[0] || null;
  const price = sp.baseSellingPrice || p.priceRange?.min || 0;
  return {
    productId: p._id || '',
    name: p.name || 'Product',
    slug: p.slug || '',
    image,
    brand: p.brand?.name || '',
    category: p.category?.name || '',
    abv: p.abv,
    price,
    priceMax: p.priceRange?.max || 0,
    vendor: tenant.name || '',
    vendorSlug: tenant.slug || '',
    vendorLogo: tenant.logo || null,
    status: p.status,
    isAlcoholic: p.isAlcoholic,
    addedAt: serverItem.addedAt ? new Date(serverItem.addedAt).getTime() : 0,
    note: serverItem.note || '',
    priority: (serverItem.priority || 'medium') as keyof typeof PRIORITY_CFG,
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast }: { toast: { text: string; type: 'success' | 'remove' } | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -48 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -48 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${
            toast.type === 'remove' ? 'bg-stone-900 text-white' : 'bg-gradient-to-br from-red-700 to-red-900 text-white'
          }`}
        >
          {toast.type === 'remove' ? <Icon.PiTrashBold size={15} /> : <Icon.PiCheckCircleBold size={15} />}
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── WishlistCard ──────────────────────────────────────────────────────────────

function WishlistCard({ item, onRemove, onAddToCart, loading }: {
  item: ReturnType<typeof resolveItem>;
  onRemove: () => void;
  onAddToCart: () => void;
  loading: boolean;
}) {
  const router = useRouter();
  const pcfg = PRIORITY_CFG[item.priority];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="group bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-red-100 transition-all overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div
        className="relative bg-stone-50 overflow-hidden cursor-pointer flex-shrink-0"
        style={{ paddingBottom: '120%' }}
        onClick={() => item.slug && router.push(`/product/${item.slug}`)}
      >
        {item.image ? (
          <Image src={item.image} alt={item.name} fill className="object-contain p-3 group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon.PiWineBold size={36} className="text-stone-200" />
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {item.abv && (
            <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
              {item.abv}% ABV
            </span>
          )}
        </div>

        {/* Priority badge */}
        <div className="absolute top-2.5 right-2.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${pcfg.bg} ${pcfg.text} ${pcfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pcfg.dot}`} />
            {pcfg.label}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            <button
              onClick={e => { e.stopPropagation(); onAddToCart(); }}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-stone-900 text-xs font-bold rounded-xl hover:bg-red-50 hover:text-red-700 transition-all disabled:opacity-50"
            >
              {loading
                ? <span className="w-3 h-3 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
                : <><Icon.PiShoppingCartBold size={12} /> Add to Cart</>}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              className="w-8 h-8 flex items-center justify-center bg-white/90 rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-600 transition-all flex-shrink-0"
            >
              <Icon.PiTrashBold size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col flex-1 gap-1.5">
        {/* Brand / category */}
        {(item.brand || item.category) && (
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
            {item.brand || item.category}
          </p>
        )}

        {/* Name */}
        <h3
          className="text-sm font-black text-stone-900 leading-snug line-clamp-2 cursor-pointer hover:text-red-700 transition-colors"
          onClick={() => item.slug && router.push(`/product/${item.slug}`)}
        >
          {item.name}
        </h3>

        {/* Vendor */}
        {item.vendor && (
          <p className="text-[10px] text-stone-400 flex items-center gap-1">
            <Icon.PiStorefrontBold size={10} className="flex-shrink-0" /> {item.vendor}
          </p>
        )}

        {/* Note */}
        {item.note && (
          <p className="text-[10px] text-stone-500 bg-stone-50 rounded-lg px-2.5 py-1.5 italic line-clamp-2 border border-stone-100">
            "{item.note}"
          </p>
        )}

        {/* Price */}
        <div className="mt-auto pt-1.5 flex items-center justify-between gap-2">
          <div>
            {item.price > 0 ? (
              <span className="font-black text-stone-900 text-sm">{fmt(item.price)}</span>
            ) : (
              <span className="text-xs font-semibold text-stone-400">Price on request</span>
            )}
          </div>
          {/* Mobile add button */}
          <button
            onClick={onAddToCart}
            disabled={loading}
            className="sm:hidden flex items-center gap-1 bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold hover:bg-red-800 transition-all disabled:opacity-50"
          >
            {loading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiShoppingCartBold size={12} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WishlistPage() {
  const { wishlistState, removeFromWishlist, clearWishlist, serverItems, serverLoading, refreshServer } = useWishlist();
  const { addToCart } = useCart();

  const [mounted, setMounted]   = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [toast, setToast]       = useState<{ text: string; type: 'success' | 'remove' } | null>(null);
  const [sort, setSort]         = useState<SortKey>('newest');

  useEffect(() => { setMounted(true); }, []);

  const showToast = (text: string, type: 'success' | 'remove' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Use server items when available (authenticated), fall back to local
  const isAuthenticated = mounted && !!(typeof window !== 'undefined' && (localStorage.getItem('dh_token') || sessionStorage.getItem('dh_token')));
  const resolvedItems = useMemo(() => {
    if (isAuthenticated && serverItems.length >= 0) return serverItems.map(resolveItem);
    return wishlistState.wishlistArray.map(i => resolveItem({
      product: { _id: (i as any)._id || i.id, name: i.name, slug: (i as any).slug, images: (i as any).images, abv: (i as any).abv, brand: (i as any).brand, category: (i as any).category, priceRange: (i as any).priceRange },
      addedAt: i.addedAt,
      note: i.note,
      priority: i.priority || 'medium',
    }));
  }, [isAuthenticated, serverItems, wishlistState.wishlistArray]);

  const sorted = useMemo(() => {
    const arr = [...resolvedItems];
    switch (sort) {
      case 'newest':     return arr.sort((a, b) => b.addedAt - a.addedAt);
      case 'oldest':     return arr.sort((a, b) => a.addedAt - b.addedAt);
      case 'price_asc':  return arr.sort((a, b) => a.price - b.price);
      case 'price_desc': return arr.sort((a, b) => b.price - a.price);
      case 'name':       return arr.sort((a, b) => a.name.localeCompare(b.name));
      default:           return arr;
    }
  }, [resolvedItems, sort]);

  const handleAddToCart = (item: ReturnType<typeof resolveItem>) => {
    setLoadingId(item.productId);
    try {
      addToCart({
        id: item.productId,
        _id: item.productId,
        name: item.name,
        slug: item.slug,
        price: item.price,
        images: item.image ? [{ url: item.image }] : [],
        quantity: 1,
        selectedProductId: item.productId,
        selectedSubProductId: '',
        selectedSizeId: '',
        selectedVendorId: '',
        selectedSize: '',
        selectedVendor: '',
        selectedColor: '',
        cartItemId: `${item.productId}-${Date.now()}`,
      } as any);
      removeFromWishlist(item.productId);
      showToast(`${item.name} added to cart!`);
    } catch {}
    finally { setTimeout(() => setLoadingId(null), 600); }
  };

  const handleAddAllToCart = async () => {
    setAddingAll(true);
    for (const item of resolvedItems) {
      addToCart({
        id: item.productId, _id: item.productId, name: item.name, slug: item.slug,
        price: item.price, images: item.image ? [{ url: item.image }] : [],
        quantity: 1, selectedProductId: item.productId, selectedSubProductId: '',
        selectedSizeId: '', selectedVendorId: '', selectedSize: '', selectedVendor: '',
        selectedColor: '', cartItemId: `${item.productId}-${Date.now()}`,
      } as any);
      removeFromWishlist(item.productId);
    }
    setAddingAll(false);
    showToast(`${resolvedItems.length} item${resolvedItems.length !== 1 ? 's' : ''} added to cart!`);
  };

  const handleRemove = (item: ReturnType<typeof resolveItem>) => {
    removeFromWishlist(item.productId);
    showToast(`${item.name} removed`, 'remove');
  };

  const handleClear = () => {
    clearWishlist();
    setShowClear(false);
    showToast('Wishlist cleared', 'remove');
  };

  const loading = serverLoading && isAuthenticated;
  const count = resolvedItems.length;

  if (!mounted) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <Toast toast={toast} />

      {/* Clear confirm modal */}
      <AnimatePresence>
        {showClear && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={() => setShowClear(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full"
            >
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon.PiTrashBold size={26} />
              </div>
              <h3 className="text-lg font-black text-stone-900 text-center">Clear wishlist?</h3>
              <p className="text-sm text-stone-500 text-center mt-1.5 mb-5">
                All {count} saved item{count !== 1 ? 's' : ''} will be removed. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowClear(false)}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-all">
                  Cancel
                </button>
                <button onClick={handleClear}
                  className="flex-1 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-xl text-sm font-bold hover:from-red-800 hover:to-red-950 transition-all">
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-stone-900 via-red-950 to-stone-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 28px)' }} />
        </div>
        <div className="container mx-auto max-w-6xl px-4 py-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Icon.PiHeartBold size={16} className="text-red-400" />
                <span className="text-xs font-bold text-red-300 uppercase tracking-widest">Saved Items</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">My Wishlist</h1>
              {count > 0 && (
                <p className="text-red-200 text-sm mt-1.5 flex items-center gap-2">
                  <span>{count} item{count !== 1 ? 's' : ''} saved</span>
                  {loading && <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-300 rounded-full animate-spin inline-block" />}
                </p>
              )}
            </div>
            {count > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleAddAllToCart}
                  disabled={addingAll}
                  className="flex items-center gap-2 bg-white text-red-800 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-all disabled:opacity-60 shadow"
                >
                  {addingAll
                    ? <span className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-700 rounded-full animate-spin" />
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
          <svg viewBox="0 0 1440 36" fill="none" className="w-full h-9">
            <path d="M0 36L1440 36L1440 8C1200 32 960 42 720 28C480 14 240 -2 0 8L0 36Z" fill="rgb(250 250 249)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8 pb-20">

        {/* Loading skeleton */}
        {loading && count === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-100 overflow-hidden animate-pulse">
                <div className="bg-stone-100" style={{ paddingBottom: '120%' }} />
                <div className="p-3.5 space-y-2">
                  <div className="h-3 bg-stone-100 rounded-full w-1/3" />
                  <div className="h-4 bg-stone-100 rounded-full w-4/5" />
                  <div className="h-4 bg-stone-100 rounded-full w-2/3" />
                  <div className="h-5 bg-stone-100 rounded-full w-1/2 mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && count === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-stone-100 shadow-sm p-16 text-center"
          >
            <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Icon.PiHeartBreakBold size={38} className="text-red-200" />
            </div>
            <h2 className="text-xl font-black text-stone-900 mb-2">Your wishlist is empty</h2>
            <p className="text-sm text-stone-500 max-w-xs mx-auto mb-7">
              Save items you love by tapping the ♡ on any product — they'll appear here.
            </p>
            <Link href="/shop"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-7 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md">
              <Icon.PiStorefrontBold size={16} /> Browse Products
            </Link>
          </motion.div>
        )}

        {/* Items */}
        {count > 0 && !loading && (
          <>
            {/* Sort + count bar */}
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <p className="text-sm text-stone-500 font-medium">{count} saved item{count !== 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2">
                <Icon.PiSortAscendingBold size={14} className="text-stone-400" />
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                  className="text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-300 cursor-pointer">
                  {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {sorted.map(item => (
                  <WishlistCard
                    key={item.productId}
                    item={item}
                    onRemove={() => handleRemove(item)}
                    onAddToCart={() => handleAddToCart(item)}
                    loading={loadingId === item.productId}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Footer actions */}
            <div className="mt-10 flex items-center justify-between flex-wrap gap-4">
              <Link href="/shop"
                className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-red-700 transition-colors">
                <Icon.PiArrowLeftBold size={14} /> Continue Shopping
              </Link>
              <Link href="/cart"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md">
                <Icon.PiShoppingCartBold size={15} /> View Cart
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
