'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { salesOrderService } from '@/services/salesOrder.service';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { vendorBillService } from '@/services/vendorBill.service';
import { buildSalesDoc, type SalesDocVariant } from '@/utils/print/so-print';
import { buildPOInvoice } from '@/utils/print/po-print';
import { buildRFQInvoice } from '@/utils/print/rfq-print';
import { buildBillInvoice } from '@/utils/print/bill-print';
import type { DocumentModel } from '@/utils/print/doc-model';
import { requestDocumentExport } from '@/utils/print/document-export';
export default function DirectDocumentPrint({
  id,
  kind,
  variant,
}: {
  id: string;
  kind: 'sales' | 'purchases' | 'bill';
  variant?: SalesDocVariant;
}) {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const token = (session?.user as { token?: string })?.token;
  const [result, setResult] = useState<{ key: string; model?: DocumentModel; error?: string }>();
  const [retry, setRetry] = useState(0);
  const key = `${token}:${tenant?._id}:${id}:${kind}:${variant}`;
  useEffect(() => {
    if (!token) return;
    let active = true;
    async function load() {
      const name = tenant?.name || 'DrinksHarbour';
      if (kind === 'sales') {
        const { data } = await salesOrderService.get(id, token!);
        return buildSalesDoc(
          data,
          name,
          variant ?? (data.docType === 'quotation' ? 'quotation' : 'sales-order')
        );
      }
      if (kind === 'bill') {
        const { data } = await vendorBillService.getVendorBill(id, token!);
        return buildBillInvoice(data, name);
      }
      const { data } = await purchaseOrderService.getPurchaseOrder(id, token!);
      return ['confirmed', 'received', 'validated', 'billed', 'partially_received'].includes(
        data.status
      )
        ? buildPOInvoice(data as Parameters<typeof buildPOInvoice>[0], name)
        : buildRFQInvoice(data as Parameters<typeof buildRFQInvoice>[0], name);
    }
    load()
      .then((model) => {
        if (active) {
          setResult({ key, model });
          requestDocumentExport(model);
        }
      })
      .catch((error) => {
        if (active)
          setResult({
            key,
            error: error instanceof Error ? error.message : 'Unable to load document',
          });
      });
    return () => {
      active = false;
    };
  }, [key, token, tenant?.name, id, kind, variant, retry]);
  const current = result?.key === key ? result : undefined;
  return (
    <main className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">Print document</h1>
      {current?.error ? (
        <p role="alert">
          {current.error}{' '}
          <button onClick={() => setRetry((v) => v + 1)} className="underline">
            Retry
          </button>
        </p>
      ) : current?.model ? (
        <>
          <p>Choose a template in the preview, then download or print your PDF.</p>
          <button
            className="rounded border px-4 py-2"
            onClick={() => requestDocumentExport(current.model!)}
          >
            Open preview
          </button>
        </>
      ) : (
        <p role="status">Loading document…</p>
      )}
    </main>
  );
}
