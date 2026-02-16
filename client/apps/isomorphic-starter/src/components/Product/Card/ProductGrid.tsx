'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { ProductType } from '@/types/product.types';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { useWishlist } from '@/context/WishlistContext';

interface ProductGridProps {
  data: ProductType;
  style?: 'style-1' | 'style-2' | 'style-3';
}

const ProductGrid: React.FC<ProductGridProps> = ({ data, style = 'style-1' }) => {
  const [activeColor, setActiveColor] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
  const { openQuickview } = useModalQuickviewContext();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const isWishlisted = isInWishlist(data.id);
  const discount = data.originPrice && data.originPrice > data.price 
    ? Math.round(((data.originPrice - data.price) / data.originPrice) * 100) 
    : 0;

  const handleQuickviewOpen = () => {
    openQuickview(data);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWishlisted) {
      removeFromWishlist(data.id);
    } else {
      addToWishlist(data);
    }
  };

  const getImage = () => {
    if (activeColor) {
      const variant = data.variation?.find((item) => item.color === activeColor);
      if (variant?.image) return variant.image;
    }
    if (data.thumbImage?.[0]) return data.thumbImage[0];
    if (data.images?.[0]) return data.images[0];
    return '/images/placeholder-product.png';
  };

  return (
    <div 
      className={`product-item group ${style}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="product-main cursor-pointer block">
        <div className="product-thumb bg-gray-50 relative overflow-hidden rounded-2xl">
          {discount > 0 && (
            <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg z-10">
              -{discount}%
            </span>
          )}

          <button
            onClick={handleWishlistToggle}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
              isWishlisted 
                ? 'bg-red-500 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <Icon.PiHeart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>

          <Link href={`/product/${data.id}`} className="block w-full h-full">
            <div className="product-img w-full h-[280px] relative overflow-hidden">
              <Image
                src={getImage()}
                width={500}
                height={500}
                alt={data.name}
                priority={true}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isHovered ? 'scale-110' : 'scale-100'
                }`}
              />
            </div>
          </Link>

          <div className={`absolute inset-x-0 bottom-0 flex justify-center gap-2 p-3 transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickviewOpen();
              }}
              className="px-4 py-2 bg-white rounded-full text-sm font-semibold shadow-lg hover:bg-gray-900 hover:text-white transition-colors"
            >
              Quick View
            </button>
          </div>
        </div>

        {data.variation && data.variation.length > 0 && (
          <div className="flex gap-1 mt-3">
            {data.variation.slice(0, 4).map((item, index) => (
              <button
                key={index}
                onClick={() => setActiveColor(item.color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  activeColor === item.color 
                    ? 'border-gray-900 scale-110' 
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: item.colorCode || item.color }}
                title={item.color}
              />
            ))}
          </div>
        )}

        <div className="product-infor mt-3">
          <Link href={`/product/${data.id}`}>
            <h3 className="product-name text-base font-medium line-clamp-2 hover:text-gray-600 transition-colors">
              {data.name}
            </h3>
          </Link>
          <div className="product-price-block flex items-center gap-2 mt-2">
            <span className="product-price text-lg font-bold text-gray-900">
              ₦{data.price.toLocaleString()}
            </span>
            {data.originPrice && data.originPrice > data.price && (
              <span className="text-sm text-gray-400 line-through">
                ₦{data.originPrice.toLocaleString()}
              </span>
            )}
          </div>
          {data.category && (
            <p className="text-xs text-gray-500 mt-1 capitalize">
              {typeof data.category === 'string' ? data.category : data.category?.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductGrid;
