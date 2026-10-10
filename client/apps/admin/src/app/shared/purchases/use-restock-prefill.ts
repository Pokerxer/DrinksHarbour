'use client';
import { useEffect, useState } from 'react';
import {
  arrivalEstimate,
  type RestockPreparation,
} from './restock-preparation';
import { planningRequest } from '@/services/notificationInsights.service';
import {
  draftKey,
  readDraft,
  validQuantity,
  type RestockDraft,
} from '../notifications/vendor-orders/order-draft';
export interface RestockReference {
  coverDays: number;
  lines: Array<{ key: string; offerId: string }>;
}
export function useRestockPrefill(
  token: string,
  scope: string,
  onLoad: (draft: RestockDraft) => void,
  onReset?: () => void
) {
  const [state, setState] = useState<{
    scope: string;
    loading: boolean;
    error: string;
    reference: RestockReference | null;
    notice: string;
    prepared: RestockPreparation | null;
  }>({
    scope,
    loading: false,
    error: '',
    reference: null,
    notice: '',
    prepared: null,
  });
  useEffect(() => {
    if (
      !token ||
      !scope ||
      new URLSearchParams(window.location.search).get('restock') !== '1'
    )
      return;
    onReset?.();
    const abort = new AbortController();
    setState({
      scope,
      loading: true,
      error: '',
      reference: null,
      notice: '',
      prepared: null,
    });
    const load = async () => {
      const stored = readDraft(sessionStorage.getItem(draftKey(scope)), scope);
      if (!stored)
        throw new Error(
          'This restock preparation expired or belongs to another session. Return to Vendor orders and prepare it again.'
        );
      const plan = await planningRequest(
        token,
        'order-plan',
        `coverDays=${stored.coverDays}`,
        abort.signal,
        true
      );
      if (!plan.canPurchase)
        throw new Error(
          'Purchasing access is required to load this vendor order.'
        );
      const offers: RestockPreparation['offers'] = [];
      const items = stored.items.map((item) => {
        const line = plan.lines.find((l) => l.key === item.key),
          offer = line?.alternatives?.find((o) => o.offerId === item.offerId);
        if (
          !line ||
          !offer ||
          line.summary ||
          line.subProductId !== item.subProductId ||
          line.sizeId !== item.sizeId ||
          line.warehouseId !== stored.warehouseId ||
          offer.vendorId !== stored.vendorId ||
          offer.currency !== stored.currency ||
          !validQuantity(item.quantity, offer)
        )
          throw new Error(
            'Supplier terms or stock evidence changed. Return to Vendor orders and review the recommendation.'
          );
        offers.push(offer);
        return {
          ...item,
          productName: line.productName,
          sku: line.sku,
          sizeName: line.sizeName,
          uom: offer.packaging,
          unitPrice: offer.unitPrice,
          packSize: offer.packagingQty,
          packQty: item.quantity / offer.packagingQty,
          packPrice: offer.unitPrice * offer.packagingQty,
        };
      });
      if (abort.signal.aborted) return;
      const changed = items.filter(
        (item, i) =>
          item.unitPrice !== stored.items[i].unitPrice ||
          item.packSize !== stored.items[i].packSize
      ).length;
      const draft = {
        ...stored,
        expectedArrival: arrivalEstimate(offers),
        vendorName:
          plan.lines
            .flatMap((l) => l.alternatives || [])
            .find((o) => o.vendorId === stored.vendorId)?.vendorName ||
          stored.vendorName,
        items,
      };
      onLoad(draft);
      setState({
        scope,
        loading: false,
        error: '',
        prepared: { draft, offers, coverDays: stored.coverDays },
        notice: changed
          ? `${changed} ${changed === 1 ? 'product has' : 'products have'} updated supplier price or pack terms. Review the current totals before saving.`
          : '',
        reference: {
          coverDays: stored.coverDays,
          lines: items.map((i) => ({ key: i.key, offerId: i.offerId })),
        },
      });
    };
    void load().catch((e) => {
      if (!abort.signal.aborted)
        setState({
          scope,
          loading: false,
          error:
            e instanceof Error
              ? e.message
              : 'Unable to load restock preparation.',
          reference: null,
          notice: '',
          prepared: null,
        });
    });
    return () => abort.abort();
  }, [token, scope, onLoad, onReset]);
  return state.scope === scope
    ? state
    : {
        scope,
        loading: true,
        error: '',
        reference: null,
        notice: '',
        prepared: null,
      };
}

export function forgetRestockDraft(scope: string) {
  try {
    sessionStorage.removeItem(draftKey(scope));
  } catch {
    // Storage cleanup must not turn a saved purchase into an apparent failure.
  }
}
