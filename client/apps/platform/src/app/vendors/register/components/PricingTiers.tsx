'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { PLAN_TIERS, ADD_ON_PRICES, FEATURE_COMPARISON, type FeatureComparison } from '../data';
import { RevealOnScroll } from './RevealOnScroll';

function formatNaira(n: number): string {
  if (n === 0) return 'Free';
  return `₦${n.toLocaleString('en-NG')}`;
}

export function PricingTiers() {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <RevealOnScroll className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <Icon.PiTagBold size={13} /> Pricing
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Choose your plan</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
            Start free and upgrade as you grow. All paid plans include a branded storefront, payment
            processing, and access to our buyer network.
          </p>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {PLAN_TIERS.map((tier, i) => (
            <RevealOnScroll key={tier.key} delay={i * 60} className="h-full">
              <div
                className={`group relative rounded-2xl border p-6 flex flex-col h-full transition-all duration-300 ${
                  tier.popular
                    ? `${tier.accentBorder} shadow-xl ring-2 ${tier.accentRing} bg-white hover:shadow-2xl hover:-translate-y-1.5`
                    : `${tier.accentBorder} shadow-sm bg-white hover:shadow-xl hover:-translate-y-1 ${tier.glow}`
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-800 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md tracking-wide uppercase">
                    Most Popular
                  </span>
                )}

                {/* Accent header bar */}
                <div className={`h-1.5 w-12 rounded-full ${tier.accentBg} mb-4 group-hover:w-20 transition-all duration-500`} />

                {/* Label + tagline */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-900 text-lg">{tier.label}</h3>
                    {tier.priceMonthly === 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.accentBg} ${tier.accentText} uppercase tracking-wide`}>
                        No card
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{tier.tagline}</p>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-black text-gray-900 tracking-tight">{formatNaira(tier.priceMonthly)}</span>
                  {tier.priceMonthly > 0 && <span className="text-xs text-gray-400 font-medium">/month</span>}
                </div>

                {/* Stats pills */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${tier.accentBg} ${tier.accentText}`}>
                    <Icon.PiPackage size={11} /> {tier.skuLimit}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${tier.accentBg} ${tier.accentText}`}>
                    <Icon.PiUsersBold size={11} /> {tier.staffLimit}
                  </span>
                </div>

                {/* Commission badge */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
                  <span className="text-xs text-gray-400 font-medium">Marketplace commission</span>
                  <span className="inline-flex items-center gap-1 text-sm font-black text-red-700">
                    <Icon.PiPercentBold size={12} />
                    {tier.commissionRate}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-xs text-gray-600">
                      <span className={`w-4 h-4 rounded-full ${tier.accentBg} ${tier.accentText} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon.PiCheckBold size={10} />
                      </span>
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href="/vendors/register/apply"
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-[1.03] active:scale-95 ${
                    tier.popular
                      ? 'bg-gradient-to-br from-red-600 to-red-800 text-white hover:from-red-700 hover:to-red-900 shadow-md hover:shadow-lg'
                      : tier.priceMonthly === 0
                        ? `${tier.accentBg} ${tier.accentText} hover:brightness-95`
                        : `border-2 ${tier.accentBorder} ${tier.accentText} hover:bg-white`
                  }`}
                >
                  {tier.priceMonthly === 0 ? 'Start Free Trial' : `Choose ${tier.label}`}
                  <Icon.PiArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </a>

                {tier.addOnsAllowed && (
                  <p className="text-[10px] text-gray-400 text-center mt-2.5 flex items-center justify-center gap-1">
                    <Icon.PiPlusCircle size={10} /> Add-ons available
                  </p>
                )}
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll className="text-center mb-6">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-800 transition-colors"
          >
            <Icon.PiListChecks size={16} />
            {showComparison ? 'Hide' : 'Show'} full feature comparison
            <Icon.PiCaretDownBold size={14} className={`transition-transform ${showComparison ? 'rotate-180' : ''}`} />
          </button>
        </RevealOnScroll>

        {showComparison && (
          <RevealOnScroll>
            <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-bold text-gray-900 sticky left-0 bg-gray-50">Feature</th>
                    {PLAN_TIERS.map((tier) => (
                      <th key={tier.key} className="px-3 py-3 font-bold text-gray-900 text-center min-w-[80px]">
                        {tier.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="text-left px-4 py-2.5 font-medium text-gray-700 sticky left-0 bg-inherit">{row.feature}</td>
                      {PLAN_TIERS.map((tier) => {
                        const val = row[tier.key as keyof FeatureComparison];
                        return (
                          <td key={tier.key} className="px-3 py-2.5 text-center">
                            {typeof val === 'boolean' ? (
                              val ? (
                                <Icon.PiCheckCircleBold size={16} className="text-emerald-600 mx-auto" />
                              ) : (
                                <Icon.PiXCircle size={16} className="text-gray-200 mx-auto" />
                              )
                            ) : (
                              <span className="font-medium text-gray-600">{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealOnScroll>
        )}

        <RevealOnScroll>
          <p className="text-center text-xs text-gray-400 mt-6">
            <Icon.PiInfo size={12} className="inline mr-1" />
            Add-ons available on Pro and above: extra shop +{formatNaira(ADD_ON_PRICES.extra_shop)}/mo,
            extra warehouse +{formatNaira(ADD_ON_PRICES.extra_warehouse)}/mo. First of each is free.
          </p>
        </RevealOnScroll>
      </div>
    </div>
  );
}