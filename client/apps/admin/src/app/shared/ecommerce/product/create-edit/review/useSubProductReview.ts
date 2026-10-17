'use client';
import { useEffect, useState } from 'react';
import { subproductService } from '@/services/subproduct.service';
import { initialDrafts, reviewLines } from './pricing';
import type { PriceDraft, ReviewListing } from './types';
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
export function readReview(response: unknown, id: string): ReviewListing {
  const root = object(response) ? response : {};
  const data = object(root.data) ? root.data : root;
  const listing = object(data.subProduct) ? data.subProduct : data;
  if (
    listing._id !== id ||
    typeof listing.status !== 'string' ||
    (listing.sizes !== undefined &&
      (!Array.isArray(listing.sizes) ||
        listing.sizes.some((s: unknown) => !object(s) || typeof s._id !== 'string')))
  )
    throw new Error('The server returned invalid listing details.');
  return listing as unknown as ReviewListing;
}
export function useSubProductReview(id: string, token: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    listing: ReviewListing | null;
    drafts: Record<string, PriceDraft>;
    loading: boolean;
    error: string | null;
  }>({ key: '', listing: null, drafts: {}, loading: true, error: null });
  const key = `${id}:${token}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    setState({
      key,
      listing: null,
      drafts: {},
      loading: !!token,
      error: token ? null : 'Sign in again to review this listing.',
    });
    if (!token) return () => controller.abort();
    void subproductService
      .getSubProduct(id, token, { refresh: 'true' }, controller.signal)
      .then((response: unknown) => {
        if (controller.signal.aborted) return;
        const listing = readReview(response, id);
        setState({
          key,
          listing,
          drafts: initialDrafts(reviewLines(listing)),
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            listing: null,
            drafts: {},
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load this listing.',
          });
      });
    return () => controller.abort();
  }, [id, token, key, attempt]);
  const current =
    state.key === key
      ? state
      : { listing: null, drafts: {}, loading: !!token, error: null };
  const edit = (lineId: string, field: keyof PriceDraft, value: string) =>
    setState((previous) =>
      previous.key === key
        ? {
            ...previous,
            drafts: {
              ...previous.drafts,
              [lineId]: { ...previous.drafts[lineId], [field]: value },
            },
          }
        : previous
    );
  const updateDrafts = (
    update: (drafts: Record<string, PriceDraft>) => Record<string, PriceDraft>
  ) =>
    setState((previous) =>
      previous.key === key
        ? { ...previous, drafts: update(previous.drafts) }
        : previous
    );
  const reset = (lineId?: string) =>
    setState((previous) => {
      if (previous.key !== key || !previous.listing) return previous;
      const defaults = initialDrafts(reviewLines(previous.listing));
      return {
        ...previous,
        drafts: lineId
          ? { ...previous.drafts, [lineId]: defaults[lineId] }
          : defaults,
      };
    });
  return {
    ...current,
    edit,
    updateDrafts,
    reset,
    refresh: () => setAttempt((v) => v + 1),
  };
}
