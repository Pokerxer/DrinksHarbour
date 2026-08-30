'use client';

/**
 * Landing hero for the bare /shop page.
 *
 * When admins publish `shop` placement banners this renders the same autoscroll
 * full-width HeroBanner carousel the homepage uses (one 2:1 slide at a time,
 * auto-advancing, with controls + indicators). If the placement is empty it
 * falls back to the standard themed gradient hero + category chip rail via
 * ShopHeroBanner, so the bare shop page never shows a blank slab or the
 * homepage's demo slides.
 *
 * This is only rendered on the plain /shop (no filters/search/sale/page) — the
 * caller decides that; here we merely switch on for-slots.
 */
import { useState, useCallback } from 'react';
import HeroBanner from '@/components/Banner/HeroBanner';
import ShopHeroBanner from '@/components/Shop/ShopHeroBanner';

interface ShopHeroCarouselProps {
  category?: string | string[] | null;
  subcategory?: string | string[] | null;
  brand?: string | string[] | null;
  heroSeed?: { label: string; description?: string } | null;
}

export default function ShopHeroCarousel({
  category,
  subcategory,
  brand,
  heroSeed,
}: ShopHeroCarouselProps) {
  // Becomes true when the `shop` placement has no banners; the themed hero then
  // takes over so the slot isn't a hole.
  const [empty, setEmpty] = useState(false);

  const handleEmpty = useCallback(() => setEmpty(true), []);

  if (empty) {
    return (
      <ShopHeroBanner
        category={category}
        subcategory={subcategory}
        brand={brand}
        seed={heroSeed}
      />
    );
  }

  return (
    <HeroBanner
      placement="shop"
      limit={5}
      autoPlay={true}
      showControls={true}
      showIndicators={true}
      useFallback={false}
      onEmpty={handleEmpty}
    />
  );
}
