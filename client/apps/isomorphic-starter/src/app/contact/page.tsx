'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubjectKey = 'order' | 'delivery' | 'product' | 'vendor' | 'payment' | 'returns' | 'other';

const SUBJECTS: { value: SubjectKey; label: string; icon: React.ElementType }[] = [
  { value: 'order',    label: 'Order Issue',          icon: Icon.PiPackage },
  { value: 'delivery', label: 'Delivery Enquiry',     icon: Icon.PiTruck },
  { value: 'product',  label: 'Product Question',     icon: Icon.PiWineBold },
  { value: 'vendor',   label: 'Vendor / Partnership', icon: Icon.PiStorefront },
  { value: 'payment',  label: 'Payment Problem',      icon: Icon.PiCreditCard },
  { value: 'returns',  label: 'Returns & Refunds',    icon: Icon.PiArrowCounterClockwise },
  { value: 'other',    label: 'Other',                icon: Icon.PiChatCircle },
];

const FAQ_LINKS = [
  { q: 'How do I track my order?', href: '/order-tracking' },
  { q: 'What is your return policy?', href: '/returns' },
  { q: 'How long does delivery take?', href: '/shipping-info' },
  { q: 'Do you deliver nationwide?', href: '/faqs#delivery' },
];

// ─── Contact Info cards ───────────────────────────────────────────────────────

const INFO_CARDS = [
  {
    icon: Icon.PiMapPin,
    label: 'Office',
    value: 'Abuja, Nigeria',
    sub: 'FCT · Nigeria',
    color: 'bg-red-50 text-red-700',
  },
  {
    icon: Icon.PiEnvelope,
    label: 'Email',
    value: 'support@drinksharbour.com',
    sub: 'We reply within 24 h',
    href: 'mailto:support@drinksharbour.com',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: Icon.PiPhone,
    label: 'Phone',
    value: '+234 700 DRINKS',
    sub: 'Mon–Fri · 9 am – 6 pm',
    href: 'tel:+2347003746570',
    color: 'bg-green-50 text-green-700',
  },
  {
    icon: Icon.PiWhatsappLogo,
    label: 'WhatsApp',
    value: 'Chat with us',
    sub: 'Instant AI support',
    href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000'}?text=${encodeURIComponent('Hi DrinksHarbour! I need help with ')}`,
    external: true,
    color: 'bg-emerald-50 text-emerald-700',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', subject: '' as SubjectKey | '',
    message: '', orderNumber: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.name.trim())    e.name    = 'Required';
    if (!form.email.trim())   e.email   = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.message.trim()) e.message = 'Required';
    else if (form.message.trim().length < 10) e.message = 'At least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res  = await fetch(`${API_URL}/api/contact`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ ok: true, msg: data.message });
        setForm({ name: '', email: '', phone: '', subject: '', message: '', orderNumber: '' });
      } else {
        setResult({ ok: false, msg: data.message || 'Something went wrong. Please try again.' });
      }
    } catch {
      setResult({ ok: false, msg: 'Network error. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-700 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="container mx-auto max-w-4xl text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
            <Icon.PiHeadset size={14} />
            Customer Support
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
            How can we help you?
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Our team is here to help with orders, deliveries, products, and anything else.
            We typically respond within 24 hours.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-6xl">

        {/* ── Info Cards ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {INFO_CARDS.map((card) => {
            const Ic = card.icon;
            const inner = (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 h-full hover:shadow-md hover:border-red-100 transition-all group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.color}`}>
                  <Ic size={22} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{card.label}</p>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors leading-snug">
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              </div>
            );
            if (card.href) {
              return (
                <a
                  key={card.label}
                  href={card.href}
                  target={card.external ? '_blank' : undefined}
                  rel={card.external ? 'noopener noreferrer' : undefined}
                  className="block"
                >
                  {inner}
                </a>
              );
            }
            return <div key={card.label}>{inner}</div>;
          })}
        </div>

        {/* ── Main Grid ───────────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-8">

          {/* ── Left: Form ────────────────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
              <h2 className="text-lg font-black text-gray-900 mb-1">Send us a message</h2>
              <p className="text-sm text-gray-500 mb-6">Fill in the form and we'll get back to you shortly.</p>

              {/* Success / Error banner */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={`flex items-start gap-3 p-4 rounded-xl mb-6 border ${
                      result.ok
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {result.ok
                      ? <Icon.PiCheckCircleFill size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                      : <Icon.PiWarningCircleFill size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    }
                    <p className="text-sm font-medium">{result.msg}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Name + Email */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Full Name" error={errors.name} required>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="John Doe"
                      className={inputCls(!!errors.name)}
                    />
                  </Field>
                  <Field label="Email Address" error={errors.email} required>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="you@example.com"
                      className={inputCls(!!errors.email)}
                    />
                  </Field>
                </div>

                {/* Phone + Order Number */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Phone Number" hint="Optional">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+234 800 000 0000"
                      className={inputCls(false)}
                    />
                  </Field>
                  <Field label="Order Number" hint="If applicable">
                    <input
                      type="text"
                      value={form.orderNumber}
                      onChange={set('orderNumber')}
                      placeholder="DH-2024-XXXXX"
                      className={inputCls(false)}
                    />
                  </Field>
                </div>

                {/* Subject */}
                <Field label="Subject" required>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SUBJECTS.map(s => {
                      const Ic = s.icon;
                      const selected = form.subject === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, subject: s.value }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                            selected
                              ? 'border-red-700 bg-red-50 text-red-700'
                              : 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700'
                          }`}
                        >
                          <Ic size={15} className="flex-shrink-0" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Message */}
                <Field label="Message" error={errors.message} required>
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    rows={5}
                    placeholder="Tell us exactly how we can help you…"
                    className={`${inputCls(!!errors.message)} resize-none`}
                  />
                  <p className={`text-xs mt-1 ${form.message.length < 10 && form.message.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {form.message.length} / 1000 characters
                  </p>
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl hover:from-red-800 hover:to-red-950 transition-all hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Icon.PiPaperPlaneTiltFill size={18} />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ── Right: Sidebar ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Business Hours */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Icon.PiClock size={18} className="text-red-700" />
                Business Hours
              </h3>
              <div className="space-y-2.5">
                {[
                  { day: 'Monday – Friday', hours: '9:00 AM – 6:00 PM' },
                  { day: 'Saturday',        hours: '10:00 AM – 4:00 PM' },
                  { day: 'Sunday',          hours: 'Closed' },
                ].map(({ day, hours }) => (
                  <div key={day} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{day}</span>
                    <span className={`font-semibold ${hours === 'Closed' ? 'text-red-500' : 'text-gray-900'}`}>
                      {hours}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                WhatsApp AI support is available 24/7
              </div>
            </div>

            {/* Quick FAQ */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Icon.PiQuestion size={18} className="text-red-700" />
                Quick Answers
              </h3>
              <div className="space-y-2">
                {FAQ_LINKS.map(({ q, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-red-50 transition-colors group"
                  >
                    <span className="text-sm text-gray-700 group-hover:text-red-700 transition-colors">{q}</span>
                    <Icon.PiArrowRight size={14} className="text-gray-300 group-hover:text-red-500 transition-colors flex-shrink-0" />
                  </Link>
                ))}
                <Link
                  href="/faqs"
                  className="flex items-center gap-2 mt-2 text-sm font-semibold text-red-700 hover:underline"
                >
                  View all FAQs <Icon.PiArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000'}?text=${encodeURIComponent('Hi DrinksHarbour! I need help with ')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-[#25D366] text-white rounded-2xl p-5 hover:bg-[#1ebe5d] transition-colors shadow-sm group"
            >
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon.PiWhatsappLogo size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Chat on WhatsApp</p>
                <p className="text-xs text-white/80 mt-0.5">Instant AI-powered support</p>
              </div>
              <Icon.PiArrowRight size={16} className="opacity-70 group-hover:translate-x-1 transition-transform" />
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return `w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition-colors ${
    hasError
      ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-50'
  }`;
}

function Field({
  label, children, error, hint, required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <Icon.PiWarning size={11} /> {error}
        </p>
      )}
    </div>
  );
}
