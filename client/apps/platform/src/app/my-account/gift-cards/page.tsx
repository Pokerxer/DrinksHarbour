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
import StatCard from '../_components/StatCard';

const PRESETS = [5000, 25000, 100000, 500000, 1000000, 5000000];
const MIN_GC = 1000;
const MAX_GC = 20000000;

const STATUS_BADGE: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  redeemed: 'bg-stone-100 text-stone-600 border-stone-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  disabled: 'bg-stone-100 text-stone-500 border-stone-200',
};

function GiftCardPreview({ amount, tierId, code }: { amount: number; tierId?: string; code?: string }) {
  const t = giftCardTierById(tierId, amount);
  return (
    <div className={`rounded-2xl p-5 bg-gradient-to-br ${t.gradient} ${t.textClass} shadow-lg aspect-[1.6/1] flex flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[10px] uppercase tracking-widest font-bold ${t.accentClass}`}>DrinksHarbour · {t.name}</p>
          <p className="text-2xl font-black mt-1">{fmtNgn(amount)}</p>
        </div>
        <Icon.PiGiftBold size={22} className="opacity-60" />
      </div>
      <div className="flex items-end justify-between">
        <p className="font-mono text-sm tracking-wider">{code || 'DHGC-••••-••••-••••'}</p>
        <p className="text-[10px] opacity-70">Gift Card</p>
      </div>
    </div>
  );
}

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
          <h3 className="font-black text-stone-900 flex items-center gap-2"><Icon.PiGiftBold size={18} className="text-red-700" /> Buy a Gift Card</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><Icon.PiXBold size={16} /></button>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-2">Choose an amount</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => { setAmount(p); setCustom(''); }}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${!custom && amount === p ? 'border-red-700 bg-red-50 text-red-700' : 'border-stone-200 text-stone-700 hover:border-stone-300'}`}>
                    {fmtNgn(p)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-1.5">Custom amount (₦)</p>
              <input type="number" min={MIN_GC} max={MAX_GC} step={500} value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. 15000"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500">This is a</span>
              <span className={`px-2 py-1 rounded-full font-bold bg-gradient-to-br ${tier.gradient} ${tier.textClass}`}>{tier.name}</span>
              <span className="text-stone-500">gift card</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={forSomeone} onChange={e => setForSomeone(e.target.checked)} className="rounded border-stone-300 text-red-700 focus:ring-red-200" />
              <span className="text-sm font-semibold text-stone-700">Send as a gift to someone</span>
            </label>
            {forSomeone && (
              <div className="space-y-3 bg-stone-50 rounded-xl p-4 border border-stone-200">
                <input value={recipient.name} onChange={e => setRecipient(p => ({ ...p, name: e.target.value }))} placeholder="Recipient name"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none" />
                <input type="email" value={recipient.email} onChange={e => setRecipient(p => ({ ...p, email: e.target.value }))} placeholder="Recipient email (optional)"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none" />
                <textarea value={recipient.message} onChange={e => setRecipient(p => ({ ...p, message: e.target.value }))} placeholder="Personal message (optional)" rows={2}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none resize-none" />
              </div>
            )}
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button onClick={handleBuy} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60">
              {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiCreditCardBold size={14} />}
              {submitting ? 'Processing…' : `Buy for ${fmtNgn(finalAmount || 0)}`}
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-600 mb-2">Preview</p>
            <GiftCardPreview amount={finalAmount || amount} tierId={tier.id} />
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <Icon.PiLockBold size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Gift cards are valid for 12 months and redeemable at any tenant on DrinksHarbour. A unique code + QR is generated on successful payment.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GiftCardTile({ card }: { card: GiftCardItem }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!card.code) return;
    navigator.clipboard.writeText(card.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <Link href={`/my-account/gift-cards/${card._id}`} className="block bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <GiftCardPreview amount={card.initialAmount} tierId={card.design?.tier} code={card.code || undefined} />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_BADGE[card.status] || STATUS_BADGE.disabled}`}>{card.status.replace('_', ' ')}</span>
          <span className="text-xs text-stone-400">Exp {fmtDate(card.expiresAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-400">Balance</p>
            <p className="font-black text-stone-900">{fmtNgn(card.balance)} <span className="text-xs font-medium text-stone-400">/ {fmtNgn(card.initialAmount)}</span></p>
          </div>
          {card.code && (
            <button onClick={copy} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-red-700 bg-stone-50 px-2.5 py-1.5 rounded-lg">
              {copied ? <Icon.PiCheckBold size={12} className="text-green-600" /> : <Icon.PiCopyBold size={12} />}
              {copied ? 'Copied' : 'Copy code'}
            </button>
          )}
        </div>
        {card.recipient?.email && <p className="text-xs text-stone-400">For {card.recipient.name || card.recipient.email}</p>}
      </div>
    </Link>
  );
}

function GiftCardsPageInner() {
  const { token } = useAccount();
  const { cards, loading, purchase, verifyPurchase } = useGiftCards(token);
  const [buyOpen, setBuyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const searchParams = useSearchParams();
  const purchaseRef = searchParams.get('gc_ref');
  const giftCardId = searchParams.get('gc_id');

  useEffect(() => {
    if (!purchaseRef || !giftCardId || !token) return;
    setVerifying(true);
    verifyPurchase(purchaseRef, giftCardId).then(res => {
      setVerifying(false);
      setVerifyMsg({ ok: res.ok, text: res.ok ? `Gift card issued — code ${res.code || ''}` : (res.message || 'Verification failed') });
      window.history.replaceState({}, '', '/my-account/gift-cards');
      setTimeout(() => setVerifyMsg(null), 7000);
    });
  }, [purchaseRef, giftCardId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePurchase = async (data: any) => {
    const res = await purchase(data);
    if (res.ok && res.authUrl && res.reference && res.giftCardId) {
      const url = new URL(res.authUrl);
      url.searchParams.set('callback_url', `${window.location.origin}/my-account/gift-cards?gc_ref=${res.reference}&gc_id=${res.giftCardId}`);
      window.location.href = url.toString();
    }
    return res;
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
          <Icon.PiGiftBold size={44} className="mx-auto text-stone-200 mb-4" />
          <p className="font-black text-stone-800 text-lg mb-1">No gift cards yet</p>
          <p className="text-sm text-stone-400 mb-6">Buy one for yourself or send as a gift to a friend.</p>
          <button onClick={() => setBuyOpen(true)} className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
            <Icon.PiPlusBold size={14} /> Buy Your First Gift Card
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => <GiftCardTile key={c._id} card={c} />)}
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
