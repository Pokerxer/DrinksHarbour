'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Returns & Refunds</h1>
          <p className="mt-2 text-gray-600">Our return policy</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiArrowUUpLeftBold className="w-6 h-6" />
              Return Period
            </h2>
            <p className="mt-4 text-gray-600">
              We offer a 7-day return policy for most items. If you're not completely satisfied with your purchase, you may return it within 7 days of delivery for a full refund or exchange.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiCheckCircleBold className="w-6 h-6" />
              Eligible Items
            </h2>
            <ul className="mt-4 list-disc list-inside text-gray-600 space-y-2">
              <li>Unopened items in original packaging</li>
              <li>Items with manufacturing defects</li>
              <li>Wrong items delivered</li>
              <li>Items damaged during shipping</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiXCircleBold className="w-6 h-6" />
              Non-Returnable Items
            </h2>
            <ul className="mt-4 list-disc list-inside text-gray-600 space-y-2">
              <li>Opened or used products</li>
              <li>Perishable items (once delivered)</li>
              <li>Items without original packaging</li>
              <li>Sale/discounted items (unless defective)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiArrowUUpLeftBold className="w-6 h-6" />
              How to Return
            </h2>
            <ol className="mt-4 list-decimal list-inside text-gray-600 space-y-2">
              <li>Contact our support team within 7 days of delivery</li>
              <li>Provide your order number and reason for return</li>
              <li>We'll arrange for pickup or provide return instructions</li>
              <li>Refunds processed within 5-7 business days after inspection</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon.PiMoneyBold className="w-6 h-6" />
              Refunds
            </h2>
            <p className="mt-4 text-gray-600">
              Refunds will be processed to your original payment method. For cash on delivery orders, refunds will be credited to your bank account. Please allow 5-7 business days for the refund to reflect in your account.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Contact Us <Icon.PiArrowRightBold />
          </Link>
        </div>
      </div>
    </div>
  );
}