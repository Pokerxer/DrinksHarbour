import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export function CtaSection() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-16">
      <div className="text-center bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 rounded-3xl shadow-sm p-10 text-white overflow-hidden relative">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="absolute top-0 right-0 w-72 h-72 bg-red-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <div className="w-14 h-14 bg-white/10 text-red-300 rounded-2xl flex items-center justify-center mx-auto mb-5 backdrop-blur-md">
            <Icon.PiHandshakeBold size={28} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Ready to run your business on DrinksHarbour?</h2>
          <p className="text-red-100 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            Join 60+ beverage businesses already using DrinksHarbour ERM to manage inventory,
            process sales, and grow revenue. Start your free trial in under 5 minutes.
          </p>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-xs text-red-200">
            <span className="flex items-center gap-1.5">
              <Icon.PiShieldCheck size={14} className="text-red-300" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.PiClock size={14} className="text-red-300" />
              Setup in under 5 minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.PiHeadset size={14} className="text-red-300" />
              Free onboarding support
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/vendors/register/apply"
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-7 py-3.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              <Icon.PiPencilSimpleLineBold size={17} /> Start Application
            </Link>
            <Link
              href="/contact?subject=erm"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-7 py-3.5 rounded-xl font-bold transition-all"
            >
              <Icon.PiChatCircle size={17} /> Talk to Our Team
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
