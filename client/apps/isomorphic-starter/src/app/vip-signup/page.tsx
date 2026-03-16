'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function VIPSignup() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setMessage({ type: 'success', text: 'Welcome to VIP! You will receive exclusive offers soon.' });
    setEmail('');
    setIsLoading(false);
  };

  const benefits = [
    { icon: Icon.PiPercentBold, title: 'Exclusive Discounts', desc: 'Up to 30% off on select products' },
    { icon: Icon.PiGiftBold, title: 'Early Access', desc: 'Be the first to know about new arrivals' },
    { icon: Icon.PiStarBold, title: 'VIP Events', desc: 'Invites to exclusive tasting events' },
    { icon: Icon.PiTruckBold, title: 'Free Delivery', desc: 'Free shipping on all orders' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold">Join VIP Club</h1>
          <p className="mt-4 text-gray-400">Unlock exclusive benefits and rewards</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-800 rounded-xl">
                <benefit.icon className="w-8 h-8 text-amber-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">{benefit.title}</h3>
                  <p className="text-sm text-gray-400">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6">Sign Up Free</h2>
            
            {message && (
              <div className={`p-4 rounded-lg mb-6 ${
                message.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Joining...' : 'Join VIP Club'}
              </button>
            </form>

            <p className="mt-4 text-sm text-gray-400 text-center">
              Already a VIP? <Link href="/login" className="text-amber-400 hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}