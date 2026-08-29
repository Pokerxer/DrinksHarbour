import React from 'react';
import * as Icon from 'react-icons/pi';
import { BrowserFrame } from './BrowserFrame';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';
import type { ErmModule } from '../data';

interface FeatureRowProps {
  module: ErmModule;
  index: number;
}

export function FeatureRow({ module, index }: FeatureRowProps) {
  const isReversed = index % 2 === 1;
  const Ic = module.icon;

  return (
    <div className="py-12 lg:py-16">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Text content */}
          <RevealOnScroll
            direction={isReversed ? 'right' : 'left'}
            className={isReversed ? 'lg:order-2' : 'lg:order-1'}
          >
            <div className="space-y-5">
              {/* Module icon + tagline */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                  <Ic size={24} />
                </div>
                <span className="text-xs font-semibold text-red-600 uppercase tracking-widest">
                  {module.tagline}
                </span>
              </div>

              {/* Name */}
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                {module.name}
              </h2>

              {/* Description */}
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
                {module.description}
              </p>

              {/* Benefit-oriented bullets */}
              <ul className="space-y-3 pt-1">
                {module.bullets.map(({ text, benefit }) => (
                  <li key={text} className="flex items-start gap-3">
                    <Icon.PiCheckCircle
                      size={18}
                      className="text-emerald-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{text}</span>
                      <span className="text-sm text-gray-500"> — {benefit}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </RevealOnScroll>

          {/* Screenshot */}
          <RevealOnScroll
            direction={isReversed ? 'left' : 'right'}
            delay={150}
            className={isReversed ? 'lg:order-1' : 'lg:order-2'}
          >
            <BrowserFrame
              screenshot={module.screenshot}
              alt={`${module.name} — DrinksHarbour ERM dashboard screenshot`}
            />
          </RevealOnScroll>
        </div>
      </div>
    </div>
  );
}
