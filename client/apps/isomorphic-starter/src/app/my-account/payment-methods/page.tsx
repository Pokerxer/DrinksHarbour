'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/my-account/payment-methods');
      return;
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
          <Link href="/my-account" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <Icon.PiArrowLeftBold /> Back to Account
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-center py-12">
            <Icon.PiCreditCardBold className="w-16 h-16 mx-auto text-gray-300" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">No saved payment methods</h2>
            <p className="mt-2 text-gray-500">Add a payment method for faster checkout</p>
            <button className="mt-6 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              Add Payment Method
            </button>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <Icon.PiShieldCheckBold className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">Secure Payments</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your payment information is encrypted and secure. We never store your full card details on our servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}