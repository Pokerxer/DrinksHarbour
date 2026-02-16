'use client';

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import * as Icon from 'react-icons/pi';
import ProductCard from '@/components/Product/Card';
import type { ProductType } from '@/types/product.types';

import 'swiper/css';
import 'swiper/css/navigation';

interface RelatedProductsProps {
  products: ProductType[];
  title?: string;
}

const RelatedProducts: React.FC<RelatedProductsProps> = ({ products, title = 'You May Also Like' }) => {
  console.log('RelatedProducts - products:', products);
  console.log('RelatedProducts - length:', products?.length);

  if (!products || products.length === 0) {
    console.log('RelatedProducts - returning null, products is empty');
    return null;
  }

  return (
    <section className="py-12 lg:py-16 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
          <div className="flex gap-2">
            <button className="related-prev w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-black hover:bg-gray-50 transition-colors">
              <Icon.PiCaretLeft size={20} />
            </button>
            <button className="related-next w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-black hover:bg-gray-50 transition-colors">
              <Icon.PiCaretRight size={20} />
            </button>
          </div>
        </div>

        <Swiper
          modules={[Navigation, Autoplay]}
          spaceBetween={16}
          slidesPerView={2}
          navigation={{
            prevEl: '.related-prev',
            nextEl: '.related-next',
          }}
          autoplay={{
            delay: 5000,
            disableOnInteraction: true,
          }}
          breakpoints={{
            320: { slidesPerView: 2, spaceBetween: 12 },
            640: { slidesPerView: 3, spaceBetween: 16 },
            1024: { slidesPerView: 4, spaceBetween: 24 },
            1280: { slidesPerView: 5, spaceBetween: 24 },
          }}
        >
          {products.map((product) => (
            <SwiperSlide key={product.id || product._id}>
              <ProductCard data={product} type="grid" />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default RelatedProducts;
