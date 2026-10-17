import type { SavedInvoice } from '@/services/arAp.service';
export default function InvoicePaymentInstructions({
  invoice,
}: {
  invoice: SavedInvoice;
}) {
  const accounts = invoice.detailContext?.issuer.bankAccounts || [];
  if (!accounts.length || invoice.state === 'cancelled') return null;
  return (
    <section className="mt-6 border-t border-gray-200 pt-5">
      <h2 className="text-xs font-semibold text-gray-900">
        Payment instructions
      </h2>
      <p className="mt-1 text-[11px] text-gray-500">
        Current invoice bank accounts · use {invoice.number} as your payment
        reference.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {accounts.map((account) => (
          <div
            key={`${account.bankName}:${account.accountNumber}`}
            className="rounded-lg border border-gray-100 bg-gray-50 p-3 print:bg-white"
          >
            <p className="text-xs font-semibold text-gray-900">
              {account.bankName}
            </p>
            <p className="mt-1 select-all font-mono text-sm font-semibold tracking-wide text-gray-900">
              {account.accountNumber}
            </p>
            {account.accountName && (
              <p className="mt-1 text-xs text-gray-500">
                {account.accountName}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
