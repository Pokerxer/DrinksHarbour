'use client';
import {
  PiArrowLeft,
  PiArrowUpRight,
  PiFloppyDisk,
  PiPlus,
  PiSparkle,
  PiSpinner,
  PiMagnifyingGlass,
} from 'react-icons/pi';
import HeaderMetrics from './HeaderMetrics';
import RecordNavigation from './RecordNavigation';
import type { ProductEditHeaderProps } from './types';

export default function ProductEditHeader(props: ProductEditHeaderProps) {
  const busy = props.saving || props.generating;
  const status = props.status === 'approved' ? 'Active' : props.status;
  const badge =
    props.status === 'approved' || props.status === 'active'
      ? 'bg-green-50 text-green-700 ring-green-200'
      : props.status === 'rejected'
        ? 'bg-red-50 text-red-700 ring-red-200'
        : props.status === 'pending'
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : 'bg-gray-100 text-gray-600 ring-gray-200';
  const feedback = props.saving
    ? 'Saving changes…'
    : props.saveStatus === 'error'
      ? 'Save failed. Try again.'
      : props.dirty
        ? 'Unsaved changes'
        : props.saveStatus === 'saved'
          ? 'Changes saved'
          : props.isEditMode
            ? 'No unsaved changes'
            : 'New catalogue product';
  const secondary =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div>
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            aria-label="Back to products"
            onClick={props.onBack}
            disabled={busy}
            className={`${secondary} w-11 shrink-0 px-0`}
          >
            <PiArrowLeft size={20} aria-hidden />
          </button>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="break-words text-lg font-semibold leading-snug tracking-tight text-gray-900 sm:text-xl">
                {props.title}
              </h1>
              {props.isEditMode && status && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${badge}`}
                >
                  {status}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <p
                role="status"
                className={
                  props.saveStatus === 'error'
                    ? 'text-red-700'
                    : props.dirty && !props.saving
                      ? 'text-amber-700'
                      : ''
                }
              >
                {feedback}
              </p>
              {props.dirty && props.lastDraftSaved && (
                <span>
                  Draft saved on this device at{' '}
                  {props.lastDraftSaved.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-14 sm:pl-0">
          <button
            type="button"
            aria-label="New product"
            disabled={busy}
            onClick={props.onNew}
            className={secondary}
          >
            <PiPlus size={17} aria-hidden />
            New
          </button>
          {props.canGenerate && (
            <button
              type="button"
              aria-label="Generate with AI"
              title="Generate product fields with AI (Claude Haiku)"
              disabled={busy}
              onClick={props.onGenerate}
              className={`${secondary} border-purple-200 text-purple-700 hover:bg-purple-50`}
            >
              {props.generating ? (
                <PiSpinner
                  className="animate-spin motion-reduce:animate-none"
                  size={17}
                  aria-hidden
                />
              ) : (
                <PiSparkle size={17} aria-hidden />
              )}
              {props.generating ? 'Generating…' : 'AI assist'}
            </button>
          )}
          <button
            type="button"
            aria-label="Save changes"
            aria-busy={props.saving}
            onClick={props.onSave}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {props.saving ? (
              <PiSpinner
                className="animate-spin motion-reduce:animate-none"
                size={17}
                aria-hidden
              />
            ) : (
              <PiFloppyDisk size={17} aria-hidden />
            )}
            {props.saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
      {props.isEditMode && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-6 lg:px-8">
          <HeaderMetrics
            metrics={props.metrics}
            onVariants={props.onVariants}
            onOnHand={props.onOnHand}
            onSold={props.onSold}
          />
          <div className="flex max-w-full flex-wrap items-center gap-3">
            {props.searchContext && (
              <span
                title={`From search: ${props.searchContext}`}
                className="inline-flex max-w-40 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600"
              >
                <PiMagnifyingGlass className="shrink-0" aria-hidden />
                <span className="truncate">{props.searchContext}</span>
              </span>
            )}
            {props.onPreview && (
              <button
                type="button"
                aria-label="View on website"
                onClick={props.onPreview}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                View website
                <PiArrowUpRight size={16} aria-hidden />
              </button>
            )}
            <RecordNavigation
              index={props.index}
              total={props.total}
              busy={busy}
              onPrevious={props.onPrevious}
              onNext={props.onNext}
            />
          </div>
        </div>
      )}
    </div>
  );
}
