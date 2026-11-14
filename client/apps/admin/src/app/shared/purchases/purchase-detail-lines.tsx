import { outstandingPurchaseQuantity } from './purchase-workflow-state';
import BaseCurrencyEquivalent from './base-currency-equivalent';
import {
  fmtAmount,
  linePackSize,
  packNounOf,
  packsLabel,
  type PurchaseOrder,
} from './types';

export default function PurchaseDetailLines({ po }: { po: PurchaseOrder }) {
  const totalCost = po.items.reduce(
    (s, it) =>
      s + (it.totalCost ?? (it.unitCost ?? it.unitPrice ?? 0) * it.quantity),
    0
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">Order Lines</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
              SKU
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Qty
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
              Packs
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Received
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Outstanding
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Unit Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {po.items.map((item, i) => {
            const lineType = item.lineType;
            if (lineType === 'section') {
              return (
                <tr key={i} className="bg-gray-50/80">
                  <td
                    colSpan={8}
                    className="px-4 py-2.5 text-sm font-bold text-gray-900"
                  >
                    {item.name}
                  </td>
                </tr>
              );
            }
            if (lineType === 'note') {
              return (
                <tr key={i} className="bg-amber-50/40">
                  <td
                    colSpan={8}
                    className="px-4 py-2.5 text-xs italic text-gray-600"
                  >
                    {item.description}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {(() => {
                    const name = item.subProductName ?? item.productName ?? '';
                    const size = item.sizeName;
                    if (size && !name.includes(size))
                      return `${name} – ${size}`;
                    return name;
                  })()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {item.sku}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-600">
                  {packsLabel(
                    item.quantity,
                    linePackSize(item),
                    packNounOf(item.packaging)
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      item.receivedQty >= item.quantity
                        ? 'font-medium text-green-600'
                        : 'text-gray-500'
                    }
                  >
                    {item.receivedQty}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    const out = outstandingPurchaseQuantity(item);
                    return (
                      <span
                        className={
                          out > 0
                            ? 'font-medium text-amber-600'
                            : 'text-gray-400'
                        }
                      >
                        {out}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {po.currency}{' '}
                  {fmtAmount(
                    item.unitCost ??
                      item.unitPrice ??
                      (item.quantity
                        ? (item.totalCost ?? 0) / item.quantity
                        : 0)
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {po.currency}{' '}
                  {fmtAmount(
                    item.totalCost ??
                      (item.unitCost ?? item.unitPrice ?? 0) * item.quantity
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50">
            <td
              colSpan={7}
              className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
            >
              Total
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
              {po.currency} {fmtAmount(totalCost)}
              <div>
                <BaseCurrencyEquivalent
                  amount={totalCost}
                  currency={po.currency}
                  className="font-normal"
                />
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
