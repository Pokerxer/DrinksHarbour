'use client';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { useSalesCreateForm } from './hooks/useSalesCreateForm';
import type { useSalesCreateActions } from './hooks/use-sales-create-actions';
const SalesCatalogModal = dynamic(() => import('./sales-catalog-modal'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
    >
      <span className="rounded-xl bg-white p-5 text-sm text-gray-700">
        Opening product catalogue…
      </span>
    </div>
  ),
});
import SalesScanDrawer from './sales-scan-drawer';
import SalesConfirmModal from './sales-confirm-modal';
import SalesCartImportModal from './sales-cart-import-modal';
export default function SalesCreateOverlays({
  form,
  token,
  cartOpen,
  setCartOpen,
  actions,
  currency = 'NGN',
}: {
  form: ReturnType<typeof useSalesCreateForm>;
  token: string;
  cartOpen: boolean;
  setCartOpen: (value: boolean) => void;
  actions: ReturnType<typeof useSalesCreateActions>;
  currency?: string;
}) {
  const [catalogueMounted, setCatalogueMounted] = useState(false);
  useEffect(() => {
    if (form.catalogOpen) setCatalogueMounted(true);
  }, [form.catalogOpen]);
  return (
    <>
      {(form.catalogOpen || catalogueMounted) && (
        <SalesCatalogModal
          open={form.catalogOpen}
          token={token}
          warehouseId={form.warehouseId || undefined}
          warehouseName={
            form.warehouses.find(
              (warehouse) => warehouse._id === form.warehouseId
            )?.name
          }
          currency={currency}
          pricelist={form.pricelist}
          pricelistId={form.pricelistId}
          qtyMap={form.catalogQtyMap}
          onClose={() => form.setCatalogOpen(false)}
          onAdd={form.addProductFromCatalog}
          onSetQty={form.setCatalogLineQty}
          onRemove={form.removeCatalogLine}
        />
      )}

      <SalesScanDrawer
        open={form.scanOpen}
        token={token}
        warehouseId={form.warehouseId || undefined}
        onClose={() => form.setScanOpen(false)}
        onAdd={form.addProductFromCatalog}
      />

      <SalesConfirmModal
        open={actions.confirmPrices}
        title="Confirmation"
        body="This will update the unit price of all products based on the new pricelist."
        busy={actions.pricesBusy}
        onClose={() => actions.setConfirmPrices(false)}
        onConfirm={actions.handleUpdatePrices}
      />

      <SalesCartImportModal
        open={cartOpen}
        token={token}
        customer={form.customer}
        onClose={() => setCartOpen(false)}
        onConfirm={(items) => {
          form.importCustomerCart(items);
          setCartOpen(false);
          toast.success(
            `${items.length} line${items.length !== 1 ? 's' : ''} added from marketplace cart`
          );
        }}
      />
    </>
  );
}
