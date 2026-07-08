import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { ApplyForm } from './components/ApplyForm';

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:py-16">
        {/* Back link */}
        <Link
          href="/vendors/register"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-700 transition-colors mb-8"
        >
          <Icon.PiArrowLeft size={16} /> Back to vendor page
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
            <Icon.PiPencilSimpleLineBold size={13} /> Vendor Application
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">Become a vendor</h1>
          <p className="text-sm text-gray-500 max-w-lg mx-auto">
            Complete the four steps below. It takes about five minutes — you can save and come back anytime.
          </p>
        </div>

        <ApplyForm />
      </main>
    </div>
  );
}