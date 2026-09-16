import type { POSSession } from '@/app/shared/point-of-sale/types';
import type { InvoiceOrder } from '../invoice';
import type { DocumentModel, DocCell } from './doc-model';
const money = (value = 0) =>
  `NGN ${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function buildPOSSessionDocument(
  session: POSSession,
  orders: InvoiceOrder[] = [],
  companyName = 'DRINKS HARBOUR',
  closing = false
): DocumentModel {
  const rows: DocCell[][] = [];
  const section = (text: string) => rows.push([{ text, strong: true }, { text: '' }]);
  const row = (label: string, value: string) => rows.push([{ text: label }, { text: value }]);
  section('Sales summary');
  row('Total sales', money(session.totalSales));
  row('Transactions', String(session.orderCount));
  if (orders.length)
    row(
      'Items sold',
      String(
        orders.reduce(
          (sum, order) =>
            sum + (order.items ?? []).reduce((n, item) => n + (item.quantity ?? 0), 0),
          0
        )
      )
    );
  section('Payment breakdown');
  for (const [label, value] of [
    ['Cash', session.cashSales],
    ['Card / POS', session.cardSales],
    ['Bank transfer', session.transferSales],
    ['Mobile money', session.mobileMoneySales],
    ['Split', session.splitSales],
  ] as [string, number][])
    row(label, money(value));
  if (orders.length) {
    section('Discounts, voids and refunds');
    row(
      'Discounted orders',
      String(orders.filter((o) => !o.isVoided && (o.discountTotal ?? 0) > 0).length)
    );
    row('Discounts', money(orders.reduce((sum, o) => sum + (o.discountTotal ?? 0), 0)));
    row('Voided orders', String(orders.filter((o) => o.isVoided).length));
    row(
      'Voided amount',
      money(
        orders
          .filter((o) => o.isVoided)
          .reduce((sum, o) => sum + (o.total ?? o.totalAmount ?? 0), 0)
      )
    );
    row('Refunded orders', String(orders.filter((o) => o.refunds?.length).length));
    row(
      'Refunded amount',
      money(
        orders.reduce(
          (sum, o) => sum + (o.refunds ?? []).reduce((n, r) => n + (r.totalRefunded ?? 0), 0),
          0
        )
      )
    );
  }
  section('Session control');
  row('Opening cash', money(session.openingCash));
  row(
    'Cash in',
    money(
      (session.cashMovements ?? []).filter((m) => m.type === 'in').reduce((n, m) => n + m.amount, 0)
    )
  );
  row(
    'Cash out',
    money(
      (session.cashMovements ?? [])
        .filter((m) => m.type === 'out')
        .reduce((n, m) => n + m.amount, 0)
    )
  );
  const minutes = Math.max(
    0,
    Math.floor(
      ((session.closedAt ? new Date(session.closedAt) : new Date()).getTime() -
        new Date(session.openedAt).getTime()) /
        60000
    )
  );
  row('Duration', `${Math.floor(minutes / 60)}h ${minutes % 60}m`);
  return {
    kind: 'invoice',
    companyName,
    department: 'Point of Sale',
    docTitle: closing ? 'Z-Report / Closing control' : 'Session report',
    number: session._id,
    status: session.status,
    parties: [],
    meta: [
      ['Opened', new Date(session.openedAt).toLocaleString('en-GB')],
      ['Closed', session.closedAt ? new Date(session.closedAt).toLocaleString('en-GB') : 'Open'],
      ['Terminal', session.terminalType || 'retail'],
    ],
    table: { columns: [{ label: 'Description' }, { label: 'Value', align: 'right' }], rows },
    totals: [],
    miniTables: [
      {
        title: 'Payment reconciliation',
        columns: [
          ['Method', 'left'],
          ['Expected', 'right'],
          ['Counted', 'right'],
          ['Difference', 'right'],
        ],
        rows: (session.methodBalances ?? []).map((m) => [
          { text: m.method.replaceAll('_', ' ') },
          { text: money(m.theoretical) },
          { text: m.counted == null ? 'Not counted' : money(m.counted) },
          { text: m.counted == null ? 'Not counted' : money(m.counted - m.theoretical) },
        ]),
      },
    ],
    sections: [
      {
        title: 'Session staff',
        body: `Opened by: ${session.openedBy?.posName || [session.openedBy?.firstName, session.openedBy?.lastName].filter(Boolean).join(' ')}`,
      },
      ...(session.notes ? [{ title: 'Opening notes', body: session.notes }] : []),
      ...(session.closingNotes ? [{ title: 'Closing notes', body: session.closingNotes }] : []),
      { title: 'Confidential', body: 'For internal records.' },
    ],
    signatures: [],
    fileName: `${closing ? 'z-report' : 'session-report'}-${session._id}.pdf`,
  };
}
