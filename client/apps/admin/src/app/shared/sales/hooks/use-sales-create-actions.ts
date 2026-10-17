'use client';
import { useRef, useState } from 'react';
import type { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { routes } from '@/config/routes';
import { singleFlight } from '../sales-repricing';
import { salesCreateReadiness } from '../sales-create-rules';
import type { useSalesCreateForm } from './useSalesCreateForm';
import { printProformaInvoice, printQuotation } from '@/utils/salesInvoice';
import type { SalesDocVariant } from '@/utils/print/so-print';

export function useSalesCreateActions({
  form,
  token,
  initial,
  ensureSaved,
  router,
  tenantName,
  onHistory,
  disabled = false,
  onPersisted,
  orderId,
  readOnly = false,
}: {
  form: ReturnType<typeof useSalesCreateForm>;
  token: string;
  disabled?: boolean;
  onPersisted?: () => void;
  initial?: SalesOrder;
  orderId?: string;
  readOnly?: boolean;
  ensureSaved: (force?: boolean) => Promise<string | null>;
  router: ReturnType<typeof useRouter>;
  tenantName: string;
  onHistory: () => void;
}) {
  const pending = useRef(false);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function run(kind: string, work: () => Promise<void>) {
    if (pending.current || disabled) return;
    if (!token) {
      setError('Sign in to continue.');
      return;
    }
    pending.current = true;
    setAction(kind);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not finish the action. Try again.'
      );
    } finally {
      pending.current = false;
      setAction(null);
    }
  }
  const [confirmPrices, setConfirmPrices] = useState(false);
  const [pricesBusy, setPricesBusy] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const updatePricesFlight = useRef(singleFlight());
  function handleUpdatePrices() {
    return updatePricesFlight.current(() =>
      run('repricing', async () => {
        setPricesBusy(true);
        try {
          const id = await ensureSaved();
          if (!id) {
            toast.error('Add a product first');
            return;
          }
          const res = await salesOrderService.updatePrices(id, token);
          form.applyServerItems(res.data.items);
          toast.success('Prices updated');
          onHistory();
          setConfirmPrices(false);
        } catch (err: unknown) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to update prices'
          );
        } finally {
          setPricesBusy(false);
        }
      })
    );
  }

  // Coupons are validated server-side against tenant Promotions, so the
  // document must exist first (same ensureSaved pattern as Update Prices).
  async function handleCoupon(code: string) {
    let failure: unknown;
    await run('coupon', async () => {
      setCouponBusy(true);
      try {
        const id = await ensureSaved(true);
        if (!id) {
          throw new Error('Save a product line before applying a coupon.');
        }
        const res = await salesOrderService.applyCoupon(id, code, token);
        const so = res.data;
        form.setCoupon(
          so.couponCode
            ? {
                code: so.couponCode,
                name: so.couponName ?? '',
                discount: so.couponDiscount ?? 0,
              }
            : null
        );
        toast.success(
          code ? `Coupon ${so.couponCode} applied` : 'Coupon removed'
        );
        onHistory();
      } catch (err: unknown) {
        failure = err;
        toast.error(
          err instanceof Error ? err.message : 'Could not apply coupon'
        );
      } finally {
        setCouponBusy(false);
      }
    });
    if (failure) throw failure;
  }

  function validate(confirm = false) {
    const ready = salesCreateReadiness(
      form.priced,
      form.grandTotal,
      form.validUntil
    );
    const invalid = confirm ? ready.confirmError : ready.saveError;
    if (invalid) {
      setError(invalid);
      return false;
    }
    return true;
  }
  async function flush() {
    const id = await ensureSaved(true);
    if (!id)
      throw new Error(
        'Could not save draft. Retry Save draft before continuing.'
      );
    return id;
  }
  function handleManualSave() {
    return run('saving', async () => {
      if (!validate()) return;
      await flush();
    });
  }
  function handleSaveEdit() {
    return run('saving', async () => {
      if (!initial || !validate()) return;
      await flush();
      onPersisted?.();
      toast.success('Changes saved');
      router.push(routes.eCommerce.salesDetails(initial._id));
    });
  }
  function handleSave(asOrder: boolean) {
    return run(asOrder ? 'confirming' : 'saving', async () => {
      if (!validate(asOrder)) return;
      if (asOrder && orderId) {
        const existing = await salesOrderService.get(orderId, token);
        if (existing.data.docType === 'order') {
          if (existing.data.orderStatus === 'draft') await salesOrderService.confirmReservation(orderId, token);
          onPersisted?.();
          router.push(routes.eCommerce.salesDetails(orderId));
          return;
        }
        if (
          existing.data.invoiceIssuedAt ||
          ['converted', 'expired', 'rejected'].includes(
            existing.data.quoteStatus || ''
          )
        )
          throw new Error(
            'This quotation is no longer active. Open the saved document to review it.'
          );
      }
      const id = await flush();
      if (asOrder) {
        await salesOrderService.confirmReservation(id, token);
        toast.success('Order confirmed; available stock reserved');
      } else toast.success('Quotation saved');
      onPersisted?.();
      router.push(routes.eCommerce.salesDetails(id));
    });
  }
  function handlePrint(type: SalesDocVariant) {
    return run('printing', async () => {
      if (!readOnly && !validate()) return;
      const id = readOnly ? orderId : await flush();
      if (!id) throw new Error('No saved document to print.');
      const res = await salesOrderService.get(id, token);
      (type === 'proforma' ? printProformaInvoice : printQuotation)(
        res.data,
        tenantName
      );
    });
  }

  return {
    action,
    error,
    handleManualSave,
    confirmPrices,
    setConfirmPrices,
    pricesBusy,
    couponBusy,
    handleUpdatePrices,
    handleCoupon,
    handleSaveEdit,
    handleSave,
    handlePrint,
  };
}
