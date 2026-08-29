import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';

export function PlanTeaser() {
  return (
    <div className="bg-gray-50 border-y border-gray-100">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <RevealOnScroll className="text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 text-xs font-semibold mb-4">
            <Icon.PiTag size={13} />
            Simple Pricing
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
            Plans from <span className="text-red-600">₦0</span>/month
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto mb-8">
            Start with a free trial — no credit card required. Upgrade as your business grows
            and unlock multi-location, advanced CRM, and API access.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/vendors/register"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-7 py-3.5 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Icon.PiArrowRight size={16} />
              View All Plans
            </Link>
            <Link
              href="/vendors/register/apply"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-7 py-3.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-colors"
            >
              <Icon.PiPaperPlaneTilt size={16} />
              Start Application
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
