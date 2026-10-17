import type { SalesOrder } from '@/services/salesOrder.service';
import type { useSalesCreateForm } from './hooks/useSalesCreateForm';
import { soItemToDraftLine } from './sales-create-pricing-helpers';

// Read-only documents show booked amounts, even if a live price preview or
// newer pricelist response arrives after the document was loaded.
export function savedSalesForm(
  form: ReturnType<typeof useSalesCreateForm>,
  so: SalesOrder,
) {
  return {
    ...form,
    priced: so.items.map((item) => ({
      ...soItemToDraftLine(item),
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      taxAmount: item.taxAmount || 0,
    })),
    untaxedAmount: so.subtotal,
    discountTotal: so.discountTotal || 0,
    promotionTotal: so.promotionTotal || 0,
    taxTotal: so.taxTotal || 0,
    grandTotal: so.total,
    pricelistCartDiscount: so.pricelistCartDiscount || 0,
    shippingFee: so.shippingFee || 0,
  };
}
