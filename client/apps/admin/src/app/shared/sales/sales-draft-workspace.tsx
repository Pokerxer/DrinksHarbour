'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SalesCreate from '@/app/shared/sales/sales-create';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { routes } from '@/config/routes';

export default function SalesDraftWorkspace({
  invoice = false,
}: {
  invoice?: boolean;
}) {
  const label = invoice ? 'invoice' : 'quotation';
  const params = useSearchParams();
  // Draft autosave replaces the URL without remounting the working form.
  const [draft] = useState(() => params?.get('draft') || '');
  const { data: session, status: authStatus } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const [initial, setInitial] = useState<SalesOrder>();
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [version, setVersion] = useState(0);
  const [loadedToken, setLoadedToken] = useState('');
  useEffect(() => {
    if (!draft || !token) return;
    let current = true;
    setError('');
    setBlocked(false);
    salesOrderService
      .get(draft, token)
      .then((result) => {
        if (!current) return;
        if (
          !invoice &&
          result.data.docType === 'order' &&
          !result.data.invoiceIssuedAt
        ) {
          setBlocked(true);
          setError(
            'This quotation has already been converted to an order. Open the document to review it.'
          );
        } else if (
          result.data.invoiceIssuedAt ||
          (result.data.docType === 'order' &&
            result.data.orderStatus !== 'draft')
        ) {
          setBlocked(true);
          setError(
            'This invoice has already been issued. Open it to view details or record payment.'
          );
        } else if (
          result.data.docType === 'quotation' &&
          !['draft', 'sent', 'accepted'].includes(result.data.quoteStatus || '')
        ) {
          setBlocked(true);
          setError(
            'This draft is no longer active. Open the source document to review its status.'
          );
        } else {
          setInitial(result.data);
          setLoadedToken(token);
        }
      })
      .catch((err) => {
        if (current)
          setError(err instanceof Error ? err.message : 'Unable to load draft');
      });
    return () => {
      current = false;
    };
  }, [draft, token, version, invoice]);
  if (authStatus === 'loading')
    return (
      <p role="status" className="p-6 text-sm text-gray-500">
        Loading your {label} workspace…
      </p>
    );
  if (!token)
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        Sign in to create or reopen a {label}.
      </p>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-white p-5"
      >
        <p>{error}</p>
        {!blocked && (
          <button
            type="button"
            onClick={() => setVersion((value) => value + 1)}
            className="mr-4 mt-3 min-h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-brand"
          >
            Retry draft
          </button>
        )}
        <Link
          className="mt-3 inline-block underline"
          href={
            draft
              ? routes.eCommerce.salesDetails(draft)
              : invoice
                ? routes.accounting.invoices
                : routes.eCommerce.salesOrders
          }
        >
          Open document
        </Link>
      </div>
    );
  if (draft && (!initial || loadedToken !== token))
    return (
      <p role="status" className="p-6 text-gray-500">
        Loading {label} draft…
      </p>
    );
  return <SalesCreate invoice={invoice} initial={initial} />;
}
