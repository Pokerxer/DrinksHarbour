'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface AgeGateProps {
  productId?: string;
  productName?: string;
  minimumAge?: number;
}

const AgeGate: React.FC<AgeGateProps> = ({ 
  productId, 
  productName = 'this product',
  minimumAge = 18 
}) => {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [birthYear, setBirthYear] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<'NG' | 'US'>('NG');

  const STORAGE_KEY = 'drinksharbour_age_verified';

  useEffect(() => {
    const stored = sessionStorage.getItem(`${STORAGE_KEY}_${productId}`);
    const globalStored = sessionStorage.getItem(STORAGE_KEY);
    
    if (stored === 'true' || globalStored === 'true') {
      setIsVerified(true);
    } else {
      setIsVerified(false);
    }
  }, [productId]);

  const calculateAge = useCallback((year: number, month: number, day: number): number => {
    const today = new Date();
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }, []);

  const handleVerify = useCallback(() => {
    setError('');

    if (!birthYear || !birthMonth || !birthDay) {
      setError('Please enter your complete date of birth');
      return;
    }

    const year = parseInt(birthYear, 10);
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);

    if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
      setError('Please enter a valid year');
      return;
    }

    if (isNaN(month) || month < 1 || month > 12) {
      setError('Please enter a valid month (1-12)');
      return;
    }

    if (isNaN(day) || day < 1 || day > 31) {
      setError('Please enter a valid day (1-31)');
      return;
    }

    const age = calculateAge(year, month, day);

    if (age < 0) {
      setError('Date of birth cannot be in the future');
      return;
    }

    if (age < minimumAge) {
      setError(`You must be at least ${minimumAge} years old to view this product`);
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, 'true');
    if (productId) {
      sessionStorage.setItem(`${STORAGE_KEY}_${productId}`, 'true');
    }
    setIsVerified(true);
  }, [birthYear, birthMonth, birthDay, calculateAge, minimumAge, productId]);

  const handleExit = useCallback(() => {
    window.history.back();
  }, []);

  const handleSimpleVerify = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    if (productId) {
      sessionStorage.setItem(`${STORAGE_KEY}_${productId}`, 'true');
    }
    setIsVerified(true);
  }, [productId]);

  if (isVerified === null) {
    return (
      <div className="fixed inset-0 bg-white z-[200]" />
    );
  }

  if (isVerified) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      >
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur">
                <Icon.PiWine size={40} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Age Verification Required
              </h1>
              <p className="text-amber-100 text-sm">
                You must be {minimumAge}+ to view alcoholic products
              </p>
              <p className="text-white/80 text-xs mt-2">
                Restricted product: {productName}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select your country
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedCountry('NG')}
                    className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                      selectedCountry === 'NG'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    🇳🇬 Nigeria (18+)
                  </button>
                  <button
                    onClick={() => setSelectedCountry('US')}
                    className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                      selectedCountry === 'US'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    🇺🇸 United States (21+)
                  </button>
                </div>
              </div>

              {/* Date of Birth Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your date of birth
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <input
                      type="number"
                      placeholder="Day"
                      min="1"
                      max="31"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center font-medium focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    <span className="block text-center text-xs text-gray-400 mt-1">Day</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Month"
                      min="1"
                      max="12"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center font-medium focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    <span className="block text-center text-xs text-gray-400 mt-1">Month</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Year"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center font-medium focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    <span className="block text-center text-xs text-gray-400 mt-1">Year</span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
                  >
                    <Icon.PiWarningCircle size={20} className="flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Verify Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleVerify}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Verify Age
              </motion.button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white text-sm text-gray-500">or</span>
                </div>
              </div>

              {/* Skip Verification (Exit) */}
              <div className="space-y-3">
                <button
                  onClick={handleSimpleVerify}
                  className="w-full py-3 px-6 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  I am {selectedCountry === 'NG' ? '18+' : '21+'}, Enter Site
                </button>
                
                <button
                  onClick={handleExit}
                  className="w-full py-3 px-6 border-2 border-gray-200 text-gray-600 font-medium rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  I am under {selectedCountry === 'NG' ? '18' : '21'}, Leave Site
                </button>
              </div>

              {/* Legal Notice */}
              <p className="text-center text-xs text-gray-400 leading-relaxed">
                By entering this site, you agree to our Terms of Service and Privacy Policy. 
                This site contains information about alcoholic beverages. 
                You must be of legal drinking age to purchase alcohol.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgeGate;
