'use client';

import { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { useReferrals } from '../_hooks/useReferrals';
import type { ReferralItem, ReferralsPayload } from '../_types';
import { fmtNgn } from '../_components/format';

// ── Static status styling (no dynamic Tailwind classes) ───────────────────────

const STATUS_DOT: Record<ReferralItem['status'], { dotBg: string; text: string }> = {
  pending:   { dotBg: 'bg-amber-400', text: 'text-amber-700' },
  qualified: { dotBg: 'bg-blue-400',  text: 'text-blue-700' },
  paid:      { dotBg: 'bg-green-500', text: 'text-green-700' },
  rejected:  { dotBg: 'bg-red-500',   text: 'text-red-600' },
  reversed:  { dotBg: 'bg-stone-300', text: 'text-stone-500' },
};

function waShareUrl(link: string, terms: ReferralsPayload['terms']): string {
  const headline = `Give ${fmtNgn(terms.refereeDiscountNgn)} — get ${fmtNgn(terms.referrerCreditNgn)}`;
  const message = `${headline} on DrinksHarbour. Use my link: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// ── Share card ────────────────────────────────────────────────────────────────

function ShareCard({ data }: { data: ReferralsPayload }) {
  const [copied, setCopied] = useState(false);
  const t = data.terms;
  const headline = `Give ${fmtNgn(t.refereeDiscountNgn)} — get ${fmtNgn(t.referrerCreditNgn)}`;

  const copy = () => {
    navigator.clipboard.writeText(data.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiShareNetworkBold size={15} className="text-red-700" /> Refer &amp; Earn
        </h2>
        <p className="text-2xl font-black text-stone-900 mt-2">{headline}</p>
        <p className="text-sm text-stone-500 mt-1 leading-relaxed">
          Share your link — your friend gets <strong className="text-stone-700">{fmtNgn(t.refereeDiscountNgn)}</strong> off their first order, and you earn <strong className="text-stone-700">{fmtNgn(t.referrerCreditNgn)}</strong> when they pay.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <input readOnly value={data.link} onFocus={e => e.target.select()}
            className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl text-xs bg-stone-50 focus:bg-white focus:border-red-400 outline-none truncate" />
          <button onClick={copy}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-red-700 bg-white px-3 py-2.5 rounded-xl border border-stone-200 flex-shrink-0 transition-colors">
            {copied ? <Icon.PiCheckBold size={11} className="text-green-600" /> : <Icon.PiCopyBold size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <a href={waShareUrl(data.link, t)} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all">
          <Icon.PiWhatsappLogoBold size={15} /> Share on WhatsApp
        </a>
      </div>
    </div>
  );
}

// ── Totals row ────────────────────────────────────────────────────────────────

function TotalsRow({ summary }: { summary: ReferralsPayload['summary'] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center mb-3">
          <Icon.PiWalletBold size={17} className="text-green-600" />
        </div>
        <p className="text-xs text-green-700 font-medium">Earned</p>
        <p className="text-xl font-black text-green-700 mt-0.5">{fmtNgn(summary.earnedNgn)}</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
          <Icon.PiHourglassBold size={17} className="text-amber-600" />
        </div>
        <p className="text-xs text-amber-700 font-medium">Pending</p>
        <p className="text-xl font-black text-amber-700 mt-0.5">{fmtNgn(summary.pendingNgn)}</p>
      </div>
    </div>
  );
}

// ── Referral list ─────────────────────────────────────────────────────────────

function ReferralList({ referrals }: { referrals: ReferralItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiUsersBold size={15} className="text-red-700" /> Your referrals
        </h2>
      </div>
      <ul className="divide-y divide-stone-100">
        {referrals.map(r => {
          const dot = STATUS_DOT[r.status] || STATUS_DOT.reversed;
          const capReached = r.status === 'rejected' && r.rejectedReason === 'monthly_cap';
          return (
            <li key={r._id} className="px-5 py-3.5 flex items-center gap-3.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot.dotBg}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">{r.name}</p>
                <p className={`text-xs mt-0.5 ${capReached || r.status === 'rejected' ? 'text-red-600' : 'text-stone-400'}`}>
                  {capReached ? "Monthly referral limit reached — this one wasn't paid." : r.statusLabel}
                </p>
              </div>
              {r.status === 'paid' && (
                <p className="text-sm font-black text-green-600 flex-shrink-0">+{fmtNgn(r.creditNgn)}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ data }: { data: ReferralsPayload }) {
  const t = data.terms;
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm py-12 px-5 text-center">
      <Icon.PiShareNetworkBold size={36} className="mx-auto text-stone-200 mb-3" />
      <p className="font-semibold text-stone-600 mb-1">No referrals yet</p>
      <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed">
        Share your link — friends save <strong className="text-stone-600">{fmtNgn(t.refereeDiscountNgn)}</strong> on their first order, and you earn <strong className="text-stone-600">{fmtNgn(t.referrerCreditNgn)}</strong> when they pay.
      </p>
      <a href={waShareUrl(data.link, t)} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all mt-4">
        <Icon.PiWhatsappLogoBold size={15} /> Share your link
      </a>
    </div>
  );
}

// ── Terms footnote ────────────────────────────────────────────────────────────

function TermsNote({ terms }: { terms: ReferralsPayload['terms'] }) {
  return (
    <p className="text-xs text-stone-400 leading-relaxed">
      Your friend gets <strong className="text-stone-600">{fmtNgn(terms.refereeDiscountNgn)}</strong> off their first order over{' '}
      <strong className="text-stone-600">{fmtNgn(terms.minSpendNgn)}</strong>, valid for {terms.couponValidDays} days. You're paid when their order is paid.
    </p>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const { token } = useAccount();
  const { data, loading, error } = useReferrals(token);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="bg-white rounded-xl border border-red-200 shadow-sm px-5 py-4 text-center">
          <Icon.PiWarningBold size={20} className="mx-auto text-red-600 mb-2" />
          <p className="text-sm text-stone-600">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-stone-900">Referrals</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Give {fmtNgn(data.terms.refereeDiscountNgn)} — get {fmtNgn(data.terms.referrerCreditNgn)} when friends place their first order.
        </p>
      </div>

      <ShareCard data={data} />
      <TotalsRow summary={data.summary} />

      {data.referrals.length > 0 ? (
        <ReferralList referrals={data.referrals} />
      ) : (
        <EmptyState data={data} />
      )}

      <TermsNote terms={data.terms} />
    </div>
  );
}