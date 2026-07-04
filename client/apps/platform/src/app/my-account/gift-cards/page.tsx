'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import Link from 'next/link';
import { useAccount } from '../AccountShell';
import { useGiftCards } from '../_hooks/useGiftCards';
import type { GiftCardItem } from '../_types';
import { fmtNgn, fmtDate } from '../_components/format';
import { giftCardTierForAmount, giftCardTierById } from './_giftCardTiers';
import InlineAlert from '../_components/InlineAlert';
import PremiumGiftCard from '../_components/PremiumGiftCard';
import StatCard from '../_components/StatCard';

const PRESETS = [5000, 25000, 100000, 500000, 1000000, 5000000];
const MIN_GC = 1000;
const MAX_GC = 20000000;


function GiftCardPurchaseModal({ open, onClose, onPurchase }:
  { open: boolean; onClose: () => void; onPurchase: (data: any) => Promise<{ ok: boolean; authUrl?: string; message?: string }> }) {
  const [amount, setAmount] = useState(25000);
  const [custom, setCustom] = useState('');
  const [recipient, setRecipient] = useState({ email: '', name: '', message: '' });
  const [forSomeone, setForSomeone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const finalAmount = custom ? Number(custom) : amount;
  const tier = giftCardTierForAmount(finalAmount || 0);

  const handleBuy = async () => {
    const n = Number(finalAmount);
    if (!Number.isInteger(n) || n < MIN_GC || n > MAX_GC) {
      setError(`Enter a whole amount between ${fmtNgn(MIN_GC)} and ${fmtNgn(MAX_GC)}`); return;
    }
    if (forSomeone && recipient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) { setError('Recipient email is invalid'); return; }
    setSubmitting(true); setError(null);
    const res = await onPurchase({
      amount: n,
      recipient: forSomeone ? {
        email: recipient.email || undefined,
        name: recipient.name || undefined,
        message: recipient.message || undefined,
      } : undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.message || 'Failed to start purchase'); return; }
    if (res.authUrl) window.location.href = res.authUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-stone-900 flex items-center gap-2"><Icon.PiGiftBold size={18} className="text-red-700" /> Buy a Gift Card</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"><Icon.PiXBold size={16} /></button>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-3">Choose an amount</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => { setAmount(p); setCustom(''); }}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${!custom && amount === p ? 'border-red-700 bg-red-50 text-red-700 shadow-sm' : 'border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>
                    {fmtNgn(p)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="relative">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Custom amount (₦)</p>
                <input type="number" min={MIN_GC} max={MAX_GC} step={500} value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. 15000"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all" />
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-gradient-to-br ${tier.gradient} ${tier.textClass}`}>
                <Icon.PiGiftBold size={10} />
                {tier.name}
              </span>
              <span className="text-stone-400">·</span>
              <span className="text-stone-500">Tier based on amount</span>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setForSomeone(v => !v)}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${forSomeone ? 'bg-red-700 border-red-700' : 'border-stone-300 group-hover:border-stone-400'}`}>
                {forSomeone && <Icon.PiCheckBold size={10} className="text-white" />}
              </div>
              <span className="text-sm font-medium text-stone-700">Send as a gift</span>
            </label>
            {forSomeone && (
              <div className="space-y-2.5 bg-stone-50 rounded-xl p-4 border border-stone-200">
                <input value={recipient.name} onChange={e => setRecipient(p => ({ ...p, name: e.target.value }))} placeholder="Recipient name"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none transition-all" />
                <input type="email" value={recipient.email} onChange={e => setRecipient(p => ({ ...p, email: e.target.value }))} placeholder="Recipient email"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none transition-all" />
                <textarea value={recipient.message} onChange={e => setRecipient(p => ({ ...p, message: e.target.value }))} placeholder="Add a personal message (optional)" rows={2}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none resize-none transition-all" />
              </div>
            )}
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button onClick={handleBuy} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60 shadow-lg shadow-red-900/20">
              {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiCreditCardBold size={14} />}
              {submitting ? 'Processing…' : `Buy for ${fmtNgn(finalAmount || 0)}`}
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-600 mb-3">Preview</p>
            <PremiumGiftCard amount={finalAmount || amount} tierId={tier.id} />
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5">
              <Icon.PiShieldCheckBold size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">12-month validity</p>
                <p className="text-xs text-amber-700 mt-0.5">Redeemable at any tenant. A unique code + QR is generated on successful payment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GiftCardTile({ card, onComplete }: { card: GiftCardItem; onComplete?: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!card.code) return;
    navigator.clipboard.writeText(card.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const pct = card.initialAmount > 0 ? Math.round((card.balance / card.initialAmount) * 100) : 0;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <Link href={`/my-account/gift-cards/${card._id}`} className="block bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <PremiumGiftCard amount={card.initialAmount} tierId={card.design?.tier} code={card.code || undefined} cardNumber={card.cardNumber} balance={card.balance} tilt={false} showFlip={false} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {card.purchasedByMe && card.claimedBy ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <Icon.PiGiftBold size={9} /> Gifted
              </span>
            ) : card.purchasedByMe && card.claimToken && !card.claimedBy ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                <Icon.PiClockBold size={9} /> Pending claim
              </span>
            ) : (
              <>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.status === 'active' ? 'bg-green-500' : card.status === 'pending_payment' ? 'bg-amber-400' : 'bg-stone-300'}`} />
                <span className="text-xs font-semibold text-stone-600 capitalize">{card.status.replace('_', ' ')}</span>
              </>
            )}
          </div>
          <span className="text-xs text-stone-400">Exp {fmtDate(card.expiresAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                <circle cx="22" cy="22" r="18" fill="none" stroke={pct <= 0 ? '#d6d3d1' : pct <= 25 ? '#f87171' : pct <= 50 ? '#fbbf24' : pct <= 75 ? '#4ade80' : '#22c55e'} strokeWidth="3"
                  strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-stone-700">{pct}%</span>
            </div>
            <div>
              <p className="text-sm font-black text-stone-900">{fmtNgn(card.balance)}</p>
              <p className="text-xs text-stone-400">of {fmtNgn(card.initialAmount)}</p>
            </div>
          </div>
          {card.code && !(card.purchasedByMe && card.claimToken) && (
            <button onClick={copy} className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
              {copied ? <Icon.PiCheckBold size={12} className="text-green-600" /> : <Icon.PiCopyBold size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        {card.recipient?.email && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-stone-100 text-xs text-stone-400">
            <Icon.PiUserBold size={10} className="opacity-50" />
            <span>For {card.recipient.name || card.recipient.email}</span>
          </div>
        )}
        {card.status === 'pending_payment' && onComplete && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onComplete(card._id); }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg py-2 transition-colors"
          >
            <Icon.PiArrowClockwiseBold size={12} />
            Verify Payment
          </button>
        )}
      </div>
    </Link>
  );
}

function GiftCardsPageInner() {
  const { token } = useAccount();
  const { cards, loading, purchase, verifyPurchase, completePayment } = useGiftCards(token);
  const [buyOpen, setBuyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const searchParams = useSearchParams();
  // Paystack redirects back with ?reference=&trxref= (our own DHGC- reference).
  // gc_ref is kept for backwards-compatibility with any in-flight links.
  const purchaseRef =
    searchParams.get('gc_ref') ||
    searchParams.get('reference') ||
    searchParams.get('trxref');
  const giftCardIdParam = searchParams.get('gc_id');

  useEffect(() => {
    if (!purchaseRef || !token) return;
    // gc_id is now embedded in the Paystack callbackUrl by the server, so
    // giftCardIdParam is the primary source. sessionStorage is a fallback for
    // older in-flight links that pre-date the callbackUrl change.
    let gcId = giftCardIdParam;
    if (!gcId) { try { gcId = sessionStorage.getItem('dh_gc_fund_id'); } catch { /* ignore */ } }
    if (!gcId) return;
    setVerifying(true);
    verifyPurchase(purchaseRef, gcId).then(res => {
      setVerifying(false);
      setVerifyMsg({ ok: res.ok, text: res.ok ? `Gift card issued — code ${res.code || ''}` : (res.message || 'Verification failed') });
      if (res.ok) {
        // Clean up only on success; on failure keep params so the user can retry.
        try { sessionStorage.removeItem('dh_gc_fund_id'); } catch { /* ignore */ }
        window.history.replaceState({}, '', '/my-account/gift-cards');
      }
      setTimeout(() => setVerifyMsg(null), 8000);
    });
  }, [purchaseRef, giftCardIdParam, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePurchase = async (data: any) => {
    const res = await purchase(data);
    if (res.ok && res.authUrl && res.reference && res.giftCardId) {
      // Stash gcId as fallback (server embeds gc_id in callbackUrl, but keep this
      // for resilience against browser sessionStorage failures being the only issue).
      try { sessionStorage.setItem('dh_gc_fund_id', res.giftCardId); } catch { /* ignore */ }
      window.location.href = res.authUrl;
    }
    return res;
  };

  const handleCompletePayment = async (cardId: string) => {
    setVerifying(true);
    const res = await completePayment(cardId);
    setVerifying(false);
    setVerifyMsg({ ok: res.ok, text: res.ok ? `Gift card issued — code ${res.code || ''}` : (res.message || 'Verification failed') });
    setTimeout(() => setVerifyMsg(null), 8000);
  };

  const totalValue = cards.filter(c => c.status === 'active').reduce((s, c) => s + c.balance, 0);
  const activeCount = cards.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Gift Cards</h1>
          <p className="text-sm text-stone-500 mt-0.5">Buy, send and redeem gift cards — usable at any tenant.</p>
        </div>
        <button onClick={() => setBuyOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
          <Icon.PiPlusBold size={14} /> Buy Gift Card
        </button>
      </div>

      {verifying && <InlineAlert variant="pending" spinning>Verifying your gift-card purchase…</InlineAlert>}
      {verifyMsg && <InlineAlert variant={verifyMsg.ok ? 'success' : 'error'}>{verifyMsg.text}</InlineAlert>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={Icon.PiGiftBold} label="Total Cards" value={cards.length} color="bg-purple-50 text-purple-700" loading={loading} />
        <StatCard icon={Icon.PiCheckCircleBold} label="Active" value={activeCount} color="bg-green-50 text-green-700" loading={loading} />
        <StatCard icon={Icon.PiWalletBold} label="Total Value" value={fmtNgn(totalValue)} color="bg-amber-50 text-amber-700" loading={loading} />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-52 bg-stone-100 animate-pulse rounded-xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-14 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-stone-800 to-red-900 flex items-center justify-center shadow-lg">
            <Icon.PiGiftBold size={28} className="text-white/80" />
          </div>
          <p className="font-black text-stone-800 text-lg mb-1">No gift cards yet</p>
          <p className="text-sm text-stone-400 mb-6 max-w-xs mx-auto">Buy one for yourself or send as a gift to a friend. Redeemable at any tenant on the platform.</p>
          <button onClick={() => setBuyOpen(true)} className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-lg shadow-red-900/20">
            <Icon.PiPlusBold size={14} /> Buy Your First Gift Card
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => <GiftCardTile key={c._id} card={c} onComplete={handleCompletePayment} />)}
        </div>
      )}

      <GiftCardPurchaseModal open={buyOpen} onClose={() => setBuyOpen(false)} onPurchase={handlePurchase} />
    </div>
  );
}

export default function GiftCardsPage() {
  return (
    <Suspense fallback={<div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />}>
      <GiftCardsPageInner />
    </Suspense>
  );
}
