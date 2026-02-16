'use client';

import AnnouncementBanner from '@/components/Banner/AnnouncementBanner';

export default function AnnouncementBannerSection() {
  return (
    <div className="space-y-6">
      {/* Marquee Layout - Default replacement for BannerTop */}
      <section>
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Marquee Layout</h3>
        <AnnouncementBanner
          placement="header"
          layout="marquee"
          scrollSpeed={30}
          pauseOnHover={true}
        />
      </section>

      {/* Static Layout - Simple banner */}
      <section>
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Static Layout</h3>
        <AnnouncementBanner
          placement="header"
          layout="static"
          showClose={true}
        />
      </section>

      {/* Alert Layout - Prominent messages */}
      <section>
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Alert Layout</h3>
        <AnnouncementBanner
          placement="header"
          layout="alert"
          variant="warning"
        />
      </section>

      {/* Toast Layout - Floating notifications */}
      <section className="h-40 relative">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Toast Layout</h3>
        <AnnouncementBanner
          placement="header"
          layout="toast"
          showClose={true}
        />
      </section>

      {/* Variant Examples */}
      <section>
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Variants</h3>
        <div className="space-y-3">
          <AnnouncementBanner
            placement="header"
            layout="static"
            variant="success"
          />
          <AnnouncementBanner
            placement="header"
            layout="static"
            variant="info"
          />
          <AnnouncementBanner
            placement="header"
            layout="static"
            variant="error"
          />
        </div>
      </section>
    </div>
  );
}
