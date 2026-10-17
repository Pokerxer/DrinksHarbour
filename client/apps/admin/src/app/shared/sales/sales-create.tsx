'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { useSalesCreateForm } from './hooks/useSalesCreateForm';
import { useSalesAutosave } from './hooks/useSalesAutosave';
import { useSalesCreateActions } from './hooks/use-sales-create-actions';
import { useSalesCustomerPrefill } from './hooks/use-sales-customer-prefill';
import SalesCreateHeader from './sales-create-header';
import SalesCreateReview from './sales-create-review';
import { salesCreateReadiness } from './sales-create-rules';
import InvoiceCreateHeader from '@/app/shared/accounting/invoice-create-header';
import InvoiceCreateDetails from '@/app/shared/accounting/invoice-create-details';
import InvoiceCreateReview from '@/app/shared/accounting/invoice-create-review';
import { invoiceReadiness } from '@/app/shared/accounting/invoice-create-rules';
import { useInvoiceCreateActions } from '@/app/shared/accounting/use-invoice-create-actions';
import SalesCreateEditor from './sales-create-editor';
import SalesCreateOverlays from './sales-create-overlays';
import SalesActivityPanel from './sales-activity-panel';
import { useTenant } from '@/context/TenantContext';
import { printProformaInvoice } from '@/utils/salesInvoice';
import { editableSale } from './sales-edit-policy';
import SalesEditControls from './sales-edit-controls';
import SalesEditDelivery from './sales-edit-delivery';

export default function SalesCreate({
  mode = 'create',
  initial,
  invoice = false,
  onUpdated,
}: {
  mode?: 'create' | 'edit';
  invoice?: boolean;
  initial?: SalesOrder;
  onUpdated?: (doc: SalesOrder) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const { tenant } = useTenant();
  const readOnly =
    mode === 'edit' && Boolean(initial && !editableSale(initial));
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const form = useSalesCreateForm({ token, mode, initial });
  const [invoiceDueDate, setInvoiceDueDate] = useState(
    initial?.dueDate?.slice(0, 10) || '',
  );
  const autosave = useSalesAutosave({
    enabled: !readOnly,
    token,
    initial,
    draftPath: invoice
      ? (id) => `${routes.accounting.invoiceCreate}?draft=${id}`
      : mode === 'create'
        ? (id) => `/sales/create?draft=${id}`
        : undefined,
    priced: form.priced,
    customer: form.customer,
    notes: form.notes,
    terms: form.terms,
    validUntil: form.validUntil,
    paymentTerms: form.paymentTerms,
    pricelistId: form.pricelistId,
    warehouseId: form.warehouseId,
    shippingFee: form.shippingFee,
    plannedRedeemPoints: form.plannedRedeemPoints,
    buildPayload: invoice
      ? () => ({
          ...form.buildPayload(),
          dueDate: invoiceDueDate || null,
          invoiceDraft: true,
        })
      : form.buildPayload,
  });
  const orderId = initial?._id || autosave.draftId || undefined;
  const [historyKey, setHistoryKey] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const onHistory = () => setHistoryKey((value) => value + 1);
  useEffect(() => {
    if (autosave.autoSaveStatus === 'saved')
      setHistoryKey((value) => value + 1);
  }, [autosave.autoSaveStatus]);
  useSalesCustomerPrefill(
    form,
    token,
    mode,
    useSearchParams()?.get('customer') || '',
  );
  const actions = useSalesCreateActions({
    readOnly,
    form,
    token,
    initial,
    ensureSaved: autosave.ensureSaved,
    orderId,
    router,
    tenantName: tenant?.name || 'DrinksHarbour',
    onHistory,
    disabled:
      lifecycleBusy || form.saving || autosave.autoSaveStatus === 'saving',
    onPersisted: () => {
      autosave.isDirtyRef.current = false;
    },
  });
  const currency = initial?.currency || 'NGN';
  const readiness = invoiceReadiness(
    form.priced,
    form.grandTotal,
    invoiceDueDate,
    currency,
  );
  const salesReady = salesCreateReadiness(
    form.priced,
    form.grandTotal,
    form.validUntil,
  );
  const externalBusy =
    lifecycleBusy ||
    form.saving ||
    autosave.autoSaveStatus === 'saving' ||
    actions.pricesBusy ||
    actions.couponBusy ||
    Boolean(actions.action);
  const invoiceActions = useInvoiceCreateActions({
    token,
    orderId,
    dueDate: invoiceDueDate,
    ...readiness,
    disabled: externalBusy,
    ensureSaved: autosave.ensureSaved,
    onPrint: async (id) => {
      const result = await salesOrderService.get(id, token);
      printProformaInvoice(result.data, tenant?.name || 'DrinksHarbour');
    },
    onIssued: () => {
      autosave.isDirtyRef.current = false;
      toast.success('Invoice issued');
      router.push(routes.accounting.invoices);
    },
  });
  const busy = externalBusy || Boolean(invoiceActions.action);
  return (
    <div className={`min-w-0 ${invoice ? 'pb-16' : 'pb-24'}`}>
      {invoice ? (
        <InvoiceCreateHeader
          saving={externalBusy}
          hasLines={form.hasLines}
          action={invoiceActions.action}
          saveStatus={autosave.autoSaveStatus}
          saveError={readiness.saveError}
          issueError={readiness.issueError}
          error={invoiceActions.error}
          draftLabel={
            initial?.soNumber || (orderId ? 'Saved draft' : 'New draft')
          }
          onSave={invoiceActions.save}
          onPrint={invoiceActions.print}
          onIssue={invoiceActions.issue}
        />
      ) : (
        <SalesCreateHeader
          readOnly={readOnly}
          mode={mode}
          initial={initial}
          saving={externalBusy}
          hasLines={form.hasLines}
          orderId={orderId}
          token={token}
          autoSaveStatus={autosave.autoSaveStatus}
          action={actions.action}
          error={actions.error}
          saveError={salesReady.saveError}
          confirmError={salesReady.confirmError}
          onManualSave={actions.handleManualSave}
          onCreateOrder={() => actions.handleSave(true)}
          onSaveQuotation={() => actions.handleSave(false)}
          onSaveEdit={actions.handleSaveEdit}
          onPrint={() => actions.handlePrint('quotation')}
          onSendProForma={() => actions.handlePrint('proforma')}
        />
      )}
      {!invoice && mode === 'edit' && initial && (
        <>
          <SalesEditControls
            so={initial}
            token={token}
            disabled={externalBusy}
            beforeLock={async () =>
              readOnly || Boolean(await autosave.ensureSaved(true))
            }
            onBusyChange={setLifecycleBusy}
            onChanged={(doc) => {
              autosave.isDirtyRef.current = false;
              onHistory();
              onUpdated?.(doc);
            }}
          />
          <SalesEditDelivery so={initial} disabled={externalBusy} />
        </>
      )}
      <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_288px]">
        <fieldset disabled={busy} className="min-w-0">
          <SalesCreateEditor
            readOnly={readOnly}
            snapshot={readOnly ? initial : undefined}
            form={form}
            token={token}
            invoice={invoice}
            invoiceDetails={
              invoice ? (
                <InvoiceCreateDetails
                  dueDate={invoiceDueDate}
                  disabled={busy}
                  onDueDate={(value) => {
                    setInvoiceDueDate(value);
                    autosave.isDirtyRef.current = true;
                    autosave.setAutoSaveStatus('idle');
                  }}
                />
              ) : undefined
            }
            onUpdatePrices={() => actions.setConfirmPrices(true)}
            onImportCart={() => setCartOpen(true)}
            onCoupon={actions.handleCoupon}
            couponBusy={actions.couponBusy}
          />
        </fieldset>
        <aside className="min-w-0 space-y-4 2xl:sticky 2xl:top-4 2xl:self-start">
          {!invoice && mode === 'create' && (
            <SalesCreateReview
              customer={
                `${form.customer?.firstName || ''} ${form.customer?.lastName || ''}`.trim() ||
                'Walk-in customer'
              }
              validUntil={form.validUntil}
              productCount={salesReady.productCount}
              subtotal={form.untaxedAmount}
              discounts={
                form.discountTotal +
                (form.promotionTotal || 0) +
                (form.coupon?.discount || 0) +
                form.pricelistCartDiscount
              }
              tax={form.taxTotal}
              shipping={form.shippingFee}
              total={form.grandTotal}
              currency={currency}
              confirmError={salesReady.confirmError}
            />
          )}
          {invoice && (
            <InvoiceCreateReview
              customer={
                `${form.customer?.firstName || ''} ${form.customer?.lastName || ''}`.trim() ||
                'Walk-in customer'
              }
              dueDate={invoiceDueDate}
              productCount={readiness.productCount}
              subtotal={form.untaxedAmount}
              discounts={
                form.discountTotal +
                (form.promotionTotal || 0) +
                (form.coupon?.discount || 0) +
                form.pricelistCartDiscount
              }
              tax={form.taxTotal}
              shipping={form.shippingFee}
              total={form.grandTotal}
              currency={currency}
              issueError={readiness.issueError}
            />
          )}
          {invoice || mode === 'create' ? (
            <details className="rounded-xl border border-gray-200 bg-white">
              <summary className="cursor-pointer px-5 py-4 text-xs font-semibold text-gray-700">
                {invoice ? 'Invoice activity' : 'Quotation activity'}
              </summary>
              <SalesActivityPanel
                token={token}
                orderId={orderId}
                refreshKey={historyKey}
              />
            </details>
          ) : (
            <SalesActivityPanel
              token={token}
              orderId={orderId}
              refreshKey={historyKey}
            />
          )}
        </aside>
      </div>
      <SalesCreateOverlays
        form={form}
        token={token}
        currency={currency}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        actions={actions}
      />
    </div>
  );
}
