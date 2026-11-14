'use client';

// Builder line state + live server-priced preview (advisory).
// The marketplace price routinely differs from the retail price a picker
// displays, so `price_changed` is EXPECTED for most lines — the preview adopts
// the server-corrected price/quantity (mirroring checkout's "Accept & Continue")
// while order creation re-prices authoritatively. Never sends winning prices.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { BuilderLine } from '@/services/whatsapp-order.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const PREVIEW_DEBOUNCE_MS = 350;

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

/** Per-item result of POST /api/cart/validate (public; prices from subProductId+sizeId). */
interface CartValidateItem {
  subProductId?: string;
  sizeId?: string | null;
  status?: string; // 'ok' | 'price_changed' | 'quantity_reduced' | 'out_of_stock' | 'unavailable'
  currentPrice?: number | null;
  maxQuantity?: number | null;
}

const mapKey = (subProductId?: string, sizeId?: string | null) => `${subProductId ?? ''}|${sizeId ?? ''}`;

/** Product lines that actually reference a catalogue item — the only lines the
 *  preview validates (sections, notes and the empty "Add a product" row skip). */
const previewable = (lines: BuilderLine[]) =>
  lines.filter((l) => l.lineType === 'product' && l.subProductId);

/** Preview signature — JSON of the product lines' [subProductId, sizeId, quantity]. */
const signatureOf = (lines: BuilderLine[]) =>
  JSON.stringify(previewable(lines).map((l) => [l.subProductId, l.sizeId ?? null, l.quantity]));

export function useBuilderLines(initial: BuilderLine[]) {
  const [lines, setLines] = useState<BuilderLine[]>(initial);
  const [previewing, setPreviewing] = useState(false);
  /** Keys of product lines whose shown price is not server-confirmed: unpriced
   *  lines (unitPrice == null) plus lines the latest preview batch corrected. */
  const [stalePriceKeys, setStalePriceKeys] = useState<Set<string>>(() => new Set());

  // Latest lines for the response handler — merging onto the freshest snapshot
  // avoids clobbering edits (notes/descriptions) made while the request flew.
  const linesRef = useRef<BuilderLine[]>(lines);
  linesRef.current = lines;
  const seqRef = useRef(0);

  const addProductLine = useCallback(
    (l: Omit<BuilderLine, 'key' | 'lineType' | 'quantity'> & { quantity?: number }) => {
      setLines((prev) => [
        ...prev,
        { ...l, key: crypto.randomUUID(), lineType: 'product', quantity: l.quantity ?? 1 },
      ]);
    },
    [],
  );

  const addSection = useCallback(() => {
    setLines((prev) => [...prev, { key: crypto.randomUUID(), lineType: 'section', quantity: 0 }]);
  }, []);

  const addNote = useCallback(() => {
    setLines((prev) => [...prev, { key: crypto.randomUUID(), lineType: 'note', quantity: 0 }]);
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const update = useCallback((key: string, patch: Partial<BuilderLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const setQuantity = useCallback((key: string, q: number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key && l.lineType === 'product' ? { ...l, quantity: Math.max(1, q) } : l)),
    );
  }, []);

  /** Adopt validate results back onto the current lines, keyed by
   *  subProductId+sizeId. Side effects (toast/stale keys) run outside setLines. */
  const adopt = useCallback((results: CartValidateItem[]) => {
    const byKey = new Map(results.map((r) => [mapKey(r.subProductId, r.sizeId ?? null), r] as const));
    const priceUpdates: Array<{ name: string; price: number }> = [];
    const corrected = new Set<string>();

    const next = linesRef.current.map((l) => {
      if (l.lineType !== 'product' || !l.subProductId) return l;
      const v = byKey.get(mapKey(l.subProductId, l.sizeId ?? null));
      if (!v || v.status === 'ok') return l;
      if (v.status === 'out_of_stock' || v.status === 'unavailable') {
        if (l.availableStock !== 0) {
          corrected.add(l.key);
          return { ...l, availableStock: 0 };
        }
        return l;
      }
      let nextL = l;
      if (
        v.status === 'price_changed' &&
        typeof v.currentPrice === 'number' &&
        v.currentPrice > 0 &&
        nextL.unitPrice !== v.currentPrice
      ) {
        priceUpdates.push({
          name: [nextL.productName, nextL.sizeName].filter(Boolean).join(' · ') || 'Item',
          price: v.currentPrice,
        });
        nextL = { ...nextL, unitPrice: v.currentPrice };
        corrected.add(nextL.key);
      }
      if (typeof v.maxQuantity === 'number' && nextL.quantity > v.maxQuantity) {
        nextL = { ...nextL, quantity: Math.max(1, v.maxQuantity) };
        corrected.add(nextL.key);
      }
      return nextL;
    });

    if (priceUpdates.length > 0) {
      // At most one price toast per change batch.
      const f = priceUpdates[0];
      const more = priceUpdates.length - 1;
      toast.success(`Price updated: ${f.name} → ${fmtNgn(f.price)}${more > 0 ? ` (+${more} more)` : ''}`);
    }
    setLines(next);
    const stale = new Set<string>();
    for (const l of next) {
      if (l.lineType === 'product' && l.subProductId && (l.unitPrice == null || corrected.has(l.key))) {
        stale.add(l.key);
      }
    }
    setStalePriceKeys(stale);
  }, []);

  // ── Live preview: debounced on the quantity/line signature, seq-guarded ──
  const signature = useMemo(() => signatureOf(lines), [lines]);

  useEffect(() => {
    const items = previewable(lines).map((l) => ({
      subProductId: l.subProductId as string,
      sizeId: l.sizeId ?? null,
      quantity: l.quantity,
      price: l.unitPrice ?? null,
    }));
    if (items.length === 0) {
      setPreviewing(false);
      return;
    }
    const timer = setTimeout(async () => {
      const seq = ++seqRef.current;
      setPreviewing(true);
      try {
        const res = await fetch(`${API_URL}/api/cart/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { items?: CartValidateItem[] };
        };
        if (seq !== seqRef.current || !body?.success) return;
        // The user edited lines/quantities while the request flew — a fresh
        // preview is already scheduled for the new signature; drop this one.
        if (signatureOf(linesRef.current) !== signature) return;
        adopt(body.data?.items || []);
      } catch {
        /* advisory preview — network failures leave the shown prices as-is */
      } finally {
        if (seq === seqRef.current) setPreviewing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature drives re-runs; `lines` snapshot is captured per run
  }, [signature, adopt]);

  return {
    lines,
    setLines,
    addProductLine,
    addSection,
    addNote,
    remove,
    update,
    setQuantity,
    previewing,
    stalePriceKeys,
  } as const;
}

export default useBuilderLines;
