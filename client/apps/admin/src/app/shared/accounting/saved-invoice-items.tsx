import type { SavedInvoice } from '@/services/arAp.service';
import { invoiceMoney } from './invoice-detail-helpers';
export default function SavedInvoiceItems({
  invoice,
}: {
  invoice: SavedInvoice;
}) {
  return (
    <section aria-label="Invoice items">
      <div className="hidden sm:block print:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Saved invoice items</caption>
          <thead className="border-y border-gray-200 bg-gray-50 text-[11px] text-gray-500">
            <tr>
              {['Description', 'Qty', 'Unit price', 'Tax', 'Amount'].map(
                (label, i) => (
                  <th
                    scope="col"
                    key={label}
                    className={`px-3 py-3 font-medium ${i ? 'text-right' : ''}`}
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items.map((item, i) =>
              item.lineType === 'product' ? (
                <tr key={i}>
                  <td className="max-w-64 break-words px-3 py-4">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="mt-1 text-xs text-gray-500">
                        {item.description}
                      </p>
                    )}
                    {item.uom && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        {item.uom}
                        {(item.packSize || 1) > 1
                          ? ` · ${item.packSize} units per pack`
                          : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">
                    {invoiceMoney(invoice, item.unitPrice)}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">
                    {invoiceMoney(invoice, item.taxAmount)}
                  </td>
                  <td className="px-3 py-4 text-right font-medium tabular-nums">
                    {invoiceMoney(invoice, item.lineTotal)}
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td
                    colSpan={5}
                    className={`px-3 py-3 text-sm ${item.lineType === 'section' ? 'bg-gray-50 font-semibold text-gray-900' : 'italic text-gray-500'}`}
                  >
                    {item.description || item.name}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-gray-100 sm:hidden print:hidden">
        {invoice.items.map((item, i) => (
          <div key={i} className="py-4">
            <p className="break-words text-sm font-semibold text-gray-900">
              {item.name}
            </p>
            {item.description && (
              <p className="mt-1 text-xs text-gray-500">{item.description}</p>
            )}
            {item.lineType === 'product' && (
              <>
                <p className="mt-2 text-xs text-gray-500">
                  {item.quantity} × {invoiceMoney(invoice, item.unitPrice)}
                  {item.uom ? ` · ${item.uom}` : ''}
                </p>
                <div className="mt-2 flex justify-between gap-2 text-xs">
                  <span className="text-gray-500">
                    Tax {invoiceMoney(invoice, item.taxAmount)}
                  </span>
                  <strong className="tabular-nums text-gray-900">
                    {invoiceMoney(invoice, item.lineTotal)}
                  </strong>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {!invoice.items.length && (
        <p className="py-5 text-sm text-gray-500">
          No item details were saved. Review the source document.
        </p>
      )}
    </section>
  );
}
