'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function ShippingInfo() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Shipping Information</h1>
          <p className="mt-2 text-gray-600">Everything you need to know about delivery</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiTruckBold className="w-6 h-6" />
              Delivery Options
            </h2>
            <div className="mt-4 space-y-4">
              <div className="border-l-4 border-gray-900 pl-4">
                <h3 className="font-medium text-gray-900">Standard Delivery</h3>
                <p className="text-gray-600 text-sm">3-5 business days - Free for orders over ₦50,000</p>
              </div>
              <div className="border-l-4 border-gray-600 pl-4">
                <h3 className="font-medium text-gray-900">Express Delivery</h3>
                <p className="text-gray-600 text-sm">1-2 business days - Additional fee applies</p>
              </div>
              <div className="border-l-4 border-gray-400 pl-4">
                <h3 className="font-medium text-gray-900">Same Day Delivery</h3>
                <p className="text-gray-600 text-sm">Available in select areas - Order before 12pm</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiMapPinLineBold className="w-6 h-6" />
              Delivery Areas
            </h2>
            <p className="mt-4 text-gray-600">
              We currently deliver to major cities across Nigeria. Enter your address at checkout to confirm delivery availability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiPackageBold className="w-6 h-6" />
              Tracking Your Order
            </h2>
            <p className="mt-4 text-gray-600">
              Once your order ships, you&apos;ll receive a tracking number via SMS and email. You can also track your order in your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiWarningCircleBold className="w-6 h-6" />
              Delivery Restrictions
            </h2>
            <ul className="mt-4 list-disc list-inside text-gray-600 space-y-2">
              <li>We do not deliver to P.O. Boxes</li>
              <li>Age verification required for alcohol deliveries</li>
              <li>Someone must be available to receive the order</li>
              <li>Valid ID may be required upon delivery</li>
            </ul>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link href="/contact" className="text-gray-900 hover:underline">
            Still have questions? Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}