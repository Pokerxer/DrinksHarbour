import { PiPlus, PiCaretLeft, PiCaretRight } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { CataloguePage } from './sales-catalog-data';
export default function CatalogueFooter({
  pagination,
  busy,
  summary,
  onPage,
  onClose,
}: {
  pagination?: CataloguePage['pagination'];
  busy: boolean;
  summary: { lines: number; units: number };
  onPage: (delta: number) => void;
  onClose: () => void;
}) {
  return (
    <footer className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <p className="text-xs text-gray-500">
          {pagination?.total
            ? `${(pagination.page - 1) * 24 + 1}–${Math.min(pagination.page * 24, pagination.total)} of ${pagination.total}`
            : '0 products'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous catalogue page"
            disabled={busy || !pagination?.hasPrev}
            onClick={() => onPage(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <PiCaretLeft />
          </button>
          <span className="text-xs text-gray-600">
            Page {pagination?.page || 1} of {pagination?.pages || 1}
          </span>
          <button
            type="button"
            aria-label="Next catalogue page"
            disabled={busy || !pagination?.hasNext}
            onClick={() => onPage(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <PiCaretRight />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {summary.lines} line{summary.lines !== 1 ? 's' : ''} in order{' '}
            <span className="text-xs font-normal text-gray-500">
              · {summary.units} units
            </span>
          </p>
          <a
            href={routes.eCommerce.createSubProduct}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex min-h-7 items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            <PiPlus /> Create product
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Done
        </button>
      </div>
    </footer>
  );
}
