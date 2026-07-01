import type { SalesOrder, SalesLineItem } from '@/services/salesOrder.service';

type DocType = 'quotation' | 'proforma';

function docTitle(so: SalesOrder, printType: DocType): string {
  if (printType === 'proforma') return 'PRO-FORMA INVOICE';
  return so.docType === 'quotation' ? 'QUOTATION' : 'SALES ORDER';
}

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  immediate: 'Immediate Payment',
  net_7: 'Net 7 Days',
  net_15: 'Net 15 Days',
  net_30: 'Net 30 Days',
  net_45: 'Net 45 Days',
  net_60: 'Net 60 Days',
  end_of_month: 'End of Month',
};

const COMPANY_NAME = 'DrinksHarbour';
const COMPANY_ADDRESS = '39 Gana St, Maitama, Abuja, Nigeria';
const COMPANY_EMAIL = 'accounts@drinksharbour.com';

function isNonProductLine(item: SalesLineItem): boolean {
  return item.lineType === 'section' || item.lineType === 'note';
}

function fmtDate(s?: string): string {
  if (!s) return '\u2014';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtAmt(n: number | undefined, cur = 'NGN'): string {
  return `${cur} ${(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function addressLines(a: { street?: string; city?: string; state?: string; country?: string } | undefined): string[] {
  if (!a) return [];
  const street = (a.street ?? '').trim();
  const loc = [a.city, a.state, a.country].filter(Boolean).join(', ');
  return [street, loc].filter(Boolean);
}

function sectionSubtotals(items: SalesLineItem[]): Map<string, number> {
  const out = new Map<string, number>();
  let cur: string | null = null;
  for (const it of items) {
    if (it.lineType === 'section') {
      cur = it._id;
      out.set(cur, 0);
      continue;
    }
    if (it.lineType !== 'product') continue;
    if (cur) out.set(cur, (out.get(cur) ?? 0) + (it.lineTotal || 0));
  }
  return out;
}

function buildDocHtml(so: SalesOrder, docType: DocType): string {
  const title = docTitle(so, docType);
  const subtotals = sectionSubtotals(so.items);
  const ship = so.deliveryAddress;
  const invAddr = so.invoiceAddress;
  const showShipTo =
    !!ship &&
    (ship.name || ship.street || ship.city || ship.state) &&
    JSON.stringify(ship) !== JSON.stringify(invAddr);

  const productLines = so.items.filter((i) => !isNonProductLine(i));
  const untaxed = productLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const taxTotal =
    so.taxTotal ?? productLines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const discountTotal = so.discountTotal ?? 0;

  const invAddrLines = addressLines(invAddr);
  const shipAddrLines = addressLines(ship);

  const itemRows = so.items
    .map((item, i) => {
      if (item.lineType === 'section') {
        const sub = subtotals.get(item._id);
        return `<tr style="background:#f3f4f6">
          <td colspan="5" style="padding:6px 12px;font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e7eb">${item.name}</td>
          <td style="padding:6px 12px;text-align:right;font-size:10px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb">${typeof sub === 'number' ? `Subtotal ${fmtAmt(sub, so.currency)}` : ''}</td>
        </tr>`;
      }
      if (item.lineType === 'note') {
        return `<tr>
          <td colspan="6" style="padding:5px 12px;font-size:10px;color:#6b7280;font-style:italic;border-bottom:${i < so.items.length - 1 ? '1px solid #f3f4f6' : 'none'}">${item.description || item.name || ''}</td>
        </tr>`;
      }
      const rowBg = i % 2 === 1 ? 'background:#fafafa;' : '';
      return `<tr style="${rowBg}border-bottom:${i < so.items.length - 1 ? '1px solid #f3f4f6' : 'none'}">
        <td style="padding:9px 12px">
          <div style="font-size:12px;font-weight:600;color:#111827">${item.name ?? '\u2014'}</div>
          ${item.description ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px">${item.description}</div>` : ''}
          ${item.sku ? `<div style="font-size:9px;color:#d1d5db;font-family:monospace;margin-top:1px">${item.sku}</div>` : ''}
        </td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;color:#374151">${item.quantity}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;color:#374151">${fmtAmt(item.unitPrice, so.currency)}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;color:#374151">${item.discount > 0 ? (item.discountType === 'percentage' ? `${item.discount}%` : fmtAmt(item.discount, so.currency)) : '\u2014'}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;color:#374151">${item.taxRate ? `${item.taxRate}%` : '\u2014'}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:700;color:#111827">${fmtAmt(item.lineTotal, so.currency)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} · ${so.soNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#fff;color:#111827}
  @media print{@page{size:A4 portrait;margin:8mm}}
  table{width:100%;border-collapse:collapse}
</style>
</head>
<body>
<div style="background:#fff;overflow:hidden;max-width:820px;margin:0 auto">

  <!-- Red header band -->
  <div style="background:linear-gradient(135deg,#b91c1c 0%,#7f1d1d 100%);padding:20px 36px 16px;display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1">${COMPANY_NAME}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:5px;line-height:1.6">
        ${COMPANY_ADDRESS}<br>${COMPANY_EMAIL}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:3px">${title}</div>
      <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px">${so.soNumber}</div>
      <div style="display:inline-flex;align-items:center;margin-top:6px;background:rgba(255,255,255,0.15);color:#fff;padding:3px 12px;border-radius:99px;font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.25)">
        ${((so.docType === 'quotation' ? so.quoteStatus : so.orderStatus) ?? 'draft').toUpperCase()}
      </div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:20px 32px 24px">

    <!-- Address cards -->
    <div style="display:grid;grid-template-columns:${showShipTo ? '1fr 1fr 1fr' : '1fr 1fr'};gap:12px;margin-bottom:16px">

      <!-- Bill To -->
      <div style="border:1px solid #fecaca;border-top:3px solid #b91c1c;border-radius:8px;padding:10px 14px;background:#fff8f8">
        <div style="font-size:8px;font-weight:800;letter-spacing:0.16em;color:#b91c1c;text-transform:uppercase;margin-bottom:6px">Bill To</div>
        <div style="font-size:13px;font-weight:800;color:#111827;line-height:1.2">${so.customerSnapshot?.name ?? 'Walk-in Customer'}</div>
        ${so.customerSnapshot?.phone ? `<div style="font-size:10px;color:#6b7280;margin-top:3px">${so.customerSnapshot.phone}</div>` : ''}
        ${so.customerSnapshot?.email ? `<div style="font-size:10px;color:#6b7280">${so.customerSnapshot.email}</div>` : ''}
        ${invAddrLines.map((l) => `<div style="font-size:10px;color:#6b7280;margin-top:2px">${l}</div>`).join('')}
      </div>

      <!-- Deliver To -->
      ${showShipTo ? `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#fafafa">
        <div style="font-size:8px;font-weight:800;letter-spacing:0.16em;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Deliver To</div>
        <div style="font-size:13px;font-weight:800;color:#111827;line-height:1.2">${ship?.name ?? so.customerSnapshot?.name ?? '\u2014'}</div>
        ${ship?.phone ? `<div style="font-size:10px;color:#6b7280;margin-top:3px">${ship.phone}</div>` : ''}
        ${shipAddrLines.map((l) => `<div style="font-size:10px;color:#6b7280;margin-top:2px">${l}</div>`).join('')}
      </div>` : '<div></div>'}

      <!-- Issued By -->
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#fafafa">
        <div style="font-size:8px;font-weight:800;letter-spacing:0.16em;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Issued By</div>
        <div style="font-size:13px;font-weight:800;color:#111827;line-height:1.2">${COMPANY_NAME}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:3px">${COMPANY_ADDRESS}</div>
        <div style="font-size:10px;color:#6b7280">${COMPANY_EMAIL}</div>
      </div>
    </div>

    <!-- Meta band -->
    <div style="display:flex;gap:0;margin-bottom:16px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6;overflow:hidden">
      ${[
        { label: 'Issue Date', value: fmtDate(so.createdAt) },
        { label: 'Valid Until', value: fmtDate(so.validUntil) },
        { label: 'Payment Terms', value: PAYMENT_TERMS_LABEL[so.paymentTerms ?? ''] ?? 'Immediate Payment' },
        { label: 'Currency', value: so.currency ?? 'NGN' },
      ].map(({ label, value }, i, arr) => `
      <div style="flex:1;padding:10px 14px;border-right:${i < arr.length - 1 ? '1px solid #e5e7eb' : 'none'}">
        <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:3px">${label}</div>
        <div style="font-size:11px;font-weight:700;color:#1f2937">${value}</div>
      </div>`).join('')}
    </div>

    <!-- Line items table -->
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <table>
        <thead>
          <tr style="background:#b91c1c">
            ${[
              { label: 'Item', align: 'left', w: '35%' },
              { label: 'Qty', align: 'right', w: '8%' },
              { label: 'Unit Price', align: 'right', w: '17%' },
              { label: 'Discount', align: 'right', w: '13%' },
              { label: 'Tax', align: 'right', w: '9%' },
              { label: 'Total', align: 'right', w: '18%' },
            ].map(({ label, align, w }) => `
            <th style="padding:8px 12px;font-size:8px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.12em;text-align:${align};width:${w}">${label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          ${discountTotal > 0 ? `
          <tr style="background:#fff">
            <td colspan="5" style="padding:6px 12px;text-align:right;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Subtotal</td>
            <td style="padding:6px 12px;text-align:right;font-size:12px;color:#374151">${fmtAmt(untaxed, so.currency)}</td>
          </tr>
          <tr style="background:#fff">
            <td colspan="5" style="padding:4px 12px;text-align:right;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Discount</td>
            <td style="padding:4px 12px;text-align:right;font-size:12px;color:#dc2626">\u2212${fmtAmt(discountTotal, so.currency)}</td>
          </tr>` : ''}
          ${taxTotal > 0 ? `
          <tr style="background:#fff">
            <td colspan="5" style="padding:4px 12px;text-align:right;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Tax</td>
            <td style="padding:4px 12px;text-align:right;font-size:12px;color:#374151">${fmtAmt(taxTotal, so.currency)}</td>
          </tr>` : ''}
          <tr style="border-top:2px solid #e5e7eb;background:#f9fafb">
            <td colspan="5" style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em">Total</td>
            <td style="padding:10px 12px;text-align:right;font-size:15px;font-weight:900;color:#111827">${fmtAmt(so.total, so.currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Notes / Terms -->
    ${(so.notes || so.terms) ? `
    <div style="display:grid;grid-template-columns:${so.notes && so.terms ? '1fr 1fr' : '1fr'};gap:12px;margin-bottom:20px">
      ${so.terms ? `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#f9fafb">
        <div style="font-size:8px;font-weight:800;color:#9ca3af;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:5px">Terms &amp; Conditions</div>
        <div style="font-size:11px;color:#374151;line-height:1.6;white-space:pre-wrap">${so.terms}</div>
      </div>` : ''}
      ${so.notes ? `
      <div style="padding:10px 14px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b">
        <div style="font-size:8px;font-weight:800;color:#92400e;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:5px">Notes</div>
        <div style="font-size:11px;color:#78350f;line-height:1.6;white-space:pre-wrap">${so.notes}</div>
      </div>` : ''}
    </div>` : ''}

    <!-- Pro-forma disclaimer -->
    ${docType === 'proforma' ? `
    <div style="margin-bottom:16px;padding:8px 14px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">
      <div style="font-size:10px;color:#1e40af;line-height:1.5">
        <strong>Pro-Forma Invoice:</strong> This document is issued for advance payment or customs purposes only and does not constitute a tax invoice. A formal VAT invoice will be issued upon confirmation and delivery.
      </div>
    </div>` : ''}

    <!-- Signature lines -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:8px">
      ${['Authorised by (DrinksHarbour)', 'Accepted by (Customer)'].map((label) => `
      <div>
        <div style="border-top:1.5px solid #e5e7eb;padding-top:10px">
          <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">${label}</div>
          <div style="margin-top:24px;font-size:9px;color:#e5e7eb">Name / Date / Stamp</div>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Footer band -->
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:10px 36px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#9ca3af">Generated ${fmtDate(new Date().toISOString())}</div>
    <div style="font-size:9px;color:#d1d5db;letter-spacing:0.06em;font-weight:600">DRINKSHARBOUR · ${so.soNumber}</div>
    <div style="font-size:9px;color:#9ca3af">${COMPANY_EMAIL}</div>
  </div>

</div>
</body>
</html>`;
}

export function printSalesDoc(so: SalesOrder, docType: DocType = 'quotation'): void {
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) return;
  win.document.write(buildDocHtml(so, docType));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

export function printSalesDocs(orders: SalesOrder[], docType: DocType = 'quotation'): void {
  if (orders.length === 0) return;
  if (orders.length === 1) return printSalesDoc(orders[0], docType);
  const pages = orders.map((o, i) => {
    const html = buildDocHtml(o, docType);
    const body = html.replace(/[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '');
    return `<div style="page-break-after:${i < orders.length - 1 ? 'always' : 'avoid'}">${body}</div>`;
  });
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}@media print{@page{size:A4 portrait;margin:8mm}}</style></head><body>${pages.join('')}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}
