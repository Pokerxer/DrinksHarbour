'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Thumbs, Zoom, FreeMode } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import * as Icon from 'react-icons/pi';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import 'swiper/css/zoom';
import 'swiper/css/free-mode';

interface ProductGalleryProps {
  images: Array<{
    url: string;
    alt?: string;
    publicId?: string;
  }>;
  productName: string;
  badge?: {
    name: string;
    color: string;
    type?: string;
  };
  onImageClick?: (index: number) => void;
}

const ProductGallery: React.FC<ProductGalleryProps> = React.memo(({ 
  images, 
  productName, 
  badge, 
  onImageClick 
}) => {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const handleSlideChange = useCallback((swiper: SwiperType) => { 
    setActiveIndex(swiper.activeIndex); 
  }, []);
  
  const handleImageClick = useCallback((index: number) => {
    if (onImageClick) { 
      onImageClick(index); 
    }
  }, [onImageClick]);

  const displayImages = images.length > 0 
    ? images 
    : [{ url: '/images/product/placeholder.png', alt: productName }];

  return (
    <div className="product-gallery">
      {/* Main Image Carousel */}
      <div className="relative mb-4">
        {/* Badge */}
        {badge && badge.name && (
          <div 
            className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg"
            style={{ backgroundColor: badge.color || '#10B981' }}
          >
            {badge.name.toUpperCase()}
          </div>
        )}

        {/* Discount Badge */}
        {badge?.type === 'discount' && (
          <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg">
            SALE
          </div>
        )}

        <Swiper
          modules={[Navigation, Thumbs, Zoom]}
          spaceBetween={0}
          slidesPerView={1}
          navigation
          thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
          zoom={{ containerClass: 'swiper-zoom-container' }}
          className="rounded-2xl overflow-hidden bg-gray-100"
          onSlideChange={handleSlideChange}
        >
          {displayImages.map((image, index) => (
            <SwiperSlide key={image.publicId || index}>
              <div 
                className="relative aspect-square cursor-zoom-in group"
                onClick={() => handleImageClick(index)}
              >
                <div className="swiper-zoom-container w-full h-full">
                  <Image
                    src={image.url}
                    alt={image.alt || `${productName} - Image ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority={index === 0}
                  />
                </div>
                
                {/* Zoom Icon */}
                <div className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Icon.PiMagnifyingGlassPlus size={20} className="text-gray-700" />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Image Counter */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/70 text-white text-sm rounded-full">
            {activeIndex + 1} / {displayImages.length}
          </div>
        )}
      </div>

      {/* Thumbnail Navigation */}
      {displayImages.length > 1 && (
        <Swiper
          onSwiper={setThumbsSwiper}
          modules={[Thumbs, FreeMode, Navigation]}
          spaceBetween={12}
          slidesPerView={4}
          freeMode
          watchSlidesProgress
          breakpoints={{
            320: { slidesPerView: 3, spaceBetween: 8 },
            480: { slidesPerView: 4, spaceBetween: 12 },
            768: { slidesPerView: 5, spaceBetween: 12 },
          }}
          className="thumbs-swiper"
        >
          {displayImages.map((image, index) => (
            <SwiperSlide key={image.publicId || index} className="cursor-pointer">
              <div 
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                  activeIndex === index 
                    ? 'border-black ring-2 ring-black ring-offset-2' 
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <Image
                  src={image.url}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="100px"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
});

ProductGallery.displayName = 'ProductGallery';

export default ProductGallery;
