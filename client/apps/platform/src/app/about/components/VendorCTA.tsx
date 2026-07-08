import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { FadeIn } from './FadeIn';

export function VendorCTA() {
  return (
    <FadeIn>
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 flex flex-col">
          <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center mb-4">
            <Icon.PiStorefront size={24} />
          </div>
          <h3 className="font-black text-gray-900 text-lg mb-2">Sell on DrinksHarbour</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-5 flex-1">
            Are you a wine merchant, importer, or beverage brand? List your products on Nigeria&apos;s
            fastest-growing drinks marketplace and reach a growing community of verified buyers.
          </p>
          <Link
            href="/vendors/register"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all self-start"
          >
            Apply to Sell on DrinksHarbour <Icon.PiArrowRight size={15} />
          </Link>
        </div>

        <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 rounded-2xl p-7 text-white flex flex-col">
          <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4">
            <Icon.PiHandshake size={24} />
          </div>
          <h3 className="font-black text-lg mb-2">Partner with Us</h3>
          <p className="text-sm text-red-100 leading-relaxed mb-5 flex-1">
            Brands, event organisers, hotels, and restaurants — let&apos;s explore bulk supply agreements,
            co-branded promotions, and exclusive partnerships tailored to your business.
          </p>
          <Link
            href="/contact?subject=vendor"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all self-start"
          >
            Get in Touch <Icon.PiArrowRight size={15} />
          </Link>
        </div>
      </div>
    </FadeIn>
  );
}
