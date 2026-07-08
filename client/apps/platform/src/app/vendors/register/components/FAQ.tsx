import React from 'react';
import * as Icon from 'react-icons/pi';
import { FAQ_SCHEMA } from '../data';
import { RevealOnScroll } from './RevealOnScroll';

export function FAQ() {
  const faqs = FAQ_SCHEMA.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <RevealOnScroll className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
          <Icon.PiQuestionBold size={13} /> FAQ
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Questions?</h2>
        <p className="text-sm text-gray-500 mt-2">Everything you need to know about selling on DrinksHarbour.</p>
      </RevealOnScroll>

      <div className="space-y-3">
        {faqs.map(({ name, acceptedAnswer }, i) => (
          <RevealOnScroll key={name} delay={i * 60}>
            <details className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-100 transition-all duration-300">
              <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none">
                <span className="font-semibold text-gray-900 text-sm">{name}</span>
                <Icon.PiCaretDownBold
                  size={16}
                  className="text-gray-400 flex-shrink-0 transition-transform duration-300 group-open:rotate-180"
                />
              </summary>
              <div className="px-5 pb-5 pt-0">
                <p className="text-sm text-gray-500 leading-relaxed">{acceptedAnswer.text}</p>
              </div>
            </details>
          </RevealOnScroll>
        ))}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
    </div>
  );
}