'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/loader/Skeleton';
import * as Icon from 'react-icons/pi';

interface RecommendedForYouProps {
  maxItems?: number;
}

const RecommendedForYou: React.FC<RecommendedForYouProps> = ({ maxItems = 12 }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(!!data.user);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      
      // Try hitting the personalized backend route via our Next.js API proxy
      const response = await fetch(`/api/user/recommendations?limit=${maxItems}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          setProducts(data.data);
          return;
        }
      }
      
      // Fallback: If not logged in or no recommendations, fetch bestsellers or trending
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const fallbackUrl = `${API_URL}/api/products/trending?limit=${maxItems}`;
      
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (data.success) {
          setProducts(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [maxItems, isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  if (loading) {
    return (
      <div className="py-8 bg-gray-50/50 border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Recommended For You</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            <ProductCardSkeleton count={6} layout="grid" />
          </div>
        </div>
      </div>
    );
  }

  if (!products.length) return null;

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
