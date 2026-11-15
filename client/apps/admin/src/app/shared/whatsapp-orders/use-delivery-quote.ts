'use client';

import { useEffect, useState } from 'react';
import type { DeliveryDraft } from './delivery-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface DeliveryQuote {
  fee: number;
  baseFee?: number;
  label?: string;
  distanceKm?: number;
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
  source?: 'google' | 'zone';
  routeType?: 'direct' | 'single-vendor' | 'multi-vendor';
  stops?: number;
  zone?: string;
}

export default function useDeliveryQuote(
  delivery: DeliveryDraft,
  subtotal: number,
  tenantIds: string[]
) {
  const params = new URLSearchParams({
    state: delivery.state,
    lga: delivery.lga,
    subtotal: String(subtotal),
  });
  if (delivery.pin) {
    params.set('lat', String(delivery.pin.lat));
    params.set('lon', String(delivery.pin.lon));
  }
  const tenants = [...new Set(tenantIds)].sort();
  if (tenants.length > 1) params.set('vendors', tenants.join(','));

  const query =
    delivery.state && delivery.lga && subtotal > 0 ? params.toString() : '';
  const [attempt, setAttempt] = useState(0);
  const key = `${query}|${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    quote: DeliveryQuote | null;
  } | null>(null);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        // Staff identity is separate from the buyer whose waiver is applied on save.
        const response = await fetch(
          `${API_URL}/api/shipping/calculate?${query}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        );
        const body = (await response.json()) as {
          success?: boolean;
          data?: DeliveryQuote;
        };
        const amount = body.data?.baseFee ?? body.data?.fee;
        if (
          !response.ok ||
          !body.success ||
          !body.data ||
          typeof amount !== 'number' ||
          !Number.isFinite(amount) ||
          amount < 0
        ) {
          throw new Error('Delivery rate unavailable');
        }
        if (!controller.signal.aborted) setResult({ key, quote: body.data });
      } catch {
        if (!controller.signal.aborted) setResult({ key, quote: null });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, key]);

  const current = query && result?.key === key ? result : null;
  const quote = current?.quote ?? null;
  const baseFee = quote ? Math.round(quote.baseFee ?? quote.fee) : null;
  const feeInput = delivery.feeOverride;
  const override =
    feeInput !== undefined &&
    /^\d+$/.test(feeInput) &&
    Number.isSafeInteger(Number(feeInput))
      ? Number(feeInput)
      : undefined;
  return {
    baseFee,
    override,
    hasFee: feeInput !== undefined ? override !== undefined : baseFee !== null,
    fee: feeInput !== undefined ? (override ?? 0) : (baseFee ?? 0),
    loading: Boolean(query && !current),
    failed: Boolean(current && !quote),
    retry: () => setAttempt((previous) => previous + 1),
    info:
      quote && baseFee !== null
        ? {
            baseFee,
            source: quote.source,
            distanceKm: quote.distanceKm,
            routeType: quote.routeType,
            stops: quote.stops,
            zone: quote.zone,
            zoneLabel: quote.label,
            daysMin: quote.deliveryDaysMin,
            daysMax: quote.deliveryDaysMax,
          }
        : undefined,
  };
}
