'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { FAQS } from '../data';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-sm text-gray-900">{question}</span>
        <Icon.PiCaretDown
          size={16}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-500 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export function Faq() {
  return (
    <div className="bg-gray-50 border-y border-gray-100">
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <RevealOnScroll className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <Icon.PiQuestion size={13} />
            Frequently Asked Questions
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            Common questions from vendors
          </h2>
        </RevealOnScroll>

        <RevealOnScroll className="space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.question} {...faq} />
          ))}
        </RevealOnScroll>
      </div>
    </div>
  );
}
