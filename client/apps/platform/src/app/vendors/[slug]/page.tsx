'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreProduct {
  _id: string;
  name: string;
  slug: string;
  primaryImage?: { url: string; alt?: string } | null;
  minWebsitePrice: number;
  maxWebsitePrice: number;
  originalMinPrice: number | null;
  isOnSale: boolean;
  abv?: number | null;
  originCountry?: string | null;
  sizes?: string[];
}

interface Store {
  _id: string;
  name: string;
  slug: string;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  city?: string;
  state?: string;
  plan?: string;
  productCount?: number;
  description?: string;
  address?: { street?: string; city?: string; state?: string };
  email?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_BADGES: Record<string, { label: string; cls: string }> = {
  enterprise: { label: 'Enterprise', cls: 'bg-purple-100 text-purple-700' },
  pro:        { label: 'Pro',        cls: 'bg-blue-100 text-blue-700' },
  starter:    { label: 'Starter',    cls: 'bg-green-100 text-green-700' },
  free_trial: { label: 'Trial',      cls: 'bg-gray-100 text-gray-600' },
  custom:     { label: 'Custom',     cls: 'bg-amber-100 text-amber-700' },
};

function nameToGradient(name: string): string {
  const gradients = [
    'from-red-700 to-red-900',
    'from-purple-600 to-purple-900',
    'from-blue-600 to-blue-900',
    'from-emerald-600 to-emerald-900',
    'from-amber-600 to-amber-800',
    'from-rose-600 to-rose-900',
    'from-indigo-600 to-indigo-900',
    'from-teal-600 to-teal-900',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function discountPct(product: StoreProduct): number | null {
  if (!product.originalMinPrice || product.originalMinPrice <= product.minWebsitePrice) return null;
  return Math.round((1 - product.minWebsitePrice / product.originalMinPrice) * 100);
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: StoreProduct }) {
  const pct = discountPct(product);
  return (
    <Link
      href={`/product/${product.slug}`}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all overflow-hidden group flex flex-col"
    >
      <div className="relative aspect-square bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden flex items-center justify-center">
        {product.primaryImage?.url ? (
          <Image
            src={product.primaryImage.url}
            alt={product.name}
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-300 p-2"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <Icon.PiImage size={32} className="text-gray-300" />
        )}
        {pct !== null && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{pct}%
          </span>
        )}
        {product.isOnSale && pct === null && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            SALE
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-red-700 transition-colors flex-1 mb-2">
          {product.name}
        </p>

        {/* Meta: ABV + origin */}
        <div className="flex flex-wrap gap-1 mb-2">
          {product.abv != null && (
            <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded">
              {product.abv}% ABV
            </span>
          )}
          {product.originCountry && (
            <span className="text-[10px] bg-blue-50 text-blue-600 font-medium px-1.5 py-0.5 rounded">
              {product.originCountry}
            </span>
          )}
        </div>

        {/* Sizes */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {product.sizes.slice(0, 3).map(s => (
              <span key={s} className="text-[10px] border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                {s}
              </span>
            ))}
            {product.sizes.length > 3 && (
              <span className="text-[10px] text-gray-400">+{product.sizes.length - 3}</span>
            )}
          </div>
        )}

        {product.minWebsitePrice > 0 && (
          <div className="mt-auto">
            <p className="text-sm font-bold text-gray-900">
              {product.maxWebsitePrice && product.maxWebsitePrice !== product.minWebsitePrice
                ? `₦${product.minWebsitePrice.toLocaleString()} – ₦${product.maxWebsitePrice.toLocaleString()}`
                : `₦${product.minWebsitePrice.toLocaleString()}`}
            </p>
            {product.originalMinPrice && product.originalMinPrice > product.minWebsitePrice && (
              <p className="text-[11px] text-gray-400 line-through">
                ₦{product.originalMinPrice.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${API_URL}/api/stores/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.message || 'Store not found');
        setStore(d.data.store);
        setProducts(d.data.products || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 animate-pulse">
        <div className="h-52 bg-gray-300" />
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="relative -mt-12 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-48" />
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !store) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Icon.PiStorefront size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Store not found</h2>
          <p className="text-gray-500 text-sm mb-4">{error || 'This store may no longer be active.'}</p>
          <Link href="/vendors" className="text-sm text-red-700 underline">← Back to vendors</Link>
        </div>
      </div>
    );
  }

  const gradient = nameToGradient(store.name);
  const location = [store.city, store.state].filter(Boolean).join(', ');
  const planBadge = PLAN_BADGES[store.plan ?? ''];
  const onSaleCount = products.filter(p => p.isOnSale).length;
  const fullAddress = [
    store.address?.street,
    store.address?.city,
    store.address?.state,
  ].filter(Boolean).join(', ');
  const descLong = (store.description?.length ?? 0) > 180;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Banner ──────────────────────────────────────────────────────── */}
      <div className={`relative h-48 sm:h-60 bg-gradient-to-br ${gradient} overflow-hidden`}>
        {store.logo?.url && (
          <Image src={store.logo.url} alt={store.logo.alt ?? store.name} fill className="object-cover opacity-20" />
        )}
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Breadcrumb */}
        <div className="absolute top-4 left-4">
          <Link href="/vendors" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium transition-colors bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Icon.PiArrowLeft size={12} /> All Vendors
          </Link>
        </div>

        {/* Store name on banner */}
        <div className="absolute bottom-5 left-0 right-0 px-5">
          <h1 className="text-white font-black text-2xl sm:text-3xl drop-shadow-lg">{store.name}</h1>
          {location && (
            <p className="text-white/70 text-xs mt-1 flex items-center gap-1">
              <Icon.PiMapPin size={11} /> {location}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        {/* ── Profile Card ────────────────────────────────────────────── */}
        <div className="relative -mt-6 mb-6 z-10">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-5">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden border-4 border-white`}>
                {store.logo?.url ? (
                  <Image src={store.logo.url} alt={store.name} width={80} height={80} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-2xl font-black text-white">{initials(store.name)}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <Icon.PiShieldCheck size={11} /> Verified
                  </span>
                  {planBadge && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadge.cls}`}>
                      {planBadge.label}
                    </span>
                  )}
                  {onSaleCount > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      <Icon.PiTag size={11} /> {onSaleCount} on sale
                    </span>
                  )}
                </div>

                {store.description && (
                  <div>
                    <p className={`text-sm text-gray-600 leading-relaxed ${!descExpanded && descLong ? 'line-clamp-2' : ''}`}>
                      {store.description}
                    </p>
                    {descLong && (
                      <button
                        onClick={() => setDescExpanded(v => !v)}
                        className="text-xs text-red-700 font-medium mt-1 hover:underline"
                      >
                        {descExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}

                {/* Contact / location details */}
                {(fullAddress || store.email) && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {fullAddress && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Icon.PiMapPin size={13} className="text-gray-400 flex-shrink-0" />
                        {fullAddress}
                      </span>
                    )}
                    {store.email && (
                      <a
                        href={`mailto:${store.email}`}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-700 transition-colors"
                      >
                        <Icon.PiEnvelope size={13} className="text-gray-400 flex-shrink-0" />
                        {store.email}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Stats + CTA */}
              <div className="flex sm:flex-col items-center gap-4 sm:gap-3 flex-shrink-0 sm:text-right w-full sm:w-auto">
                <div className="flex sm:flex-col gap-4 sm:gap-1 flex-1 sm:flex-none">
                  <div className="text-center sm:text-right">
                    <p className="text-2xl font-black text-gray-900">{store.productCount ?? 0}</p>
                    <p className="text-xs text-gray-400">Products</p>
                  </div>
                  {onSaleCount > 0 && (
                    <div className="text-center sm:text-right">
                      <p className="text-2xl font-black text-red-600">{onSaleCount}</p>
                      <p className="text-xs text-gray-400">On sale</p>
                    </div>
                  )}
                </div>
                <Link
                  href={`/shop?tenant=${store._id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white text-sm font-semibold rounded-xl hover:from-red-800 hover:to-red-950 transition-all shadow-sm whitespace-nowrap"
                >
                  <Icon.PiShoppingBag size={15} /> Shop All Products
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Products ──────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Icon.PiPackage size={18} className="text-red-700" />
              Products
              {products.length > 0 && (
                <span className="text-xs font-normal text-gray-400">
                  (showing {products.length}{store.productCount && store.productCount > products.length ? ` of ${store.productCount}` : ''})
                </span>
              )}
            </h2>
            {products.length > 0 && (
              <Link
                href={`/shop?tenant=${store._id}`}
                className="text-xs text-red-700 font-semibold hover:underline flex items-center gap-1"
              >
                View all <Icon.PiArrowRight size={13} />
              </Link>
            )}
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Icon.PiPackage size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No products listed yet.</p>
              <p className="text-gray-300 text-xs mt-1">Check back soon!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {products.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {store.productCount && store.productCount > products.length && (
                <div className="mt-6 text-center">
                  <Link
                    href={`/shop?tenant=${store._id}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:border-red-200 hover:text-red-700 text-gray-700 font-semibold text-sm rounded-xl transition-colors shadow-sm"
                  >
                    <Icon.PiShoppingBag size={16} />
                    View all {store.productCount.toLocaleString()} products
                    <Icon.PiArrowRight size={14} />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
