'use client';
import { DialogTitle, DialogDescription } from '@headlessui/react';
import { Modal } from '@core/modal-views/modal';
import { PiX } from 'react-icons/pi';
import type { InsightLine } from '@/services/notificationInsights.service';
import WarehouseProductImage from './warehouse-product-image';
import WarehouseProductDetails from './warehouse-product-details';
export default function WarehouseProductModal({
  line,
  onClose,
  ...permissions
}: {
  line: InsightLine;
  onClose: () => void;
  demand: boolean;
  purchase: boolean;
  manageTransfers?: boolean;
  coverDays?: number;
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
          <WarehouseProductImage
            src={line.productImage}
            name={line.productName}
          />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Warehouse stock details
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
              <p className="mt-1 font-mono text-[11px] text-gray-400">
                {line.sku}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            aria-label="Close product details"
            className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]"
          >
            <PiX aria-hidden className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <WarehouseProductDetails line={line} {...permissions} />
        </div>
      </div>
    </Modal>
  );
}
