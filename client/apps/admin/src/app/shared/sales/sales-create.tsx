// client/apps/admin/src/app/shared/sales/sales-create.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { useSalesCreateForm } from './hooks/useSalesCreateForm';
import { useSalesAutosave } from './hooks/useSalesAutosave';
import SalesCreateHeader from './sales-create-header';
import SalesCustomerBar from './sales-customer-bar';
import SalesLineTable from './sales-line-table';
import SalesTotals from './sales-totals';
import SalesOtherInfoTab from './sales-other-info-tab';
import SalesCatalogModal from './sales-catalog-modal';
import SalesScanDrawer from './sales-scan-drawer';
import SalesPrintSheet, { type PrintSheetType } from './sales-print-sheet';
import SalesActivityPanel from './sales-activity-panel';
import type { CreateTab } from './sales-stage-pill';

export default function SalesCreate({
  mode = 'create',
  initial,
}: {
  mode?: 'create' | 'edit';
  initial?: SalesOrder;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [printState, setPrintState] = useState<{
    so: SalesOrder;
    type: PrintSheetType;
  } | null>(null);

  const form = useSalesCreateForm({ token, mode, initial });

  const { autoSaveStatus, isDirtyRef, draftId, handleManualSave, ensureSaved } =
    useSalesAutosave({
      token,
      initial,
      priced: form.priced,
      customer: form.customer,
      notes: form.notes,
      terms: form.terms,
      validUntil: form.validUntil,
      paymentTerms: form.paymentTerms,
      pricelistId: form.pricelistId,
      warehouseId: form.warehouseId as string,
      buildPayload: form.buildPayload,
    });

  const orderId = initial?._id ?? draftId ?? undefined;
  const [historyKey, setHistoryKey] = useState(0);
  useEffect(() => {
    if (autoSaveStatus === 'saved') setHistoryKey((k) => k + 1);
  }, [autoSaveStatus]);

  function validateFilled() {
    const filled = form.priced.filter(
      (l) => l.lineType !== 'product' || l.subProductId
    );
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return null;
    }
    const badQty = filled.find(
      (l) => l.lineType === 'product' && !(l.quantity > 0)
    );
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return null;
    }
    return filled;
  }

  async function handleSaveEdit() {
    if (!initial || !validateFilled()) return;
    form.setSaving(true);
    try {
      await salesOrderService.update(initial._id, form.buildPayload() as any, token);
      toast.success('Changes saved');
      router.push(routes.eCommerce.salesDetails(initial._id));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save changes'
      );
    } finally {
      form.setSaving(false);
    }
  }

  async function handleSave(asOrder: boolean) {
    if (!validateFilled()) return;
    form.setSaving(true);
    try {
      const p = form.buildPayload();
      // Create mode overrides: use undefined (omitted on serialize) instead
      // of null so the server keeps defaults for new documents.
      const res = await salesOrderService.create(
        {
          ...p,
          docType: asOrder ? 'order' : 'quotation',
          customer: form.customer?._id,
          pricelist: form.pricelistId || undefined,
          appliedPricelist: form.pricelist
            ? { pricelistId: form.pricelist._id, pricelistName: form.pricelist.name }
            : undefined,
        } as any,
        token
      );
      toast.success(asOrder ? 'Order created' : 'Quotation saved');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      form.setSaving(false);
    }
  }

  async function handleTabChange(next: CreateTab) {
    if (next !== form.tab && isDirtyRef.current) {
      await handleManualSave();
    }
    form.setTab(next);
  }

  async function handlePrint(type: 'quotation' | 'proforma') {
    const id = await ensureSaved();
    if (!id) {
      toast.error('Add at least one product before printing');
      return;
    }
    try {
      const res = await salesOrderService.get(id, token);
      setPrintState({ so: res.data, type });
      setTimeout(() => window.print(), 150);
    } catch {
      toast.error('Could not load document for printing');
    }
  }

  return (
    <div className="pb-24">
      <SalesCreateHeader
        mode={mode}
        initial={initial}
        saving={form.saving}
        hasLines={form.hasLines}
        orderId={initial?._id}
        token={token}
        autoSaveStatus={autoSaveStatus}
        onManualSave={handleManualSave}
        onCreateOrder={() => handleSave(true)}
        onSaveQuotation={() => handleSave(false)}
        onSaveEdit={handleSaveEdit}
        onPrint={() => handlePrint('quotation')}
        onSendProForma={() => handlePrint('proforma')}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <SalesCustomerBar
        token={token}
        customer={form.customer}
        onSelectCustomer={form.handleSelectCustomer}
        onClearCustomer={() => form.setCustomer(null)}
        pricelists={form.pricelists as { _id: string; name: string }[]}
        pricelistId={form.pricelistId}
        onPricelistChange={(id) => {
          form.setPricelistId(id);
          form.setPricelistOverridden(true);
        }}
        resolvedPricelistId={form.resolvedPricelistId}
        validUntil={form.validUntil}
        onValidUntilChange={form.setValidUntil}
        warehouses={form.warehouses}
        warehouseId={form.warehouseId as string}
        onWarehouseChange={form.setWarehouseId}
      />

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
        <div className="flex border-b border-gray-100 px-4">
          <button
            type="button"
            onClick={() => handleTabChange('lines')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              form.tab === 'lines'
                ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Lines
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('other')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              form.tab === 'other'
                ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Other Info
          </button>
        </div>

        <div className="p-5">
          {form.tab === 'lines' ? (
            <>
              <SalesLineTable
                token={token}
                lines={form.priced}
                onUpdate={form.updateLine}
                onAdd={form.addLine}
                onAddSection={form.addSection}
                onAddNote={form.addNote}
                onOpenCatalog={() => form.setCatalogOpen(true)}
                onOpenScan={() => form.setScanOpen(true)}
                onRemove={form.removeLine}
                onReorder={form.reorderLines}
                warehouseId={(form.warehouseId as string) || undefined}
              />
              <SalesTotals
                untaxedAmount={form.untaxedAmount}
                discountTotal={form.discountTotal}
                taxTotal={form.taxTotal}
                grandTotal={form.grandTotal}
              />
            </>
          ) : (
            <SalesOtherInfoTab
              paymentTerms={form.paymentTerms}
              onPaymentTermsChange={form.setPaymentTerms}
              invoiceAddress={form.invoiceAddress}
              deliveryAddress={form.deliveryAddress}
              deliverDifferent={form.deliverDifferent}
              onInvoiceChange={(patch) =>
                form.setInvoiceAddress((prev) => ({ ...prev, ...patch }))
              }
              onDeliveryChange={(patch) =>
                form.setDeliveryAddress((prev) => ({ ...prev, ...patch }))
              }
              onToggleDeliverDifferent={form.handleToggleDeliverDifferent}
              onLoadCustomerAddress={
                form.customer
                  ? () => void form.loadCustomerAddress(form.customer!)
                  : undefined
              }
              loadingCustomerAddress={form.loadingCustomerAddress}
              notes={form.notes}
              onNotesChange={form.setNotes}
              terms={form.terms}
              onTermsChange={form.setTerms}
            />
          )}
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <SalesActivityPanel
            token={token}
            orderId={orderId}
            refreshKey={historyKey}
          />
        </div>
      </div>

      <SalesCatalogModal
        open={form.catalogOpen}
        token={token}
        pricelist={form.pricelist}
        qtyMap={form.catalogQtyMap}
        onClose={() => form.setCatalogOpen(false)}
        onAdd={form.addProductFromCatalog}
        onSetQty={form.setCatalogLineQty}
        onRemove={form.removeCatalogLine}
      />

      <SalesScanDrawer
        open={form.scanOpen}
        token={token}
        onClose={() => form.setScanOpen(false)}
        onAdd={form.addProductFromCatalog}
      />

      {printState && (
        <SalesPrintSheet so={printState.so} type={printState.type} />
      )}
    </div>
  );
}
