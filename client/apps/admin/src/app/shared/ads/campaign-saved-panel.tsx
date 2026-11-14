'use client';

/**
 * Post-save panel: the campaign exists as a draft and activation is offered
 * as a deliberate second step (never automatic). Activation can hit the
 * server's prepaid money gate (409 "Load your ad wallet to activate") — that
 * message is surfaced inline with a link back to the wallet card, because it
 * is the one error the user can act on right now.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Text } from 'rizzui';
import {
  PiMegaphoneDuotone,
  PiPlayBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { adsService } from '@/services/ads.service';

export default function CampaignSavedPanel({
  campaignId,
  cpcTariff,
  token,
}: {
  campaignId: string;
  /** Per-click tariff from the summary response — null while loading. */
  cpcTariff: number | null;
  token: string;
}) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const handleActivate = async () => {
    setWalletError(null);
    setActivating(true);
    try {
      await adsService.setStatus(token, campaignId, 'active');
      toast.success('Campaign activated');
      router.push(routes.eCommerce.advertising);
    } catch (err: any) {
      if (/wallet/i.test(err.message || '')) {
        // The 409 money gate: surface it inline, point at the wallet card.
        setWalletError(err.message || 'Load your ad wallet to activate');
      } else {
        toast.error(err.message || 'Failed to activate campaign');
      }
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <PiMegaphoneDuotone className="h-7 w-7 text-emerald-600" />
      </div>
      <Text className="mb-1 text-lg font-bold text-gray-900">
        Campaign saved as a draft
      </Text>
      <Text className="mb-6 block text-sm text-gray-500">
        {cpcTariff !== null &&
          `Activating starts charging ₦${cpcTariff.toLocaleString(
            'en-NG'
          )} per verified click out of your prepaid ad wallet.`}
      </Text>
      {walletError && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
          <div className="flex items-start gap-2">
            <PiWarningCircleBold className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <Text className="text-sm font-semibold text-amber-800">
                {walletError}
              </Text>
              <Link
                href={`${routes.eCommerce.advertising}#top-up-wallet`}
                className="mt-1 block text-xs font-semibold text-amber-700 underline"
              >
                Top up your wallet
              </Link>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          onClick={handleActivate}
          isLoading={activating}
          className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
        >
          <PiPlayBold className="mr-2 h-4 w-4" />
          Activate now
        </Button>
        <Link href={routes.eCommerce.advertising}>
          <Button variant="outline" type="button">
            Back to campaigns
          </Button>
        </Link>
      </div>
    </div>
  );
}
