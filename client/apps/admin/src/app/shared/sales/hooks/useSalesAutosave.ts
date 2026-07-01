// client/apps/admin/src/app/shared/sales/hooks/useSalesAutosave.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { salesOrderService } from '@/services/salesOrder.service';
import { routes } from '@/config/routes';
import type { SalesOrder } from '@/services/salesOrder.service';
import type { PricedLine } from '../sales-line-table';

export interface UseSalesAutosaveOptions {
  token: string;
  initial?: SalesOrder;
  priced: PricedLine[];
  customer: { _id: string } | null;
  notes: string;
  terms: string;
  validUntil: string;
  paymentTerms: string;
  pricelistId: string;
  warehouseId: string;
  buildPayload: () => Record<string, any>;
}

export function useSalesAutosave({
  token,
  initial,
  priced,
  customer,
  notes,
  terms,
  validUntil,
  paymentTerms,
  pricelistId,
  warehouseId,
  buildPayload,
}: UseSalesAutosaveOptions) {
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const draftIdRef = useRef<string | null>(initial?._id ?? null);
  const isDirtyRef = useRef(false);
  const autoSaveEnabledRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      autoSaveEnabledRef.current = true;
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (autoSaveEnabledRef.current) isDirtyRef.current = true;
  }, [
    priced,
    customer,
    notes,
    terms,
    validUntil,
    paymentTerms,
    pricelistId,
    warehouseId,
  ]);

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const latestPayloadRef = useRef<ReturnType<typeof buildPayload> | null>(null);
  useEffect(() => {
    if (autoSaveEnabledRef.current) {
      latestPayloadRef.current = buildPayload();
    }
  }, [buildPayload]);

  const bgSaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    bgSaveRef.current = () => {
      if (!isDirtyRef.current) return;
      const tok = tokenRef.current;
      if (!tok) return;
      const payload = latestPayloadRef.current;
      if (!payload) return;
      const hasProduct = ((payload as any).items ?? []).some(
        (l: any) => l.lineType === 'product' && l.subproduct
      );
      if (!hasProduct) return;

      const BASE =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const existingId = initial?._id ?? draftIdRef.current;
      if (existingId) {
        fetch(`${BASE}/api/sales-orders/${existingId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
          },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } else {
        fetch(`${BASE}/api/sales-orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
          },
          body: JSON.stringify({ ...payload, docType: 'quotation' }),
          keepalive: true,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps — intentional: restarts interval only when token or doc ID changes; form data read from refs
  }, [token, initial?._id]);

  useEffect(() => {
    if (!token) return;
    const productLines = priced.filter(
      (l) => l.lineType === 'product' && l.subProductId
    );
    if (productLines.length === 0) return;

    const timer = setTimeout(async () => {
      if (!autoSaveEnabledRef.current) return;
      setAutoSaveStatus('saving');
      try {
        const payload = buildPayload();
        const existingId = initial?._id ?? draftIdRef.current;
        if (existingId) {
          await salesOrderService.update(existingId, payload as any, token);
        } else {
          const res = await salesOrderService.create(
            { ...payload, docType: 'quotation' } as any,
            token
          );
          const newId = res.data._id;
          draftIdRef.current = newId;
          window.history.replaceState(
            null,
            '',
            routes.eCommerce.salesEdit(newId)
          );
        }
        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
      } catch {
        setAutoSaveStatus('error');
      }
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps — buildPayload omitted to prevent infinite loop; refs omitted intentionally
  }, [
    priced,
    customer,
    notes,
    terms,
    validUntil,
    paymentTerms,
    pricelistId,
    token,
  ]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      bgSaveRef.current();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    return () => {
      bgSaveRef.current();
    };
  }, []);

  async function handleManualSave() {
    const productLines = priced.filter(
      (l) => l.lineType === 'product' && l.subProductId
    );
    if (productLines.length === 0) return;
    setAutoSaveStatus('saving');
    try {
      const payload = buildPayload();
      const existingId = initial?._id ?? draftIdRef.current;
      if (existingId) {
        await salesOrderService.update(existingId, payload as any, token);
      } else {
        const res = await salesOrderService.create(
          { ...payload, docType: 'quotation' } as any,
          token
        );
        draftIdRef.current = res.data._id;
        window.history.replaceState(
          null,
          '',
          routes.eCommerce.salesEdit(res.data._id)
        );
      }
      isDirtyRef.current = false;
      setAutoSaveStatus('saved');
    } catch {
      setAutoSaveStatus('error');
    }
  }

  async function ensureSaved(): Promise<string | null> {
    const existingId = initial?._id ?? draftIdRef.current;
    if (existingId) return existingId;
    const productLines = priced.filter(
      (l) => l.lineType === 'product' && l.subProductId
    );
    if (productLines.length === 0) return null;
    try {
      setAutoSaveStatus('saving');
      const res = await salesOrderService.create(
        { ...buildPayload(), docType: 'quotation' } as any,
        token
      );
      const newId = res.data._id;
      draftIdRef.current = newId;
      window.history.replaceState(
        null,
        '',
        routes.eCommerce.salesEdit(newId)
      );
      setAutoSaveStatus('saved');
      return newId;
    } catch {
      setAutoSaveStatus('error');
      return null;
    }
  }

  return {
    autoSaveStatus,
    setAutoSaveStatus,
    isDirtyRef,
    draftIdRef,
    handleManualSave,
    ensureSaved,
  };
}
