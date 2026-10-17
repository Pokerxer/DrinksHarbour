const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
export default function ReviewFooter({
  loaded,
  edited,
  blocked,
  invalid,
  action,
  actionError,
  declining,
  reason,
  onReason,
  onDeclining,
  onClose,
  onApprove,
  onDecline,
  onShowIssues,
}: {
  loaded: boolean;
  edited: number;
  blocked: number;
  invalid: string | null;
  action: 'approve' | 'decline' | null;
  actionError: string | null;
  declining: boolean;
  reason: string;
  onReason: (value: string) => void;
  onDeclining: (value: boolean) => void;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onShowIssues: () => void;
}) {
  return (
    <footer className="max-h-[45dvh] shrink-0 overflow-y-auto border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      {actionError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {actionError}
        </p>
      )}
      {invalid && !declining && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <div aria-live="polite">
            <p className="text-xs font-semibold text-red-800">
              {blocked} price {blocked === 1 ? 'issue blocks' : 'issues block'}{' '}
              approval
            </p>
            <p className="mt-1 text-xs text-red-700">{invalid}</p>
          </div>
          <button
            type="button"
            aria-label="Show blocking prices"
            onClick={onShowIssues}
            disabled={!!action}
            className={`${button} border-red-200 text-red-700`}
          >
            Show issues
          </button>
        </div>
      )}
      {declining && (
        <label className="mb-3 block text-xs font-medium text-gray-600">
          Decline reason
          <textarea
            aria-label="Decline reason"
            value={reason}
            disabled={!!action}
            maxLength={2000}
            onChange={(e) => onReason(e.target.value)}
            rows={2}
            placeholder="Optional feedback for this listing"
            className="mt-1 w-full rounded-lg border border-gray-200 p-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {loaded
            ? `All prices · ${edited} price ${edited === 1 ? 'row' : 'rows'} edited · Saved only on approval`
            : 'Review listing details before taking action'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={declining ? () => onDeclining(false) : onClose}
            disabled={!!action}
            className={button}
          >
            {declining ? 'Cancel decline' : 'Close'}
          </button>
          {loaded && !declining && (
            <>
              <button
                type="button"
                onClick={() => onDeclining(true)}
                disabled={!!action}
                className={`${button} text-red-700`}
              >
                Decline listing
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={!!action || !!invalid}
                className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
              >
                {action === 'approve' ? 'Approving…' : 'Approve listing'}
              </button>
            </>
          )}
          {loaded && declining && (
            <button
              type="button"
              onClick={onDecline}
              disabled={!!action}
              className="min-h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
            >
              {action === 'decline' ? 'Declining…' : 'Confirm decline'}
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
