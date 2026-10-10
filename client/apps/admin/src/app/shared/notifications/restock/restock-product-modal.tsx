'use client';
import { DialogTitle, DialogDescription } from '@headlessui/react';
import { Modal } from '@core/modal-views/modal';
import { PiX } from 'react-icons/pi';
import type { InsightLine } from '@/services/notificationInsights.service';
import type { Selection } from '../vendor-orders/order-draft';
import ProductImage from '../warehouses/warehouse-product-image';
import RestockLine from './restock-line';
export default function RestockProductModal({
  line,
  onClose,
  ...options
}: {
  line: InsightLine;
  onClose: () => void;
  selection?: Selection;
  onChange: (choice: Selection) => void;
  stock: boolean;
  demand: boolean;
}) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      customSize={880}
      rounded="lg"
      containerClassName="overflow-hidden bg-white"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex shrink-0 items-start gap-4 border-b border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          <ProductImage src={line.productImage} name={line.productName} />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Restock details
            </p>
            <DialogTitle className="text-lg font-semibold leading-snug text-gray-900">
              {line.productName}{' '}
              <span className="whitespace-nowrap font-normal text-gray-500">
                {line.sizeName}
              </span>
            </DialogTitle>
            <DialogDescription className="mt-2 text-xs text-gray-500">
              {line.warehouseName}
            </DialogDescription>
            {line.sku && (
              <p className="mt-1 break-all font-mono text-[11px] text-gray-400">
                {line.sku}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            aria-label="Close restock details"
            className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PiX aria-hidden className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <RestockLine line={line} {...options} embedded />
        </div>
      </div>
    </Modal>
  );
}
