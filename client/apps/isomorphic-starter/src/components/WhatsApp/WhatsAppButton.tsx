'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000';
const PREFILL = encodeURIComponent('Hi DrinksHarbour! I need help with ');
const WA_URL  = `https://wa.me/${PHONE}?text=${PREFILL}`;

export default function WhatsAppButton() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [pulse, setPulse]             = useState(true);

  // Stop pulse after first interaction
  const handleClick = () => {
    setPulse(false);
    window.open(WA_URL, '_blank', 'noopener,noreferrer');
  };

  // Auto-hide pulse ring after 8 s
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      // Sits just above the chatbot FAB (bottom-24 = 96 px, bottom-5 = 20 px → gap = 64 px ≈ 16 gap)
      className="fixed bottom-[88px] right-5 z-[9998] flex flex-col items-end gap-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-xl shadow-lg whitespace-nowrap pointer-events-none"
          >
            Chat on WhatsApp
            {/* Arrow */}
            <span className="absolute right-[-5px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button */}
      <button
        onClick={handleClick}
        aria-label="Chat on WhatsApp"
        className="relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 focus:outline-none"
        style={{ background: '#25D366' }}
      >
        {/* Pulse ring */}
        {pulse && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: '#25D366' }} />
        )}

        {/* WhatsApp logo SVG */}
        <svg viewBox="0 0 32 32" className="w-8 h-8" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.003 2.667C8.636 2.667 2.667 8.636 2.667 16c0 2.364.632 4.588 1.736 6.513L2.667 29.333l6.99-1.712A13.262 13.262 0 0016.003 29.333C23.37 29.333 29.333 23.364 29.333 16S23.37 2.667 16.003 2.667zm0 24.267a11.19 11.19 0 01-5.716-1.565l-.41-.244-4.147 1.017 1.04-4.029-.267-.424A11.2 11.2 0 014.8 16.001c0-6.181 5.027-11.2 11.2-11.2S27.2 9.82 27.2 16.001c0 6.18-5.022 11.2-11.197 11.2-.003 0-.003-.001 0 0zm6.147-8.388c-.337-.169-1.992-.978-2.302-1.09-.309-.11-.534-.167-.758.168-.225.334-.869 1.09-1.065 1.314-.196.225-.393.254-.73.085-.337-.17-1.422-.521-2.707-1.66-.999-.89-1.673-1.99-1.869-2.325-.196-.336-.021-.518.147-.685.152-.152.337-.393.505-.59.168-.196.225-.337.337-.56.112-.225.056-.42-.028-.59-.084-.169-.758-1.825-1.037-2.5-.274-.657-.55-.568-.758-.579-.196-.01-.42-.013-.644-.013a1.24 1.24 0 00-.898.42c-.309.338-1.177 1.148-1.177 2.804 0 1.654 1.205 3.253 1.373 3.478.168.225 2.37 3.619 5.741 5.073.802.347 1.428.554 1.916.708.805.257 1.538.22 2.117.134.646-.097 1.992-.815 2.273-1.603.28-.787.28-1.46.196-1.601-.084-.14-.309-.225-.644-.393z" />
        </svg>
      </button>
    </div>
  );
}
