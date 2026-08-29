import { ErmHero } from './components/ErmHero';
import { FeatureRow } from './components/FeatureRow';
import { CapabilitiesStrip } from './components/CapabilitiesStrip';
import { MidPageCta } from './components/MidPageCta';
import { Testimonials } from './components/Testimonials';
import { Faq } from './components/Faq';
import { PlanTeaser } from './components/PlanTeaser';
import { CtaSection } from './components/CtaSection';
import { ERM_MODULES } from './data';
import { getApiUrl } from '@/lib/api';

const API_URL = getApiUrl();

async function getStats() {
  try {
    const [storesRes, productsRes] = await Promise.all([
      fetch(`${API_URL}/api/stores?page=1&limit=1`, {
        next: { revalidate: 300 }, // cache for 5 minutes
      }),
      fetch(`${API_URL}/api/products?page=1&limit=1`, {
        next: { revalidate: 300 },
      }),
    ]);

    const storesData = storesRes.ok ? await storesRes.json() : null;
    const productsData = productsRes.ok ? await productsRes.json() : null;

    return {
      vendorCount: storesData?.data?.pagination?.total ?? 0,
      productCount: productsData?.data?.pagination?.totalResults ?? 0,
    };
  } catch {
    return { vendorCount: 0, productCount: 0 };
  }
}

export default async function ErmPage() {
  const { vendorCount, productCount } = await getStats();

  // Split modules into two groups for mid-page CTA placement
  const firstHalf = ERM_MODULES.slice(0, 5);
  const secondHalf = ERM_MODULES.slice(5);

  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <ErmHero vendorCount={vendorCount} productCount={productCount} />

        {/* First 5 modules */}
        <div className="bg-white">
          {firstHalf.map((module, index) => (
            <FeatureRow key={module.id} module={module} index={index} />
          ))}
        </div>

        {/* Mid-page CTA — breaks the pattern, re-engages the visitor */}
        <MidPageCta />

        {/* Remaining 5 modules */}
        <div className="bg-white">
          {secondHalf.map((module, index) => (
            <FeatureRow key={module.id} module={module} index={index + 5} />
          ))}
        </div>

        <CapabilitiesStrip />
        <Testimonials />
        <PlanTeaser />
        <Faq />
      </main>

      <CtaSection />
    </div>
  );
}
