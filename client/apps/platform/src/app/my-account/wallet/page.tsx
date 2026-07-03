'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import Link from 'next/link';
import { useAccount } from '../AccountShell';
import { useWallet } from '../_hooks/useWallet';
import StatCard from '../_components/StatCard';
import FundModal from '../_components/FundModal';
import WalletTransactionList from '../_components/WalletTransactionList';
import InlineAlert from '../_components/InlineAlert';
import DateRangeFilter from '../_components/DateRangeFilter';
import { fmtNgn, fmtDateTime } from '../_components/format';

const TYPE_FILTERS = ['all', 'credit', 'debit', 'refund'];

function WalletPageInner() {
  const { token } = useAccount();
  const { wallet, loading, transactions, txLoading, txPage, txTotalPages, fetchTransactions, fundWallet, verifyFunding } = useWallet(token);
  const [fundOpen, setFundOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const searchParams = useSearchParams();
  const fundingRef = searchParams.get('wallet_ref');

  // Handle the return from Paystack after wallet funding.
  useEffect(() => {
    if (!fundingRef || !token) return;
    setVerifying(true);
    verifyFunding(fundingRef).then(res => {
      setVerifying(false);
      setVerifyMsg({ ok: res.ok, text: res.ok ? `Wallet funded successfully — new balance ${fmtNgn(res.balance || 0)}` : (res.message || 'Verification failed') });
      // Clean the query string.
      window.history.replaceState({}, '', '/my-account/wallet');
      setTimeout(() => setVerifyMsg(null), 6000);
    });
  }, [fundingRef, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load (and reload on filter change) the single transactions panel.
  useEffect(() => {
    if (!token) return;
    fetchTransactions(1, { type: typeFilter, from: dateFrom, to: dateTo });
  }, [token, typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFund = async (amount: number) => {
    const res = await fundWallet(amount);
    if (res.ok && res.reference && res.authUrl) {
      // Persist reference so we can verify on return; Paystack callback also carries it.
      try { sessionStorage.setItem('dh_wallet_fund_ref', res.reference); } catch {}
      // Redirect to Paystack, returning here on success with ?wallet_ref=
      const url = new URL(res.authUrl);
      url.searchParams.set('callback_url', `${window.location.origin}/my-account/wallet?wallet_ref=${res.reference}`);
      window.location.href = url.toString();
    }
    return res;
  };

  const balance = wallet?.balance || 0;
  const summary = wallet?.summary;
  const stats = [
    { icon: Icon.PiWalletBold,       label: 'Wallet Balance', value: fmtNgn(balance),                color: 'bg-red-50 text-red-700' },
    { icon: Icon.PiArrowDownLeftBold,label: 'Total Funded',   value: fmtNgn(summary?.credited || 0),  color: 'bg-green-50 text-green-700' },
    { icon: Icon.PiArrowUpRightBold, label: 'Total Spent',    value: fmtNgn(summary?.debited || 0),   color: 'bg-amber-50 text-amber-700' },
    { icon: Icon.PiClockBold,        label: 'Last Activity',  value: summary?.lastActivityAt ? fmtDateTime(summary.lastActivityAt) : '—', color: 'bg-blue-50 text-blue-700' },
  ];

  const nextPage = (p: number) => fetchTransactions(p, { type: typeFilter, from: dateFrom, to: dateTo });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">My Wallet</h1>
          <p className="text-sm text-stone-500 mt-0.5">Fund your wallet once, checkout faster everywhere.</p>
        </div>
        <button onClick={() => setFundOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
          <Icon.PiPlusBold size={14} /> Fund Wallet
        </button>
      </div>

      {verifying && <InlineAlert variant="pending" spinning>Verifying your payment…</InlineAlert>}
      {verifyMsg && <InlineAlert variant={verifyMsg.ok ? 'success' : 'error'}>{verifyMsg.text}</InlineAlert>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} loading={loading} />)}
      </div>

      <div className="bg-gradient-to-br from-stone-900 via-red-950 to-stone-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-red-200 font-semibold uppercase tracking-wide">DrinksHarbour Wallet</p>
            <p className="text-3xl font-black mt-2">{fmtNgn(balance)}</p>
            <p className="text-xs text-stone-300 mt-1">Usable at any tenant on the platform.</p>
          </div>
          <Icon.PiWalletBold size={28} className="text-red-300/60" />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setFundOpen(true)} className="flex items-center gap-2 bg-white text-stone-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-stone-100 transition-all">
            <Icon.PiPlusBold size={13} /> Add Money
          </button>
          <Link href="/shop" className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-white/20 transition-all">
            <Icon.PiShoppingCartBold size={13} /> Shop Now
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 space-y-3">
          <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
            <Icon.PiReceiptBold size={15} className="text-red-700" /> Transactions
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {TYPE_FILTERS.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border transition-all ${typeFilter === t ? 'border-red-700 bg-red-50 text-red-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
        </div>
        <WalletTransactionList items={transactions} loading={txLoading} />
        {txTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-stone-100">
            <button disabled={txPage <= 1} onClick={() => nextPage(txPage - 1)}
              className="text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700">← Previous</button>
            <span className="text-xs text-stone-400">Page {txPage} of {txTotalPages}</span>
            <button disabled={txPage >= txTotalPages} onClick={() => nextPage(txPage + 1)}
              className="text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700">Next →</button>
          </div>
        )}
      </div>

      <FundModal open={fundOpen} onClose={() => setFundOpen(false)} onFund={handleFund} currentBalance={balance} />
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />}>
      <WalletPageInner />
    </Suspense>
  );
}
