'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import * as Icon from 'react-icons/pi';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  tagline?: string;
  featuredImage?: {
    url: string;
    alt?: string;
  };
  bannerImage?: {
    url: string;
    alt?: string;
  };
  thumbnailImage?: {
    url: string;
    alt?: string;
  };
  color?: string;
  icon?: string;
  productCount: number;
}

const fallbackCategories: Category[] = [
  {
    _id: '1',
    name: 'Whiskey',
    slug: 'whiskey',
    description: 'Single Malt & Blended',
    featuredImage: { url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&h=800&fit=crop', alt: 'Whiskey' },
    color: '#92400e',
    productCount: 124,
  },
  {
    _id: '2',
    name: 'Vodka',
    slug: 'vodka',
    description: 'Premium & Classic',
    featuredImage: { url: 'https://images.unsplash.com/photo-1572575626618-6a0b5d6fb858?w=600&h=800&fit=crop', alt: 'Vodka' },
    color: '#0ea5e9',
    productCount: 89,
  },
  {
    _id: '3',
    name: 'Champagne',
    slug: 'champagne',
    description: 'Sparkling & Brut',
    featuredImage: { url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=800&fit=crop', alt: 'Champagne' },
    color: '#facc15',
    productCount: 67,
  },
  {
    _id: '4',
    name: 'Beer',
    slug: 'beer',
    description: 'Craft & Premium',
    featuredImage: { url: 'https://images.unsplash.com/photo-1608879493122-e3876d490a0c?w=600&h=800&fit=crop', alt: 'Beer' },
    color: '#f97316',
    productCount: 156,
  },
  {
    _id: '5',
    name: 'Wine',
    slug: 'wine',
    description: 'Red, White & Rose',
    featuredImage: { url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=600&h=800&fit=crop', alt: 'Wine' },
    color: '#b91c1c',
    productCount: 203,
  },
  {
    _id: '6',
    name: 'Gin',
    slug: 'gin',
    description: 'London Dry & Premium',
    featuredImage: { url: 'https://images.unsplash.com/photo-1605218457336-98db6b9b7601?w=600&h=800&fit=crop', alt: 'Gin' },
    color: '#10b981',
    productCount: 45,
  },
  {
    _id: '7',
    name: 'Rum',
    slug: 'rum',
    description: 'Aged & Spiced',
    featuredImage: { url: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=600&h=800&fit=crop', alt: 'Rum' },
    color: '#d97706',
    productCount: 78,
  },
  {
    _id: '8',
    name: 'Brandy & Cognac',
    slug: 'brandy',
    description: 'Fine & VSOP',
    featuredImage: { url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=600&h=800&fit=crop', alt: 'Brandy' },
    color: '#c2410c',
    productCount: 52,
  },
];

const categoryColorMap: Record<string, string> = {
  whiskey: '#92400e',
  'whiskey ': '#92400e',
  vodka: '#0ea5e9',
  champagne: '#facc15',
  beer: '#f97316',
  wine: '#b91c1c',
  gin: '#10b981',
  rum: '#d97706',
  brandy: '#c2410c',
  'brandy ': '#c2410c',
  tequila: '#ca8a04',
  liqueur: '#a855f7',
  'red-wine': '#7f1d1d',
  'white-wine': '#fef08a',
  'rose-wine': '#f472b6',
  'sparkling-wine': '#fde047',
  scotch: '#78350f',
  bourbon: '#92400e',
  coffee: '#78350f',
  tea: '#65a30d',
  juice: '#f97316',
  water: '#0ea5e9',
  'soft-drinks': '#ef4444',
  default: '#6b7280',
};

const getGradientStyle = (color: string | undefined, slug: string): string => {
  if (color && color.startsWith('#')) {
    const darkerColor = adjustBrightness(color, -30);
    const lighterColor = adjustBrightness(color, 20);
    return `from-[${lighterColor}] to-[${darkerColor}]`;
  }
  const mapColor = categoryColorMap[slug] || categoryColorMap.default;
  const darkerColor = adjustBrightness(mapColor, -30);
  const lighterColor = adjustBrightness(mapColor, 20);
  return `from-[${lighterColor}] to-[${darkerColor}]`;
};

const adjustBrightness = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
};

const CollectionCard = ({ category }: { category: Category }) => {
  const gradientClass = getGradientStyle(category.color, category.slug);
  
  const displayImage = category.featuredImage?.url || category.bannerImage?.url || `https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&h=800&fit=crop`;

  const [imgError, setImgError] = useState(false);

  return (
    <Link 
      href={`/shop?type=${category.slug}`}
      className="group block"
    >
      <div className="relative rounded-3xl overflow-hidden cursor-pointer">
        <div className="relative aspect-[3/4] overflow-hidden">
          <Image
            src={imgError ? '/images/placeholder-product.png' : displayImage}
            alt={category.featuredImage?.alt || category.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 640px) 50vw, 25vw"
            onError={() => setImgError(true)}
          />
          
          <div className={`absolute inset-0 bg-gradient-to-t ${gradientClass} opacity-50 group-hover:opacity-40 transition-opacity duration-500`} />
          
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
            <div className="transform transition-transform duration-500 group-hover:-translate-y-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                <Icon.PiWineFill size={20} className="text-white" />
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                {category.name}
              </h3>
              
              {category.description && (
                <p className="text-white/75 text-xs sm:text-sm mb-2">
                  {category.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <Icon.PiPackage size={14} />
                <span>{category.productCount || 0} products</span>
              </div>
              
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                <span className="text-white font-medium text-sm">Shop Now</span>
                <Icon.PiArrowRight size={14} className="text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

const Collection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiper, setSwiper] = useState<SwiperType | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await fetch(`${API_URL}/api/categories`);
        const data = await response.json();

        if (data.success && data.data?.categories?.length > 0) {
          const parentSlugs = ['whiskey', 'vodka', 'champagne', 'beer', 'wine', 'gin', 'rum', 'brandy', 'tequila', 'liqueur', 'red-wine', 'white-wine', 'rose-wine', 'sparkling-wine', 'scotch', 'bourbon', 'coffee', 'tea', 'juice', 'water', 'soft-drinks'];
          const parentCategories = data.data.categories.filter(
            (cat: any) => parentSlugs.includes(cat.slug)
          );
          setCategories(parentCategories);
        } else {
          setCategories(fallbackCategories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories(fallbackCategories);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const goNext = () => {
    if (swiper) swiper.slideNext();
  };

  const goPrev = () => {
    if (swiper) swiper.slidePrev();
  };

  if (loading) {
    return (
      <div className="collection-block py-16 sm:py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 mb-3">
              <Icon.PiSparkleFill size={12} className="text-amber-500" />
              Curated Selection
            </div>
            <div className="h-10 bg-gray-200 rounded w-48 mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-gray-200 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-block py-16 sm:py-20 bg-white">
      <div className="container mx-auto px-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 mb-3">
              <Icon.PiSparkleFill size={12} className="text-amber-500" />
              Curated Selection
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Explore Collections
            </h2>
            <p className="text-gray-500 mt-2">
              Discover our premium selection of fine beverages
            </p>
          </div>
          
          <div className="flex items-center gap-3 justify-center sm:justify-end">
            <button
              onClick={goPrev}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all duration-300"
            >
              <Icon.PiArrowLeft size={18} />
            </button>
            <button
              onClick={goNext}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all duration-300"
            >
              <Icon.PiArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Categories Grid */}
        {categories.length > 0 ? (
          <>
            <div className="hidden lg:block">
              <Swiper
                modules={[Autoplay, Navigation]}
                onSwiper={setSwiper}
                slidesPerView={4}
                spaceBetween={24}
                loop={categories.length > 4}
                className="h-full"
              >
                {categories.map((category) => (
                  <SwiperSlide key={category._id}>
                    <CollectionCard category={category} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>

            <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {categories.slice(0, 8).map((category) => (
                <CollectionCard key={category._id} category={category} />
              ))}
            </div>

            {/* View All CTA */}
            <div className="text-center mt-12">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                View All Collections
                <Icon.PiArrowRight size={20} />
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Icon.PiPackage size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No categories found</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Collection;
