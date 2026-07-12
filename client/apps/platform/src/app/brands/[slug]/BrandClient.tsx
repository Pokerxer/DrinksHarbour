'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Brand {
  _id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  shortDescription?: string;
  story?: string;
  founded?: number;
  founderName?: string;
  countryOfOrigin?: string;
  region?: string;
  primaryCategory?: string;
  brandType?: string;
  specializations?: string[];
  productCount?: number;
  logo?: { url: string; alt?: string };
  logoVariants?: { primary?: string; white?: string };
  featuredImage?: { url: string; alt?: string };
  bannerImage?: { url: string; alt?: string };
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  isPremium?: boolean;
  verified?: boolean;
}

const COUNTRY_EMOJI: Record<string, string> = {
  France: '🇫🇷', Italy: '🇮🇹', 'United States': '🇺🇸', USA: '🇺🇸',
  'United Kingdom': '🇬🇧', UK: '🇬🇧', Germany: '🇩🇪', Spain: '🇪🇸',
  Mexico: '🇲🇽', Japan: '🇯🇵', Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', Ireland: '🇮🇪',
  Australia: '🇦🇺', Canada: '🇨🇦', Nigeria: '🇳🇬', 'South Africa': '🇿🇦',
};

function getEmoji(country?: string) {
  if (!country) return '🌍';
  return COUNTRY_EMOJI[country.split(',')[0].trim()] || '🌍';
}

function getBrandColor(brand: Brand) {
  return brand.brandColors?.primary || brand.brandColors?.accent || '#991b1b';
}

function getLogoUrl(brand: Brand): string | null {
  return brand.logo?.url || brand.logoVariants?.primary || brand.logoVariants?.white || null;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BrandClient({ brand }: { brand: Brand }) {
  const color     = getBrandColor(brand);
  const logoUrl   = getLogoUrl(brand);
  const shopLink  = `/shop?brand=${encodeURIComponent(brand.name)}`;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero / Banner ──────────────────────────────────────────────────── */}
      <div className="relative h-64 sm:h-80 overflow-hidden">
        {brand.bannerImage?.url ? (
          <Image
            src={brand.bannerImage.url}
            alt={brand.bannerImage.alt || brand.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${color}cc 0%, ${color} 100%)` }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />

        {/* Breadcrumb */}
        <div className="absolute top-4 left-4 z-10">
          <nav className="flex items-center gap-2 text-white/70 text-xs">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Icon.PiCaretRight size={12} />
            <Link href="/brands" className="hover:text-white transition-colors">Brands</Link>
            <Icon.PiCaretRight size={12} />
            <span className="text-white font-medium">{brand.name}</span>
          </nav>
        </div>

        {/* Badges */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {brand.isPremium && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 rounded-full text-[10px] font-bold text-white shadow">
              <Icon.PiCrownFill size={10} /> Premium
            </span>
          )}
          {brand.verified && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 rounded-full text-[10px] font-bold text-white shadow">
              <Icon.PiSealCheckFill size={10} /> Verified
            </span>
          )}
        </div>
      </div>

      {/* ── Profile Card ───────────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-4xl px-4">
        <div className="relative -mt-16 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="w-20 h-20 rounded-2xl bg-white shadow-xl border-2 border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0"
              >
                {logoUrl ? (
                  <Image src={logoUrl} alt={brand.name} width={72} height={72} className="object-contain p-1.5" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-black text-white rounded-2xl"
                    style={{ backgroundColor: color }}>
                    {initials(brand.name)}
                  </div>
                )}
              </motion.div>

              {/* Name & meta */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-gray-900 mb-1">{brand.name}</h1>
                {brand.tagline && (
                  <p className="text-sm text-gray-500 italic mb-2">&ldquo;{brand.tagline}&rdquo;</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {brand.countryOfOrigin && (
                    <span className="flex items-center gap-1">
                      <span>{getEmoji(brand.countryOfOrigin)}</span>
                      {brand.countryOfOrigin}
                      {brand.region && `, ${brand.region}`}
                    </span>
                  )}
                  {brand.founded && (
                    <span className="flex items-center gap-1">
                      <Icon.PiCalendar size={12} />
                      Est. {brand.founded}
                    </span>
                  )}
                  {brand.primaryCategory && (
                    <span className="capitalize px-2 py-0.5 bg-gray-100 rounded-full font-medium">
                      {brand.primaryCategory.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* CTA */}
              <Link
                href={shopLink}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow transition-all hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                <Icon.PiShoppingCart size={16} />
                Shop {brand.productCount ? `${brand.productCount} Products` : 'Now'}
              </Link>
            </div>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-16">

          {/* Left: About */}
          <div className="lg:col-span-2 space-y-6">

            {/* Description */}
            {(brand.description || brand.shortDescription) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Icon.PiInfo size={18} style={{ color }} />
                  About {brand.name}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {brand.description || brand.shortDescription}
                </p>
              </div>
            )}

            {/* Story */}
            {brand.story && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Icon.PiBookOpenText size={18} style={{ color }} />
                  Brand Story
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {brand.story}
                </p>
              </div>
            )}

            {/* Specializations */}
            {brand.specializations && brand.specializations.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Icon.PiStar size={18} style={{ color }} />
                  Specializations
                </h2>
                <div className="flex flex-wrap gap-2">
                  {brand.specializations.map(s => (
                    <span key={s} className="px-3 py-1 text-xs font-medium rounded-full border"
                      style={{ borderColor: color, color }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Side info */}
          <div className="space-y-6">

            {/* Quick facts */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Facts</h3>
              <ul className="space-y-3">
                {brand.productCount != null && (
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Icon.PiWine size={15} /> Products</span>
                    <span className="font-semibold text-gray-900">{brand.productCount}</span>
                  </li>
                )}
                {brand.countryOfOrigin && (
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Icon.PiMapPin size={15} /> Origin</span>
                    <span className="font-semibold text-gray-900">{brand.countryOfOrigin}</span>
                  </li>
                )}
                {brand.founded && (
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Icon.PiCalendar size={15} /> Founded</span>
                    <span className="font-semibold text-gray-900">{brand.founded}</span>
                  </li>
                )}
                {brand.founderName && (
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Icon.PiUser size={15} /> Founder</span>
                    <span className="font-semibold text-gray-900">{brand.founderName}</span>
                  </li>
                )}
                {brand.brandType && (
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Icon.PiTag size={15} /> Type</span>
                    <span className="font-semibold text-gray-900 capitalize">{brand.brandType.replace(/_/g, ' ')}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Links */}
            {(brand.website || brand.socialMedia?.instagram || brand.socialMedia?.facebook || brand.socialMedia?.twitter || brand.socialMedia?.youtube) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Links</h3>
                <ul className="space-y-2">
                  {brand.website && (
                    <li>
                      <a href={brand.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        <Icon.PiGlobe size={15} /> Official Website
                      </a>
                    </li>
                  )}
                  {brand.socialMedia?.instagram && (
                    <li>
                      <a href={brand.socialMedia.instagram} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-pink-600 transition-colors">
                        <Icon.PiInstagramLogo size={15} /> Instagram
                      </a>
                    </li>
                  )}
                  {brand.socialMedia?.facebook && (
                    <li>
                      <a href={brand.socialMedia.facebook} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                        <Icon.PiFacebookLogo size={15} /> Facebook
                      </a>
                    </li>
                  )}
                  {brand.socialMedia?.twitter && (
                    <li>
                      <a href={brand.socialMedia.twitter} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-sky-500 transition-colors">
                        <Icon.PiTwitterLogo size={15} /> Twitter / X
                      </a>
                    </li>
                  )}
                  {brand.socialMedia?.youtube && (
                    <li>
                      <a href={brand.socialMedia.youtube} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors">
                        <Icon.PiYoutubeLogo size={15} /> YouTube
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Shop CTA */}
            <Link
              href={shopLink}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              <Icon.PiShoppingCart size={16} />
              Browse All {brand.name} Products
            </Link>

            <Link
              href="/brands"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-gray-600 bg-white border border-gray-200 hover:border-gray-300 transition-all"
            >
              <Icon.PiArrowLeft size={15} />
              All Brands
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
