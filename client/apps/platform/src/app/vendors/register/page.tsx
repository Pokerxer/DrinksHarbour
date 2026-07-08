import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { HeroSection } from './components/HeroSection';
import { BenefitsStrip } from './components/BenefitsStrip';
import { HowItWorks } from './components/HowItWorks';
import { PricingTiers } from './components/PricingTiers';
import { Testimonials } from './components/Testimonials';
import { TrustBadges } from './components/TrustBadges';
import { FAQ } from './components/FAQ';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <HeroSection />
        <BenefitsStrip />
        <HowItWorks />
        <PricingTiers />
        <Testimonials />
        <TrustBadges />
        <FAQ />
      </main>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-5xl px-4 pb-16">
        <div className="text-center bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 rounded-3xl shadow-sm p-10 text-white overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute top-0 right-0 w-72 h-72 bg-red-500 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <div className="w-14 h-14 bg-white/10 text-red-300 rounded-2xl flex items-center justify-center mx-auto mb-5 backdrop-blur-md">
              <Icon.PiHandshakeBold size={28} />
            </div>
            <h2 className="text-2xl font-black mb-3">Ready to grow?</h2>
            <p className="text-red-100 text-sm max-w-md mx-auto mb-6">
              Start your application today — it takes about five minutes. Our team reviews every
              application within 48 hours.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/vendors/register/apply"
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-7 py-3.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
              >
                <Icon.PiPencilSimpleLineBold size={17} /> Start Application
              </Link>
              <Link
                href="/contact?subject=vendor"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-7 py-3.5 rounded-xl font-bold transition-all"
              >
                <Icon.PiChatCircle size={17} /> Talk to Our Team
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}