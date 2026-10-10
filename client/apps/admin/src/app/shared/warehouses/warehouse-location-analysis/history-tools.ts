import type { HistoryKind, HistoryRow } from '@/services/warehouseHistory.service';
export function movementQuantity(row: HistoryRow) {
  if (row.stockChange !== undefined) return row.stockChange;
  if (row.status === 'adjusted') return null;
  return ['transfer_out', 'return_out', 'shipped'].includes(row.status)
    ? -Math.abs(row.quantity)
    : row.quantity;
}
export function datePreset(preset: 'week' | 'month' | 'all', now = new Date()) {
  if (preset === 'all') return { start: '', end: '' };
  const end = now.toISOString().slice(0, 10);
  const start = new Date(`${end}T00:00:00Z`);
  if (preset === 'week') start.setUTCDate(start.getUTCDate() - 6);
  else start.setUTCDate(1);
  return { start: start.toISOString().slice(0, 10), end };
}
export function historyCsv(rows: HistoryRow[], kind: HistoryKind) {
  const movements = kind === 'movements' || kind === 'transfer_movements';
  const headers = [
    'Reference',
    'Product / Location',
    'Created (UTC)',
    'Status',
    movements ? 'Stock change' : 'Historical quantity',
    ...(movements
      ? [
          'Recorded quantity',
          ...(kind === 'transfer_movements' ? ['Transferred in', 'Transferred out'] : []),
          'Balance before',
          'Balance after',
          'Recorded by',
        ]
      : [
          ...(kind === 'transfers' ? ['Transferred in', 'Transferred out'] : []),
          'Returned',
          ...(kind === 'purchases'
            ? [
                'Purchased after returns',
                'Received value',
                'Returned value',
                'Purchase value after returns',
              ]
            : []),
          'Whole document line/value total',
          'Currency',
        ]),
  ];
  // Quoting alone does not prevent spreadsheet formula execution.
  const cell = (value: string | number | null | undefined) => {
    let text = String(value ?? '');
    if (typeof value !== 'number' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    headers,
    ...rows.map((row) => [
      row.reference,
      row.description,
      row.date,
      row.status,
      movements ? movementQuantity(row) : row.quantity,
      ...(movements
        ? [
            row.quantity,
            ...(kind === 'transfer_movements'
              ? [row.transferInQuantity, row.transferOutQuantity]
              : []),
            row.balanceBefore,
            row.balanceAfter,
            row.actor,
          ]
        : [
            ...(kind === 'transfers' ? [row.transferInQuantity, row.transferOutQuantity] : []),
            row.returned,
            ...(kind === 'purchases'
              ? [
                  row.purchasedQuantity,
                  row.receivedAmount,
                  row.returnedAmount,
                  row.netPurchaseAmount,
                ]
              : []),
            row.amount,
            row.currency,
          ]),
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
export function downloadHistory(
  rows: HistoryRow[],
  kind: HistoryKind,
  warehouseId: string,
  page: number,
) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', historyCsv(rows, kind)], { type: 'text/csv;charset=utf-8;' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `warehouse-${warehouseId}-${kind}-page-${page}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
