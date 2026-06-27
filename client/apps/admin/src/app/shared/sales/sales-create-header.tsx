// client/apps/admin/src/app/shared/sales/sales-create-header.tsx
'use client';

import Link from 'next/link';
import { PiArrowLeft, PiCheck, PiFloppyDisk } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { StagePill } from './sales-stage-pill';
import {
  quoteStatusLabel,
  orderStatusLabel,
} from './sales-helpers';
import type { SalesOrder } from '@/services/salesOrder.service';

export interface SalesCreateHeaderProps {
  mode: 'create' | 'edit';
  initial?: SalesOrder;
  saving: boolean;
  hasLines: boolean;
  onCreateOrder?: () => void;
  onSaveQuotation?: () => void;
  onSaveEdit?: () => void;
}

/**
 * Top-of-page header for the Sales create/edit page: breadcrumb, title,
 * primary actions (Create Order / Save Quotation / Save Changes / Cancel),
 * and the lifecycle stage pills.
 */
export default function SalesCreateHeader({
  mode,
  initial,
  saving,
  hasLines,
  onCreateOrder,
  onSaveQuotation,
  onSaveEdit,
}: SalesCreateHeaderProps) {
  const isEdit = mode === 'edit' && initial;
  const backHref = isEdit
    ? routes.eCommerce.salesDetails(initial._id)
    : routes.eCommerce.salesOrders;
  const cancelHref = isEdit
    ? routes.eCommerce.salesDetails(initial._id)
    : routes.eCommerce.salesOrders;

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <Link
            href={routes.eCommerce.salesOrders}
            className="flex items-center gap-1 hover:text-gray-700"
          >
            <PiArrowLeft className="h-4 w-4" /> Sales
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900">
            {isEdit ? initial.soNumber : 'New Sale'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {mode === 'edit' ? 'Edit' : 'New'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {isEdit
            ? 'Update the draft and save your changes.'
            : 'Save as a quotation or create the order directly.'}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving || !hasLines}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiFloppyDisk className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCreateOrder}
                disabled={saving || !hasLines}
                className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                <PiCheck className="h-4 w-4" />
                {saving ? 'Saving…' : 'Create Order'}
              </button>
              <button
                type="button"
                onClick={onSaveQuotation}
                disabled={saving || !hasLines}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <PiFloppyDisk className="h-4 w-4" />
                Save as Quotation
              </button>
            </>
          )}
          <Link
            href={cancelHref}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          {isEdit ? (
            <StagePill
              label={
                initial.docType === 'quotation'
                  ? quoteStatusLabel(initial.quoteStatus)
                  : orderStatusLabel(initial.orderStatus)
              }
              active
            />
          ) : (
            <>
              <StagePill label="Quotation" active />
              <StagePill label="Quotation Sent" active={false} />
              <StagePill label="Sales Order" active={false} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}