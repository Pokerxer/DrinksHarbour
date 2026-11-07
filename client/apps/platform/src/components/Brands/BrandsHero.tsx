import * as Icon from 'react-icons/pi';

export default function BrandsHero({ total, totalProducts }: { total?: number; totalProducts?: number }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white py-14 px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-700 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="container mx-auto max-w-4xl text-center relative">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
          <Icon.PiStar size={14} />
          Premium Partners
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
          Our Brands
        </h1>
        <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
          Discover the world&apos;s finest beverage brands available on DrinksHarbour.
          From heritage distilleries to craft producers — every bottle tells a story.
        </p>

        <div className="mx-auto grid max-w-lg grid-cols-4 items-start gap-3 text-center sm:gap-8">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiStorefront size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">
              {total != null ? total.toLocaleString() : '\u2014'}
            </p>
            <span className="text-xs text-gray-400">Brands</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiWine size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">
              {totalProducts != null ? totalProducts.toLocaleString() : '\u2014'}
            </p>
            <span className="text-xs text-gray-400">Products</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiShieldCheck size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">100%</p>
            <span className="text-xs text-gray-400">Authentic</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiGlobe size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">Global</p>
            <span className="text-xs text-gray-400">Selection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

