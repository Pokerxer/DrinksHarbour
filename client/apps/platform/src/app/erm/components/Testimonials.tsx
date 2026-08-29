'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';
import { TESTIMONIALS } from '../data';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon.PiStarFill
          key={i}
          size={14}
          className={i < rating ? 'text-amber-400' : 'text-gray-200'}
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <div className="bg-gray-50 border-y border-gray-100">
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <RevealOnScroll className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <Icon.PiChatCircleText size={13} />
            What Vendors Say
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            Trusted by beverage businesses across Nigeria
          </h2>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-2 gap-4">
          {TESTIMONIALS.map(({ quote, author, role, location, rating }, i) => (
            <RevealOnScroll key={author} delay={i * 100}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all h-full flex flex-col">
                <StarRating rating={rating} />
                <p className="text-gray-600 text-sm leading-relaxed mt-3 mb-4 flex-1">
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                    {author.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{author}</p>
                    <p className="text-xs text-gray-400">{role} &middot; {location}</p>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </div>
  );
}
