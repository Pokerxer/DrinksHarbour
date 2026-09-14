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

export default function InvoiceCreate() {
  const params = useSearchParams();
  // Draft autosave replaces the URL without remounting the working form.
  const [draft] = useState(() => params?.get('draft') || '');
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const [initial, setInitial] = useState<SalesOrder>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!draft || !token) return;
    let current = true;
    salesOrderService
      .get(draft, token)
      .then((result) => {
        if (!current) return;
        if (
          result.data.docType === 'order' &&
          result.data.orderStatus !== 'draft'
        ) {
          setError(
            'This invoice has already been issued. Open it to view details or record payment.'
          );
        } else setInitial(result.data);
      })
      .catch((err) => {
        if (current)
          setError(err instanceof Error ? err.message : 'Unable to load draft');
      });
    return () => {
      current = false;
    };
  }, [draft, token]);
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-white p-5"
      >
        <p>{error}</p>
        <Link
          className="mt-3 inline-block underline"
          href={
            draft
              ? routes.eCommerce.salesDetails(draft)
              : routes.accounting.invoices
          }
        >
          Open document
        </Link>
      </div>
    );
  if (draft && !initial)
    return (
      <p role="status" className="p-6 text-gray-500">
        Loading invoice draft…
      </p>
    );
  return <SalesCreate invoice initial={initial} />;
}
