'use client';

import React, { useState } from 'react';

// ── Tier definitions ─────────────────────────────────────────────────────────

const TIER_BG: Record<string, string> = {
  classic:   'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
  silver:    'linear-gradient(135deg, #2c2c2c 0%, #4a4a4a 35%, #1a1a1a 70%, #3d3d3d 100%)',
  gold:      'linear-gradient(135deg, #3d2b1f 0%, #8B6914 25%, #c9a227 55%, #7a5c10 80%, #3d2b1f 100%)',
  platinum:  'linear-gradient(135deg, #0d0d0d 0%, #2a2a2a 30%, #4a4a4a 55%, #1e1e1e 80%, #0d0d0d 100%)',
  premium:   'linear-gradient(135deg, #1a0533 0%, #2d0f5e 35%, #4a1a8a 60%, #1a0533 100%)',
  black:     'linear-gradient(135deg, #050505 0%, #111111 30%, #0a0a0a 60%, #1a1a1a 100%)',
};

const TIER_ACCENT: Record<string, string> = {
  classic:  'rgba(147,197,253,0.9)',
  silver:   'rgba(209,213,219,0.9)',
  gold:     'rgba(251,191,36,0.95)',
  platinum: 'rgba(229,231,235,0.95)',
  premium:  'rgba(196,181,253,0.95)',
  black:    'rgba(251,191,36,0.9)',
};

const TIER_CIRCLE_A: Record<string, string> = {
  classic:  'rgba(59,130,246,0.75)',
  silver:   'rgba(156,163,175,0.75)',
  gold:     'rgba(245,158,11,0.8)',
  platinum: 'rgba(209,213,219,0.8)',
  premium:  'rgba(139,92,246,0.8)',
  black:    'rgba(251,191,36,0.8)',
};

const TIER_CIRCLE_B: Record<string, string> = {
  classic:  'rgba(37,99,235,0.55)',
  silver:   'rgba(107,114,128,0.55)',
  gold:     'rgba(180,83,9,0.6)',
  platinum: 'rgba(107,114,128,0.6)',
  premium:  'rgba(109,40,217,0.6)',
  black:    'rgba(180,83,9,0.6)',
};

const TIER_LABEL: Record<string, string> = {
  classic:  'Classic',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
  premium:  'Premium',
  black:    'Black',
};

function resolveTier(tierId?: string, amount = 0): string {
  if (tierId && TIER_BG[tierId]) return tierId;
  if (amount >= 5_000_000) return 'black';
  if (amount >= 2_000_000) return 'premium';
  if (amount >= 1_000_000) return 'platinum';
  if (amount >= 500_000)   return 'gold';
  if (amount >= 200_000)   return 'silver';
  return 'classic';
}

function fmtNgn(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── EMV Chip ──────────────────────────────────────────────────────────────────

function ChipIcon() {
  return (
    <svg width="38" height="30" viewBox="0 0 38 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chipGold" x1="0" y1="0" x2="38" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5d769" />
          <stop offset="0.4" stopColor="#c9a227" />
          <stop offset="1" stopColor="#8B6914" />
        </linearGradient>
      </defs>
      <rect width="38" height="30" rx="4" fill="url(#chipGold)" />
      <rect x="13" y="0"  width="12" height="8"  rx="1" fill="rgba(0,0,0,0.25)" />
      <rect x="0"  y="11" width="11" height="8"  rx="1" fill="rgba(0,0,0,0.25)" />
      <rect x="13" y="11" width="12" height="8"  rx="1" fill="rgba(0,0,0,0.18)" />
      <rect x="27" y="11" width="11" height="8"  rx="1" fill="rgba(0,0,0,0.25)" />
      <rect x="13" y="22" width="12" height="8"  rx="1" fill="rgba(0,0,0,0.25)" />
      <line x1="0"  y1="11" x2="38" y2="11" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <line x1="0"  y1="19" x2="38" y2="19" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <line x1="13" y1="0"  x2="13" y2="30" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <line x1="25" y1="0"  x2="25" y2="30" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
    </svg>
  );
}

// ── Contactless symbol ────────────────────────────────────────────────────────

function ContactlessIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="18" r="2" fill={color} />
      <path d="M6 14 C6 11 8.5 8.5 11 8.5 C13.5 8.5 16 11 16 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M3 11 C3 6.5 6.5 3 11 3 C15.5 3 19 6.5 19 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}

// ── Magnetic stripe ───────────────────────────────────────────────────────────

function MagStripe() {
  return (
    <div style={{
      height: 44,
      background: 'linear-gradient(180deg, #0a0a0a 0%, #000 50%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 8px)' }} />
    </div>
  );
}

// ── Bottom barcode-number strip ───────────────────────────────────────────────

function BarcodeStrip({ cardNumber }: { cardNumber?: string | null }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '0 0 14px 14px',
      padding: '5px 14px 7px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.20em',
        color: '#111',
      }}>
        {cardNumber || '•••• •••• •••• ••••'}
      </span>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface PremiumGiftCardProps {
  amount: number;
  tierId?: string;
  code?: string | null;
  cardNumber?: string | null;
  balance?: number;
  tilt?: boolean;
  qrDataUrl?: string | null;
  showFlip?: boolean;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PremiumGiftCard({
  amount,
  tierId,
  code,
  cardNumber,
  balance,
  tilt = true,
  qrDataUrl,
  showFlip = true,
}: PremiumGiftCardProps) {
  const [flipped, setFlipped] = useState(false);
  const tier = resolveTier(tierId, amount);
  const bg = TIER_BG[tier];
  const accent = TIER_ACCENT[tier];
  const circleA = TIER_CIRCLE_A[tier];
  const circleB = TIER_CIRCLE_B[tier];
  const displayBalance = balance ?? amount;
  const tierLabel = TIER_LABEL[tier] ?? 'Gift';

  const baseTransform = tilt
    ? 'perspective(1100px) rotateY(-7deg) rotateX(4deg)'
    : 'none';
  const cardTransform = flipped
    ? 'perspective(1100px) rotateY(180deg)'
    : baseTransform;

  const cardShadow = tilt
    ? '8px 20px 52px rgba(0,0,0,0.50), 2px 6px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)'
    : '0 10px 30px rgba(0,0,0,0.28)';

  const faceBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 14,
    overflow: 'hidden',
  };

  return (
    <div style={{ perspective: '1100px', userSelect: 'none' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1.586 / 1',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4,0.2,0.2,1)',
          transform: cardTransform,
          boxShadow: cardShadow,
          borderRadius: 14,
          cursor: showFlip ? 'pointer' : 'default',
        }}
        onClick={() => showFlip && setFlipped(f => !f)}
      >
        {/* ── FRONT ── */}
        <div style={{ ...faceBase, background: bg }}>
          {/* Studio light bloom */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 18% 18%, rgba(255,255,255,0.13) 0%, transparent 55%)', pointerEvents: 'none' }} />
          {/* Diagonal sheen */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 42%, rgba(255,255,255,0.03) 58%, transparent 78%)', pointerEvents: 'none' }} />
          {/* Bottom vignette */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.50) 100%)', pointerEvents: 'none' }} />
          {/* Inset bevel */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px 10px' }}>

              {/* Brand + tier */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/favicon.png" alt="DrinksHarbour" style={{ width: 15, height: 15, opacity: 0.9, filter: 'brightness(1.5)' }} />
                  <span style={{ color: accent, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>DrinksHarbour</span>
                </div>
                <span style={{ color: accent, fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.65 }}>{tierLabel}</span>
              </div>

              {/* Chip + contactless */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <ChipIcon />
                <ContactlessIcon color={accent} />
              </div>

              {/* 16-digit number — ATM center position */}
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <div style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  color: 'rgba(255,255,255,0.92)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                }}>
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
              </div>

              {/* Balance + circles */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 7, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>
                    {balance !== undefined && balance !== amount ? 'Available balance' : 'Card value'}
                  </div>
                  <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1 }}>
                    {fmtNgn(displayBalance)}
                  </div>
                  {balance !== undefined && balance !== amount && (
                    <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 7.5, marginTop: 1 }}>of {fmtNgn(amount)}</div>
                  )}
                </div>
                {/* Overlapping circles */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: circleA, position: 'relative', zIndex: 2 }} />
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: circleB, marginLeft: -10, position: 'relative', zIndex: 1 }} />
                </div>
              </div>

              {showFlip && (
                <div style={{ marginTop: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 6.5, letterSpacing: '0.10em', textTransform: 'uppercase' }}>tap to flip</span>
                </div>
              )}
            </div>

            {/* Bottom barcode strip — shows 16-digit number */}
            <BarcodeStrip cardNumber={cardNumber} />
          </div>
        </div>

        {/* ── BACK ── */}
        <div style={{ ...faceBase, transform: 'rotateY(180deg)', background: 'linear-gradient(140deg, #181818 0%, #252525 50%, #181818 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 85% 15%, rgba(255,255,255,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Magnetic stripe at very top */}
            <div style={{ marginTop: 18 }}>
              <MagStripe />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 16px 14px', gap: 8 }}>
              {/* Signature strip */}
              <div style={{
                background: 'repeating-linear-gradient(90deg, #ddd 0px, #ddd 14px, #fff 14px, #fff 16px)',
                borderRadius: 3,
                padding: '4px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 6.5, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Authorized Signature</span>
                <span style={{ fontFamily: 'cursive', fontSize: 9, color: '#333', opacity: 0.75 }}>DrinksHarbour</span>
              </div>

              {/* QR area — centered */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {qrDataUrl ? (
                  <div style={{ background: '#fff', padding: 7, borderRadius: 8, boxShadow: '0 3px 10px rgba(0,0,0,0.5)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Scan to redeem" style={{ width: 82, height: 82, display: 'block' }} />
                  </div>
                ) : (
                  <div style={{
                    background: '#fff', padding: 7, borderRadius: 8,
                    boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
                    width: 96, height: 96,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2"  y="2"  width="22" height="22" rx="2" fill="none" stroke="#111" strokeWidth="3" />
                      <rect x="8"  y="8"  width="10" height="10" fill="#111" />
                      <rect x="56" y="2"  width="22" height="22" rx="2" fill="none" stroke="#111" strokeWidth="3" />
                      <rect x="62" y="8"  width="10" height="10" fill="#111" />
                      <rect x="2"  y="56" width="22" height="22" rx="2" fill="none" stroke="#111" strokeWidth="3" />
                      <rect x="8"  y="62" width="10" height="10" fill="#111" />
                      <rect x="32" y="2"  width="4"  height="4"  fill="#111" />
                      <rect x="38" y="2"  width="8"  height="4"  fill="#111" />
                      <rect x="32" y="8"  width="8"  height="4"  fill="#111" />
                      <rect x="32" y="32" width="16" height="4"  fill="#111" />
                      <rect x="32" y="38" width="4"  height="16" fill="#111" />
                      <rect x="44" y="44" width="10" height="4"  fill="#111" />
                      <rect x="56" y="32" width="22" height="4"  fill="#111" />
                      <rect x="56" y="38" width="4"  height="10" fill="#111" />
                      <rect x="62" y="50" width="16" height="4"  fill="#111" />
                    </svg>
                  </div>
                )}
                <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: 7.5, letterSpacing: '0.10em', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.5 }}>
                  {qrDataUrl ? 'Scan to redeem at any DrinksHarbour store' : 'QR activates after payment'}
                </span>
              </div>

              {/* Card number + code at bottom */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8.5, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.14em' }}>
                  {cardNumber || '•••• •••• •••• ••••'}
                </span>
                {code && (
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>
                    {code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFlip && (
        <p style={{ textAlign: 'center', fontSize: 10.5, color: 'rgba(0,0,0,0.32)', marginTop: 8, letterSpacing: '0.05em' }}>
          {flipped ? 'Back — tap card to flip' : 'Front — tap card to flip'}
        </p>
      )}
    </div>
  );
}
