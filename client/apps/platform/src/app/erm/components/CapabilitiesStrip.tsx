import React from 'react';
import { CAPABILITIES } from '../data';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';

export function CapabilitiesStrip() {
  return (
    <div className="bg-white border-y border-gray-100">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <RevealOnScroll className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            Built-In Capabilities
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            Everything you need, included
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
            Cross-cutting features that power every module in the ERM.
          </p>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CAPABILITIES.map(({ icon: Ic, title, description, color }, i) => (
            <RevealOnScroll key={title} delay={i * 80}>
              <div className="group bg-gray-50 rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 h-full">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform duration-300`}
                >
                  <Ic size={24} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </div>
  );
}
