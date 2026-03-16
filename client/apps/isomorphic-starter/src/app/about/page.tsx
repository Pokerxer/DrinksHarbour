'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">About DrinksHarbour</h1>
          <p className="mt-2 text-gray-600">Your premier destination for quality beverages</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Who We Are</h2>
            <p className="text-gray-600">
              DrinksHarbour is Nigeria's leading online beverage store, offering a curated selection of wines, spirits, beers, and non-alcoholic drinks from around the world. We pride ourselves on quality, authenticity, and exceptional customer service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-gray-600">
              To make premium beverages accessible to everyone across Nigeria, delivering excellence in every bottle while supporting local businesses and communities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Why Choose Us</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Icon.PiCheckCircleBold className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Authentic Products</h3>
                  <p className="text-sm text-gray-600">100% genuine beverages</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Icon.PiTruckBold className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Fast Delivery</h3>
                  <p className="text-sm text-gray-600">Quick and reliable shipping</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Icon.PiShieldCheckBold className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Secure Payments</h3>
                  <p className="text-sm text-gray-600">Safe transaction guarantee</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Icon.PiHeadphonesBold className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">24/7 Support</h3>
                  <p className="text-sm text-gray-600">Always here to help</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-4">
              Have questions? We'd love to hear from you.
            </p>
            <Link href="/contact" className="inline-flex items-center gap-2 text-gray-900 hover:underline">
              Get in Touch <Icon.PiArrowRightBold />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}