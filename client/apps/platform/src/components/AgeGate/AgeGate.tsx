'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface AgeGateProps {
  productId?: string;
  minimumAge?: number;
}

const STORAGE_KEY = 'drinksharbour_age_verified';

const AgeGate: React.FC<AgeGateProps> = ({
  productId,
  minimumAge = 18,
}) => {
  // Lazy initializer reads localStorage synchronously on first render (client-only
  // because this component is loaded with ssr: false in layout.tsx).
  const [isVerified, setIsVerified] = useState<boolean>(() => {
    const global  = localStorage.getItem(STORAGE_KEY);
    const product = productId ? localStorage.getItem(`${STORAGE_KEY}_${productId}`) : null;
    return global === 'true' || product === 'true';
  });

  const verify = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    if (productId) localStorage.setItem(`${STORAGE_KEY}_${productId}`, 'true');
    setIsVerified(true);
  }, [productId]);

  const leave = useCallback(() => {
    window.history.back();
  }, []);

  if (isVerified) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="age-gate"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(178,2,2,0.18) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(178,2,2,0.12) 0%, transparent 55%),
            linear-gradient(135deg, #0a0a0a 0%, #1a0505 40%, #0d0d0d 100%)
          `,
        }}
      >
        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative red glow orbs */}
        <div className="absolute top-[-120px] left-[-80px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(178,2,2,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-100px] right-[-60px] w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(178,2,2,0.10) 0%, transparent 70%)' }} />

        {/* Card */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          transition={{ delay: 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* Top brand stripe */}
          <div className="h-1" style={{ background: 'linear-gradient(to right, #b20202, #ff3232, #b20202)' }} />

          {/* Hero section */}
          <div
            className="px-8 pt-10 pb-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1a0505 0%, #0d0d0d 100%)' }}
          >
            {/* Subtle inner glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(178,2,2,0.25) 0%, transparent 70%)' }} />

            {/* Logo */}
            <div className="relative flex justify-center mb-6">
              <Image
                src="/images/logo.svg"
                alt="DrinksHarbour"
                width={170}
                height={60}
                priority
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>

            {/* Wine glass icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'rgba(178,2,2,0.2)', border: '1px solid rgba(178,2,2,0.35)' }}
            >
              <Icon.PiWineFill size={30} style={{ color: '#ff6060' }} />
            </div>

            <h2 className="modal-title text-xl font-black text-white mb-2 leading-tight">
              Age Verification
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              This site sells alcoholic beverages.<br />
              You must be <span className="font-bold text-white">{minimumAge}+</span> to enter.
            </p>
          </div>

          {/* Body */}
          <div className="px-7 py-7 space-y-4">

            {/* 18+ confirm */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={verify}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2.5 shadow-lg transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #b20202 0%, #8b0000 100%)' }}
            >
              <Icon.PiCheckCircleFill size={20} />
              Yes, I am {minimumAge} or older
            </motion.button>

            {/* Leave */}
            <button
              onClick={leave}
              className="w-full py-3.5 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: '#f9fafb', color: '#6b7280', border: '1.5px solid #e5e7eb' }}
            >
              <Icon.PiArrowLeft size={16} />
              No, take me back
            </button>

            {/* Legal */}
            <p className="text-center text-xs leading-relaxed pt-1" style={{ color: '#9ca3af' }}>
              By entering you confirm you are of legal drinking age and agree to our{' '}
              <Link href="/terms" className="underline hover:text-gray-600 transition-colors">Terms</Link>
              {' & '}
              <Link href="/privacy-policy" className="underline hover:text-gray-600 transition-colors">Privacy Policy</Link>.
            </p>

          </div>

          {/* Bottom brand strip */}
          <div className="h-0.5" style={{ background: 'linear-gradient(to right, transparent, #b20202, transparent)' }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgeGate;
