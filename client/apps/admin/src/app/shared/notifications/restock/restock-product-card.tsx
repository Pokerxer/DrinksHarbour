import { PiArrowUpRight, PiMapPin } from 'react-icons/pi';
import ProductImage from '../warehouses/warehouse-product-image';
import { units } from '../insights/presentation';
import { validQuantity } from '../vendor-orders/order-draft';
import { matchesRestockStatus, type RestockRow } from './restock-rules';
export default function RestockProductCard({
  line,
  stock,
  onOpen,
}: {
  line: RestockRow;
  stock: boolean;
  onOpen: () => void;
}) {
  const offer = line.selected;
  const excluded = matchesRestockStatus(line, 'excluded');
  const valid = !!offer && validQuantity(offer.quantity, offer);
  const earlierSupply =
    stock &&
    offer?.quantity === 0 &&
    (offer.replenishment?.shortfallBeforeDelivery ?? 0) > 0;
  const manual = !valid || !!offer?.needsManualReview || earlierSupply;
  const status = excluded
    ? 'Excluded from order'
    : !offer
      ? line.alternatives?.length
        ? 'Choose supplier'
        : 'Needs supplier'
      : earlierSupply
        ? 'Earlier supply needed'
        : manual
          ? 'Review quantity'
          : offer.quantity === 0
            ? 'Covered by supply'
            : 'Order ready';
  const attention = stock && ['urgent', 'high'].includes(line.urgency || '');
  const planned = !offer
    ? 'Choose supplier'
    : !valid || (offer.needsManualReview && !line.quantityEdited)
      ? 'Review quantity'
      : `${units(offer.quantity)} units`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`View ${line.productName} ${line.sizeName} at ${line.warehouseName} restock details`}
      className={`group flex h-full w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${attention ? 'border-amber-200' : 'border-gray-200'}`}
    >
      <span className="flex w-full items-start gap-3">
        <ProductImage src={line.productImage} name={line.productName} />
        <span className="min-w-0 flex-1">
          <span
            role="heading"
            aria-level={3}
            className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900"
          >
            {line.productName}{' '}
            <span className="font-normal text-gray-500">{line.sizeName}</span>
          </span>
          <span className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <PiMapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{line.warehouseName}</span>
          </span>
          <span
            className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${excluded ? 'bg-gray-100 text-gray-600' : manual || !offer ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
          >
            {status}
          </span>
        </span>
      </span>
      <span className="mt-4 grid w-full grid-cols-2 gap-3 border-t border-gray-100 pt-3">
        {stock && (
          <span>
            <span className="block text-[11px] text-gray-500">
              Available now
            </span>
            <span className="mt-1 block text-lg font-semibold tabular-nums text-gray-900">
              {units(line.available)} units
            </span>
          </span>
        )}
        <span>
          <span className="block text-[11px] text-gray-500">Order units</span>
          <span className="mt-1 block text-lg font-semibold tabular-nums text-gray-900">
            {planned}
          </span>
        </span>
      </span>
      <span className="mt-3 inline-flex items-center gap-1 self-end text-xs font-semibold text-primary">
        View details{' '}
        <PiArrowUpRight
          aria-hidden
          className="h-4 w-4 transition group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}
