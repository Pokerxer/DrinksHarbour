import AdsNavHeader from '@/app/shared/ads/ads-nav-header';

/**
 * Shared chrome for every /advertising/* route — the POS-style shell,
 * mirroring the Merchandising layout: full-bleed wrapper, white bordered nav
 * bar, gray-50 content canvas.
 */
export default function AdvertisingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <AdsNavHeader />
      </div>
      <div className="flex-1 bg-gray-50 px-4 pb-10 pt-6 md:px-10 lg:px-14">
        {children}
      </div>
    </div>
  );
}
