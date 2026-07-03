'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../../AccountShell';
import { useGiftCardDetail } from '../../_hooks/useGiftCards';
import { giftCardTierById } from '../_giftCardTiers';
import InlineAlert from '../../_components/InlineAlert';
import { fmtNgn, fmtDate, fmtDateTime } from '../../_components/format';

const TX_LABEL: Record<string, { label: string; color: string; sign: string }> = {
  issue:      { label: 'Issued',     color: 'text-green-700', sign: '+' },
  redeem:     { label: 'Redeemed',   color: 'text-red-700',   sign: '-' },
  refund:     { label: 'Refund',     color: 'text-blue-700',  sign: '+' },
  adjustment: { label: 'Adjustment', color: 'text-amber-700', sign: '' },
};

export default function GiftCardDetailPage() {
  const { token } = useAccount();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : null;
  const { card, transactions, loading, error, redeem } = useGiftCardDetail(token, id);

  const [redeemAmt, setRedeemAmt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const tier = giftCardTierById(card.design?.tier, card.initialAmount);
  const qrDataUrl = (card as any).qrDataUrl as string | null | undefined;
  const canRedeem = card.status === 'active' && card.balance > 0;
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

  return (
    <div className="space-y-6">
      <Link href="/my-account/gift-cards" className="text-sm font-semibold text-red-700 flex items-center gap-1"><Icon.PiArrowLeftBold size={13} /> Back to gift cards</Link>

      {msg && <InlineAlert variant={msg.ok ? 'success' : 'error'}>{msg.text}</InlineAlert>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card art + QR */}
        <div className="space-y-4">
          <div className={`rounded-2xl p-6 bg-gradient-to-br ${tier.gradient} ${tier.textClass} shadow-lg aspect-[1.6/1] flex flex-col justify-between`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-[10px] uppercase tracking-widest font-bold ${tier.accentClass}`}>DrinksHarbour · {tier.name}</p>
                <p className="text-3xl font-black mt-1">{fmtNgn(card.balance)}</p>
                <p className="text-xs opacity-70 mt-0.5">of {fmtNgn(card.initialAmount)}</p>
              </div>
              <Icon.PiGiftBold size={26} className="opacity-60" />
            </div>
            <p className="font-mono text-base tracking-wider">{card.code || 'DHGC-••••-••••-••••'}</p>
          </div>

          {qrDataUrl && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Gift card QR" className="w-40 h-40" />
              <p className="text-xs text-stone-400 mt-2 text-center">Show this at any DrinksHarbour tenant to redeem in store.</p>
            </div>
          )}
        </div>

        {/* Details + redeem */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
            <Row label="Status" value={card.status.replace('_', ' ')} />
            <Row label="Balance" value={`${fmtNgn(card.balance)} / ${fmtNgn(card.initialAmount)}`} />
            <Row label="Expires" value={fmtDate(card.expiresAt)} />
            {card.recipient?.name && <Row label="For" value={card.recipient.name} />}
            {card.code && (
              <button onClick={copyCode} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-stone-600 hover:text-red-700 bg-stone-50 px-3 py-2 rounded-lg">
                {copied ? <Icon.PiCheckBold size={12} className="text-green-600" /> : <Icon.PiCopyBold size={12} />}
                {copied ? 'Copied' : 'Copy code'}
              </button>
            )}
          </div>

          {canRedeem && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
              <h3 className="font-black text-stone-900 text-sm flex items-center gap-2"><Icon.PiWalletBold size={15} className="text-red-700" /> Redeem to wallet</h3>
              <input type="range" min={0} max={maxRedeem} step={100} value={Math.min(redeemAmt, maxRedeem)}
                onChange={e => setRedeemAmt(Number(e.target.value))} className="w-full accent-red-700" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">₦0</span>
                <span className="font-black text-red-700">{fmtNgn(Math.min(redeemAmt, maxRedeem))}</span>
                <button onClick={() => setRedeemAmt(maxRedeem)} className="text-stone-500 hover:text-red-700 font-semibold">Max {fmtNgn(maxRedeem)}</button>
              </div>
              <button onClick={doRedeem} disabled={submitting || redeemAmt < 1}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60">
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiArrowRightBold size={14} />}
                {submitting ? 'Redeeming…' : 'Move to wallet'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100"><h3 className="font-black text-stone-900 text-sm">Activity</h3></div>
            {transactions.length === 0 ? (
              <p className="p-6 text-sm text-stone-400 text-center">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {transactions.map(t => {
                  const m = TX_LABEL[t.type] || TX_LABEL.adjustment;
                  return (
                    <li key={t._id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{m.label}</p>
                        <p className="text-xs text-stone-400">{fmtDateTime(t.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-black ${m.color}`}>{m.sign}{fmtNgn(t.amount)}</p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-semibold text-stone-900 capitalize">{value}</span>
    </div>
  );
}
