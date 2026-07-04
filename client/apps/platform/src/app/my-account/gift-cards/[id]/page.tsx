'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../../AccountShell';
import { useGiftCardDetail, useGiftCards } from '../../_hooks/useGiftCards';
import PremiumGiftCard from '../../_components/PremiumGiftCard';
import InlineAlert from '../../_components/InlineAlert';
import { fmtNgn, fmtDate, fmtDateTime } from '../../_components/format';


const TX_LABEL: Record<string, { label: string; color: string; sign: string; dotBg: string }> = {
  issue:      { label: 'Issued',     color: 'text-green-700', sign: '+', dotBg: 'bg-green-100' },
  redeem:     { label: 'Redeemed',   color: 'text-red-700',   sign: '-', dotBg: 'bg-red-100' },
  refund:     { label: 'Refund',     color: 'text-blue-700',  sign: '+', dotBg: 'bg-blue-100' },
  adjustment: { label: 'Adjustment', color: 'text-amber-700', sign: '',  dotBg: 'bg-amber-100' },
};

export default function GiftCardDetailPage() {
  const { token } = useAccount();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : null;
  const { card, transactions, loading, error, redeem } = useGiftCardDetail(token, id);
  const { sendGift } = useGiftCards(token);

  const [redeemAmt, setRedeemAmt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [sendGiftOpen, setSendGiftOpen] = useState(false);
  const [giftForm, setGiftForm] = useState({ email: '', name: '', message: '' });
  const [sendingGift, setSendingGift] = useState(false);
  const [resending, setResending] = useState(false);

  if (loading && !card) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" /></div>;
  }
  if (error || !card) {
    return (
      <div className="space-y-4">
        <Link href="/my-account/gift-cards" className="text-sm font-semibold text-red-700 flex items-center gap-1"><Icon.PiArrowLeftBold size={13} /> Back to gift cards</Link>
        <InlineAlert variant="error">{error || 'Gift card not found'}</InlineAlert>
      </div>
    );
  }

  const qrDataUrl = (card as any).qrDataUrl as string | null | undefined;
  // Buyer cannot redeem once claimToken is set (card is a gift in transit or claimed).
  const canRedeem = card.status === 'active' && card.balance > 0 && !(card.purchasedByMe && card.claimToken);
  const maxRedeem = card.balance;

  const copyCode = () => {
    if (!card.code) return;
    navigator.clipboard.writeText(card.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const doRedeem = async () => {
    const n = Math.min(Math.max(Math.floor(redeemAmt), 1), maxRedeem);
    if (n < 1) { setMsg({ ok: false, text: 'Enter an amount to redeem' }); return; }
    setSubmitting(true); setMsg(null);
    const res = await redeem(card._id, n);
    setSubmitting(false);
    if (res.ok) {
      setMsg({ ok: true, text: `${fmtNgn(n)} moved to your wallet — wallet balance ${fmtNgn(res.walletBalance || 0)}` });
      setRedeemAmt(0);
    } else {
      setMsg({ ok: false, text: res.message || 'Redemption failed' });
    }
  };

  const doResend = async () => {
    if (!card.recipient?.email) return;
    setResending(true);
    await sendGift(card._id, {
      email: card.recipient.email,
      name: card.recipient.name,
      message: card.recipient.message,
    });
    setResending(false);
    setMsg({ ok: true, text: `Gift notification resent to ${card.recipient.email}` });
  };

  const doSendGift = async () => {
    if (!giftForm.email) return;
    setSendingGift(true);
    const res = await sendGift(card._id, giftForm);
    setSendingGift(false);
    if (res.ok) {
      setMsg({ ok: true, text: `Gift notification sent to ${giftForm.email}` });
      setSendGiftOpen(false);
      setGiftForm({ email: '', name: '', message: '' });
    } else {
      setMsg({ ok: false, text: res.message || 'Failed to send gift' });
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/my-account/gift-cards" className="text-sm font-semibold text-red-700 flex items-center gap-1"><Icon.PiArrowLeftBold size={13} /> Back to gift cards</Link>

      {msg && <InlineAlert variant={msg.ok ? 'success' : 'error'}>{msg.text}</InlineAlert>}

      {/* Gift Status panel — shown to buyer when card is in the gift flow */}
      {card.purchasedByMe && card.claimToken && (
        <div className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
          card.claimedBy ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              card.claimedBy ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {card.claimedBy
                ? <Icon.PiCheckCircleBold size={16} className="text-green-600" />
                : <Icon.PiClockBold size={16} className="text-blue-600" />}
            </div>
            <div>
              <p className={`text-sm font-bold ${card.claimedBy ? 'text-green-800' : 'text-blue-800'}`}>
                {card.claimedBy ? 'Gift claimed' : 'Awaiting claim'}
              </p>
              <p className={`text-xs mt-0.5 ${card.claimedBy ? 'text-green-600' : 'text-blue-600'}`}>
                {card.claimedBy
                  ? `Claimed${card.claimedAt ? ` on ${fmtDate(card.claimedAt)}` : ''}`
                  : `Sent to ${card.recipient?.email || 'recipient'}`}
              </p>
            </div>
          </div>
          {!card.claimedBy && (
            <button
              onClick={doResend}
              disabled={resending}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-60"
            >
              {resending
                ? <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                : <Icon.PiPaperPlaneTiltBold size={12} />}
              Resend
            </button>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card art + QR */}
        <div className="space-y-4">
          <PremiumGiftCard
            amount={card.initialAmount}
            tierId={card.design?.tier}
            code={card.code || undefined}
            cardNumber={(card as any).cardNumber as string | null | undefined}
            balance={card.balance}
            qrDataUrl={qrDataUrl}
            showFlip={true}
          />
        </div>

        {/* Details + actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs text-stone-400">Status</span>
              <span className="text-sm font-semibold text-stone-900 capitalize">{card.status.replace('_', ' ')}</span>
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs text-stone-400">Balance</span>
              <span className="text-sm font-semibold text-stone-900">{fmtNgn(card.balance)} <span className="text-xs font-normal text-stone-400">/ {fmtNgn(card.initialAmount)}</span></span>
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs text-stone-400">Expires</span>
              <span className="text-sm font-semibold text-stone-900">{fmtDate(card.expiresAt)}</span>
            </div>
            {/* Recipient row — shown to buyer */}
            {card.purchasedByMe && card.recipient?.name && (
              <div className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-xs text-stone-400">Recipient</span>
                <span className="text-sm font-semibold text-stone-900">{card.recipient.name}</span>
              </div>
            )}
            {/* "Gifted by" row — shown to the recipient */}
            {!card.purchasedByMe && card.recipient?.name && (
              <div className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-xs text-stone-400">Gifted by</span>
                <span className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                  <Icon.PiGiftBold size={12} className="text-red-700" />
                  {card.recipient.name}
                </span>
              </div>
            )}
            {/* Copy code — hidden for gifted-in-transit cards (buyer's view) */}
            {card.code && !(card.purchasedByMe && card.claimToken) && (
              <div className="px-5 py-3">
                <button onClick={copyCode} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-stone-500 hover:text-red-700 bg-stone-50 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors border border-stone-200 hover:border-red-200">
                  {copied ? <Icon.PiCheckBold size={12} className="text-green-600" /> : <Icon.PiCopyBold size={12} />}
                  {copied ? 'Code copied' : 'Copy gift card code'}
                </button>
              </div>
            )}
            {/* Send as Gift — only on active self-bought cards not yet gifted */}
            {card.purchasedByMe && !card.claimToken && card.status === 'active' && (
              <div className="px-5 py-3">
                <button
                  onClick={() => setSendGiftOpen(v => !v)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors border border-red-200 hover:border-red-300"
                >
                  <Icon.PiGiftBold size={12} />
                  {sendGiftOpen ? 'Cancel' : 'Send as a gift'}
                </button>
                {sendGiftOpen && (
                  <div className="mt-3 space-y-2.5">
                    <input
                      type="email"
                      placeholder="Recipient email *"
                      value={giftForm.email}
                      onChange={e => setGiftForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none transition-all"
                    />
                    <input
                      placeholder="Recipient name (optional)"
                      value={giftForm.name}
                      onChange={e => setGiftForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none transition-all"
                    />
                    <textarea
                      placeholder="Personal message (optional)"
                      rows={2}
                      value={giftForm.message}
                      onChange={e => setGiftForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none resize-none transition-all"
                    />
                    <button
                      onClick={doSendGift}
                      disabled={sendingGift || !giftForm.email}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-2 rounded-lg font-bold text-xs hover:from-red-800 hover:to-red-950 disabled:opacity-60 transition-all"
                    >
                      {sendingGift
                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Icon.PiPaperPlaneTiltBold size={11} />}
                      {sendingGift ? 'Sending…' : 'Send gift notification'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {canRedeem && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2"><Icon.PiWalletBold size={14} className="text-red-700" /> Redeem to wallet</h3>
              <input type="range" min={0} max={maxRedeem} step={100} value={Math.min(redeemAmt, maxRedeem)}
                onChange={e => setRedeemAmt(Number(e.target.value))} className="w-full h-1.5 accent-red-700 rounded-full appearance-none bg-stone-100 cursor-pointer" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">₦0</span>
                <span className="font-bold text-xl text-red-700">{fmtNgn(Math.min(redeemAmt, maxRedeem))}</span>
                <button onClick={() => setRedeemAmt(maxRedeem)} className="text-xs font-semibold text-stone-500 hover:text-red-700">Max</button>
              </div>
              <button onClick={doRedeem} disabled={submitting || redeemAmt < 1}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 disabled:opacity-60 shadow-lg shadow-red-900/20">
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiArrowRightBold size={14} />}
                {submitting ? 'Redeeming…' : 'Move to wallet'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <h3 className="font-semibold text-stone-900 text-sm">Activity</h3>
            </div>
            {transactions.length === 0 ? (
              <div className="p-8 text-center">
                <Icon.PiReceiptBold size={24} className="mx-auto text-stone-200 mb-2" />
                <p className="text-sm text-stone-400">No activity yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {transactions.map(t => {
                  const m = TX_LABEL[t.type] || TX_LABEL.adjustment;
                  return (
                    <li key={t._id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${m.dotBg}`}>
                          {t.type === 'issue' ? <Icon.PiPlusBold size={11} className={m.color} /> :
                           t.type === 'redeem' ? <Icon.PiArrowUpRightBold size={11} className={m.color} /> :
                           t.type === 'refund' ? <Icon.PiArrowCounterClockwiseBold size={11} className={m.color} /> :
                           <Icon.PiCircleBold size={11} className={m.color} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800">{m.label}</p>
                          <p className="text-xs text-stone-400">{fmtDateTime(t.createdAt)}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold flex-shrink-0 ml-3 ${m.color}`}>{m.sign}{fmtNgn(t.amount)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
