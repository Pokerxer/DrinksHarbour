'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function SustainabilityPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Sustainability</h1>
          <p className="mt-2 text-gray-600">Our commitment to the environment</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiLeafBold className="w-6 h-6 text-green-600" />
              Our Mission
            </h2>
            <p className="mt-4 text-gray-600">
              At DrinksHarbour, we are committed to minimizing our environmental footprint while delivering quality beverages to our customers. We believe in sustainable practices that protect our planet for future generations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiPackageBold className="w-6 h-6 text-green-600" />
              Packaging
            </h2>
            <ul className="mt-4 list-disc list-inside text-gray-600 space-y-2">
              <li>Use of recyclable and biodegradable packaging materials</li>
              <li>Minimizing plastic use in our supply chain</li>
              <li>Encouraging suppliers to adopt eco-friendly packaging</li>
              <li>Offering reusable packaging options for bulk orders</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiTruckBold className="w-6 h-6 text-green-600" />
              Delivery
            </h2>
            <ul className="mt-4 list-disc list-inside text-gray-600 space-y-2">
              <li>Optimized delivery routes to reduce carbon emissions</li>
              <li>Electric vehicle adoption for last-mile delivery</li>
              <li>Consolidated shipping to minimize trips</li>
              <li>Carbon offset program for deliveries</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiRecycleBold className="w-6 h-6 text-green-600" />
              Recycling Program
            </h2>
            <p className="mt-4 text-gray-600">
              We accept empty bottles and packaging for recycling. Contact us to learn about our bottle return program and earn rewards for recycling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiHandshakeBold className="w-6 h-6 text-green-600" />
              Community Impact
            </h2>
            <ul className="mt-4 list-disc list-inside text-gray-600 space-y-2">
              <li>Supporting local breweries and distilleries</li>
              <li>Fair trade partnerships</li>
              <li>Community clean-up initiatives</li>
              <li>Education on responsible consumption</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">Join us in making a difference</p>
          <Link href="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Shop Responsibly <Icon.PiArrowRightBold />
          </Link>
        </div>
      </div>
    </div>
  );
}