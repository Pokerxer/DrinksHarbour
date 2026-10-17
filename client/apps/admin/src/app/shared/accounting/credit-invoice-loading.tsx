import type { CreditInvoiceChoices } from './use-credit-invoices';
export default function CreditInvoiceLoading({
  choices,
}: {
  choices: CreditInvoiceChoices;
}) {
  return (
    <div className="text-xs text-gray-500">
      {choices.loading && <p role="status">Loading invoice choices…</p>}
      {choices.error && (
        <p role="alert" className="text-red-700">
          Invoice choices could not load: {choices.error}{' '}
          <button
            type="button"
            onClick={choices.retry}
            className="font-medium underline"
          >
            Retry invoices
          </button>
        </p>
      )}
      {!choices.loading && !choices.error && choices.hasMore && (
        <button type="button" onClick={choices.more} className="underline">
          Load more invoices
        </button>
      )}
    </div>
  );
}
