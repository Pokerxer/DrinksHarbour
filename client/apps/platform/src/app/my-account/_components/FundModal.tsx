'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { fmtNgn } from './format';

interface FundModalProps {
  open: boolean;
  onClose: () => void;
  onFund: (amount: number) => Promise<{ ok: boolean; authUrl?: string; message?: string }>;
  currentBalance: number;
}

const PRESETS = [1000, 2500, 5000, 10000, 25000, 50000];

export default function FundModal({ open, onClose, onFund, currentBalance }: FundModalProps) {
  const [amount, setAmount] = useState<number>(2500);
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const finalAmount = custom ? Number(custom) : amount;

  const handleFund = async () => {
    const n = Number(finalAmount);
    if (!Number.isInteger(n) || n < 500) {
      setError('Enter a whole amount of at least ₦500');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await onFund(n);
    setSubmitting(false);
    if (!res.ok) { setError(res.message || 'Failed to start funding'); return; }
    if (res.authUrl) window.location.href = res.authUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-black text-stone-900 flex items-center gap-2">
            <Icon.PiWalletBold size={18} className="text-red-700" /> Fund Wallet
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><Icon.PiXBold size={16} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-stone-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-xs text-stone-500 font-semibold">Current balance</span>
            <span className="font-black text-stone-900">{fmtNgn(currentBalance)}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-600 mb-2">Choose an amount</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button key={p} onClick={() => { setAmount(p); setCustom(''); }}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    !custom && amount === p
                      ? 'border-red-700 bg-red-50 text-red-700'
                      : 'border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}>
                  {fmtNgn(p)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-600 mb-1.5">Or enter a custom amount (₦)</p>
            <input type="number" min={500} step={100} value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="e.g. 7500"
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none" />
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <Icon.PiLockBold size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">You'll be redirected to Paystack to complete payment securely. Your wallet is credited instantly after verification.</p>
          </div>
          <button onClick={handleFund} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60">
            {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiArrowRightBold size={14} />}
            {submitting ? 'Initializing…' : `Fund ${fmtNgn(finalAmount || 0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}