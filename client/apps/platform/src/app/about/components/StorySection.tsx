import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { MILESTONES } from '../data';
import { FadeIn } from './FadeIn';

export function StorySection() {
  return (
    <FadeIn>
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-4">
            <Icon.PiBookOpenText size={13} /> Our Story
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4 leading-tight">
            Good drinks <span className="text-red-700">shouldn&apos;t be hard to find.</span>
          </h2>
          <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
            <p>
              Before DrinksHarbour, finding a genuine premium bottle in Nigeria meant slim supermarket picks,
              unanswered questions about authenticity, and no way to compare prices. There was no trusted place
              to discover, compare, and buy with confidence — so in 2026, we built one from the ground up in Abuja.
            </p>
            <p>
              We launched with a small curated catalogue — spirits and wines sourced directly from verified
              distributors, delivered from a single hub in Abuja. No counterfeits, no guesswork. When local
              merchants and craft importers started asking to join, we opened the platform as a marketplace,
              giving each vendor their own digital storefront with real-time inventory and nationwide reach.
            </p>
            <p>
              Today, we serve a growing community of over 1,500 customers across the FCT and neighbouring states.
              More than 60 brands and dozens of verified vendors list on DrinksHarbour — and we&apos;re just getting
              started.
            </p>
            <p className="text-xs text-gray-400 pt-2">
              Need help? Visit our{' '}
              <Link href="/faqs" className="text-red-700 underline-offset-2 underline hover:text-red-800">
                FAQs
              </Link>{' '}
              or review our{' '}
              <Link href="/privacy-policy" className="text-red-700 underline-offset-2 underline hover:text-red-800">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="relative pl-6">
          <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-red-200 via-red-400 to-red-200" />
          <div className="space-y-6">
            {MILESTONES.map(({ year, title, body }, i) => (
              <FadeIn key={year} delay={i * 0.08}>
                <div className="relative">
                  <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow" />
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-red-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{year}</span>
                      <span className="text-sm font-bold text-gray-900">{title}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
