'use client';
import type { ReactNode } from 'react';
import type { useSalesCreateForm } from './hooks/useSalesCreateForm';
import SalesCustomerBar from './sales-customer-bar';
import SalesLineTable from './sales-line-table';
import SalesTotals from './sales-totals';
import SalesOtherInfoTab from './sales-other-info-tab';
import type { SalesOrder } from '@/services/salesOrder.service';
import { savedSalesForm } from './sales-edit-snapshot';
export default function SalesCreateEditor({
  form,
  token,
  invoice,
  invoiceDetails,
  onUpdatePrices,
  onImportCart,
  onCoupon,
  couponBusy,
  readOnly = false,
  snapshot,
}: {
  form: ReturnType<typeof useSalesCreateForm>;
  token: string;
  invoice: boolean;
  invoiceDetails?: ReactNode;
  onUpdatePrices: () => void;
  onImportCart: () => void;
  onCoupon: (code: string) => Promise<void>;
  couponBusy: boolean;
  readOnly?: boolean;
  snapshot?: SalesOrder;
}) {
  if (snapshot) form = savedSalesForm(form, snapshot);
  const handleTabChange = form.setTab;
  return (
    <>
      <fieldset disabled={readOnly} inert={readOnly} className="min-w-0">
        <SalesCustomerBar
          token={token}
          invoiceDetails={invoiceDetails}
          customer={form.customer}
          onSelectCustomer={form.handleSelectCustomer}
          onClearCustomer={form.handleClearCustomer}
          pricelists={form.pricelists as { _id: string; name: string }[]}
          pricelistId={form.pricelistId}
          pricelistsLoading={form.pricelistsLoading}
          pricelistsError={form.pricelistsError}
          onRetryPricelists={form.retryPricelists}
          onPricelistChange={(id) => {
            form.setPricelistId(id);
            form.setPricelistOverridden(true);
          }}
          onUpdatePrices={onUpdatePrices}
          resolvedPricelistId={form.resolvedPricelistId}
          validUntil={form.validUntil}
          onValidUntilChange={form.setValidUntil}
          warehouses={form.warehouses}
          warehouseId={form.warehouseId}
          onWarehouseChange={form.setWarehouseId}
          onImportCart={onImportCart}
        />
      </fieldset>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap border-b border-gray-100 px-2 sm:px-4">
          <button
            type="button"
            onClick={() => handleTabChange('lines')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              form.tab === 'lines'
                ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {invoice ? 'Invoice items' : 'Order Lines'}
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
            {invoice ? 'Details & terms' : 'Other Info'}
          </button>
        </div>

        <fieldset
          disabled={readOnly}
          inert={readOnly}
          className="min-w-0 p-3 sm:p-5"
        >
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
                warehouseId={form.warehouseId || undefined}
                warehouseName={
                  form.warehouses.find(
                    (w) => w._id === form.warehouseId,
                  )?.name
                }
              />
              <SalesTotals
                untaxedAmount={form.untaxedAmount}
                discountTotal={form.discountTotal}
                promotionTotal={form.promotionTotal}
                taxTotal={form.taxTotal}
                grandTotal={form.grandTotal}
                coupon={form.coupon}
                couponBusy={couponBusy}
                pricelistCartDiscount={form.pricelistCartDiscount}
                pricelistName={form.pricelist?.name || undefined}
                onApplyCoupon={onCoupon}
                onClearCoupon={() => onCoupon('')}
                shippingFee={form.shippingFee}
                onShippingChange={form.setShippingFee}
                onApplyDiscount={form.applyGlobalDiscount}
                customerPoints={form.customer?.loyaltyPoints ?? null}
                plannedRedeemPoints={form.plannedRedeemPoints}
                onRedeemPointsChange={form.setPlannedRedeemPoints}
                onOpenTerms={() => handleTabChange('other')}
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
        </fieldset>
      </div>
    </>
  );
}
