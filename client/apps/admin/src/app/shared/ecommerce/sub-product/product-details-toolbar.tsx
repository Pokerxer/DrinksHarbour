'use client';
import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiArrowLeft, PiPencilSimple, PiPlus } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { subproductService } from '@/services/subproduct.service';
import ToolbarMenu from './create-edit/toolbar-menu';
import ToolbarStats, { type ProductHistory } from './create-edit/toolbar-stats';
import ProductHistoryPanel from './create-edit/ProductHistoryPanel';
import {
  requestDuplicate,
  takeDuplicateSource,
} from './create-edit/duplicate-intent';
import { clearSubProductDraft } from './create-edit/draft-cleanup';
import DetailActionDialog, { type DetailAction } from './detail-action-dialog';

export interface ProductDetailsToolbarProps {
  id: string;
  name: string;
  status: string;
  published: boolean;
  stock: number;
  price: number;
  currency: string;
  token?: string;
  onChanged: () => void;
}
export default function ProductDetailsToolbar(
  props: ProductDetailsToolbarProps
) {
  const router = useRouter();
  const [history, setHistory] = useState<ProductHistory | null>(null);
  const [action, setAction] = useState<DetailAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const disabled = busy || !props.id || !props.token;
  const archived = props.status === 'archived';
  const buttonClass =
    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50 sm:flex-none';
  function navigate(path: string) {
    if (locked.current) return;
    router.push(path);
  }
  function ask(next: DetailAction) {
    if (disabled || locked.current) return;
    setError('');
    setAction(next);
  }
  async function confirmAction() {
    if (!action || disabled || locked.current || !props.token) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      if (action === 'delete')
        await subproductService.deleteSubProduct(props.id, props.token);
      else if (action === 'archive')
        await subproductService.archiveSubProduct(props.id, props.token);
      else await subproductService.restoreSubProduct(props.id, props.token);
      try {
        sessionStorage.removeItem('dh-sp-nav-v1');
      } catch {
        /* Navigation can reload without cached data. */
      }
      setAction(null);
      if (action === 'restore') props.onChanged();
      router.refresh();
      if (action !== 'restore') router.push(routes.eCommerce.subProducts);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to update this product. Please retry.'
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Sub-product toolbar"
      aria-busy={busy}
      className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            aria-label="Back to sub-products"
            disabled={busy}
            onClick={() => navigate(routes.eCommerce.subProducts)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50"
          >
            <PiArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-base font-semibold text-gray-900">
                {props.name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${archived ? 'bg-amber-50 text-amber-800' : props.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {(props.status || 'draft').replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {props.published ? 'Published' : 'Unpublished'} · Product details
            </p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Product actions"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            disabled={busy}
            className={buttonClass}
            onClick={() => {
              if (locked.current) return;
              takeDuplicateSource();
              clearSubProductDraft();
              navigate(routes.eCommerce.createSubProduct);
            }}
          >
            <PiPlus aria-hidden="true" />
            New
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              navigate(`/sub-products/${encodeURIComponent(props.id)}/edit`)
            }
            className={`${buttonClass} border-gray-900 bg-gray-900 text-white hover:bg-gray-700`}
          >
            <PiPencilSimple aria-hidden="true" />
            Edit product
          </button>
          <ToolbarMenu
            disabled={disabled}
            archived={archived}
            onArchive={() => ask(archived ? 'restore' : 'archive')}
            onDelete={() => ask('delete')}
            onDuplicate={() => {
              if (disabled || locked.current) return;
              clearSubProductDraft();
              requestDuplicate(props.id);
              navigate(routes.eCommerce.createSubProduct);
            }}
          />
        </div>
      </div>
      <div className="border-t border-gray-100">
        <ToolbarStats
          stock={props.stock}
          price={props.price}
          currency={props.currency}
          purchased={null}
          sold={null}
          editing
          disabled={disabled}
          onHistory={setHistory}
        />
      </div>
      {history && props.token && (
        <ProductHistoryPanel
          key={`${props.id}:${history}`}
          type={history}
          subProductId={props.id}
          productName={props.name}
          token={props.token}
          onClose={() => setHistory(null)}
        />
      )}
      <DetailActionDialog
        action={action}
        name={props.name}
        busy={busy}
        error={error}
        onClose={() => setAction(null)}
        onConfirm={confirmAction}
      />
    </section>
  );
}
