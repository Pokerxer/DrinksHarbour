'use client';

/**
 * Ad wallet card — prepaid balance + Paystack top-up.
 *
 * The balance and the CPC tariff both come from GET /api/ads/campaigns/summary
 * (the tariff is a platform pricing decision surfaced verbatim from the API —
 * never hard-coded and never dressed up as a "market rate").
 *
 * "Top up wallet" rides the existing Paystack initialize seam with
 * purpose=ad_wallet metadata and a fresh Idempotency-Key per click, then
 * redirects to the gateway authorization URL.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button, Input, Text } from 'rizzui';
import { PiSpinnerBold, PiWalletDuotone } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { adsService } from '@/services/ads.service';

const naira = (value: number) => `₦${value.toLocaleString('en-NG')}`;

export default function WalletCard({ className }: { className?: string }) {
  const { data: session } = useSession() as unknown as {
    data: {
      token?: string;
      user?: { token?: string; email?: string };
    } | null;
  };
  const token = session?.token || session?.user?.token || '';
  const email = session?.user?.email || '';

  const [balance, setBalance] = useState<number | null>(null);
  const [cpcTariff, setCpcTariff] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [initializing, setInitializing] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await adsService.summary(token);
      if (response?.success && response.data) {
        setBalance(response.data.balance ?? 0);
        setCpcTariff(response.data.cpcTariff ?? null);
      }
    } catch (err: any) {
      console.error('Error fetching ad wallet summary:', err);
      setError(err.message || 'Failed to load wallet');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadSummary();
  }, [token, loadSummary]);

  const amountValue = amount.trim() === '' ? NaN : Number(amount);
  const amountValid = Number.isInteger(amountValue) && amountValue > 0;

  const handleTopUp = async () => {
    if (!amountValid || !email) {
      toast.error(
        email
          ? 'Enter a top-up amount in naira'
          : 'Your account has no email to bill'
      );
      return;
    }
    setInitializing(true);
    try {
      const response = await adsService.initializeTopup(token, amountValue, email);
      const url =
        response?.data?.authorizationUrl || response?.data?.authorization_url;
      if (response?.success && url) {
        window.location.href = url;
        return; // navigating away to Paystack
      }
      toast.error(response?.message || 'Failed to start wallet top-up');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start wallet top-up');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div
      id="top-up-wallet"
      className={cn(
        'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#b20202]/10">
            <PiWalletDuotone className="h-5 w-5 text-[#b20202]" />
          </span>
          <div>
            <Text className="font-semibold text-gray-900">Ad wallet</Text>
            <Text className="block text-xs text-gray-500">
              Prepaid balance for sponsored placements
            </Text>
          </div>
        </div>
        {isLoading ? (
          <PiSpinnerBold className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <Text className="text-2xl font-bold text-gray-900" aria-label="Wallet balance">
            {error ? '—' : naira(balance ?? 0)}
          </Text>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label
            htmlFor="top-up-amount"
            className="mb-1.5 block text-xs font-medium text-gray-700"
          >
            Top-up amount (₦)
          </label>
          <Input
            id="top-up-amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
          />
        </div>
        <Button
          type="button"
          onClick={handleTopUp}
          disabled={initializing || !amountValid || !email}
          isLoading={initializing}
          className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
        >
          Top up wallet
        </Button>
      </div>

      {cpcTariff !== null && (
        <p className="mt-3 text-xs text-gray-500">
          Prepaid — campaigns charge {naira(cpcTariff)} per verified click from
          this balance.
        </p>
      )}
    </div>
  );
}
