'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { useLoyalty } from '../_hooks/useLoyalty';
import type { LoyaltyTier } from '../_types';
import { fmtNgn, fmtDateTime } from '../_components/format';

const TIER_META: Record<LoyaltyTier, { name: string; color: string; bg: string; icon: any; perk: string }> = {
  cork:   { name: 'Cork',   color: 'text-amber-700', bg: 'from-amber-500 to-amber-700', icon: Icon.PiCrownBold, perk: '1× earn rate · standard rewards' },
  barrel: { name: 'Barrel',  color: 'text-blue-700',  bg: 'from-blue-600 to-blue-800',   icon: Icon.PiCrownBold, perk: '1.1× earn rate · early access to drops' },
  cellar: { name: 'Cellar',  color: 'text-purple-700',bg: 'from-purple-600 to-purple-800',icon: Icon.PiCrownBold, perk: '1.25× earn rate · exclusive tastings' },
  vault:  { name: 'Vault',   color: 'text-stone-900',bg: 'from-stone-800 to-stone-950',  icon: Icon.PiCrownBold, perk: '1.5× earn rate · concierge & priority' },
};

const TX_META: Record<string, { label: string; color: string; sign: string }> = {
  earn:      { label: 'Earned',     color: 'text-green-700', sign: '+' },
  bonus:     { label: 'Bonus',      color: 'text-green-700', sign: '+' },
  referral:  { label: 'Referral',   color: 'text-purple-700', sign: '+' },
  redeem:    { label: 'Redeemed',   color: 'text-red-700',    sign: '-' },
  expiry:    { label: 'Expired',    color: 'text-stone-500',  sign: '-' },
  adjustment:{ label: 'Adjustment', color: 'text-amber-700',  sign: '' },
};

function TierCard({ tier, active, lifetimePoints }: { tier: LoyaltyTier; active: boolean; lifetimePoints: number }) {
  const meta = TIER_META[tier];
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${active ? 'border-red-700 shadow-md' : 'border-stone-200'}`}>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.bg} flex items-center justify-center text-white mb-3`}>
        <meta.icon size={18} />
      </div>
      <p className={`font-black text-stone-900 ${meta.color}`}>{meta.name}</p>
      <p className="text-xs text-stone-400 mt-0.5">{meta.perk}</p>
    </div>
  );
}

function RedeemModal({ open, onClose, onRedeem, points, rate, min, step }:
  { open: boolean; onClose: () => void; onRedeem: (p: number) => Promise<{ ok: boolean; amountCredited?: number; message?: string }>; points: number; rate: number; min: number; step: number }) {
  const [value, setValue] = useState(min);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ amount: number; points: number } | null>(null);
  if (!open) return null;

  // Clamp to steps, between min and current points.
  const maxPoints = Math.floor(points / step) * step;
  const redeemable = Math.max(Math.min(value, maxPoints), 0);
  const ngnValue = Math.floor(redeemable * rate);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-black text-stone-900 flex items-center gap-2"><Icon.PiCoinsBold size={18} className="text-red-700" /> Redeem Points</h3>
          <button onClick={close} className="text-stone-400 hover:text-stone-700"><Icon.PiXBold size={16} /></button>
        </div>
        {success ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4"><Icon.PiCheckCircleBold size={26} className="text-green-600" /></div>
            <p className="font-black text-stone-900 text-lg">{fmtNgn(success.amount)} added to your wallet</p>
            <p className="text-sm text-stone-500 mt-1">{success.points} points redeemed.</p>
            <button onClick={close} className="mt-6 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="bg-stone-50 rounded-xl p-4 flex items-center justify-between">
              <span className="text-xs text-stone-500 font-semibold">Available points</span>
              <span className="font-black text-stone-900">{points.toLocaleString()}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-1.5">Points to redeem (in steps of {step})</p>
              <input type="range" min={min} max={maxPoints || min} step={step} value={redeemable}
                onChange={e => setValue(Number(e.target.value))}
                className="w-full accent-red-700" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-stone-400">{min} min</span>
                <span className="font-black text-red-700">{redeemable.toLocaleString()} pts</span>
                <span className="text-xs text-stone-400">{maxPoints.toLocaleString()} max</span>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-green-700">You get</span>
              <span className="font-black text-green-700 text-lg">{fmtNgn(ngnValue)}</span>
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <Icon.PiLockBold size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Points are converted to wallet credit at ₦{rate.toFixed(2)} per point. They are never redeemable for cash.</p>
            </div>
            <button onClick={handleRedeem} disabled={submitting || redeemable < min}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60">
              {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiArrowRightBold size={14} />}
              {submitting ? 'Redeeming…' : `Redeem ${redeemable.toLocaleString()} points`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
      <div className="px-6 py-4 border-b border-stone-100">
        <h3 className="font-black text-stone-900 text-sm flex items-center gap-2"><Icon.PiShareNetworkBold size={15} className="text-red-700" /> Refer & Earn</h3>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-stone-500">Give friends 500 points when they sign up with your code — you earn 500 points too, applied to their first order.</p>
        {code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
              <code className="flex-1 font-mono text-sm font-bold text-stone-900 tracking-wider">{code}</code>
              <button onClick={copy} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-red-700 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200">
                {copied ? <Icon.PiCheckBold size={12} className="text-green-600" /> : <Icon.PiCopyBold size={12} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="text-xs text-stone-400">Share link: <span className="text-red-700 break-all">{link}</span></p>
            <p className="text-xs text-stone-500">Bonus earned so far: <span className="font-bold text-stone-700">{bonusEarned.toLocaleString()} pts</span></p>
          </div>
        ) : (
          <button onClick={onGetCode}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-800 transition-all">
            <Icon.PiSparkleBold size={14} /> Generate my referral code
          </button>
        )}
        <div className="border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold text-stone-600 mb-1.5">Have a referral code? Apply it:</p>
          <div className="flex gap-2">
            <input value={applyCode} onChange={e => setApplyCode(e.target.value.toUpperCase())} placeholder="DH-XXXXXX"
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 focus:bg-white focus:border-red-400 outline-none uppercase font-mono" />
            <button onClick={handleApply} disabled={applying}
              className="bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-800 disabled:opacity-60">Apply</button>
          </div>
          {applyMsg && <p className={`text-xs mt-2 font-medium ${applyMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{applyMsg.text}</p>}
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyPage() {
  const { token } = useAccount();
  const { loyalty, loading, transactions, txLoading, txPage, txTotalPages, fetchTransactions, redeem, getReferralCode, applyReferral } = useLoyalty(token);
  const [redeemOpen, setRedeemOpen] = useState(false);

  if (loading && !loyalty) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" /></div>;
  }
  if (!loyalty) return null;

  const tier = TIER_META[loyalty.tier];
  const referralLink = loyalty.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://drinksharbour.com'}/register?ref=${loyalty.referralCode}`
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">Corks & Points</h1>
        <p className="text-sm text-stone-500 mt-0.5">Earn points on every order, redeem them into your wallet, climb the tiers.</p>
      </div>

      {/* Hero tier card */}
      <div className={`rounded-2xl p-6 text-white shadow-lg bg-gradient-to-br ${tier.bg}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80 font-bold">Current Tier</p>
            <p className="text-3xl font-black mt-1 flex items-center gap-2"><tier.icon size={24} /> {tier.name}</p>
            <p className="text-xs opacity-80 mt-1">{tier.perk}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest opacity-80 font-bold">Points</p>
            <p className="text-3xl font-black mt-1">{loyalty.points.toLocaleString()}</p>
            <p className="text-xs opacity-80 mt-1">redeemable now</p>
          </div>
        </div>
        {loyalty.nextTier && loyalty.nextThreshold && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="opacity-80">Progress to {TIER_META[loyalty.nextTier].name}</span>
              <span className="font-bold">{loyalty.lifetimePoints.toLocaleString()} / {loyalty.nextThreshold.toLocaleString()} lifetime pts</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${loyalty.progress}%` }} />
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={() => setRedeemOpen(true)} disabled={loyalty.points < loyalty.minRedeemPoints}
            className="flex items-center gap-2 bg-white text-stone-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-stone-100 transition-all disabled:opacity-60">
            <Icon.PiWalletBold size={13} /> Redeem to Wallet
          </button>
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm">
            <Icon.PiCoinsBold size={13} /> {loyalty.earnMultiplier}× earn rate
          </div>
        </div>
      </div>

      {/* Tier ladder */}
      <div>
        <h2 className="font-black text-stone-900 text-sm mb-3">Tier Ladder</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['cork','barrel','cellar','vault'] as LoyaltyTier[]).map(t => (
            <TierCard key={t} tier={t} active={loyalty.tier === t} lifetimePoints={loyalty.lifetimePoints} />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Icon.PiCoinsBold, label: 'Lifetime Points', value: loyalty.lifetimePoints.toLocaleString(), color: 'bg-amber-50 text-amber-700' },
          { icon: Icon.PiStarBold,   label: 'Earned',          value: (loyalty.summary.earned || 0).toLocaleString(), color: 'bg-green-50 text-green-700' },
          { icon: Icon.PiWalletBold, label: 'Redeemed',        value: (loyalty.summary.redeemed || 0).toLocaleString(), color: 'bg-red-50 text-red-700' },
          { icon: Icon.PiShareNetworkBold, label: 'Referral Bonus', value: (loyalty.summary.referralBonus || 0).toLocaleString(), color: 'bg-purple-50 text-purple-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}><s.icon size={18} /></div>
            <p className="text-xl font-black text-stone-900">{s.value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral */}
      <ReferralCard code={loyalty.referralCode} link={referralLink} bonusEarned={loyalty.referralBonusEarned}
        onGetCode={getReferralCode} onApply={applyReferral} />

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="font-black text-stone-900 text-sm flex items-center gap-2"><Icon.PiReceiptBold size={15} className="text-red-700" /> Recent Activity</h2>
        </div>
        {txLoading && transactions.length === 0 ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-stone-100 animate-pulse rounded-xl" />)}</div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <Icon.PiStarBold size={36} className="mx-auto text-stone-200 mb-3" />
            <p className="font-semibold text-stone-700 mb-1">No activity yet</p>
            <p className="text-sm text-stone-400">Earn points on your next order to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {transactions.map(t => {
              const meta = TX_META[t.type] || TX_META.adjustment;
              return (
                <li key={t._id} className="px-6 py-3 flex items-center gap-4 hover:bg-stone-50/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-800 truncate">{t.reason || meta.label}</p>
                    <p className="text-xs text-stone-400">{fmtDateTime(t.createdAt)}</p>
                  </div>
                  <p className={`text-sm font-black ${meta.color}`}>{meta.sign}{Math.abs(t.points).toLocaleString()} pts</p>
                </li>
              );
            })}
          </ul>
        )}
        {txTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-stone-100">
            <button disabled={txPage <= 1} onClick={() => fetchTransactions(txPage - 1)} className="text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700">← Previous</button>
            <span className="text-xs text-stone-400">Page {txPage} of {txTotalPages}</span>
            <button disabled={txPage >= txTotalPages} onClick={() => fetchTransactions(txPage + 1)} className="text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700">Next →</button>
          </div>
        )}
      </div>

      <RedeemModal open={redeemOpen} onClose={() => setRedeemOpen(false)} onRedeem={redeem}
        points={loyalty.points} rate={loyalty.redeemRateNgnPerPoint} min={loyalty.minRedeemPoints} step={loyalty.redeemStepPoints} />
    </div>
  );
}