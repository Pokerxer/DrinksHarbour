/**
 * Shared invoice builder — single source of truth for all invoice HTML generation
 * and print logic across POS orders, POS sessions, and product history panels.
 */

export interface InvoiceStore {
  name: string;
  logoSrc?: string;
  address?: string[];
  bankAccounts?: { bankName: string; accountNumber?: string; accountName?: string }[];
}

export interface InvoiceItem {
  name?: string;
  product?: { name?: string };
  variant?: string;
  quantity?: number;
  priceAtPurchase?: number;
  itemSubtotal?: number;
  discountAmount?: number;
  /** per-item refunded qty, used by POS order-detail */
  refundedQty?: number;
}

export interface InvoiceOrder {
  receiptNumber?: string;
  orderNumber?: string;
  placedAt?: string;
  createdAt?: string;
  total?: number;
  totalAmount?: number;
  subtotal?: number;
  discountTotal?: number;
  isVoided?: boolean;
  paymentMethod?: string;
  paymentDetails?: {
    splitPayments?: { method: string; amount: number }[];
    change?: number;
  };
  posStaff?: { firstName?: string; lastName?: string; posName?: string } | null;
  staff?: { name?: string } | null;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  refunds?: { totalRefunded?: number }[];
  items?: InvoiceItem[];
}

export const DEFAULT_STORE: InvoiceStore = {
  name: 'DRINKS HARBOUR',
  logoSrc: '/logo.png',
  address: ['Nigeria', '39 Gana Street, Maitama, Abuja'],
};

// ─────────────────────────────────────────────────────────────────────────────

function ng(v: number) {
  return `₦${Number(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cap(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function itemName(it: InvoiceItem): string {
  return it.product?.name || it.name || '—';
}

/** Returns derived values common to both HTML builder and React preview */
export function deriveInvoiceData(order: InvoiceOrder, store: InvoiceStore = DEFAULT_STORE) {
  const storeName  = store.name.toUpperCase();
  const logoSrc    = store.logoSrc || '/logo.png';
  const address    = store.address ?? DEFAULT_STORE.address ?? [];

  const amount     = order.totalAmount ?? order.total ?? 0;
  const subtotal   = order.subtotal ?? amount;
  const discount   = order.discountTotal ?? 0;
  const totalRefunded = (order.refunds ?? []).reduce((s, r) => s + (r.totalRefunded ?? 0), 0);
  const change     = order.paymentDetails?.change ?? 0;
  const splits     = order.paymentDetails?.splitPayments ?? [];

  const cashier = order.posStaff
    ? (order.posStaff.posName || `${order.posStaff.firstName || ''} ${order.posStaff.lastName || ''}`.trim())
    : (order.staff?.name || null);

  const hasCustomer  = !!(order.customer?.firstName && order.customer.firstName !== 'Walk-in');
  const customerName = hasCustomer
    ? `${order.customer!.firstName} ${order.customer!.lastName || ''}`.trim()
    : 'Walk-in Customer';
  const customerPhone = hasCustomer ? (order.customer?.phone || '') : '';

  const payLabel = splits.length > 0
    ? splits.map((s) => `${cap(s.method)} ${ng(s.amount)}`).join(' + ')
    : cap(order.paymentMethod || '');

  const dateStr = new Date(order.placedAt || order.createdAt || Date.now())
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const statusLabel = order.isVoided ? 'VOID'
    : totalRefunded >= amount && totalRefunded > 0 ? 'REFUNDED'
    : totalRefunded > 0 ? 'PART. REFUNDED'
    : 'PAID';
  const statusColor = order.isVoided ? '#64748b'
    : totalRefunded >= amount && totalRefunded > 0 ? '#dc2626'
    : totalRefunded > 0 ? '#d97706'
    : '#16a34a';

  const receiptRef = order.receiptNumber || order.orderNumber || '—';

  return {
    storeName, logoSrc, address, amount, subtotal, discount,
    totalRefunded, change, cashier, customerName, customerPhone,
    payLabel, dateStr, statusLabel, statusColor, receiptRef,
    items: order.items ?? [],
    hasOrderNum: !!(order.orderNumber && order.receiptNumber),
    orderNumber: order.orderNumber,
    bankAccounts: store.bankAccounts ?? [],
  };
}

// ── HTML string builder (for print popup) ────────────────────────────────────

export function buildInvoice(order: InvoiceOrder, store: InvoiceStore = DEFAULT_STORE): string {
  const d = deriveInvoiceData(order, store);

  const addrHtml   = d.address.map((l) => `<div>${l}</div>`).join('');
  const banksHtml  = d.bankAccounts.map((b) =>
    `<div style="margin-top:2px">${b.bankName}${b.accountNumber ? ` - ${b.accountNumber}` : ''}${b.accountName ? `<span style="color:#9ca3af;font-size:11px"> · ${b.accountName}</span>` : ''}</div>`
  ).join('');

  const itemRowsHtml = d.items.map((it, i) => {
    const qty     = it.quantity ?? 0;
    const price   = it.priceAtPurchase ?? 0;
    const total   = it.itemSubtotal ?? price * qty;
    const ret     = it.refundedQty ?? 0;
    const crossed = ret >= qty && ret > 0;
    const rowBg   = i % 2 === 1 ? 'background:#fafafa;' : '';
    return `
      <tr style="${rowBg}border-bottom:1px solid #f0f0f0;${crossed ? 'opacity:0.38;' : ''}">
        <td style="padding:10px 16px;font-size:13px;color:#111;${crossed ? 'text-decoration:line-through;' : ''}">
          <span style="font-weight:500">${itemName(it)}</span>${it.variant ? `<span style="color:#888;font-size:11px"> · ${it.variant}</span>` : ''}
          ${ret > 0 && !crossed ? `<div style="font-size:10px;color:#dc2626;margin-top:2px;font-weight:600">↩ ${ret} returned</div>` : ''}
        </td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;white-space:nowrap">${qty}.00 Units</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;font-variant-numeric:tabular-nums">${ng(price)}</td>
        <td style="padding:10px 16px;text-align:right;font-size:12px;color:#d1d5db">—</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#111;font-variant-numeric:tabular-nums">${ng(total)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <title>Invoice · ${d.receiptRef}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;background:#fff}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111}
    @media print{@page{size:A4;margin:14mm 16mm}}
    table{width:100%;border-collapse:collapse}
  </style>
  </head><body>
  <div style="max-width:820px;margin:0 auto;padding:44px 52px 120px">

    <div style="height:5px;background:linear-gradient(90deg,#b20202,#7f1d1d);border-radius:3px;margin-bottom:32px"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
      <img src="${d.logoSrc}" alt="${d.storeName}" style="height:54px;object-fit:contain;object-position:left center"
           onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div style=\\"font-size:20px;font-weight:900;color:#b20202\\">${d.storeName}</div>')">
      <div style="text-align:right;font-size:12px;line-height:1.9;color:#4b5563;max-width:300px">
        <div style="font-size:14px;font-weight:800;color:#111;letter-spacing:0.03em;margin-bottom:2px">${d.storeName}</div>
        ${addrHtml}${banksHtml}
      </div>
    </div>

    <div style="border-top:1px solid #e5e7eb;margin-bottom:24px"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Invoice</div>
        <div style="font-size:28px;font-weight:900;color:#b20202;letter-spacing:-0.5px;line-height:1">${d.receiptRef}</div>
        ${d.hasOrderNum ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">Order # ${d.orderNumber}</div>` : ''}
      </div>
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;background:${d.statusColor}18;color:${d.statusColor};border:1px solid ${d.statusColor}40;margin-top:4px">
        ${d.statusLabel}
      </span>
    </div>

    <div style="display:flex;gap:0;margin:22px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Order Date</div>
        <div style="font-size:13px;font-weight:600;color:#111">${d.dateStr}</div>
      </div>
      ${d.cashier ? `<div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Cashier</div>
        <div style="font-size:13px;font-weight:600;color:#111">${d.cashier}</div>
      </div>` : ''}
      <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Payment</div>
        <div style="font-size:13px;font-weight:600;color:#111;text-transform:capitalize">${d.payLabel || '—'}</div>
        ${d.change > 0 ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">Change: ${ng(d.change)}</div>` : ''}
      </div>
      <div style="flex:1;padding:12px 16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Customer</div>
        <div style="font-size:13px;font-weight:600;color:#111">${d.customerName}</div>
        ${d.customerPhone ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${d.customerPhone}</div>` : ''}
      </div>
    </div>

    <table style="margin-bottom:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          ${['Description','Quantity','Unit Price','Taxes','Amount'].map((h,i)=>
            `<th style="padding:10px 16px;text-align:${i===0?'left':'right'};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb${i<4?';white-space:nowrap':''}">${h}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>${itemRowsHtml}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:0;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
      <div style="width:340px">
        ${d.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
          <span style="color:#6b7280">Discount</span>
          <span style="color:#dc2626;font-weight:600">−${ng(d.discount)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
          <span style="color:#6b7280">Untaxed Amount</span>
          <span style="font-weight:600;color:#111">${ng(d.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:13px 16px;background:#b20202">
          <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em">Total</span>
          <span style="font-size:14px;font-weight:800;color:#fff">${ng(d.amount)}</span>
        </div>
        ${d.totalRefunded > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:9px 16px;border-top:1px solid #fee2e2;background:#fff5f5;font-size:12px">
          <span style="color:#dc2626">Total Returned</span>
          <span style="color:#dc2626;font-weight:700">−${ng(d.totalRefunded)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:9px 16px;background:#fff5f5;border-top:1px dashed #fecaca;font-size:12px">
          <span style="color:#6b7280">Net Paid</span>
          <span style="font-weight:700;color:#111">${ng(Math.max(0, d.amount - d.totalRefunded))}</span>
        </div>` : ''}
      </div>
    </div>

    <div style="margin-top:28px;font-size:12px;color:#6b7280">
      <span style="font-weight:600;color:#374151">Terms &amp; Conditions: </span>
      <span style="color:#b20202">https://www.drinksharbour.com/terms</span>
    </div>
    <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af">
      <span>No Return Of Drinks</span><span>Page 1 / 1</span>
    </div>

  </div>
  </body></html>`;
}

// ── Print helper ──────────────────────────────────────────────────────────────

export function printInvoice(order: InvoiceOrder, store: InvoiceStore = DEFAULT_STORE): void {
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) return;
  win.document.write(buildInvoice(order, store));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

/** Print multiple orders, each on its own A4 page */
export function printInvoices(orders: InvoiceOrder[], store: InvoiceStore = DEFAULT_STORE): void {
  if (orders.length === 0) return;
  if (orders.length === 1) return printInvoice(orders[0], store);
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) return;
  const pages = orders.map((o, i) => {
    const html = buildInvoice(o, store);
    const body = html.replace(/[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '');
    return `<div style="page-break-after:${i < orders.length - 1 ? 'always' : 'avoid'}">${body}</div>`;
  });
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}@media print{@page{size:A4;margin:14mm 16mm}}</style></head><body>${pages.join('')}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}
