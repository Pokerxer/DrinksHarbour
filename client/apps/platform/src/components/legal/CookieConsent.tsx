'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Cookie consent banner ─────────────────────────────────────────────────────
// Stores the visitor's choice in localStorage so it only shows once. Essential
// cookies are always on; optional (preference/analytics/marketing) are opt-in.

const STORAGE_KEY = 'dh_cookie_consent_v1';

export interface CookieConsent {
  essential: true;
  preference: boolean;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

function persist(consent: CookieConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent('dh:cookie-consent', { detail: consent }));
  } catch {
    /* storage unavailable — fail silently */
  }
}

const OPTIONAL_KEYS = ['preference', 'analytics', 'marketing'] as const;

const CATEGORY_COPY: { key: typeof OPTIONAL_KEYS[number]; label: string; desc: string }[] = [
  { key: 'preference', label: 'Preferences', desc: 'Remember your language and display settings' },
  { key: 'analytics',  label: 'Analytics',   desc: 'Help us understand usage (anonymised)' },
  { key: 'marketing',  label: 'Marketing',   desc: 'Show you relevant offers (opt-in)' },
];

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({ preference: false, analytics: false, marketing: false });

  // Only show if the user hasn't chosen yet
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const close = () => setVisible(false);

  const acceptAll = () => {
    persist({ essential: true, preference: true, analytics: true, marketing: true, ts: Date.now() });
    close();
  };

  const rejectAll = () => {
    persist({ essential: true, preference: false, analytics: false, marketing: false, ts: Date.now() });
    close();
  };

  const savePrefs = () => {
    persist({ essential: true, ...prefs, ts: Date.now() });
    close();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="dialog"
          aria-label="Cookie consent"
          aria-live="polite"
          className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto w-full max-w-3xl bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="hidden sm:flex w-10 h-10 rounded-xl bg-red-50 text-red-700 items-center justify-center flex-shrink-0">
                  <Icon.PiCookieBold size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-1">
                    <Icon.PiCookieBold size={16} className="text-red-700 sm:hidden" />
                    We value your privacy
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    We use essential cookies to make DrinksHarbour work, and optional cookies to improve
                    your experience. See our{' '}
                    <Link href="/cookie-policy" className="text-red-700 font-semibold hover:underline">
                      Cookie Policy
                    </Link>.
                  </p>
                </div>
              </div>

              {/* Preference toggles */}
              <AnimatePresence initial={false}>
                {showPrefs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2.5 sm:pl-13">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">Essential</p>
                          <p className="text-[11px] text-gray-500">Required for the site to function</p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide flex-shrink-0">Always on</span>
                      </div>
                      {CATEGORY_COPY.map(({ key, label, desc }) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800">{label}</p>
                            <p className="text-[11px] text-gray-500">{desc}</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={prefs[key]}
                            aria-label={`Toggle ${label} cookies`}
                            onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                              prefs[key] ? 'bg-red-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                prefs[key] ? 'translate-x-4' : ''
                              }`}
                            />
                          </button>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5">
                {!showPrefs ? (
                  <button
                    onClick={() => setShowPrefs(true)}
                    className="w-full sm:w-auto text-xs font-semibold text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    Manage preferences
                  </button>
                ) : (
                  <button
                    onClick={savePrefs}
                    className="w-full sm:w-auto text-xs font-semibold text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    Save choices
                  </button>
                )}
                <button
                  onClick={rejectAll}
                  className="w-full sm:w-auto text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-colors"
                >
                  Reject non-essential
                </button>
                <button
                  onClick={acceptAll}
                  className="w-full sm:w-auto text-xs font-bold text-white bg-gradient-to-br from-red-700 to-red-900 hover:from-red-800 hover:to-red-950 px-5 py-2.5 rounded-xl shadow-md transition-all"
                >
                  Accept all
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
