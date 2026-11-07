import { buttonClass, fieldClass } from '../market-foundation/workspace';
import type { QueuePage, QueueState } from './use-merchant-queue';
export default function QueueControls({
  state,
  setState,
  page,
  setPage,
  pagination,
  busy,
  loading,
}: {
  state: QueueState;
  setState: (value: QueueState) => void;
  page: number;
  setPage: (value: number) => void;
  pagination?: QueuePage;
  busy: boolean;
  loading: boolean;
}) {
  return (
    <section
      aria-label="Merchant queue filters and pagination"
      className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 rounded-xl border border-muted p-4"
    >
      <div className="w-full max-w-xs">
        <label
          htmlFor="merchant-queue-status"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Queue status
        </label>
        <select
          id="merchant-queue-status"
          className={fieldClass}
          value={state}
          disabled={busy}
          onChange={(event) => setState(event.target.value as QueueState)}
        >
          <option value="open">Open work</option>
          <option value="closed">Completed or cancelled</option>
          <option value="all">All orders</option>
        </select>
      </div>
      {pagination && (
        <p
          className="text-sm tabular-nums text-gray-600 dark:text-gray-400"
          role="status"
        >
          Page {pagination.page} of {pagination.pages} · {pagination.total}{' '}
          matching orders
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={buttonClass}
          aria-label="Previous queue page"
          disabled={busy || loading || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <button
          className={buttonClass}
          aria-label="Next queue page"
          disabled={busy || loading || !pagination || page >= pagination.pages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
