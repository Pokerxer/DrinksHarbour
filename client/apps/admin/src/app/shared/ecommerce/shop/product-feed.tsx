// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from 'rizzui';
import { useSession } from 'next-auth/react';
import ProductModernCard from '@core/components/cards/product-modern-card';
import { routes } from '@/config/routes';
import { TENANT_ROLES } from '@/types/authorization';

let countPerPage = 12;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/**
 * Marketplace feed. Shows the central, approved product catalog. Previously
 * this fetched without auth (so it 401'd once the API started protecting
 * routes), used the wrong default API URL, and linked every card to
 * /products/:slug — a route the middleware refuses for tenant roles. Now:
 *  - fetches with the session token,
 *  - links tenants to their own /sub-products/:slug detail page,
 *  - renders loading / empty / error states instead of a bare string.
 */
export default function ProductFeed() {
  const { data: session } = useSession();
  const token = session?.user?.token;

  const [isLoading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [nextPage, setNextPage] = useState(countPerPage);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const role = session?.user?.role ?? '';
  const isTenantUser = TENANT_ROLES.includes(role as any);

  // Tenant roles are blocked from /products by middleware, so their shop cards
  // must deep-link to the sub-product detail page instead.
  const cardRoutes = isTenantUser
    ? {
        ...routes,
        eCommerce: {
          ...routes.eCommerce,
          productDetails: routes.eCommerce.subProductDetails,
        },
      }
    : routes;

  const fetchProducts = useCallback(async () => {
    try {
      setError(null);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(
        `${API_URL}/api/products?limit=50&status=approved`,
        { headers, cache: 'no-store' }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load products');
      }

      if (data.data?.products) {
        // Transform API response to match ProductModernCard format
        const transformedProducts = data.data.products.map((product: any) => ({
          id: product._id,
          title: product.name,
          thumbnail:
            product.primaryImage?.url ||
            product.images?.[0]?.url ||
            '/images/placeholder.png',
          slug: product.slug,
          description: product.shortDescription || '',
          price: product.priceRange?.min || 0,
          sale_price: product.priceRange?.max || null,
          colors: [],
        }));
        setProducts(transformedProducts);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setInitialLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleLoadMore() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setNextPage(nextPage + countPerPage);
    }, 300);
  }

  if (initialLoading) {
    return (
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 @md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] @xl:gap-x-7 @xl:gap-y-9 @4xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] @6xl:grid-cols-[repeat(auto-fill,minmax(364px,1fr))]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/5.06] animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setInitialLoading(true);
            fetchProducts();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-gray-500">
        No approved products yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 @md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] @xl:gap-x-7 @xl:gap-y-9 @4xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] @6xl:grid-cols-[repeat(auto-fill,minmax(364px,1fr))]">
        {products
          ?.slice(0, nextPage)
          ?.map((product, index) => (
            <ProductModernCard
              key={product.id}
              product={product}
              routes={cardRoutes}
            />
          ))}
      </div>

      {nextPage < products?.length && (
        <div className="mb-4 mt-5 flex flex-col items-center xs:pt-6 sm:pt-8">
          <Button isLoading={isLoading} onClick={() => handleLoadMore()}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
