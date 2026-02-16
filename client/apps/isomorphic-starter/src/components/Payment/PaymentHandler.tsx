// components/Payment/PaymentHandler.tsx
'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { motion } from 'framer-motion';

interface PaymentHandlerProps {
  clientSecret: string;
  amount: number;
  onPaymentSuccess: (paymentData: any) => void;
  onPaymentError: (error: string) => void;
}

const PaymentHandler: React.FC<PaymentHandlerProps> = ({
  clientSecret,
  amount,
  onPaymentSuccess,
  onPaymentError,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardHolder: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

      // Confirm the payment on the backend
      const response = await fetch(`${API_URL}/api/payments/stripe/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          clientSecret,
          paymentMethod: {
            card: {
              number: cardDetails.cardNumber.replace(/\s/g, ''),
              exp_month: parseInt(cardDetails.expiryDate.split('/')[0]),
              exp_year: parseInt('20' + cardDetails.expiryDate.split('/')[1]),
              cvc: cardDetails.cvv,
            },
            billing_details: {
              name: cardDetails.cardHolder,
            },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment failed');
      }

      onPaymentSuccess({
        method: 'stripe',
        paymentIntentId: data.data?.paymentIntentId,
        status: 'succeeded',
      });
    } catch (error: any) {
      onPaymentError(error.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card Holder */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Holder Name
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon.PiUser size={18} />
          </div>
          <input
            type="text"
            value={cardDetails.cardHolder}
            onChange={(e) => setCardDetails({ ...cardDetails, cardHolder: e.target.value })}
            placeholder="John Doe"
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white transition-all outline-none"
            required
          />
        </div>
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Number
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon.PiCreditCard size={18} />
          </div>
          <input
            type="text"
            value={cardDetails.cardNumber}
            onChange={(e) => setCardDetails({ ...cardDetails, cardNumber: formatCardNumber(e.target.value) })}
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white transition-all outline-none"
            required
          />
        </div>
      </div>

      {/* Expiry and CVV */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Date
          </label>
          <input
            type="text"
            value={cardDetails.expiryDate}
            onChange={(e) => setCardDetails({ ...cardDetails, expiryDate: formatExpiryDate(e.target.value) })}
            placeholder="MM/YY"
            maxLength={5}
            className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white transition-all outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CVV
          </label>
          <div className="relative">
            <input
              type="password"
              value={cardDetails.cvv}
              onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, '') })}
              placeholder="123"
              maxLength={4}
              className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white transition-all outline-none"
              required
            />
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <motion.button
        type="submit"
        disabled={isProcessing}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-xl 
          hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl 
          disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-6"
      >
        {isProcessing ? (
          <>
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Icon.PiLockKey size={22} />
            Pay ₦{amount.toLocaleString()}
          </>
        )}
      </motion.button>

      {/* Security Note */}
      <div className="flex items-center justify-center gap-4 text-sm text-gray-500 pt-2">
        <div className="flex items-center gap-1.5">
          <Icon.PiShieldCheck size={18} className="text-green-500" />
          <span>Secure Payment</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <Icon.PiLockKey size={18} className="text-blue-500" />
          <span>256-bit SSL</span>
        </div>
      </div>
    </form>
  );
};

export default PaymentHandler;
