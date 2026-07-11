// @ts-nocheck
'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { Badge, Text, Title, Button, Input } from 'rizzui';
import {
  PiArrowLeftBold,
  PiPencilLineBold,
  PiPackageBold,
  PiMagnifyingGlassBold,
  PiArrowsClockwiseBold,
  PiPlusBold,
  PiStorefrontBold,
  PiSealCheckFill,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandInfo {
  _id: string;
  name: string;
  slug: string;
  brandType?: string;
  primaryCategory?: string;
  status: string;
  logo?: { url: string };
  countryOfOrigin?: string;
  verified?: boolean;
  notes?: string;
  description?: string;
  shortDescription?: string;
  tagline?: string;
  brandColors?: { primary?: string };
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  status: string;
  isPublished: boolean;
  images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  category?: { _id: string; name: string };
  basePrice?: number;
  totalStock?: number;
  totalStockAvailable?: number;
  subProductCount?: number;
  createdAt: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  isPublished,
}: {
  status: string;
  isPublished: boolean;
}) {
  if (status === 'approved' && isPublished)
    return (
      <Badge
        color="success"
        variant="flat"
        className="text-xs font-semibold capitalize"
      >
        Published
      </Badge>
    );
  if (status === 'pending')
    return (
      <Badge
        color="warning"
        variant="flat"
        className="text-xs font-semibold capitalize"
      >
        Pending
      </Badge>
    );
  if (status === 'rejected')
    return (
      <Badge
        color="danger"
        variant="flat"
        className="text-xs font-semibold capitalize"
      >
        Rejected
      </Badge>
    );
  if (status === 'discontinued')
    return (
      <Badge
        color="secondary"
        variant="flat"
        className="text-xs font-semibold capitalize"
      >
        Discontinued
      </Badge>
    );
  return (
    <Badge
      color="secondary"
      variant="flat"
      className="text-xs font-semibold capitalize"
    >
      Draft
    </Badge>
  );
}

// ─── Product Image ─────────────────────────────────────────────────────────────

function ProductImage({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-100 to-gray-200">
        <PiPackageBold className="h-4 w-4 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
      <img
        src={src}
        alt={name}
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-12 animate-pulse rounded bg-gray-100" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-10 animate-pulse rounded bg-gray-100" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
          </td>
          <td className="px-4 py-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrandProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;

  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 30;

  async function fetchData(pageNum = 1) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [brandRes, prodsRes] = await Promise.all([
        fetch(`${API_URL}/api/brands/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `${API_URL}/api/products/admin/list?brand=${id}&page=${pageNum}&limit=${LIMIT}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);

      const brandJson = await brandRes.json();
      if (brandJson.success) setBrand(brandJson.data.brand);

      const prodsJson = await prodsRes.json();
      if (!prodsRes.ok)
        throw new Error(prodsJson.message || `Server error ${prodsRes.status}`);
      const items: Product[] = prodsJson.data?.products || [];
      const pagination = prodsJson.data?.pagination;
      setProducts(items);
      setTotal(pagination?.total ?? items.length);
      setTotalPages(pagination?.totalPages ?? 1);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchData(page);
  }, [token, id, page]);

  // Client-side search + status filter
  useEffect(() => {
    let result = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category?.name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    setFilteredProducts(result);
  }, [products, search, statusFilter]);

  const formatPrice = (price?: number) =>
    price != null ? `₦${price.toLocaleString('en-NG')}` : '—';

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={routes.eCommerce.brands}>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700">
              <PiArrowLeftBold className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              {brand?.logo?.url ? (
                <img
                  src={brand.logo.url}
                  alt={brand.name}
                  className="h-8 w-8 rounded-lg border border-gray-100 bg-gray-50 object-contain p-0.5"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <PiStorefrontBold className="h-4 w-4 text-gray-400" />
                </div>
              )}
              <Title as="h4" className="font-semibold text-gray-900">
                {brand?.name ?? 'Brand'}
              </Title>
              {brand?.verified && (
                <PiSealCheckFill
                  className="h-5 w-5 flex-shrink-0 text-blue-500"
                  title="Verified brand"
                />
              )}
              {brand?.countryOfOrigin && (
                <span className="text-sm text-gray-400">
                  · {brand.countryOfOrigin}
                </span>
              )}
            </div>
            <nav className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
              <Link
                href={routes.eCommerce.dashboard}
                className="hover:text-gray-600"
              >
                E-Commerce
              </Link>
              <span>/</span>
              <Link
                href={routes.eCommerce.brands}
                className="hover:text-gray-600"
              >
                Brands
              </Link>
              <span>/</span>
              <span className="text-gray-600">{brand?.name ?? 'Loading…'}</span>
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={routes.eCommerce.editBrand(id)}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <PiPencilLineBold className="h-4 w-4" />
              Edit Brand
            </Button>
          </Link>
          <Link href={`${routes.eCommerce.createProduct}?brand=${id}`}>
            <Button size="sm" className="gap-1.5">
              <PiPlusBold className="h-4 w-4" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats strip ── */}
      {brand && !loading && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <Text className="text-xs text-gray-400">Total Products</Text>
            <Text className="text-lg font-bold text-gray-900">{total}</Text>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <Text className="text-xs text-gray-400">Approved</Text>
            <Text className="text-lg font-bold text-green-600">
              {products.filter((p) => p.status === 'approved').length}
            </Text>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <Text className="text-xs text-gray-400">Draft / Pending</Text>
            <Text className="text-lg font-bold text-amber-500">
              {
                products.filter(
                  (p) => p.status === 'pending' || p.status === 'draft'
                ).length
              }
            </Text>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <Text className="text-xs text-gray-400">Brand Status</Text>
            <span
              className={cn(
                'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                brand.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : brand.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
              )}
            >
              {brand.status}
            </span>
          </div>
          {brand.brandType && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
              <Text className="text-xs text-gray-400">Type</Text>
              <Text className="text-sm font-semibold capitalize text-gray-700">
                {brand.brandType.replace(/_/g, ' ')}
              </Text>
            </div>
          )}
        </div>
      )}

      {/* ── About ── */}
      {brand && (brand.tagline || brand.shortDescription) && (
        <div
          className={cn(
            'rounded-xl border border-gray-200 bg-white p-5',
            brand.brandColors?.primary && 'border-l-4'
          )}
          style={
            brand.brandColors?.primary
              ? { borderLeftColor: brand.brandColors.primary }
              : undefined
          }
        >
          {brand.tagline && (
            <Text className="mb-1 text-sm font-semibold italic text-gray-800">
              “{brand.tagline}”
            </Text>
          )}
          {brand.shortDescription && (
            <Text className="text-sm text-gray-600">
              {brand.shortDescription}
            </Text>
          )}
        </div>
      )}

      {/* ── Admin Notes ── */}
      {brand?.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <Title as="h6" className="mb-1 font-semibold text-gray-800">
            Admin Notes
          </Title>
          <Text className="mb-3 text-xs text-gray-400">
            Internal notes — not shown to customers.
          </Text>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {brand.notes}
          </p>
        </div>
      )}

      {/* ── Table card ── */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="relative w-64">
            <PiMagnifyingGlassBold className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Published</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="rejected">Rejected</option>
              <option value="discontinued">Discontinued</option>
            </select>
            <button
              onClick={() => fetchData(page)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            >
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Added
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <LoadingRows />
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                        <PiPackageBold className="h-7 w-7 text-red-400" />
                      </div>
                      <Text className="font-medium text-gray-700">{error}</Text>
                      <button
                        onClick={() => fetchData(page)}
                        className="text-sm text-primary hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                        <PiPackageBold className="h-7 w-7 text-gray-400" />
                      </div>
                      <Text className="font-medium text-gray-700">
                        {search || statusFilter !== 'all'
                          ? 'No products match your filters'
                          : 'No products under this brand yet'}
                      </Text>
                      {!search && statusFilter === 'all' && (
                        <Link
                          href={`${routes.eCommerce.createProduct}?brand=${id}`}
                        >
                          <button className="text-sm text-primary hover:underline">
                            Add the first product
                          </button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const imageUrl =
                    product.images?.find((i) => i.isPrimary)?.url ||
                    product.images?.[0]?.url;
                  return (
                    <tr
                      key={product._id}
                      className="group transition-colors hover:bg-gray-50/60"
                    >
                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage src={imageUrl} name={product.name} />
                          <div className="min-w-0">
                            <Link
                              href={routes.eCommerce.productDetails(
                                product._id
                              )}
                            >
                              <Text className="max-w-[200px] truncate font-semibold text-gray-900 transition-colors hover:text-primary">
                                {product.name}
                              </Text>
                            </Link>
                            <Text className="max-w-[200px] truncate text-xs text-gray-400">
                              /{product.slug}
                            </Text>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={product.status}
                          isPublished={product.isPublished}
                        />
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3">
                        <Text className="text-xs text-gray-600">
                          {product.category?.name || (
                            <span className="text-gray-300">—</span>
                          )}
                        </Text>
                      </td>
                      {/* Price */}
                      <td className="px-4 py-3 text-right">
                        <Text className="font-medium tabular-nums text-gray-800">
                          {formatPrice(product.basePrice)}
                        </Text>
                      </td>
                      {/* Stock */}
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const stock =
                            product.totalStockAvailable ?? product.totalStock;
                          return (
                            <span
                              className={cn(
                                'inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                                stock == null
                                  ? 'bg-gray-100 text-gray-400'
                                  : stock === 0
                                    ? 'bg-red-100 text-red-600'
                                    : stock <= 5
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                              )}
                            >
                              {stock != null ? stock : '—'}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Added */}
                      <td className="px-4 py-3">
                        <Text className="whitespace-nowrap text-xs text-gray-400">
                          {formatDate(product.createdAt)}
                        </Text>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <Link href={routes.eCommerce.ediProduct(product._id)}>
                          <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 opacity-0 transition hover:bg-gray-50 hover:text-primary group-hover:opacity-100">
                            <PiPencilLineBold className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <Text className="text-xs text-gray-400">
              Page {page} of {totalPages} · {total} products
            </Text>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
              >
                ‹
              </button>
              {[...Array(totalPages)].map((_, i) => {
                const pg = i + 1;
                if (
                  totalPages > 7 &&
                  Math.abs(pg - page) > 2 &&
                  pg !== 1 &&
                  pg !== totalPages
                ) {
                  if (pg === 2 || pg === totalPages - 1)
                    return (
                      <span key={pg} className="px-1 text-xs text-gray-400">
                        …
                      </span>
                    );
                  return null;
                }
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition',
                      pg === page
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        )}
        {!loading && total > 0 && totalPages === 1 && (
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Text className="text-xs text-gray-400">
              {filteredProducts.length} of {total} products
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
