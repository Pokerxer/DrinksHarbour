import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function DirectoryHero({ totalVendors }: { totalVendors?: number }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white py-14 px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-700 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="container mx-auto max-w-4xl text-center relative">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
          <Icon.PiStorefront size={14} />
          Verified Merchants
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
          Our Vendors
        </h1>
        <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
          Browse our curated network of verified beverage merchants across Nigeria.
          From premium spirits to craft beers — shop direct from the source.
        </p>

        <Link
          href="/vendors/register"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-red-900/30 transition-colors mb-10"
        >
          <Icon.PiStorefront size={16} />
          Become a Vendor
          <Icon.PiArrowRight size={15} />
        </Link>

        <div className="flex items-center justify-center gap-8 sm:gap-12 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiStorefront size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">
              {totalVendors != null ? totalVendors.toLocaleString() : '—'}
            </p>
            <span className="text-xs text-gray-400">Vendors</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiShieldCheck size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">100%</p>
            <span className="text-xs text-gray-400">Verified</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiTruck size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">Fast</p>
            <span className="text-xs text-gray-400">Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiStar size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">Curated</p>
            <span className="text-xs text-gray-400">Selection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
