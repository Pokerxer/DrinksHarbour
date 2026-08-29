import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';

export function MidPageCta() {
  return (
    <div className="bg-white border-y border-gray-100">
      <div className="container mx-auto max-w-4xl px-4 py-14">
        <RevealOnScroll className="text-center">
          <div className="bg-gradient-to-br from-red-50 via-white to-red-50 rounded-3xl border border-red-100 p-10 relative overflow-hidden">
            {/* Decorative blob */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-200 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="relative">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon.PiRocketLaunch size={24} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-3">
                See what you&apos;ve been missing
              </h2>
              <p className="text-sm text-gray-500 max-w-lg mx-auto mb-6 leading-relaxed">
                Every module you just saw comes included with your DrinksHarbour account.
                Start with the free trial — no credit card, no commitment, no catch.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/vendors/register/apply"
                  className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-7 py-3 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <Icon.PiArrowRight size={16} />
                  Start Free Trial
                </Link>
                <Link
                  href="/contact?subject=erm"
                  className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-7 py-3 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-colors"
                >
                  <Icon.PiChatCircle size={16} />
                  Talk to Sales
                </Link>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
