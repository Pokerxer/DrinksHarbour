// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Button } from 'rizzui';
import ProductModernCard from '@core/components/cards/product-modern-card';
import { routes } from '@/config/routes';

let countPerPage = 12;

export default function ProductFeed() {
  const [isLoading, setLoading] = useState(false);
  const [nextPage, setNextPage] = useState(countPerPage);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${API_URL}/api/products?limit=50&status=approved`);
        const data = await response.json();
        
        if (data.success && data.data?.products) {
          // Transform API response to match ProductModernCard format
          const transformedProducts = data.data.products.map((product: any) => ({
            id: product._id,
            title: product.name,
            thumbnail: product.primaryImage?.url || product.images?.[0]?.url || '/images/placeholder.png',
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
        setError('Failed to load products');
      }
    };

    fetchProducts();
  }, []);

  function handleLoadMore() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setNextPage(nextPage + countPerPage);
    }, 600);
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">{error}</div>;
  }

  if (products.length === 0) {
    return <div className="text-center py-10 text-gray-500">Loading products...</div>;
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
              routes={routes}
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