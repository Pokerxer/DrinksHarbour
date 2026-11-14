'use client';

/**
 * Manual pairing create/edit form — orchestrator.
 *
 * "When shoppers view X, suggest Y": a source product plus 1–4 suggestions,
 * saved with a single upsert against PUT /api/merchandising/pairings (the
 * server upserts on {tenant, sourceProduct}).
 *
 * Editing reuses the same upsert: `editSourceId` (from ?source=) loads the
 * existing row out of the list response and prefills the pickers. The module
 * deliberately has no separate GET-by-id endpoint.
 *
 * Form chrome mirrors the Banners editor: card sections with the same
 * rounded-2xl language, a fixed save bar, red #b20202 primary action, and
 * disabled-save until the payload is valid (source + ≥1 suggestion).
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Switch, Text } from 'rizzui';
import {
  PiArrowLeftBold,
  PiPathDuotone,
  PiPlusCircleDuotone,
  PiSpinnerBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  merchandisingPairingService,
  type PairingProductRef,
} from '@/services/merchandisingPairing.service';
import PairingProductPicker, {
  type PickerProduct,
} from './product-picker';

/** The pairing API's hard cap — mirrored from the server schema (1–4 unique). */
const MAX_SUGGESTIONS = 4;

const toPickerProduct = (ref: PairingProductRef): PickerProduct => ({
  _id: ref._id,
  name: ref.name || ref.slug || ref._id,
  slug: ref.slug,
  type: ref.type,
  images: ref.images,
});

function FormSection({
  icon,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

export default function PairingForm({
  editSourceId,
}: {
  editSourceId?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession() as unknown as {
    data: { token?: string; user?: { token?: string } } | null;
  };
  const token = session?.token || session?.user?.token || '';

  const isEdit = !!editSourceId;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  const [source, setSource] = useState<PickerProduct | null>(null);
  const [suggestions, setSuggestions] = useState<PickerProduct[]>([]);
  const [active, setActive] = useState(true);

  // Edit prefill: fetch the list, match on the source product id.
  useEffect(() => {
    if (!editSourceId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await merchandisingPairingService.list(token);
        const rows = (res?.data || []) as Array<{
          _id: string;
          sourceProduct?: PairingProductRef | null;
          suggestedProducts?: PairingProductRef[];
          active?: boolean;
        }>;
        const row = rows.find(
          (r) => r.sourceProduct?._id === editSourceId
        );
        if (!row) {
          toast.error('Pairing not found');
          router.push(routes.eCommerce.merchandising);
          return;
        }
        if (cancelled) return;
        if (row.sourceProduct) setSource(toPickerProduct(row.sourceProduct));
        setSuggestions((row.suggestedProducts || []).map(toPickerProduct));
        setActive(row.active !== false);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || 'Failed to load pairing');
          router.push(routes.eCommerce.merchandising);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSourceId, token]);

  const canSave = !!source && suggestions.length >= 1 && !submitting;

  const addSource = useCallback((product: PickerProduct) => {
    setSource(product);
    // The source can never be its own suggestion.
    setSuggestions((prev) => prev.filter((p) => p._id !== product._id));
  }, []);

  const removeSource = useCallback(() => setSource(null), []);

  const addSuggestion = useCallback((product: PickerProduct) => {
    setSuggestions((prev) => {
      if (prev.some((p) => p._id === product._id)) return prev;
      if (prev.length >= MAX_SUGGESTIONS) return prev;
      return [...prev, product];
    });
  }, []);

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((p) => p._id !== id));
  }, []);

  const suggestionsFull = suggestions.length >= MAX_SUGGESTIONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || suggestions.length < 1) {
      toast.error('Pick a source product and at least one suggestion');
      return;
    }
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await merchandisingPairingService.upsert(token, {
        sourceProduct: source._id,
        suggestedProducts: suggestions.map((p) => p._id),
        active,
      });
      if (response.success) {
        toast.success(isEdit ? 'Pairing updated' : 'Pairing saved');
        router.push(routes.eCommerce.merchandising);
      } else {
        toast.error(response.message || 'Failed to save pairing');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save pairing');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <PiSpinnerBold className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Page header — back link + title, mirroring the banner form header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={routes.eCommerce.merchandising}>
            <Button variant="outline" size="sm" type="button">
              <PiArrowLeftBold className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <Text className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Pairing' : 'New Manual Pairing'}
            </Text>
            <Text className="block text-xs text-gray-500">
              Manual pairings outrank every automatic recommendation on your
              storefront (Growth plans and up).
            </Text>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSection
            icon={<PiPathDuotone className="h-4 w-4 text-[#b20202]" />}
            iconBg="bg-[#b20202]/10"
            title="When shoppers view"
            subtitle="The product this pairing is anchored to. One pairing per product."
          >
            <PairingProductPicker
              triggerLabel="When shoppers view (select the source product)"
              placeholder="When shoppers view…"
              token={token}
              selected={source ? [source] : []}
              onAdd={addSource}
              onRemove={removeSource}
            />
          </FormSection>

          <FormSection
            icon={<PiPlusCircleDuotone className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-50"
            title="Suggest"
            subtitle={`1–${MAX_SUGGESTIONS} of your other products, shown alongside the source.`}
          >
            <PairingProductPicker
              triggerLabel="Suggest (search and add products)"
              placeholder="Suggest products…"
              token={token}
              selected={suggestions}
              onAdd={addSuggestion}
              onRemove={removeSuggestion}
              maxReached={suggestionsFull}
            />
            {suggestionsFull && (
              <p className="text-xs font-medium text-amber-600">
                A pairing can include a maximum of 4 suggestions.
              </p>
            )}
          </FormSection>
        </div>

        {/* Right column — status */}
        <div className="space-y-6">
          <FormSection
            icon={<PiPathDuotone className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            title="Status"
            subtitle="Inactive pairings are kept but never surfaced."
          >
            <div className="flex items-center justify-between">
              <Text className="text-sm font-medium text-gray-700">Active</Text>
              <Switch
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                aria-label="Toggle pairing active"
              />
            </div>
          </FormSection>
        </div>
      </div>

      {/* Fixed save bar — mirrors the banner editor's SaveBar chrome */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm text-gray-500">
              {source ? source.name : 'No source product selected'}
            </p>
            <span className="text-xs text-gray-400">
              {suggestions.length}/{MAX_SUGGESTIONS} suggestions
            </span>
          </div>
          <div className="flex items-center gap-2 sm:ms-auto">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(routes.eCommerce.merchandising)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={!canSave}
              className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
            >
              Save Pairing
            </Button>
          </div>
        </div>
      </div>
      <div className="h-16" />
    </form>
  );
}
