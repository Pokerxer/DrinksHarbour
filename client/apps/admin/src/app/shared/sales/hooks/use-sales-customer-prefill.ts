'use client';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { useSalesCreateForm } from './useSalesCreateForm';
export function useSalesCustomerPrefill(
  form: ReturnType<typeof useSalesCreateForm>,
  token: string,
  mode: 'create' | 'edit',
  prefillCustomer: string
) {
  const prefillDoneRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create' || !token || !prefillCustomer) return;
    if (prefillDoneRef.current || form.customer) return;
    prefillDoneRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const res = await posApi.searchCustomers(token, prefillCustomer, 10);
        if (cancelled) return;
        const needle = prefillCustomer.trim().toLowerCase();
        const exact = (res?.customers ?? []).find(
          (c) =>
            (c.email || '').toLowerCase() === needle ||
            (c.phone || '').replace(/\s/g, '') === needle.replace(/\s/g, '')
        );
        if (exact) {
          form.handleSelectCustomer(exact);
          toast.success(
            `Customer ${`${exact.firstName} ${exact.lastName}`.trim()} selected`
          );
        } else {
          toast(`No saved customer matches ${prefillCustomer}`, { icon: 'ℹ️' });
        }
      } catch {
        // A failed prefill must never block the page — the operator can always
        // pick the customer by hand.
      }
    })();

    return () => {
      cancelled = true;
    };
    // form.customer/handleSelectCustomer are intentionally omitted: this must
    // run once per mount, and the ref already guards re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, prefillCustomer]);
}
