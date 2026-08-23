import type { Order } from '@/services/order.service';
import { customerOf } from './order-meta';

const CSV_COLUMNS: { header: string; value: (o: Order) => string | number }[] =
  [
    { header: 'Order Number', value: (o) => o.orderNumber },
    { header: 'Receipt Number', value: (o) => o.receiptNumber ?? '' },
    { header: 'Placed At', value: (o) => o.placedAt || o.createdAt || '' },
    { header: 'Customer', value: (o) => customerOf(o).name },
    { header: 'Contact', value: (o) => customerOf(o).contact },
    { header: 'Source', value: (o) => o.source ?? 'web' },
    {
      header: 'Items',
      value: (o) => o.items.reduce((s, i) => s + i.quantity, 0),
    },
    { header: 'Subtotal', value: (o) => o.subtotal ?? 0 },
    { header: 'Discount', value: (o) => o.discountTotal ?? 0 },
    { header: 'Shipping', value: (o) => o.shippingFee ?? 0 },
    { header: 'Tax', value: (o) => o.taxAmount ?? 0 },
    { header: 'Total', value: (o) => o.totalAmount ?? 0 },
    { header: 'Platform Profit', value: (o) => o.platformCommissionTotal ?? 0 },
    { header: 'Currency', value: (o) => o.currency ?? 'NGN' },
    { header: 'Status', value: (o) => o.status },
    { header: 'Payment Status', value: (o) => o.paymentStatus },
    { header: 'Payment Method', value: (o) => o.paymentMethod ?? '' },
    {
      header: 'Vendors',
      value: (o) =>
        Array.from(
          new Set(o.items.map((i) => i.tenant?.name).filter(Boolean))
        ).join(' | '),
    },
  ];

/** RFC-4180 quoting. The shared exportToCSV helper joins raw values with commas,
 *  which shifts every column the moment a customer name or address contains one. */
export function toCSV(orders: Order[]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    CSV_COLUMNS.map((c) => escape(c.header)).join(','),
    ...orders.map((o) => CSV_COLUMNS.map((c) => escape(c.value(o))).join(',')),
  ].join('\r\n');
}

export function downloadCSV(orders: Order[], fileName: string) {
  // A Blob URL keeps commas/newlines intact — encodeURI(data:) mangles them.
  // The BOM makes Excel read the ₦-friendly UTF-8 correctly.
  const blob = new Blob(['\ufeff', toCSV(orders)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
