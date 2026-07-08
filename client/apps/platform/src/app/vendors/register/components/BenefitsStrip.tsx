import React from 'react';
import { BENEFITS } from '../data';
import { RevealOnScroll } from './RevealOnScroll';

export function BenefitsStrip() {
  return (
    <div className="container mx-auto max-w-5xl px-4 -mt-2 pb-16">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BENEFITS.map(({ icon: Ic, title, body, color }, i) => (
          <RevealOnScroll key={title} delay={i * 80}>
            <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 h-full">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform duration-300`}>
                <Ic size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </div>
  );
}