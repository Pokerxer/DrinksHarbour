// client/apps/admin/src/app/shared/sales/sales-payment-details.tsx
// Where the customer remits the invoice. Split out of sales-invoice-view.tsx to
// keep that file within the size a human will actually read, and because the
// quotation detail page prints the same block.
'use client';

import { Text, Title } from 'rizzui';
import { PiBank } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { printableBankAccounts } from '@/utils/print/so-print';

/**
 * Renders nothing when the tenant has no usable account on file — an invoice
 * that shows an empty "Payment Details" heading is worse than one that shows
 * nothing, because it advertises that the seller has somewhere to be paid.
 * Fix the account under Settings → Bank Accounts; it is the same list the POS
 * receipt prints.
 */
export default function SalesPaymentDetails({
  so,
}: {
  so: Pick<
    SalesOrder,
    'issuerBankAccounts' | 'soNumber' | 'paymentStatus'
  >;
}) {
  const accounts = printableBankAccounts(so);
  if (!accounts.length) return null;

  return (
    <div className="mt-8 border-t border-gray-100 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <PiBank className="h-4 w-4 text-gray-400" />
        <Title as="h6" className="font-semibold">
          Payment Details
        </Title>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map((account, index) => (
          <dl
            key={`${account.accountNumber}-${index}`}
            className="rounded-lg border border-gray-100 bg-gray-50/60 p-3.5"
          >
            <Row label="Bank" value={account.bankName} />
            {account.accountName && (
              <Row label="Account Name" value={account.accountName} />
            )}
            <Row label="Account Number" value={account.accountNumber} mono />
          </dl>
        ))}
      </div>
      {so.paymentStatus !== 'paid' && (
        <Text className="mt-3 text-xs text-gray-500">
          Please quote {so.soNumber} as the payment reference.
        </Text>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="mb-1.5 last:mb-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={`text-sm font-medium text-gray-900 ${
          mono ? 'tabular-nums' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
