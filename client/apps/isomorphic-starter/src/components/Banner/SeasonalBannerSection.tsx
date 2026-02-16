'use client';

import SeasonalBanner from '@/components/Banner/SeasonalBanner';

export default function SeasonalBannerSection() {
  return (
    <div className="space-y-8">
      {/* Christmas Theme - Hero Layout */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Christmas Theme - Hero Layout</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="christmas"
          layout="hero"
          showDecorations={true}
          showCountdown={true}
        />
      </section>

      {/* New Year Theme - Card Layout */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">New Year Theme - Card Layout</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="newyear"
          layout="card"
          showDecorations={true}
          showCountdown={true}
        />
      </section>

      {/* Summer Theme - Split Layout */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Summer Theme - Split Layout</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="summer"
          layout="split"
          showDecorations={true}
          showCountdown={true}
        />
      </section>

      {/* Halloween Theme - Minimal Layout */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Halloween Theme - Minimal Layout</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="halloween"
          layout="minimal"
          showDecorations={true}
          showCountdown={true}
        />
      </section>

      {/* Black Friday Theme - Hero Layout */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Black Friday Theme</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="blackfriday"
          layout="hero"
          showDecorations={true}
          showCountdown={true}
        />
      </section>

      {/* Valentine Theme */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Valentine's Day Theme</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="valentine"
          layout="card"
          showDecorations={true}
          showCountdown={true}
        />
      </section>

      {/* Easter Theme */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Easter Theme</h3>
        <SeasonalBanner
          placement="home_secondary"
          theme="easter"
          layout="card"
          showDecorations={true}
          showCountdown={true}
        />
      </section>
    </div>
  );
}
