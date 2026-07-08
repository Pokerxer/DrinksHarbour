import React from 'react';
import * as Icon from 'react-icons/pi';
import { TESTIMONIALS } from '../data';
import { RevealOnScroll } from './RevealOnScroll';

export function Testimonials() {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border-y border-gray-100">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <RevealOnScroll className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <Icon.PiQuotes size={13} /> Vendor Stories
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">What our vendors say</h2>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <RevealOnScroll key={t.author} delay={i * 100}>
              <figure className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, idx) => (
                    <Icon.PiStarFill key={idx} size={14} className="text-amber-400" />
                  ))}
                </div>

                <blockquote className="flex-1">
                  <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                </blockquote>

                <figcaption className="mt-4 pt-4 border-t border-gray-50">
                  <p className="font-bold text-gray-900 text-sm">{t.author}</p>
                  <p className="text-xs text-gray-400">
                    {t.role}, {t.location}
                  </p>
                </figcaption>
              </figure>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </div>
  );
}