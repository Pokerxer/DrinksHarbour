'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { PolicySection, Callout, SectionCard } from '@/components/legal/ui';
import { COOKIE_SECTIONS as SECTIONS } from './_content/sections';

const LAST_UPDATED = '12 July 2026';

const RELATED = [
  { label: 'Privacy Policy',   href: '/privacy-policy', icon: Icon.PiShieldCheckBold },
  { label: 'Terms of Service', href: '/terms',          icon: Icon.PiFileBold },
  { label: 'Returns Policy',   href: '/returns',        icon: Icon.PiArrowCounterClockwise },
];

export default function CookieClient() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [tocOpen, setTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setTocOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="container mx-auto max-w-5xl px-4 py-16 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
              <Icon.PiCookie size={13} />
              Legal · Cookies & tracking
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Cookie Policy</h1>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-4">
              How DrinksHarbour uses cookies and similar technologies — what they do, which are
              essential, and how you can control the rest.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <Icon.PiCalendar size={13} className="text-red-400" />
                Last updated: {LAST_UPDATED}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon.PiMapPin size={13} className="text-red-400" />
                Applies to: drinksharbour.com
              </span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
            <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-10 pb-16">
        <div className="grid lg:grid-cols-4 gap-8 items-start">

          {/* ── Sidebar TOC (desktop) ──────────────────────────────────────── */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-24">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 max-h-[80vh] overflow-y-auto">
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 px-1">Contents</p>
              <nav className="space-y-0.5">
                {SECTIONS.map(({ id, title, icon: Ic }) => {
                  const active = activeSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium transition-all ${
                        active ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <Ic size={13} className={active ? 'text-red-700' : 'text-gray-400'} />
                      <span className="leading-snug">{title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Mobile TOC toggle ──────────────────────────────────────────── */}
          <div className="lg:hidden col-span-full">
            <button
              onClick={() => setTocOpen(o => !o)}
              className="w-full flex items-center justify-between bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-3 text-sm font-semibold text-gray-700"
            >
              <span className="flex items-center gap-2">
                <Icon.PiList size={16} className="text-red-700" /> Table of Contents
              </span>
              <motion.span animate={{ rotate: tocOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <Icon.PiCaretDown size={15} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {tocOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-t-0 border-gray-100 rounded-b-2xl shadow-sm px-4 pb-4 pt-2 grid grid-cols-2 gap-1">
                    {SECTIONS.map(({ id, title, icon: Ic }) => (
                      <button
                        key={id}
                        onClick={() => scrollTo(id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 hover:bg-red-50 hover:text-red-700 transition-all text-left"
                      >
                        <Ic size={12} className="flex-shrink-0 text-red-500" />
                        {title}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Cookie content ─────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-8">

            <SectionCard>
              <Callout>
                We use essential cookies to make DrinksHarbour work, and optional cookies — only with
                your consent — to remember preferences, measure usage, and show relevant offers. You can
                change your choices at any time.
              </Callout>
            </SectionCard>

            {SECTIONS.map(({ id, title, icon, Body }) => (
              <SectionCard key={id}>
                <PolicySection id={id} title={title} icon={icon}>
                  <Body />
                </PolicySection>
              </SectionCard>
            ))}

            {/* Related links */}
            <SectionCard>
              <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <Icon.PiArrowSquareOut size={15} className="text-red-700" /> Related Policies
              </h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {RELATED.map(({ label, href, icon: Ic }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-red-200 hover:bg-red-50 transition-all group"
                  >
                    <Ic size={15} className="text-red-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-red-700 transition-colors">{label}</span>
                    <Icon.PiArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-red-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </SectionCard>

            {/* CTA */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon.PiCookieBold size={24} />
              </div>
              <h2 className="text-lg font-black text-gray-900 mb-2">Questions about cookies?</h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Our Data Protection team is happy to help with any cookie or tracking queries.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
              >
                <Icon.PiEnvelope size={16} /> Contact Us
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
