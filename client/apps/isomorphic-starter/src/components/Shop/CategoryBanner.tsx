'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface CategoryBannerProps {
  categorySlug?: string;
  subcategorySlug?: string;
  categoryName?: string;
  subcategoryName?: string;
}

interface CategoryDetails {
  _id: string;
  name: string;
  slug: string;
  type: string;
  displayName?: string;
  shortDescription?: string;
  description?: string;
  tagline?: string;
  icon?: string;
  color?: string;
  bannerImage?: {
    url: string;
    alt?: string;
  };
  featuredImage?: {
    url?: string;
    isActive?: boolean;
  };
  images?: Array<{
    url: string;
    alt?: string;
    isPrimary?: boolean;
  }>;
  contentSections?: Array<{
    title: string;
    content: string;
    image?: string;
    type: string;
  }>;
  subcategories?: Array<{
    _id: string;
    name: string;
    slug: string;
    icon?: string;
    color?: string;
    tagline?: string;
    description?: string;
  }>;
  stats?: {
    productCount?: number;
    activeProductCount?: number;
    viewCount?: number;
  };
  parentCategory?: {
    _id: string;
    name: string;
    slug: string;
  };
}

const CategoryBanner: React.FC<CategoryBannerProps> = ({
  categorySlug,
  subcategorySlug,
  categoryName,
  subcategoryName
}) => {
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchCategoryDetails = async () => {
      setLoading(true);
      setCategoryDetails(null);
      
      if (!categorySlug && !subcategorySlug && !categoryName && !subcategoryName) {
        setLoading(false);
        return;
      }

      try {
        const slug = subcategorySlug || categorySlug;
        
        if (slug) {
          const response = await fetch(`http://localhost:5001/api/products/categories/slug/${slug}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setCategoryDetails(data.data);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching category details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryDetails();
  }, [categorySlug, subcategorySlug]);

  const getCategoryColor = (color?: string) => {
    const colors: Record<string, string> = {
      beer: '#F59E0B',
      wine: '#7C3AED',
      spirits: '#DC2626',
      whisky: '#92400E',
      vodka: '#3B82F6',
      gin: '#10B981',
      rum: '#F97316',
      brandy: '#8B5CF6',
      cognac: '#F59E0B',
      tequila: '#84CC16',
      cocktails: '#EC4899',
      mixers: '#06B6D4',
      non-alcoholic: '#22C55E',
    };
    
    if (color) return color;
    const slug = (categorySlug || subcategorySlug || '').toLowerCase();
    return colors[slug] || '#6366F1';
  };

  if (loading) {
    return (
      <div className="w-full py-6 md:py-10">
        <div className="container mx-auto px-4">
          <div className="banner-item relative rounded-xl overflow-hidden h-[180px] md:h-[260px] animate-pulse bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (!categoryDetails) {
    const displayName = categorySlug || subcategorySlug 
      ? (categorySlug || subcategorySlug || '').charAt(0).toUpperCase() + (categorySlug || subcategorySlug || '').slice(1).replace(/-/g, ' ')
      : 'All Products';

    const categoryColor = getCategoryColor(undefined);
    const bgGradient = `linear-gradient(135deg, ${categoryColor}15 0%, ${categoryColor}05 100%)`;
    const borderColor = `${categoryColor}30`;

    return (
      <div className="w-full py-6 md:py-10">
        <div className="container mx-auto px-4">
          <div 
            className="banner-item relative rounded-xl overflow-hidden h-[180px] md:h-[260px] flex items-center"
            style={{ background: bgGradient, border: `1px solid ${borderColor}` }}
          >
            <div className="absolute inset-0 opacity-5" style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
            
            <div className="relative z-10 pl-6 md:pl-12">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs md:text-sm uppercase tracking-wider text-gray-500">Category</span>
              </div>
              <h1 className="text-gray-900 text-2xl md:text-4xl font-bold mb-2">{displayName}</h1>
              <p className="text-gray-500 text-sm md:text-base">Browse our complete collection</p>
            </div>

            <div className="absolute right-6 md:right-12">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
                <svg className="w-7 h-7 md:w-10 md:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    name,
    tagline,
    shortDescription,
    icon,
    color,
    bannerImage,
    featuredImage,
    subcategories,
    stats
  } = categoryDetails;

  const categoryColor = getCategoryColor(color);
  const bgGradient = `linear-gradient(135deg, ${categoryColor}20 0%, ${categoryColor}08 100%)`;
  const borderColor = `${categoryColor}30`;
  const textColor = categoryColor;

  const primaryImage = featuredImage?.url || bannerImage?.url || null;
  const productCount = stats?.activeProductCount || stats?.productCount || 0;

  return (
    <>
      <div className="w-full py-6 md:py-10">
        <div className="container mx-auto px-4">
          <div 
            className="banner-item relative rounded-xl overflow-hidden h-[200px] md:h-[300px] flex items-center"
            style={{ background: bgGradient, border: `1px solid ${borderColor}` }}
          >
            {primaryImage ? (
              <>
                <Image
                  src={primaryImage}
                  alt={name}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-gray-900/50 to-transparent"></div>
              </>
            ) : (
              <div className="absolute inset-0 opacity-3" style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
            )}
            
            <div className="relative z-10 pl-6 md:pl-12 max-w-[55%]">
              <div className="flex items-center gap-2 mb-3">
                {icon && (
                  <span className="text-xl md:text-3xl">{icon}</span>
                )}
                <span 
                  className="text-xs md:text-sm uppercase tracking-wider font-medium"
                  style={{ color: textColor }}
                >
                  {name}
                </span>
              </div>
              
              <h1 className="text-white text-2xl md:text-5xl font-bold mb-3 leading-tight">
                {tagline || `Explore ${name}`}
              </h1>
              
              {shortDescription && (
                <p className="text-white/80 text-sm md:text-base mb-4 line-clamp-2 max-w-xl">
                  {shortDescription}
                </p>
              )}
              
              <div className="flex items-center gap-4">
                {productCount > 0 && (
                  <span className="text-white/70 text-sm bg-white/10 px-3 py-1 rounded-full">
                    {productCount} Products
                  </span>
                )}
                
                {subcategories && subcategories.length > 0 && (
                  <span className="text-white/70 text-sm">
                    • {subcategories.length} Types
                  </span>
                )}
              </div>
            </div>

            <div className="absolute right-6 md:right-12 flex flex-col items-center gap-3">
              <div 
                className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white shadow-xl flex items-center justify-center"
                style={{ background: bgGradient, border: `2px solid ${borderColor}` }}
              >
                {icon ? (
                  <span className="text-3xl md:text-5xl">{icon}</span>
                ) : (
                  <svg className="w-8 h-8 md:w-12 md:h-12" style={{ color: textColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>
              
              {productCount > 0 && (
                <button
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-5 py-2 md:px-6 md:py-2.5 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Shop Now
                </button>
              )}
            </div>
          </div>

          {subcategories && subcategories.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-400 text-xs uppercase tracking-wider">Explore Types</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {subcategories.slice(0, 10).map((sub) => (
                  <Link
                    key={sub._id}
                    href={`/shop?subcategory=${sub.slug}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    {sub.icon && <span className="text-sm">{sub.icon}</span>}
                    <span className="text-sm text-gray-700 font-medium">{sub.name}</span>
                  </Link>
                ))}
                {subcategories.length > 10 && (
                  <Link
                    href="#all-types"
                    className="flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors"
                  >
                    +{subcategories.length - 10} more
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && categoryDetails && (
        <CategoryDetailsModal
          category={categoryDetails}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

interface CategoryDetailsModalProps {
  category: CategoryDetails;
  onClose: () => void;
}

const CategoryDetailsModal: React.FC<CategoryDetailsModalProps> = ({
  category,
  onClose
}) => {
  const {
    name,
    description,
    icon,
    color = '#6366F1',
    featuredImage,
    stats,
    contentSections
  } = category;

  const productCount = stats?.activeProductCount || stats?.productCount || 0;
  const viewCount = stats?.viewCount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {featuredImage?.url ? (
          <div className="relative h-48 md:h-64 w-full">
            <Image
              src={featuredImage.url}
              alt={featuredImage.alt || name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="absolute bottom-4 left-6 flex items-center gap-4">
              {icon && (
                <span className="text-5xl">{icon}</span>
              )}
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">{name}</h2>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="relative px-6 py-8"
            style={{ background: `linear-gradient(135deg, ${color}15 0%, #f8fafc 100%)` }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-4">
              {icon && (
                <span className="text-5xl">{icon}</span>
              )}
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{name}</h2>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8">
          <div className="flex flex-wrap gap-6 mb-8">
            {productCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{productCount.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Products Available</p>
                </div>
              </div>
            )}

            {viewCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{viewCount.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">People Viewed</p>
                </div>
              </div>
            )}
          </div>

          {description && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
              <div 
                className="prose prose-gray max-w-none text-gray-600"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>
          )}

          {contentSections && contentSections.length > 0 && (
            <div className="space-y-8">
              {contentSections.map((section, index) => (
                <div key={index} className="border-t pt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h3>
                  {section.image && (
                    <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden">
                      <Image
                        src={section.image}
                        alt={section.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div 
                    className="prose prose-gray max-w-none text-gray-600"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryBanner;
