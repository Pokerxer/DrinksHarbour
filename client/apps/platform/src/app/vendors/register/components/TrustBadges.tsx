import React from 'react';
import { TRUST_BADGES } from '../data';
import { RevealOnScroll } from './RevealOnScroll';

export function TrustBadges() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-16">
      <RevealOnScroll className="text-center mb-10">
        <h2 className="text-xl font-black text-gray-900">Built on trust</h2>
        <p className="text-sm text-gray-500 mt-1">Everything we do is designed to keep buyers and vendors safe.</p>
      </RevealOnScroll>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TRUST_BADGES.map(({ icon: Ic, label, description }, i) => (
          <RevealOnScroll key={label} delay={i * 80}>
            <div className="flex items-start gap-3 p-4 rounded-2xl hover:bg-white hover:shadow-sm transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0">
                <Ic size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-xs mb-1">{label}</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>
              </div>
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </div>
  );
}