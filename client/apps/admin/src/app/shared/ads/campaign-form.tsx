'use client';

/**
 * Sponsored campaign create form — orchestrator.
 *
 * A campaign promotes one central catalog Product on chosen surfaces (PDP /
 * cart), paid per verified click out of the prepaid ad wallet. Creating a
 * campaign leaves it a draft — activation is a deliberate second step
 * (CampaignSavedPanel) that the server refuses while the wallet cannot cover
 * a single click (409 "Load your ad wallet to activate").
 *
 * The product picker is the merchandising module's shared picker — same server
 * search as the pairing/banner pickers, so the tenant sees the same products.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Text } from 'rizzui';
import { PiArrowLeftBold, PiMegaphoneDuotone } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { adsService, type AdSurface } from '@/services/ads.service';
import PairingProductPicker, {
  type PickerProduct,
} from '@/app/shared/merchandising/pairings/product-picker';
import FormSection from './form-section';
import CampaignBudgetFields from './campaign-budget-fields';
import CampaignSavedPanel from './campaign-saved-panel';

const SURFACE_OPTIONS: { value: AdSurface; label: string; hint: string }[] = [
  { value: 'pdp', label: 'Product page (PDP)', hint: 'Sponsored slot in the product rails' },
  { value: 'cart', label: 'Cart', hint: '“Goes well with what’s in your cart” strip' },
];

export default function CampaignForm() {
  const router = useRouter();
  const { data: session } = useSession() as unknown as {
    data: { token?: string; user?: { token?: string } } | null;
  };
  const token = session?.token || session?.user?.token || '';

  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [product, setProduct] = useState<PickerProduct | null>(null);
  const [surfaces, setSurfaces] = useState<AdSurface[]>([]);
  const [dailyBudget, setDailyBudget] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // The per-click tariff (and therefore the budget minimum) is server data.
  const [tariff, setTariff] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adsService.summary(token);
        if (!cancelled && res?.success && res.data) {
          setTariff(res.data.cpcTariff ?? null);
        }
      } catch {
        if (!cancelled) setTariff(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const removeProduct = useCallback(() => setProduct(null), []);

  const toggleSurface = useCallback((surface: AdSurface) => {
    setSurfaces((prev) =>
      prev.includes(surface)
        ? prev.filter((s) => s !== surface)
        : [...prev, surface]
    );
  }, []);

  const budgetValue = dailyBudget.trim() === '' ? NaN : Number(dailyBudget);
  const budgetValid =
    Number.isInteger(budgetValue) && tariff !== null && budgetValue >= tariff;

  const canSave =
    !!name.trim() &&
    !!product &&
    surfaces.length >= 1 &&
    budgetValid &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await adsService.create(token, {
        name: name.trim(),
        product: product!._id,
        surfaces,
        dailyBudget: budgetValue,
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
      });
      if (response.success && response.data?._id) {
        toast.success('Campaign saved as a draft');
        setCreatedId(response.data._id);
      } else {
        toast.error(response.message || 'Failed to create campaign');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return (
      <CampaignSavedPanel
        campaignId={createdId}
        cpcTariff={tariff}
        token={token}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Page header — back link + title, mirroring the pairing form header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={routes.eCommerce.advertising}>
            <Button variant="outline" size="sm" type="button">
              <PiArrowLeftBold className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <Text className="text-lg font-bold text-gray-900">New Campaign</Text>
            <Text className="block text-xs text-gray-500">
              Sponsored placements, prepaid per verified click — always labelled
              “Sponsored”.
            </Text>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSection
            icon={<PiMegaphoneDuotone className="h-4 w-4 text-[#b20202]" />}
            iconBg="bg-[#b20202]/10"
            title="Campaign"
            subtitle="What is being promoted, and where shoppers see it."
          >
            <div>
              <label
                htmlFor="campaign-name"
                className="mb-1.5 block text-xs font-medium text-gray-700"
              >
                Campaign name
              </label>
              <input
                id="campaign-name"
                type="text"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jameson weekend push"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>

            <PairingProductPicker
              triggerLabel="Campaign product (select the product to promote)"
              placeholder="Choose a product…"
              token={token}
              selected={product ? [product] : []}
              onAdd={setProduct}
              onRemove={removeProduct}
            />

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-gray-700">
                Surfaces
              </legend>
              <div className="space-y-2">
                {SURFACE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`surface-${option.value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-gray-300"
                  >
                    <input
                      id={`surface-${option.value}`}
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-[#b20202]"
                      checked={surfaces.includes(option.value)}
                      onChange={() => toggleSurface(option.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {option.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </FormSection>
        </div>

        {/* Right column — budget and schedule */}
        <div className="space-y-6">
          <FormSection
            icon={<PiMegaphoneDuotone className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            title="Budget & schedule"
            subtitle="Prepaid — charged from your ad wallet."
          >
            <CampaignBudgetFields
              dailyBudget={dailyBudget}
              onBudgetChange={setDailyBudget}
              startsAt={startsAt}
              onStartsAtChange={setStartsAt}
              endsAt={endsAt}
              onEndsAtChange={setEndsAt}
              cpcTariff={tariff}
            />
          </FormSection>
        </div>
      </div>

      {/* Fixed save bar — mirrors the pairing editor's SaveBar chrome */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm text-gray-500">
              {product ? product.name : 'No product selected'}
            </p>
            <span className="text-xs text-gray-400">
              {surfaces.length} surface{surfaces.length !== 1 ? 's' : ''}
              {tariff !== null
                ? ` · ₦${tariff.toLocaleString('en-NG')} per click`
                : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:ms-auto">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(routes.eCommerce.advertising)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={!canSave}
              className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
            >
              Save Campaign
            </Button>
          </div>
        </div>
      </div>
      <div className="h-16" />
    </form>
  );
}
