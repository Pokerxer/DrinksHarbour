'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
interface StoreProduct {
  _id: string;
  name: string;
  slug: string;
  primaryImage?: { url: string; alt?: string } | null;
  minWebsitePrice: number;
  maxWebsitePrice: number;
  originalMinPrice: number | null;
  isOnSale: boolean;
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

export default function VendorStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Store Banner ──────────────────────────────────────────────── */}
      <div className={`relative h-44 sm:h-56 bg-gradient-to-br ${gradient} overflow-hidden`}>
        {store.logo?.url && (
          <Image src={store.logo.url} alt={store.logo.alt ?? store.name} fill className="object-cover opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* breadcrumb */}
        <div className="absolute top-4 left-4">
          <Link href="/vendors" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-xs transition-colors">
            <Icon.PiArrowLeft size={14} /> All Vendors
          </Link>
        </div>
      </div>

      {/* ── Store Profile ─────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="relative -mt-12 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden`}>
              {store.logo?.url ? (
                <Image src={store.logo.url} alt={store.name} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-white">{initials(store.name)}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-gray-900">{store.name}</h1>
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  <Icon.PiShieldCheck size={11} /> Verified
                </span>
              </div>
              {location && (
                <p className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <Icon.PiMapPin size={12} /> {location}
                </p>
              )}
              {store.description && (
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{store.description}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex sm:flex-col items-center gap-4 sm:gap-2 flex-shrink-0 sm:text-right">
              <div>
                <p className="text-xl font-black text-gray-900">{store.productCount ?? 0}</p>
                <p className="text-xs text-gray-400">Products</p>
              </div>
              <Link
                href={`/shop?tenant=${store._id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-red-700 to-red-900 text-white text-sm font-semibold rounded-xl hover:from-red-800 hover:to-red-950 transition-all shadow-sm"
              >
                <Icon.PiShoppingBag size={15} /> Shop All
              </Link>
            </div>
          </div>
        </div>

        {/* ── Products Preview ───────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Icon.PiPackage size={18} className="text-red-700" />
              Products from {store.name}
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
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Icon.PiPackage size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No products listed yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map(product => (
                <Link
                  key={product._id}
                  href={`/product/${product.slug}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all overflow-hidden group"
                >
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    {product.primaryImage?.url ? (
                      <Image
                        src={product.primaryImage.url}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={32} className="text-gray-300" />
                      </div>
                    )}
                    {product.isOnSale && (
                      <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">SALE</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-red-700 transition-colors">{product.name}</p>
                    {product.minWebsitePrice > 0 && (
                      <div className="mt-1">
                        <p className="text-sm font-bold text-gray-900">
                          {product.maxWebsitePrice && product.maxWebsitePrice !== product.minWebsitePrice
                            ? `₦${product.minWebsitePrice.toLocaleString()} – ₦${product.maxWebsitePrice.toLocaleString()}`
                            : `₦${product.minWebsitePrice.toLocaleString()}`
                          }
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
