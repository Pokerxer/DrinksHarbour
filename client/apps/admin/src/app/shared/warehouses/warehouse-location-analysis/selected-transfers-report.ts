import { computeTransferTotals } from '@/app/shared/purchases/transfer-money';
import { flatRowSizeLabel } from '@/utils/size-variant-label';
import type { StockTransfer } from '@/services/stockTransfer.service';
import type { DocumentModel } from '@/utils/print/doc-model';

const amount = (value: number) =>
  value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const ref = (value: StockTransfer['sourceWarehouse']) =>
  typeof value === 'string' ? value : value._id;

/** Document quantities after returns, matching the individual transfer invoice. */
export function buildSelectedTransfersReport(
  transfers: StockTransfer[],
  warehouseId: string
): DocumentModel {
  const documents = [
    ...new Map(transfers.map((doc) => [doc._id, doc])).values(),
  ];
  if (!documents.length) throw new Error('Select at least one transfer.');
  const products = new Map<
    string,
    {
      name: string;
      variant: string;
      currency: string;
      quantity: number;
      value: number;
      tax: number;
      missingTax: boolean;
      missing: boolean;
    }
  >();
  const currencies = new Map<
    string,
    {
      quantity: number;
      value: number;
      tax: number;
      missingTax: boolean;
      total: number;
      missingCost: boolean;
      missingTotal: boolean;
    }
  >();
  for (const doc of documents) {
    if (
      ref(doc.sourceWarehouse) !== warehouseId &&
      ref(doc.destinationWarehouse) !== warehouseId
    )
      throw new Error(
        `Transfer ${doc.transferNumber} does not belong to this warehouse.`
      );
    const currency = doc.currency || 'NGN';
    const totals = currencies.get(currency) || {
      quantity: 0,
      value: 0,
      tax: 0,
      missingTax: false,
      total: 0,
      missingCost: false,
      missingTotal: false,
    };
    const savedTotal = doc.total ?? doc.totalValue;
    if (savedTotal === undefined || !Number.isFinite(savedTotal))
      totals.missingTotal = true;
    else totals.total += savedTotal;
    for (const item of doc.items) {
      const quantity = Math.max(0, item.quantity - (item.returnedQty ?? 0));
      const key = JSON.stringify([
        item.subProductId,
        item.sizeId || item.sizeName || '',
        currency,
      ]);
      const row = products.get(key) || {
        name: item.subProductName,
        // Full identity label (shared size-variant-label util, DRI-17). The
        // bucket key (L# key above) stays on sizeId || sizeName. Stored
        // sizeName-snapshot rows (all legacy beverage transfers) compose
        // byte-identically to the previous 'sizeName / sku' output.
        variant: [flatRowSizeLabel(item), item.sku].filter(Boolean).join(' / '),
        currency,
        quantity: 0,
        value: 0,
        tax: 0,
        missingTax: false,
        missing: false,
      };
      const missing =
        quantity > 0 &&
        (item.costPrice === undefined || !Number.isFinite(item.costPrice));
      const value = missing
        ? 0
        : Math.round(quantity * (item.costPrice ?? 0) * 100) / 100;
      const missingTax = missing && (item.taxRate ?? 0) !== 0;
      const tax = missingTax
        ? 0
        : computeTransferTotals([
            {
              quantity,
              costPrice: item.costPrice ?? 0,
              discountRate: item.discountRate,
              taxRate: item.taxRate,
            },
          ]).taxAmount;
      row.tax += tax;
      row.missingTax ||= missingTax;
      totals.tax += tax;
      totals.missingTax ||= missingTax;
      row.quantity += quantity;
      row.value += value;
      row.missing ||= missing;
      products.set(key, row);
      totals.quantity += quantity;
      totals.value += value;
      totals.missingCost ||= missing;
    }
    currencies.set(currency, totals);
  }
  const warehouse = documents
    .flatMap((doc) => [doc.sourceWarehouse, doc.destinationWarehouse])
    .find((value) => ref(value) === warehouseId);
  const warehouseName =
    typeof warehouse === 'object' ? warehouse.name : warehouseId;
  return {
    kind: 'transfer',
    companyName: warehouseName,
    department: 'Warehouse Analysis',
    docTitle: 'Combined Transfers',
    number: `${documents.length} selected transfers`,
    parties: [{ heading: 'Warehouse', name: warehouseName }],
    meta: [
      ['Selected transfers', String(documents.length)],
      ['Generated', new Date().toLocaleString('en-GB')],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Size / SKU' },
        { label: 'Currency' },
        { label: 'Net quantity', align: 'right' },
        { label: 'Avg. unit cost', align: 'right' },
        { label: 'Product value', align: 'right' },
        { label: 'Tax', align: 'right' },
      ],
      rows: [...products.values()]
        .sort(
          (a, b) =>
            a.currency.localeCompare(b.currency) ||
            a.name.localeCompare(b.name) ||
            a.variant.localeCompare(b.variant)
        )
        .map((row) =>
          [
            row.name,
            row.variant || '-',
            row.currency,
            row.quantity.toLocaleString('en-GB'),
            row.missing
              ? 'Unavailable'
              : amount(row.quantity ? row.value / row.quantity : 0),
            row.missing ? 'Unavailable' : amount(row.value),
            row.missingTax ? 'Unavailable' : amount(row.tax),
          ].map((text) => ({ text }))
        ),
    },
    totals: [...currencies].flatMap(([currency, totals]) => [
      {
        label: `${currency} net quantity`,
        value: totals.quantity.toLocaleString('en-GB'),
      },
      {
        label: `${currency} product value before adjustments`,
        value: totals.missingCost
          ? 'Unavailable'
          : `${currency} ${amount(totals.value)}`,
      },
      {
        label: `${currency} tax after returns`,
        value: totals.missingTax
          ? 'Unavailable'
          : `${currency} ${amount(totals.tax)}`,
      },
      {
        label: `${currency} transfer total after returns`,
        value: totals.missingTotal
          ? 'Unavailable'
          : `${currency} ${amount(totals.total)}`,
        variant: 'grand' as const,
      },
    ]),
    miniTables: [
      {
        title: 'Selected transfer documents',
        columns: [
          ['Reference', 'left'],
          ['Status', 'left'],
          ['From', 'left'],
          ['To', 'left'],
        ],
        rows: documents.map((doc) =>
          [
            doc.transferNumber,
            doc.status.replaceAll('_', ' '),
            typeof doc.sourceWarehouse === 'object'
              ? doc.sourceWarehouse.name
              : doc.sourceWarehouse,
            typeof doc.destinationWarehouse === 'object'
              ? doc.destinationWarehouse.name
              : doc.destinationWarehouse,
          ].map((text) => ({ text }))
        ),
      },
    ],
    sections: [
      {
        title: 'Calculation basis',
        body: 'Includes every product in the selected documents, regardless of product filters. Net quantity is document quantity less returns; it is not received quantity or current stock. Unit costs are weighted averages when prices differ. Product value is before discounts, tax and delivery. Tax is calculated per original line after discounts and returns, then combined; it is already included in the transfer total. Transfer totals use saved document values after returns. Draft, cancelled and other statuses remain as listed. Currencies are kept separate. Unavailable means a saved price or value is missing.',
      },
    ],
    signatures: [],
    fileName: 'Combined warehouse transfers.pdf',
  };
}
