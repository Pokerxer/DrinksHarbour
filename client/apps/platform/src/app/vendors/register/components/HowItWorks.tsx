import React from 'react';
import * as Icon from 'react-icons/pi';
import { STEPS } from '../data';
import { RevealOnScroll } from './RevealOnScroll';

export function HowItWorks() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50 border-y border-gray-100">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <RevealOnScroll className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <Icon.PiPathBold size={13} /> How It Works
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Start selling in three steps</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
            From application to first sale — most vendors are live within a week.
          </p>
        </RevealOnScroll>

        <div className="relative grid sm:grid-cols-3 gap-6">
          {/* Connecting line */}
          <div className="hidden sm:block absolute top-12 left-[16.6%] right-[16.6%] h-px bg-gradient-to-r from-red-100 via-red-300 to-red-100" />

          {STEPS.map(({ num, title, body }, i) => (
            <RevealOnScroll key={num} delay={i * 120} className="relative">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white font-black text-sm flex items-center justify-center shadow-md">
                    {num}
                  </span>
                  <Icon.PiArrowRight size={16} className="text-gray-300" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </div>
  );
}