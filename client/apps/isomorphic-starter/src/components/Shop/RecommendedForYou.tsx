'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/loader/Skeleton';
import * as Icon from 'react-icons/pi';

interface RecommendedForYouProps {
  maxItems?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const RecommendedForYou: React.FC<RecommendedForYouProps> = ({ maxItems = 12 }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const normalizeProducts = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data?.products && Array.isArray(data.products)) return data.products;
    if (data?.data?.products && Array.isArray(data.data.products)) return data.data.products;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const fetchRecommendations = useCallback(async (auth: boolean) => {
    try {
      setLoading(true);
      setHasError(false);

      // Step 1: Try personalized endpoint if user is authenticated
      if (auth) {
        try {
          const response = await fetchWithTimeout(`/api/user/recommendations?limit=${maxItems}`);
          if (response.ok) {
            const data = await response.json();
            const prods = normalizeProducts(data);
            if (data.success && prods.length > 0) {
              setProducts(prods);
              return;
            }
          }
        } catch (e) {
          console.log('Personalized endpoint failed, trying fallbacks...');
        }
      }
      
      // Step 2: Fallback to trending products from backend
      try {
        const response = await fetchWithTimeout(`/api/products/trending?limit=${maxItems}`);
        if (response.ok) {
          const data = await response.json();
          const prods = normalizeProducts(data);
          if (data.success && prods.length > 0) {
            setProducts(prods);
            return;
          }
        }
      } catch (e) {
        console.log('Trending endpoint failed, trying more fallbacks...');
      }

      // Step 3: Fallback to bestsellers
      try {
        const response = await fetchWithTimeout(`/api/products/bestsellers?limit=${maxItems}`);
        if (response.ok) {
          const data = await response.json();
          const prods = normalizeProducts(data);
          if (data.success && prods.length > 0) {
            setProducts(prods);
            return;
          }
        }
      } catch (e) {
        console.log('Bestsellers endpoint failed, trying more fallbacks...');
      }

      // Step 4: Fallback to new arrivals
      try {
        const response = await fetchWithTimeout(`/api/products/new-arrivals?limit=${maxItems}`);
        if (response.ok) {
          const data = await response.json();
          const prods = normalizeProducts(data);
          if (data.success && prods.length > 0) {
            setProducts(prods);
            return;
          }
        }
      } catch (e) {
        console.log('New arrivals endpoint failed...');
      }

      setHasError(true);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  // Single effect that handles auth check + fetching in sequence
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
    console.log("DEBUG init called");
      try {
        console.log("DEBUG: checking auth...");
        const response = await fetch('/api/auth/me');
        const isAuth = response.ok && (await response.json()).user;
        if (cancelled) return;
        setIsAuthenticated(!!isAuth);
        setAuthChecked(true);
        await fetchRecommendations(!!isAuth);
      } catch {
        if (cancelled) return;
        setIsAuthenticated(false);
        setAuthChecked(true);
        await fetchRecommendations(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [fetchRecommendations]);

  if (loading || !authChecked) {
    return (
      <div className="py-8 bg-gray-50/50 border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
              <Icon.PiStarFill className="text-xl" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Recommended For You</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            <ProductCardSkeleton count={6} layout="grid" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError || !products.length) {
    return null;
  }

  return (
    <div className="py-8 bg-gray-50/50 border-t border-gray-100 mt-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
              <Icon.PiStarFill className="text-xl" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Recommended For You</h2>
          </div>
          <p className="text-sm text-gray-500">Based on your recent activity</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {products.map((product) => (
            <ProductCard key={product._id} data={product} type="grid" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecommendedForYou;
