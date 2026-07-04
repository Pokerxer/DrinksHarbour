'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { useLoyalty } from '../_hooks/useLoyalty';
import type { LoyaltyTier, LoyaltyTransaction } from '../_types';
import { fmtNgn, fmtDateTime, fmtDate } from '../_components/format';

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER: Record<LoyaltyTier, {
  name: string; subtitle: string; multiplier: string;
  gradient: string; lightText: string; accentText: string;
  ringColor: string; badgeBg: string; threshold: number;
}> = {
  cork: {
    name: 'Cork', subtitle: 'Standard member',
    multiplier: '1×',
    gradient: 'linear-gradient(135deg, #78350f 0%, #b45309 40%, #d97706 100%)',
    lightText: 'rgba(255,255,255,0.75)', accentText: '#fde68a',
    ringColor: '#f59e0b', badgeBg: 'rgba(251,191,36,0.15)',
    threshold: 0,
  },
  barrel: {
    name: 'Barrel', subtitle: 'Loyal member',
    multiplier: '1.1×',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 45%, #3b82f6 100%)',
    lightText: 'rgba(255,255,255,0.75)', accentText: '#bfdbfe',
    ringColor: '#3b82f6', badgeBg: 'rgba(59,130,246,0.15)',
    threshold: 50000,
  },
  cellar: {
    name: 'Cellar', subtitle: 'Premium member',
    multiplier: '1.25×',
    gradient: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 45%, #a78bfa 100%)',
    lightText: 'rgba(255,255,255,0.75)', accentText: '#e9d5ff',
    ringColor: '#7c3aed', badgeBg: 'rgba(124,58,237,0.15)',
    threshold: 150000,
  },
  vault: {
    name: 'Vault', subtitle: 'Elite member',
    multiplier: '1.5×',
    gradient: 'linear-gradient(135deg, #0f0f0f 0%, #1c1c1c 45%, #2d2d2d 100%)',
    lightText: 'rgba(255,255,255,0.65)', accentText: '#fde68a',
    ringColor: '#f59e0b', badgeBg: 'rgba(251,191,36,0.12)',
    threshold: 500000,
  },
};

const TIER_ORDER: LoyaltyTier[] = ['cork', 'barrel', 'cellar', 'vault'];

// ── Transaction config ────────────────────────────────────────────────────────

const TX_CFG: Record<string, { label: string; sign: string; dotBg: string; dotText: string; icon: any }> = {
  earn:       { label: 'Earned',     sign: '+', dotBg: 'bg-green-50',  dotText: 'text-green-600',  icon: Icon.PiCoinsBold },
  bonus:      { label: 'Bonus',      sign: '+', dotBg: 'bg-emerald-50',dotText: 'text-emerald-600',icon: Icon.PiSparkleBold },
  referral:   { label: 'Referral',   sign: '+', dotBg: 'bg-purple-50', dotText: 'text-purple-600', icon: Icon.PiShareNetworkBold },
  redeem:     { label: 'Redeemed',   sign: '-', dotBg: 'bg-red-50',    dotText: 'text-red-600',    icon: Icon.PiWalletBold },
  expiry:     { label: 'Expired',    sign: '-', dotBg: 'bg-stone-100', dotText: 'text-stone-400',  icon: Icon.PiTimerBold },
  adjustment: { label: 'Adjustment', sign: '',  dotBg: 'bg-amber-50',  dotText: 'text-amber-600',  icon: Icon.PiSlidersBold },
};

const TX_FILTERS = [
  { key: 'all',   label: 'All' },
  { key: 'earn',  label: 'Earned' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'referral', label: 'Referral' },
  { key: 'redeem', label: 'Redeemed' },
  { key: 'expiry', label: 'Expired' },
];

// ── Membership card ───────────────────────────────────────────────────────────

function MembershipCard({ tier, points, lifetimePoints, multiplier, nextTier, nextThreshold, progress, onRedeem, canRedeem }:
  { tier: LoyaltyTier; points: number; lifetimePoints: number; multiplier: number; nextTier: LoyaltyTier | null; nextThreshold: number | null; progress: number; onRedeem: () => void; canRedeem: boolean }) {
  const t = TIER[tier];
  const nt = nextTier ? TIER[nextTier] : null;
  const ptsToNext = nextThreshold ? Math.max(nextThreshold - lifetimePoints, 0) : 0;

  return (
    <div style={{ background: t.gradient }} className="relative rounded-2xl overflow-hidden text-white shadow-2xl">
      {/* Light bloom */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 55%)' }} />
      {/* Diagonal sheen */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 45%, rgba(255,255,255,0.03) 60%, transparent 80%)' }} />
      {/* Pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 20px)' }} />

      <div className="relative z-10 p-6">
        {/* Top row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/images/favicon.png" alt="DrinksHarbour" className="w-4 h-4 opacity-90 brightness-150" />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: t.lightText }}>DrinksHarbour</span>
            </div>
            <p className="text-3xl font-black tracking-tight">{t.name}</p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: t.lightText }}>{t.subtitle}</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: t.badgeBg, color: t.accentText, border: `1px solid ${t.ringColor}40` }}>
              <Icon.PiCoinsBold size={12} /> {multiplier}× earn
            </div>
          </div>
        </div>

        {/* Points center */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: t.lightText }}>Available Points</p>
          <p className="text-5xl font-black leading-none">{points.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: t.lightText }}>{lifetimePoints.toLocaleString()} lifetime pts</p>
        </div>

        {/* Progress to next tier */}
        {nt && nextThreshold ? (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span style={{ color: t.lightText }}>Progress to {nt.name}</span>
              <span className="font-bold">{ptsToNext.toLocaleString()} pts to go</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: t.accentText }} />
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2">
            <Icon.PiCrownSimpleBold size={14} style={{ color: t.accentText }} />
            <span className="text-xs font-semibold" style={{ color: t.accentText }}>You're at the top tier — Vault Elite</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onRedeem} disabled={!canRedeem}
            className="flex-1 flex items-center justify-center gap-2 bg-white/95 text-stone-900 rounded-xl py-2.5 font-bold text-sm hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
            <Icon.PiWalletBold size={14} /> Redeem to Wallet
          </button>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Icon.PiCrownSimpleBold size={13} />
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tier progression timeline ─────────────────────────────────────────────────

function TierTimeline({ currentTier, lifetimePoints }: { currentTier: LoyaltyTier; lifetimePoints: number }) {
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
      <h2 className="font-black text-stone-900 text-sm mb-4 flex items-center gap-2">
        <Icon.PiMedalBold size={15} className="text-red-700" /> Tier Progression
      </h2>
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {TIER_ORDER.map((t, idx) => {
          const meta = TIER[t];
          const unlocked = lifetimePoints >= meta.threshold;
          const active = t === currentTier;
          const isLast = idx === TIER_ORDER.length - 1;
          return (
            <React.Fragment key={t}>
              <div className="flex flex-col items-center min-w-[72px]">
                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${active ? 'ring-4 ring-offset-2 shadow-lg' : ''}`}
                  style={{
                    background: unlocked ? meta.gradient : undefined,
                    backgroundColor: unlocked ? undefined : '#f5f5f4',
                    ringColor: active ? meta.ringColor : undefined,
                  }}>
                  {unlocked
                    ? <Icon.PiCrownSimpleBold size={20} className="text-white" />
                    : <Icon.PiLockSimpleBold size={18} className="text-stone-300" />
                  }
                  {active && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                      <Icon.PiCheckBold size={8} className="text-white" />
                    </span>
                  )}
                </div>
                <p className={`text-xs font-black ${unlocked ? 'text-stone-800' : 'text-stone-300'}`}>{meta.name}</p>
                <p className={`text-[10px] mt-0.5 text-center leading-tight ${unlocked ? 'text-stone-400' : 'text-stone-300'}`}>
                  {meta.threshold === 0 ? 'Start' : `${meta.threshold.toLocaleString()} pts`}
                </p>
                <p className={`text-[9px] font-bold mt-1 ${unlocked ? 'text-stone-600' : 'text-stone-300'}`}>{meta.multiplier}</p>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mb-6 mx-1 min-w-[16px] rounded-full ${TIER_ORDER.indexOf(currentTier) > idx ? 'bg-stone-800' : 'bg-stone-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Value panel ───────────────────────────────────────────────────────────────

function PointsValuePanel({ points, rate, minRedeem, multiplier }: { points: number; rate: number; minRedeem: number; multiplier: number }) {
  const value = Math.floor(points * rate);
  const redeemablePoints = Math.floor(points / 50) * 50;
  const redeemableValue = Math.floor(redeemablePoints * rate);
  const canRedeem = points >= minRedeem;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
            <Icon.PiCoinsBold size={17} className="text-amber-600" />
          </div>
          <p className="text-xs text-stone-400 font-medium">Points value</p>
          <p className="text-xl font-black text-stone-900 mt-0.5">{fmtNgn(value)}</p>
          <p className="text-[10px] text-stone-400 mt-1">at ₦{rate.toFixed(2)}/pt</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${canRedeem ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${canRedeem ? 'bg-green-100' : 'bg-stone-100'}`}>
            <Icon.PiWalletBold size={17} className={canRedeem ? 'text-green-600' : 'text-stone-400'} />
          </div>
          <p className={`text-xs font-medium ${canRedeem ? 'text-green-700' : 'text-stone-400'}`}>Redeemable now</p>
          <p className={`text-xl font-black mt-0.5 ${canRedeem ? 'text-green-700' : 'text-stone-300'}`}>{fmtNgn(redeemableValue)}</p>
          <p className={`text-[10px] mt-1 ${canRedeem ? 'text-green-600' : 'text-stone-400'}`}>{redeemablePoints.toLocaleString()} pts</p>
        </div>
      </div>
      {/* Earn rate strip */}
      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
        <Icon.PiShoppingCartBold size={14} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 flex-1">
          You earn <strong>1 pt per ₦100 spent</strong>
          {multiplier !== 1 && <span className="text-blue-500"> × <strong>{multiplier}</strong> tier bonus</span>}
          {' '}— points credited automatically on every paid order.
        </p>
      </div>
    </div>
  );
}

// ── Ways to earn ──────────────────────────────────────────────────────────────

function WaysToEarn({ multiplier, rate, minRedeem, step }: { multiplier: number; rate: number; minRedeem: number; step: number }) {
  const effectiveRate = multiplier !== 1 ? `1 pt per ₦100 × ${multiplier} tier bonus` : '1 pt per ₦100 spent';
  const ways = [
    { icon: Icon.PiShoppingCartBold, color: 'bg-blue-50 text-blue-600', title: 'Shop & earn', body: `${effectiveRate} on every paid order — points credited automatically at checkout.` },
    { icon: Icon.PiWalletBold, color: 'bg-green-50 text-green-600', title: 'Redeem to wallet', body: `Convert from ${minRedeem} pts (in steps of ${step}) at ₦${rate.toFixed(2)}/pt — credited to your DH Wallet.` },
    { icon: Icon.PiShareNetworkBold, color: 'bg-purple-50 text-purple-600', title: 'Refer a friend', body: 'Both you and your friend earn 500 bonus points on their first order.' },
    { icon: Icon.PiMedalBold, color: 'bg-amber-50 text-amber-600', title: 'Climb the tiers', body: 'Barrel 1.1×, Cellar 1.25×, Vault 1.5× — earn faster as your lifetime points grow.' },
  ];
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
      <h2 className="font-black text-stone-900 text-sm mb-4 flex items-center gap-2">
        <Icon.PiLightningBold size={15} className="text-red-700" /> Ways to earn
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {ways.map(w => (
          <div key={w.title} className="flex gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${w.color}`}>
              <w.icon size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">{w.title}</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{w.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Referral card ─────────────────────────────────────────────────────────────

function ReferralCard({ code, link, bonusEarned, onGetCode, onApply }:
  { code: string | null; link?: string; bonusEarned: number; onGetCode: () => void; onApply: (code: string) => Promise<{ ok: boolean; message?: string }> }) {
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [applying, setApplying] = useState(false);

  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(link || code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleApply = async () => {
    if (!applyCode.trim()) return;
    setApplying(true);
    const res = await onApply(applyCode.trim());
    setApplying(false);
    setApplyMsg({ ok: res.ok, text: res.ok ? 'Referral applied — bonus awarded!' : (res.message || 'Invalid code') });
    if (res.ok) setApplyCode('');
    setTimeout(() => setApplyMsg(null), 5000);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiShareNetworkBold size={15} className="text-red-700" /> Refer &amp; Earn
        </h3>
        {bonusEarned > 0 && (
          <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full">
            +{bonusEarned.toLocaleString()} earned
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-stone-500 leading-relaxed">
          Share your referral link — your friend gets <strong className="text-stone-700">500 pts</strong> on signup and you earn <strong className="text-stone-700">500 pts</strong> when they place their first order.
        </p>

        {code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
              <Icon.PiLinkBold size={14} className="text-stone-400 flex-shrink-0" />
              <code className="flex-1 font-mono text-xs text-stone-700 truncate">{link || code}</code>
              <button onClick={copy}
                className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-red-700 bg-white px-3 py-1.5 rounded-lg border border-stone-200 flex-shrink-0 transition-colors">
                {copied ? <Icon.PiCheckBold size={11} className="text-green-600" /> : <Icon.PiCopyBold size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
              <Icon.PiTagBold size={12} className="text-purple-500" />
              <span className="text-xs text-purple-700">Your code: <strong className="font-mono tracking-widest">{code}</strong></span>
            </div>
          </div>
        ) : (
          <button onClick={onGetCode}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-800 transition-all">
            <Icon.PiSparkleBold size={14} /> Generate my referral code
          </button>
        )}

        <div className="border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold text-stone-600 mb-2">Have a referral code? Apply it here:</p>
          <div className="flex gap-2">
            <input value={applyCode} onChange={e => setApplyCode(e.target.value.toUpperCase())}
              placeholder="DH-XXXXXX"
              className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 outline-none font-mono uppercase tracking-widest" />
            <button onClick={handleApply} disabled={applying || !applyCode.trim()}
              className="bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-red-800 disabled:opacity-50 transition-all">
              {applying ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : 'Apply'}
            </button>
          </div>
          {applyMsg && (
            <p className={`text-xs mt-2 font-semibold ${applyMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
              {applyMsg.ok ? <Icon.PiCheckCircleBold className="inline mr-1" size={12} /> : <Icon.PiWarningBold className="inline mr-1" size={12} />}
              {applyMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Redeem modal ──────────────────────────────────────────────────────────────

function RedeemModal({ open, onClose, onRedeem, points, rate, min, step }:
  { open: boolean; onClose: () => void; onRedeem: (p: number) => Promise<{ ok: boolean; amountCredited?: number; message?: string }>; points: number; rate: number; min: number; step: number }) {
  const [value, setValue] = useState(min);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ amount: number; points: number } | null>(null);

  if (!open) return null;

  const maxPoints = Math.floor(points / step) * step;
  const redeemable = Math.max(Math.min(value, maxPoints), 0);
  const ngnValue = Math.floor(redeemable * rate);
  const pct = maxPoints > 0 ? (redeemable / maxPoints) * 100 : 0;

  const handleRedeem = async () => {
    if (redeemable < min) { setError(`Minimum redeemable is ${min} points`); return; }
    setSubmitting(true); setError(null);
    const res = await onRedeem(redeemable);
    setSubmitting(false);
    if (!res.ok) { setError(res.message || 'Redemption failed'); return; }
    setSuccess({ amount: res.amountCredited || ngnValue, points: redeemable });
  };

  const close = () => { setSuccess(null); setError(null); setValue(min); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-stone-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-black text-stone-900 flex items-center gap-2">
            <Icon.PiCoinsBold size={18} className="text-red-700" /> Redeem Points
          </h3>
          <button onClick={close} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors">
            <Icon.PiXBold size={15} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 border-4 border-green-100 flex items-center justify-center mx-auto mb-4">
              <Icon.PiCheckCircleBold size={28} className="text-green-600" />
            </div>
            <p className="font-black text-stone-900 text-xl">{fmtNgn(success.amount)}</p>
            <p className="text-stone-500 text-sm mt-1">added to your wallet</p>
            <p className="text-xs text-stone-400 mt-1">{success.points.toLocaleString()} points redeemed</p>
            <button onClick={close} className="mt-6 bg-stone-900 text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-800 transition-all">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Balance row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-50 rounded-xl p-3.5">
                <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mb-1">Available</p>
                <p className="font-black text-stone-900 text-lg leading-tight">{points.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">points</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3.5">
                <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wider mb-1">You receive</p>
                <p className="font-black text-green-700 text-lg leading-tight">{fmtNgn(ngnValue)}</p>
                <p className="text-[10px] text-green-600">wallet credit</p>
              </div>
            </div>

            {/* Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-stone-600">Points to redeem</p>
                <span className="font-black text-red-700 text-sm">{redeemable.toLocaleString()} pts</span>
              </div>
              <div className="relative">
                <input type="range" min={min} max={maxPoints || min} step={step} value={redeemable}
                  onChange={e => setValue(Number(e.target.value))}
                  className="w-full accent-red-700 cursor-pointer" />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-stone-400">{min.toLocaleString()} min</span>
                  <span className="text-[10px] text-stone-400 font-medium">in steps of {step}</span>
                  <span className="text-[10px] text-stone-400">{maxPoints.toLocaleString()} max</span>
                </div>
              </div>
            </div>

            {/* Rate note */}
            <div className="flex gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3.5">
              <Icon.PiInfoBold size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Points convert at <strong>₦{rate.toFixed(2)} per point</strong>. Credited directly to your platform wallet — redeemable at checkout.
              </p>
            </div>

            {error && (
              <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <Icon.PiWarningBold size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button onClick={handleRedeem} disabled={submitting || redeemable < min}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60 shadow-lg shadow-red-900/20">
              {submitting
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon.PiWalletBold size={15} />}
              {submitting ? 'Redeeming…' : `Redeem ${redeemable.toLocaleString()} pts → ${fmtNgn(ngnValue)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transaction list ──────────────────────────────────────────────────────────

function TransactionList({ transactions, loading, page, totalPages, onPage }:
  { transactions: LoyaltyTransaction[]; loading: boolean; page: number; totalPages: number; onPage: (p: number) => void }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header + filters */}
      <div className="px-5 py-4 border-b border-stone-100 space-y-3">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiReceiptBold size={15} className="text-red-700" /> Points Activity
        </h2>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          {TX_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filter === f.key
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && transactions.length === 0 ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-stone-100 animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Icon.PiClockCountdownBold size={36} className="mx-auto text-stone-200 mb-3" />
          <p className="font-semibold text-stone-600 mb-1">No {filter === 'all' ? '' : filter} activity yet</p>
          <p className="text-sm text-stone-400">Earn points on your next order to get started.</p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {filtered.map(t => {
            const cfg = TX_CFG[t.type] || TX_CFG.adjustment;
            const Ico = cfg.icon;
            const isPositive = cfg.sign === '+';
            return (
              <li key={t._id} className="px-5 py-3.5 flex items-center gap-3.5 hover:bg-stone-50/60 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.dotBg}`}>
                  <Ico size={15} className={cfg.dotText} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{t.reason || cfg.label}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{fmtDateTime(t.createdAt)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-black ${isPositive ? 'text-green-600' : cfg.sign === '-' ? 'text-red-600' : 'text-stone-500'}`}>
                    {cfg.sign}{Math.abs(t.points).toLocaleString()} pts
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{t.balanceAfter.toLocaleString()} bal</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100 bg-stone-50/50">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)}
            className="flex items-center gap-1 text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700 transition-colors">
            <Icon.PiArrowLeftBold size={11} /> Previous
          </button>
          <span className="text-xs text-stone-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
            className="flex items-center gap-1 text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700 transition-colors">
            Next <Icon.PiArrowRightBold size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const { token } = useAccount();
  const { loyalty, loading, transactions, txLoading, txPage, txTotalPages, fetchTransactions, redeem, getReferralCode, applyReferral } = useLoyalty(token);
  const [redeemOpen, setRedeemOpen] = useState(false);

  // Load first page of transactions alongside the summary
  React.useEffect(() => { fetchTransactions(1); }, [fetchTransactions]);

  if (loading && !loyalty) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }
  if (!loyalty) return null;

  const referralLink = loyalty.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://drinksharbour.com'}/register?ref=${loyalty.referralCode}`
    : undefined;

  const canRedeem = loyalty.points >= loyalty.minRedeemPoints;

  return (
    <div className="space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-black text-stone-900">Corks &amp; Points</h1>
        <p className="text-sm text-stone-500 mt-0.5">Earn 1 point per ₦100 spent on every paid order — redeem for wallet credit.</p>
      </div>

      {/* Membership card */}
      <MembershipCard
        tier={loyalty.tier}
        points={loyalty.points}
        lifetimePoints={loyalty.lifetimePoints}
        multiplier={loyalty.earnMultiplier}
        nextTier={loyalty.nextTier}
        nextThreshold={loyalty.nextThreshold}
        progress={loyalty.progress}
        onRedeem={() => setRedeemOpen(true)}
        canRedeem={canRedeem}
      />

      {/* Points value + redeemable */}
      <PointsValuePanel
        points={loyalty.points}
        rate={loyalty.redeemRateNgnPerPoint}
        minRedeem={loyalty.minRedeemPoints}
        multiplier={loyalty.earnMultiplier}
      />

      {/* Tier progression */}
      <TierTimeline currentTier={loyalty.tier} lifetimePoints={loyalty.lifetimePoints} />

      {/* Ways to earn */}
      <WaysToEarn
        multiplier={loyalty.earnMultiplier}
        rate={loyalty.redeemRateNgnPerPoint}
        minRedeem={loyalty.minRedeemPoints}
        step={loyalty.redeemStepPoints}
      />

      {/* Referral */}
      <ReferralCard
        code={loyalty.referralCode}
        link={referralLink}
        bonusEarned={loyalty.referralBonusEarned}
        onGetCode={getReferralCode}
        onApply={applyReferral}
      />

      {/* Activity */}
      <TransactionList
        transactions={transactions}
        loading={txLoading}
        page={txPage}
        totalPages={txTotalPages}
        onPage={fetchTransactions}
      />

      <RedeemModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeem={redeem}
        points={loyalty.points}
        rate={loyalty.redeemRateNgnPerPoint}
        min={loyalty.minRedeemPoints}
        step={loyalty.redeemStepPoints}
      />
    </div>
  );
}
