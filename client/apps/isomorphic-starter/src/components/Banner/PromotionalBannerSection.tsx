'use client';

import PromotionalBanner from '@/components/Banner/PromotionalBanner';

export default function PromotionalBannerSection() {
  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <PromotionalBanner
          placement="home_secondary"
          limit={4}
          layout="modern"
          showCountdown={true}
          columns={2}
        />
      </div>
    </section>
  );
}
