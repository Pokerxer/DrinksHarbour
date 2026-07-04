'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import PremiumGiftCard from '../../my-account/_components/PremiumGiftCard';
import { fmtNgn } from '../../my-account/_components/format';

interface GiftInfo {
  amount: number;
  currency: string;
  tier: string | null;
  senderName: string | null;
  message: string | null;
  alreadyClaimed: boolean;
}

export default function GiftClaimPage() {
  const params = useParams();
  const router = useRouter();
  const claimToken = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';
  const { user, token: authToken, isAuthenticated } = useAuth();

  const [gift, setGift] = useState<GiftInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimedCardId, setClaimedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!claimToken) return;
    fetch(`${API_URL}/api/gift-cards/claim/${claimToken}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setLoadErr(data.message || 'Gift not found'); return; }
        setGift(data.data ?? data);
      })
      .catch(() => setLoadErr('Could not load gift details'));
  }, [claimToken]);

  const handleClaim = async () => {
    if (!isAuthenticated || !authToken) {
      router.push(`/login?redirect=/gift/${claimToken}`);
      return;
    }
    setClaiming(true);
    setClaimErr(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/claim/${claimToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { setClaimErr(data.message || 'Claim failed'); setClaiming(false); return; }
      const payload = data.data ?? data;
      setClaimed(true);
      setClaimedCardId(String(payload.giftCardId));
    } catch {
      setClaimErr('Network error — please try again');
    } finally {
      setClaiming(false);
    }
  };

  if (loadErr) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
          <Icon.PiGiftBold size={28} className="text-stone-400" />
        </div>
        <h1 className="text-lg font-semibold text-stone-600">{loadErr}</h1>
        <Link href="/" className="text-sm font-semibold text-red-700 flex items-center gap-1">
          <Icon.PiArrowLeftBold size={12} /> Back to DrinksHarbour
        </Link>
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (claimed && claimedCardId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
          <Icon.PiCheckCircleBold size={32} className="text-green-600" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-black text-stone-900">Gift card claimed!</h1>
          <p className="text-sm text-stone-500 mt-1">{fmtNgn(gift.amount)} has been added to your gift cards.</p>
        </div>
        <Link
          href={`/my-account/gift-cards/${claimedCardId}`}
          className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
        >
          <Icon.PiGiftBold size={14} /> View My Gift Card
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-stone-50 py-12 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="sr-only">Claim your gift card</h1>
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Icon.PiGiftBold size={14} /> You have a gift!
          </div>
          {gift.senderName && (
            <p className="text-stone-600 text-sm">
              <span className="font-semibold text-stone-800">{gift.senderName}</span> sent you a gift card
            </p>
          )}
        </div>

        <PremiumGiftCard
          amount={gift.amount}
          tierId={gift.tier || undefined}
          tilt={false}
          showFlip={false}
        />

        {gift.message && (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-stone-400 mb-2">Personal message</p>
            <blockquote className="text-stone-700 text-sm italic border-l-2 border-red-200 pl-3">
              &ldquo;{gift.message}&rdquo;
            </blockquote>
          </div>
        )}

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-400">Value</span>
            <span className="font-black text-stone-900 text-lg">{fmtNgn(gift.amount)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-50 rounded-lg p-2.5">
            <Icon.PiShieldCheckBold size={12} className="text-amber-500 flex-shrink-0" />
            Redeemable at any store on DrinksHarbour. 12-month validity.
          </div>
        </div>

        {gift.alreadyClaimed ? (
          <div className="bg-stone-100 rounded-xl p-5 text-center">
            <Icon.PiLockBold size={20} className="mx-auto text-stone-400 mb-2" />
            <p className="text-stone-600 font-semibold text-sm">This gift has already been claimed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claimErr && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
                <Icon.PiWarningBold size={14} className="flex-shrink-0" />
                {claimErr}
              </div>
            )}
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 disabled:opacity-60 transition-all shadow-lg shadow-red-900/20"
            >
              {claiming
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon.PiGiftBold size={15} />}
              {claiming ? 'Claiming…' : isAuthenticated ? 'Claim this gift card' : 'Sign in to claim'}
            </button>
            {!isAuthenticated && (
              <p className="text-center text-xs text-stone-400">
                You&apos;ll be redirected to sign in, then returned here automatically.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
