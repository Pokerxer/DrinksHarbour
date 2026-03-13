'use client';

import HeroBanner from '@/components/Banner/HeroBanner';

export default function HomeHeroSection() {
  return (
    <section className="hero-section">
      <HeroBanner
        placement="home_hero"
        limit={5}
        autoPlay={true}
        showControls={true}
        showIndicators={true}
      />
    </section>
  );
}
