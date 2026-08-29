import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { RevealOnScroll } from './RevealOnScroll';

export function ErmTeaser() {
  const features = [
    { icon: Icon.PiPackageBold, label: 'Inventory tracking' },
    { icon: Icon.PiCreditCardBold, label: 'Point of Sale' },
    { icon: Icon.PiFileTextBold, label: 'Invoicing' },
    { icon: Icon.PiUsersBold, label: 'CRM & contacts' },
    { icon: Icon.PiChartLineBold, label: 'Analytics' },
    { icon: Icon.PiTruckBold, label: 'Purchasing' },
  ];

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border-y border-gray-100">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <RevealOnScroll>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Left: content */}
              <div className="p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                  <Icon.PiGearBold size={13} />
                  Built-In ERM
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
                  Run your entire business from one dashboard
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  Every DrinksHarbour subscription includes our Enterprise Resource Management
                  system — inventory, POS, invoicing, CRM, analytics, and more. No extra
                  software, no hidden fees.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {features.map(({ icon: Ic, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Ic size={16} className="text-red-600 flex-shrink-0" />
                      <span className="text-sm text-gray-700 font-medium">{label}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/erm"
                  className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <Icon.PiMonitor size={16} />
                  Explore the Full ERM
                  <Icon.PiArrowRight size={14} />
                </Link>
              </div>

              {/* Right: screenshot preview */}
              <div className="hidden lg:block bg-gray-50 relative">
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    {/* Mini browser chrome */}
                    <div className="bg-gray-100 border-b border-gray-200 h-7 flex items-center gap-1.5 px-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/erm/screenshots/analytics.png"
                      alt="DrinksHarbour ERM Dashboard"
                      className="w-full h-auto object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
