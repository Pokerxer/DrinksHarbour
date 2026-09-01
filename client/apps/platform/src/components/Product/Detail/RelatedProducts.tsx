'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay, A11y } from 'swiper/modules';
import * as Icon from 'react-icons/pi';
import ProductCard from '@/components/Product/Card';
import type { ProductType } from '@/types/product.types';

import 'swiper/css';
import 'swiper/css/navigation';

interface RelatedProductsProps {
  products: ProductType[];
  title?: string;
  /** Optional "View All" destination shown next to the heading. */
  viewAllHref?: string;
}

/**
 * "You May Also Like" carousel.
 *
 * This component owns the whole section — heading, nav arrows and slider.
 * It previously rendered its own <section> AND header while the caller wrapped
 * it in a second <section> with a duplicate <h2> and a second pair of arrows,
 * passing title="" to blank the inner heading. That produced nested sections,
 * doubled vertical padding, an empty heading node, and two sets of arrows of
 * which the caller's were inert — Swiper binds navigation by selector, and the
 * live buttons were the ones in here.
 */
const RelatedProducts: React.FC<RelatedProductsProps> = ({
  products,
  title = 'You May Also Like',
  viewAllHref,
}) => {
  // Element refs instead of global '.related-prev'/'.related-next' selectors.
  // Class selectors bind to the FIRST match in the document, so two carousels
  // on one page would both drive the first one's slider.
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 lg:py-16 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8 gap-4">
          {title ? (
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                View All <Icon.PiArrowRight size={16} />
              </Link>
            )}
            <div className="flex gap-2">
              <button
                ref={prevRef}
                type="button"
                aria-label="Previous products"
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-black hover:bg-gray-50 transition-colors"
              >
                <Icon.PiCaretLeft size={20} />
              </button>
              <button
                ref={nextRef}
                type="button"
                aria-label="Next products"
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-black hover:bg-gray-50 transition-colors"
              >
                <Icon.PiCaretRight size={20} />
              </button>
            </div>
          </div>
        </div>

        <Swiper
          modules={[Navigation, Autoplay, A11y]}
          spaceBetween={16}
          slidesPerView={2}
          // Refs aren't attached yet on first render, so wire navigation in
          // onBeforeInit — assigning refs directly in the prop leaves Swiper
          // with null elements and silently dead arrows.
          onBeforeInit={(swiper) => {
            const nav = swiper.params.navigation;
            if (nav && typeof nav !== 'boolean') {
              nav.prevEl = prevRef.current;
              nav.nextEl = nextRef.current;
            }
          }}
          navigation={{ prevEl: prevRef.current, nextEl: nextRef.current }}
          autoplay={{
            delay: 5000,
            disableOnInteraction: true,
            pauseOnMouseEnter: true,
          }}
          breakpoints={{
            320: { slidesPerView: 2, spaceBetween: 12 },
            640: { slidesPerView: 3, spaceBetween: 16 },
            1024: { slidesPerView: 4, spaceBetween: 24 },
            1280: { slidesPerView: 5, spaceBetween: 24 },
          }}
        >
          {products.map((product, i) => (
            // Related payloads can repeat an id across sources (embedded
            // relatedProducts + the background top-up), and `undefined` keys
            // collapse into one another — index disambiguates.
            <SwiperSlide key={product.id || product._id || `related-${i}`}>
              <ProductCard data={product} type="grid" />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default RelatedProducts;
