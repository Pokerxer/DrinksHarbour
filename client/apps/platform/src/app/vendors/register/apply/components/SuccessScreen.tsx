import React from 'react';
import * as Icon from 'react-icons/pi';
import Link from 'next/link';

export function SuccessScreen({ slug }: { slug: string }) {
  return (
    <div className="text-center py-8">
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes checkPop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}`
      }} />
      <div
        className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6"
        style={{ animation: 'checkPop 0.5s ease-out forwards' }}
      >
        <Icon.PiCheckCircleBold size={40} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Application received!</h1>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
        Thank you for applying to sell on DrinksHarbour. Our team will review your application
        within 48 hours and reach out via email with next steps.
      </p>
      <div className="bg-gray-50 rounded-xl px-4 py-3 inline-block mb-8">
        <p className="text-xs text-gray-400">Your reference</p>
        <p className="font-mono font-semibold text-gray-700 text-sm">DH-{slug.toUpperCase() || 'PENDING'}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 transition-all shadow-md"
        >
          <Icon.PiStorefront size={16} /> Browse Vendors
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all"
        >
          <Icon.PiHouse size={16} /> Go Home
        </Link>
      </div>
    </div>
  );
}