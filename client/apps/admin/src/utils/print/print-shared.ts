// Shared layout primitives for every printed purchase document.
// All builders return complete HTML strings opened by openPrint() in
// ../purchaseInvoice.ts — keep them print-CSS only, no JS beyond auto-print.

export const COMPANY = {
  name: 'DrinksHarbour',
  address: '39 Gana St, Maitama',
  city: 'Abuja, Nigeria',
  email: 'accounts@drinksharbour.com',
};

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtDate(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtAmt(n: number | undefined | null, currency: string): string {
  const safe = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  return `${currency} ${safe.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Amount in words ─────────────────────────────────────────────────────────

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
];
const TEENS = [
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty',
  'Ninety',
];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r < 10 && r > 0) parts.push(ONES[r]);
  else if (r >= 10 && r < 20) parts.push(TEENS[r - 10]);
  else if (r >= 20)
    parts.push(`${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ''}`);
  return parts.join(' ');
}

export function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    const w = threeDigits(groups[i]);
    words.push(SCALES[i] ? `${w} ${SCALES[i]}` : w);
  }
  return words.join(', ');
}

const CURRENCY_WORDS: Record<string, { major: string; minor: string }> = {
  NGN: { major: 'Naira', minor: 'Kobo' },
  USD: { major: 'Dollars', minor: 'Cents' },
  EUR: { major: 'Euros', minor: 'Cents' },
  GBP: { major: 'Pounds', minor: 'Pence' },
};

/** "4800000" → "Four Million, Eight Hundred Thousand Naira Only" */
export function moneyWords(amount: number, currency = 'NGN'): string {
  const { major, minor } = CURRENCY_WORDS[currency] ?? {
    major: currency,
    minor: '',
  };
  const safe = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const abs = Math.round(Math.abs(safe) * 100) / 100;
  const whole = Math.floor(abs);
  const frac = Math.round((abs - whole) * 100);
  const chunks: string[] = [];
  if (whole > 0 || frac === 0) chunks.push(`${numToWords(whole)} ${major}`);
  if (frac > 0) chunks.push(`${numToWords(frac)}${minor ? ` ${minor}` : ''}`);
  return `${chunks.join(', ')} Only`;
}

// ─── Print CSS ───────────────────────────────────────────────────────────────

export const BASE_STYLE = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%;background:#fff}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;padding:24px 32px;line-height:1.45}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  th{font-weight:600;text-align:left}
  td{vertical-align:top}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  tbody tr:nth-child(even){background:#fafafa}
  .chip{display:inline-block;padding:3px 12px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:1px solid}
  .doc-num{font-size:22px;font-weight:800;letter-spacing:-.4px;line-height:1.1}
  .meta-grid{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
  .meta-cell{flex:1 1 120px;border:1px solid #e5e7eb;border-radius:6px;padding:7px 11px}
  .meta-label{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px}
  .meta-value{font-weight:600;color:#111;font-size:12px}
  .totals{min-width:300px;margin-left:auto;margin-top:6px}
  .totals .row{display:flex;justify-content:space-between;gap:24px;padding:4px 0;color:#4b5563;font-size:12px}
  .totals .row.grand{border-top:2px solid #111;margin-top:5px;padding-top:7px;font-size:15px;font-weight:800;color:#111}
  .totals .row.strong{font-weight:700;color:#111}
  .section{border:1px solid #e5e7eb;border-radius:6px;padding:9px 13px;margin-top:10px;page-break-inside:avoid}
  .sec-title{font-size:9px;font-weight:800;color:#9ca3af;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
  .words{border:1px dashed #d1d5db;border-radius:6px;padding:8px 13px;margin-top:12px;font-style:italic;color:#374151;font-size:12px;background:#fcfcfc}
  .signatures{display:flex;gap:40px;margin-top:34px}
  .signatures>div{flex:1;border-top:1.5px solid #d1d5db;padding-top:6px}
  .sig-role{font-size:10px;color:#6b7280;font-weight:600}
  .sig-name{font-size:11px;color:#111;margin-top:2px}
  @media print{@page{size:A4;margin:12mm 14mm}body{padding:0}}
`;

// ─── Layout builders ─────────────────────────────────────────────────────────

const CHIP_COLORS: Record<string, string> = {
  paid: '#16a34a', overdue: '#dc2626', partial: '#d97706',
  confirmed: '#2563eb', draft: '#6b7280', cancelled: '#6b7280',
  cancel: '#6b7280', received: '#16a34a', validated: '#16a34a',
  completed: '#16a34a', approved: '#16a34a', refunded: '#059669',
  shipped: '#0891b2', in_transit: '#7c3aed', requested: '#2563eb',
  quoted: '#2563eb', sent: '#2563eb', pending: '#d97706',
  rejected: '#dc2626', expired: '#b45309', processing: '#d97706',
};

export function statusChip(status: string): string {
  const color = CHIP_COLORS[status] ?? '#6b7280';
  const label = status.replace(/_/g, ' ');
  return `<span class="chip" style="color:${color};background:${color}18;border-color:${color}55">${esc(label)}</span>`;
}

export function docHeader(o: {
  companyName: string;
  department: string;
  docTitle: string;
  number: string;
  status?: string;
}): string {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:18px">
    <div>
      <div style="font-size:19px;font-weight:800;letter-spacing:.2px">${esc(o.companyName)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">${esc(COMPANY.address)}, ${esc(COMPANY.city)} · ${esc(COMPANY.email)}</div>
      <div class="chip" style="margin-top:8px;color:#b20202;background:#b2020218;border-color:#b2020255">${esc(o.department)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;font-weight:800;letter-spacing:.18em;color:#9ca3af;text-transform:uppercase">${esc(o.docTitle)}</div>
      <div class="doc-num" style="margin-top:3px">${esc(o.number)}</div>
      ${o.status ? `<div style="margin-top:7px">${statusChip(o.status)}</div>` : ''}
    </div>
  <div></div></div>`;
}

export interface PartyBox {
  heading: string;
  name: string;
  lines?: string[];
}

export function partyGrid(a: PartyBox, b: PartyBox): string {
  const box = (p: PartyBox) => `
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div class="meta-label">${esc(p.heading)}</div>
      <div style="font-weight:700;color:#111;font-size:13px">${esc(p.name)}</div>
      ${(p.lines ?? [])
        .filter(Boolean)
        .map((l) => `<div style="font-size:10px;color:#6b7280;margin-top:2px">${esc(l)}</div>`)
        .join('')}
    </div>`;
  return `<div style="display:flex;gap:14px;margin-bottom:16px">${box(a)}${box(b)}</div>`;
}

export function metaGrid(cells: [string, string][]): string {
  return `<div class="meta-grid">${cells
    .map(
      ([label, value]) =>
        `<div class="meta-cell"><div class="meta-label">${esc(label)}</div><div class="meta-value">${value}</div></div>`
    )
    .join('')}</div>`;
}

export function itemsTable(
  headers: [string, 'left' | 'right' | 'center'][],
  rowsHtml: string,
  footHtml = ''
): string {
  return `<table style="margin-bottom:6px">
    <thead>
      <tr style="background:#b20202">
        ${headers
          .map(
            ([label, align], i) =>
              `<th style="padding:8px 10px;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.08em;text-align:${align}${i === 0 ? ';border-radius:4px 0 0 0' : ''}">${esc(label)}</th>`
          )
          .join('')}
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    ${footHtml ? `<tfoot>${footHtml}</tfoot>` : ''}
  </table>`;
}

export interface TotalRow {
  label: string;
  value: string;
  variant?: 'grand' | 'strong';
  color?: string;
}

export function totalsPanel(rows: TotalRow[]): string {
  if (!rows.length) return '';
  return `<div class="totals">${rows
    .map((r) => {
      const cls = r.variant ?? 'normal';
      const style = r.color ? `style="color:${r.color}"` : '';
      return `<div class="row ${cls}" ${cls !== 'grand' ? style : ''}><span>${esc(r.label)}</span><span ${cls === 'grand' ? style : ''}>${r.value}</span></div>`;
    })
    .join('')}</div>`;
}

export function wordsBox(text: string): string {
  return `<div class="words"><strong style="font-style:normal">Amount in words:</strong> ${esc(text)}</div>`;
}

export function notesSection(title: string, body: string): string {
  return `<div class="section"><div class="sec-title">${esc(title)}</div><div style="font-size:12px;color:#374151;white-space:pre-wrap">${esc(body)}</div></div>`;
}

export function signaturesRow(pairs: { role: string; name?: string }[]): string {
  return `<div class="signatures">${pairs
    .map(
      (p) =>
        `<div><div class="sig-role">${esc(p.role)}</div>${p.name ? `<div class="sig-name">✓ ${esc(p.name)}</div>` : '<div style="height:34px"></div>'}</div>`
    )
    .join('')}</div>`;
}

export function pageFooter(companyName: string, number: string): string {
  return `<div style="margin-top:26px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
    <span>${esc(companyName)} · ${esc(COMPANY.address)}, ${esc(COMPANY.city)}</span>
    <span>${esc(number)} · Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  </div>`;
}

export function docShell(opts: {
  title: string;
  style: string;
  watermark?: string;
  body: string;
}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(opts.title)}</title><style>${opts.style}</style></head><body>
  ${opts.watermark ?? ''}
  ${opts.body}
  <script>window.addEventListener('load',function(){window.print();});</script>
  </body></html>`;
}
