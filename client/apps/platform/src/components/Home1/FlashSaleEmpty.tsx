import Link from 'next/link';
import { PiArrowRight, PiLightningFill } from 'react-icons/pi';

export default function FlashSaleEmpty() {
  return (
    <section aria-labelledby="flash-sale-heading" className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 py-5 text-white">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <PiLightningFill size={28} aria-hidden="true" />
          <div>
            <h2 id="flash-sale-heading" className="text-xl font-bold">Flash Sale</h2>
            <p className="text-sm text-white/90">No active flash sales right now. Check back for new deals.</p>
          </div>
        </div>
        <Link href="/shop" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          Browse drinks <PiArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
