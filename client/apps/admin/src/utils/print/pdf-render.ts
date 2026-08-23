// Renders a DocumentModel into a real branded PDF (jsPDF). One document, one
// function — layout primitives live here, palette lives in pdf-theme, content
// lives in the *-print builders. Draws on every page: header band, watermark,
// footer with page numbers.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND, STATUS_COLORS, hexToRgb, mix, tint } from './pdf-theme';
import { COMPANY } from './print-shared';
import type { DocumentModel, DocCell, DocAlign } from './doc-model';

type RGB = [number, number, number];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 40;
const CW = PAGE_W - MX * 2; // content width
const BAND_H = 104;
const TOP = BAND_H + 28;
const BOTTOM = PAGE_H - 58;
/** Height reserved under a cell's main text for its secondary (SKU) line. */
const SUB_H = 9.5;

// ─── Text encoding ───────────────────────────────────────────────────────────
// jsPDF's built-in Helvetica is WinAnsi-encoded. Anything outside Latin-1 (plus
// the WinAnsi extras below) silently renders as an unrelated glyph — '✓' came
// out as an apostrophe and U+2212 MINUS as a double quote. Substitute what the
// builders actually emit rather than shipping garbage.

const WINANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹Œ' + 'Ž‘’“”•–—˜™š›' + 'œžŸ';

const SUBSTITUTES: Record<string, string> = {
  '✓': '', // ✓ — the renderer draws a vector tick instead
  '✔': '',
  '✗': 'x',
  '✘': 'x',
  '−': '-', // − MINUS SIGN
  '₦': 'NGN ', // ₦
  '→': '->',
  '≤': '<=',
  '≥': '>=',
};

export function safeText(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch.codePointAt(0)! <= 0xff || WINANSI_EXTRAS.includes(ch)) {
      out += ch;
      continue;
    }
    out += SUBSTITUTES[ch] ?? '?';
  }
  return out;
}

function safeCell(c: DocCell): DocCell {
  return {
    ...c,
    text: safeText(c.text),
    sub: c.sub == null ? c.sub : safeText(c.sub),
  };
}

/** Encoding-clean a whole model once, so no individual draw call can forget. */
function sanitize(m: DocumentModel): DocumentModel {
  const pair = ([a, b]: [string, string]): [string, string] => [
    safeText(a),
    safeText(b),
  ];
  return {
    ...m,
    companyName: safeText(m.companyName),
    department: safeText(m.department),
    docTitle: safeText(m.docTitle),
    number: safeText(m.number),
    parties: m.parties.map((p) => ({
      ...p,
      heading: safeText(p.heading),
      name: safeText(p.name),
      lines: p.lines?.map(safeText),
    })),
    meta: m.meta.map(pair),
    table: {
      columns: m.table.columns.map((c) => ({ ...c, label: safeText(c.label) })),
      rows: m.table.rows.map((r) => r.map(safeCell)),
    },
    miniTables: m.miniTables?.map((t) => ({
      ...t,
      title: safeText(t.title),
      columns: t.columns.map(
        ([l, a]) => [safeText(l), a] as [string, DocAlign]
      ),
      rows: t.rows.map((r) => r.map(safeCell)),
    })),
    kvGroups: m.kvGroups?.map((g) => ({
      ...g,
      title: safeText(g.title),
      items: g.items.map(pair),
    })),
    totals: m.totals.map((t) => ({
      ...t,
      label: safeText(t.label),
      value: safeText(t.value),
    })),
    words: m.words == null ? m.words : safeText(m.words),
    notice: m.notice && {
      ...m.notice,
      title: safeText(m.notice.title),
      body: safeText(m.notice.body),
    },
    sections: m.sections.map((s) => ({
      title: safeText(s.title),
      body: safeText(s.body),
    })),
    signatures: m.signatures.map((s) => ({
      role: safeText(s.role),
      name: s.name == null ? s.name : safeText(s.name),
    })),
    watermark: m.watermark == null ? m.watermark : safeText(m.watermark),
  };
}

// ─── Paint helpers ───────────────────────────────────────────────────────────
// jsPDF emits the text colour as a fill operator, so drawing any text clobbers
// the current fill. Every shape must therefore set its own fill/stroke
// immediately before drawing — never hoisted above a loop.

function paint(doc: jsPDF, hex: string): void {
  doc.setTextColor(...(hexToRgb(hex) as RGB));
}
function fill(doc: jsPDF, hex: string): void {
  doc.setFillColor(...(hexToRgb(hex) as RGB));
}
function stroke(doc: jsPDF, hex: string): void {
  doc.setDrawColor(...(hexToRgb(hex) as RGB));
}

function fmtDate(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Largest size at or below `base` at which `text` fits `maxW`. Leaves that size
 * active. Meta cards get narrow when a document carries six fields — silently
 * clipping the value there would drop real information.
 */
function fitSize(
  doc: jsPDF,
  text: string,
  maxW: number,
  base: number,
  min = 6
): number {
  let size = base;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) {
    size -= 0.3;
    doc.setFontSize(size);
  }
  return size;
}

/** Ellipsise `text` to `maxW` at the currently active font size. */
function clip(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function fitLine(
  doc: jsPDF,
  text: string,
  maxW: number,
  base: number,
  min = 6
): string {
  fitSize(doc, text, maxW, base, min);
  return clip(doc, text, maxW);
}

/**
 * One font size for a whole row of cards — the smallest any member needs. Sized
 * per-cell instead, a long value renders visibly smaller than its neighbours.
 */
function rowSize(
  doc: jsPDF,
  texts: string[],
  maxW: number,
  base: number,
  min: number,
  charSpace = 0
): number {
  return Math.min(
    ...texts.map((t) => fitSize(doc, t, maxW - t.length * charSpace, base, min))
  );
}

/** Status pill: tinted background, saturated border and text. */
function chip(
  doc: jsPDF,
  label: string,
  colorHex: string,
  x: number,
  y: number,
  alignRight = false
): void {
  doc.setFont('helvetica', 'bold').setFontSize(6.6);
  const text = label.toUpperCase();
  const w = doc.getTextWidth(text) + 16;
  const cx = alignRight ? x - w : x;
  doc.setFillColor(...(tint(colorHex, 0.88) as RGB));
  stroke(doc, colorHex);
  doc.setLineWidth(0.6);
  doc.roundedRect(cx, y, w, 13, 6.5, 6.5, 'FD');
  paint(doc, colorHex);
  doc.text(text, cx + w / 2, y + 8.7, { align: 'center' });
}

/** Outlined pill for use on the red header band. */
function ghostChip(doc: jsPDF, label: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold').setFontSize(6.4);
  const text = label.toUpperCase();
  const w = doc.getTextWidth(text) + 15;
  doc.setFillColor(...(mix(BRAND.red, '#000000', 0.22) as RGB));
  doc.setDrawColor(...(mix(BRAND.red, '#ffffff', 0.4) as RGB));
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, 13, 6.5, 6.5, 'FD');
  doc.setTextColor(...(mix(BRAND.red, '#ffffff', 0.85) as RGB));
  doc.text(text, x + w / 2, y + 8.6, { align: 'center' });
}

function drawBand(doc: jsPDF, m: DocumentModel): void {
  fill(doc, BRAND.red);
  doc.rect(0, 0, PAGE_W, BAND_H, 'F');

  // Slanted deep-red panel carrying the document identity.
  const px = PAGE_W * 0.575;
  fill(doc, BRAND.redInk);
  doc.triangle(px - 30, BAND_H, px, 0, px, BAND_H, 'F');
  doc.rect(px, 0, PAGE_W - px, BAND_H, 'F');

  fill(doc, BRAND.redDark);
  doc.rect(0, BAND_H, PAGE_W, 3, 'F');
  fill(doc, BRAND.gold);
  doc.rect(0, BAND_H + 3, PAGE_W, 1.2, 'F');

  const leftW = px - MX - 44;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(fitLine(doc, m.companyName || COMPANY.name, leftW, 16, 11), MX, 40);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...(mix(BRAND.red, '#ffffff', 0.74) as RGB));
  doc.text(
    fitLine(doc, `${COMPANY.address}, ${COMPANY.city}`, leftW, 8),
    MX,
    55
  );
  doc.text(fitLine(doc, COMPANY.email, leftW, 8), MX, 66);

  ghostChip(doc, m.department, MX, 75);

  const rx = PAGE_W - MX;
  const rightW = PAGE_W - px - 22;
  doc.setFont('helvetica', 'bold').setFontSize(7.4);
  doc.setTextColor(...(mix(BRAND.redInk, '#ffffff', 0.6) as RGB));
  doc.text(m.docTitle.toUpperCase(), rx, 33, {
    align: 'right',
    charSpace: 1.1,
  });

  doc.setTextColor(255, 255, 255);
  doc.text(fitLine(doc, m.number, rightW, 18, 10), rx, 58, { align: 'right' });

  if (m.status)
    chip(
      doc,
      m.status.replace(/_/g, ' '),
      STATUS_COLORS[m.status] ?? BRAND.muted,
      rx,
      70,
      true
    );
}

function drawWatermark(doc: jsPDF, m: DocumentModel): void {
  if (!m.watermark) return;
  const color = STATUS_COLORS[m.watermark.toLowerCase()] ?? BRAND.muted;
  // Real transparency where available so the stamp sits *behind* the content
  // visually; the tinted fallback keeps older jsPDF builds readable.
  const withGState = (opacity: number): boolean => {
    const g = doc as unknown as { GState?: new (o: object) => unknown };
    if (typeof g.GState !== 'function') return false;
    try {
      doc.setGState(new g.GState({ opacity }) as never);
      return true;
    } catch {
      return false;
    }
  };
  const translucent = withGState(0.1);
  doc.setFont('helvetica', 'bold').setFontSize(76);
  doc.setTextColor(
    ...((translucent ? hexToRgb(color) : tint(color, 0.87)) as RGB)
  );
  doc.text(m.watermark, PAGE_W / 2, PAGE_H / 2 + 40, {
    align: 'center',
    angle: 30,
  });
  if (translucent) withGState(1);
}

function drawFooter(
  doc: jsPDF,
  m: DocumentModel,
  page: number,
  total: number
): void {
  const ly = BOTTOM + 14;
  stroke(doc, BRAND.line);
  doc.setLineWidth(0.6);
  doc.line(MX, ly, PAGE_W - MX, ly);
  fill(doc, BRAND.red);
  doc.rect(MX, ly - 1.5, 28, 3, 'F');

  doc.setFont('helvetica', 'normal').setFontSize(7.3);
  paint(doc, BRAND.faint);
  doc.text(
    `${m.companyName || COMPANY.name} · ${COMPANY.address}, ${COMPANY.city} · ${COMPANY.email}`,
    MX,
    ly + 14
  );
  doc.text(
    `${m.number} · Generated ${fmtDate(new Date())} · Page ${page} of ${total}`,
    PAGE_W - MX,
    ly + 14,
    { align: 'right' }
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────────

type CellHook = {
  section: string;
  row: { index: number };
  column: { index: number };
  cell: {
    styles: Record<string, unknown>;
    x: number;
    y: number;
    width: number;
    height: number;
    padding?: (n: string) => number;
  };
};

function parseCell(rows: DocCell[][], data: CellHook): void {
  if (data.section !== 'body') return;
  const c = rows[data.row.index]?.[data.column.index];
  if (!c) return;
  if (c.color) data.cell.styles.textColor = hexToRgb(c.color);
  if (c.strong) data.cell.styles.fontStyle = 'bold';
  if (!c.sub) return;
  // Reserve the secondary line as extra bottom padding rather than as a second
  // text line — padding is honoured whatever the main text wraps to, so the two
  // can never collide.
  data.cell.styles.valign = 'top';
  const p = data.cell.styles.cellPadding as
    | number
    | { top?: number; right?: number; bottom?: number; left?: number };
  data.cell.styles.cellPadding =
    typeof p === 'number'
      ? { top: p, right: p, bottom: p + SUB_H, left: p }
      : { ...p, bottom: (p?.bottom ?? 0) + SUB_H };
}

function drawCellSub(doc: jsPDF, rows: DocCell[][], data: CellHook): void {
  if (data.section !== 'body') return;
  const c = rows[data.row.index]?.[data.column.index];
  if (!c?.sub) return;
  const { cell } = data;
  const pad = (n: string, fallback: number) =>
    typeof cell.padding === 'function' ? cell.padding(n) : fallback;
  const halign = (cell.styles.halign as DocAlign) ?? 'left';
  const x =
    halign === 'right'
      ? cell.x + cell.width - pad('right', 6)
      : halign === 'center'
        ? cell.x + cell.width / 2
        : cell.x + pad('left', 6);
  doc.setFont('helvetica', 'normal').setFontSize(6.9);
  paint(doc, BRAND.faint);
  doc.text(c.sub, x, cell.y + cell.height - 5.4, { align: halign });
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

function drawMainTable(doc: jsPDF, m: DocumentModel, startY: number): number {
  const rows = m.table.rows;
  autoTable(doc, {
    startY,
    margin: { left: MX, right: MX, top: TOP, bottom: PAGE_H - BOTTOM },
    head: [m.table.columns.map((c) => c.label)],
    body: rows.map((r) => r.map((c) => c.text)),
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.4,
      cellPadding: { top: 5.5, bottom: 5.5, left: 7, right: 7 },
      textColor: hexToRgb(BRAND.body),
      lineColor: hexToRgb('#e8eaee'),
      lineWidth: 0.5,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: hexToRgb(BRAND.zebra) },
    headStyles: {
      fillColor: hexToRgb(BRAND.red),
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7.2,
      cellPadding: { top: 7, bottom: 7, left: 7, right: 7 },
      lineColor: hexToRgb(BRAND.redDark),
      lineWidth: 0.4,
    },
    columnStyles: Object.fromEntries(
      m.table.columns.map((c, i) => [
        i,
        { halign: (c.align ?? 'left') as DocAlign },
      ])
    ),
    didParseCell: (d) => parseCell(rows, d as never),
    didDrawCell: (d) => drawCellSub(doc, rows, d as never),
  });
  return finalY(doc);
}

function drawMiniTable(
  doc: jsPDF,
  mt: NonNullable<DocumentModel['miniTables']>[number],
  startY: number
): number {
  doc.setFont('helvetica', 'bold').setFontSize(7);
  paint(doc, BRAND.muted);
  doc.text(mt.title.toUpperCase(), MX, startY + 4, { charSpace: 0.4 });
  autoTable(doc, {
    startY: startY + 10,
    margin: { left: MX, right: MX, top: TOP, bottom: PAGE_H - BOTTOM },
    head: [mt.columns.map(([l]) => l)],
    body: mt.rows.map((r) => r.map((c) => c.text)),
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4,
      textColor: hexToRgb(BRAND.body),
      lineColor: hexToRgb('#e8eaee'),
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: hexToRgb(BRAND.panel),
      textColor: hexToRgb(BRAND.muted),
      fontStyle: 'bold',
      fontSize: 6.6,
    },
    columnStyles: Object.fromEntries(
      mt.columns.map(([, a], i) => [i, { halign: a as DocAlign }])
    ),
    didParseCell: (d) => parseCell(mt.rows, d as never),
    didDrawCell: (d) => drawCellSub(doc, mt.rows, d as never),
  });
  return finalY(doc);
}

// ─── Document ────────────────────────────────────────────────────────────────

export function renderDocument(model: DocumentModel): jsPDF {
  const m = sanitize(model);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({
    title: `${m.docTitle} ${m.number}`,
    subject: m.docTitle,
    author: m.companyName || COMPANY.name,
    creator: 'DrinksHarbour ERM',
  });

  let y = TOP;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  // ── Parties ────────────────────────────────────────────────────────────
  if (m.parties.length) {
    const gap = 12;
    const bw = (CW - gap * (m.parties.length - 1)) / m.parties.length;
    const rowsMax = Math.max(
      ...m.parties.map((p) => (p.lines ?? []).filter(Boolean).length)
    );
    const bh = 46 + rowsMax * 11;
    m.parties.forEach((p, i) => {
      const bx = MX + i * (bw + gap);
      const accent = i % 2 === 0 ? BRAND.red : BRAND.gold;
      fill(doc, BRAND.blush);
      doc.setDrawColor(...(mix(BRAND.red, '#ffffff', 0.84) as RGB));
      doc.setLineWidth(0.7);
      doc.roundedRect(bx, y, bw, bh, 4, 4, 'FD');
      fill(doc, accent);
      doc.rect(bx + 0.7, y + 5, 2.6, bh - 10, 'F');

      doc.setFont('helvetica', 'bold').setFontSize(6.6);
      paint(doc, BRAND.muted);
      doc.text(p.heading.toUpperCase(), bx + 14, y + 16, { charSpace: 0.5 });
      doc.setFont('helvetica', 'bold');
      paint(doc, BRAND.ink);
      doc.text(fitLine(doc, p.name, bw - 26, 10.5, 7.5), bx + 14, y + 32);
      doc.setFont('helvetica', 'normal');
      paint(doc, BRAND.muted);
      (p.lines ?? [])
        .filter(Boolean)
        .forEach((l, li) =>
          doc.text(fitLine(doc, l, bw - 26, 8), bx + 14, y + 44 + li * 11)
        );
    });
    y += bh + 13;
  }

  // ── Meta strip ─────────────────────────────────────────────────────────
  if (m.meta.length) {
    const gap = 7;
    const cw = (CW - gap * (m.meta.length - 1)) / m.meta.length;
    const ch = 32;
    doc.setFont('helvetica', 'bold');
    const labelSize = rowSize(
      doc,
      m.meta.map(([l]) => l.toUpperCase()),
      cw - 12,
      6.1,
      4.6,
      0.3
    );
    const valueSize = rowSize(
      doc,
      m.meta.map(([, v]) => v),
      cw - 12,
      8.8,
      5.4
    );
    m.meta.forEach(([label, value], i) => {
      const cx = MX + i * (cw + gap);
      // Set fill/stroke per card: the text drawn by the previous iteration has
      // already overwritten the fill colour.
      fill(doc, BRAND.zebra);
      stroke(doc, BRAND.line);
      doc.setLineWidth(0.5);
      doc.roundedRect(cx, y, cw, ch, 3, 3, 'FD');
      fill(doc, BRAND.red);
      doc.rect(cx + 3, y, cw - 6, 2, 'F');

      doc.setFont('helvetica', 'bold').setFontSize(labelSize);
      paint(doc, BRAND.faint);
      doc.text(clip(doc, label.toUpperCase(), cw - 12), cx + 6, y + 14, {
        charSpace: 0.3,
      });
      doc.setFontSize(valueSize);
      paint(doc, BRAND.ink);
      doc.text(clip(doc, value, cw - 12), cx + 6, y + 25);
    });
    y += ch + 14;
  }

  // ── Notice banner (backorder etc.) ─────────────────────────────────────
  if (m.notice) {
    const tones = {
      info: ['#eff6ff', '#bfdbfe', '#1d4ed8', '#1e3a8a'],
      warn: ['#fffbeb', '#fcd34d', '#b45309', '#78350f'],
    } as const;
    const [bg, bd, tt, tx] = tones[m.notice.tone];
    doc.setFont('helvetica', 'normal').setFontSize(8.6);
    const lines = doc.splitTextToSize(m.notice.body, CW - 30) as string[];
    const nh = 30 + lines.length * 11;
    fill(doc, bg);
    stroke(doc, bd);
    doc.setLineWidth(0.7);
    doc.roundedRect(MX, y, CW, nh, 4, 4, 'FD');
    fill(doc, tt);
    doc.rect(MX + 0.7, y + 4, 2.6, nh - 8, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(6.8);
    paint(doc, tt);
    doc.text(m.notice.title.toUpperCase(), MX + 14, y + 15, { charSpace: 0.5 });
    doc.setFont('helvetica', 'normal').setFontSize(8.6);
    paint(doc, tx);
    doc.text(lines, MX + 14, y + 27);
    y += nh + 14;
  }

  y = drawMainTable(doc, m, y) + 16;

  // ── Totals panel ───────────────────────────────────────────────────────
  if (m.totals.length) {
    const rowH = (t: (typeof m.totals)[number]) =>
      t.variant === 'grand' ? 27 : t.variant === 'strong' ? 19 : 16;
    const panelH = m.totals.reduce((h, t) => h + rowH(t), 12);
    const tw = 268;
    const x0 = PAGE_W - MX - tw;
    ensure(panelH + 8);
    fill(doc, BRAND.zebra);
    stroke(doc, BRAND.line);
    doc.setLineWidth(0.7);
    doc.roundedRect(x0, y, tw, panelH, 4, 4, 'FD');

    let ty = y + 6;
    for (const t of m.totals) {
      const h = rowH(t);
      if (t.variant === 'grand') {
        fill(doc, BRAND.red);
        doc.rect(x0 + 0.7, ty, tw - 1.4, h, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(9.2);
        doc.setTextColor(255, 255, 255);
        doc.text(t.label.toUpperCase(), x0 + 13, ty + h / 2 + 3.4, {
          charSpace: 0.4,
        });
        doc.setTextColor(255, 255, 255);
        doc.text(
          fitLine(doc, t.value, tw - 26 - doc.getTextWidth(t.label), 12, 8),
          PAGE_W - MX - 13,
          ty + h / 2 + 4,
          { align: 'right' }
        );
      } else {
        const strong = t.variant === 'strong';
        doc
          .setFont('helvetica', strong ? 'bold' : 'normal')
          .setFontSize(strong ? 9.4 : 8.6);
        paint(doc, t.color ?? (strong ? BRAND.ink : BRAND.muted));
        doc.text(t.label, x0 + 13, ty + h / 2 + 3);
        doc.setFont('helvetica', 'bold');
        paint(doc, t.color ?? (strong ? BRAND.ink : BRAND.body));
        doc.text(t.value, PAGE_W - MX - 13, ty + h / 2 + 3, { align: 'right' });
      }
      ty += h;
    }
    y += panelH + 14;
  }

  // ── Amount in words ────────────────────────────────────────────────────
  if (m.words) {
    doc.setFont('helvetica', 'italic').setFontSize(8.6);
    const lines = doc.splitTextToSize(m.words, CW - 34) as string[];
    const wh = 24 + lines.length * 11;
    ensure(wh + 8);
    fill(doc, BRAND.blush);
    doc.setDrawColor(...(mix(BRAND.gold, '#ffffff', 0.55) as RGB));
    doc.setLineWidth(0.6);
    doc.roundedRect(MX, y, CW, wh, 4, 4, 'FD');
    fill(doc, BRAND.gold);
    doc.rect(MX + 0.7, y + 4, 2.6, wh - 8, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(6.4);
    paint(doc, BRAND.muted);
    doc.text('AMOUNT IN WORDS', MX + 14, y + 14, { charSpace: 0.5 });
    doc.setFont('helvetica', 'italic').setFontSize(8.6);
    paint(doc, BRAND.ink);
    doc.text(lines, MX + 14, y + 26);
    y += wh + 14;
  }

  // ── Mini tables, key/value groups, sections, signatures ───────────────
  const blockGap = 14;

  for (const mt of m.miniTables ?? []) {
    ensure(64 + mt.rows.length * 18);
    y = drawMiniTable(doc, mt, y) + blockGap;
  }

  for (const g of m.kvGroups ?? []) {
    ensure(58);
    const inner = CW - 28;
    const iw = inner / Math.max(g.items.length, 1);
    const gh = 48;
    fill(doc, '#ffffff');
    stroke(doc, BRAND.line);
    doc.setLineWidth(0.7);
    doc.roundedRect(MX, y, CW, gh, 4, 4, 'FD');
    fill(doc, BRAND.red);
    doc.rect(MX + 0.7, y + 4, 2.6, gh - 8, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(6.8);
    paint(doc, BRAND.muted);
    doc.text(g.title.toUpperCase(), MX + 14, y + 15, { charSpace: 0.5 });
    doc.setFont('helvetica', 'bold');
    const kLabel = rowSize(
      doc,
      g.items.map(([l]) => l.toUpperCase()),
      iw - 12,
      6.2,
      5,
      0.3
    );
    const kValue = rowSize(
      doc,
      g.items.map(([, v]) => v),
      iw - 12,
      8.6,
      5.6
    );
    g.items.forEach(([label, value], i) => {
      const ix = MX + 14 + i * iw;
      doc.setFont('helvetica', 'bold').setFontSize(kLabel);
      paint(doc, BRAND.faint);
      doc.text(clip(doc, label.toUpperCase(), iw - 12), ix, y + 29, {
        charSpace: 0.3,
      });
      doc.setFontSize(kValue);
      paint(doc, BRAND.ink);
      doc.text(clip(doc, value, iw - 12), ix, y + 41);
    });
    y += gh + blockGap;
  }

  for (const s of m.sections) {
    doc.setFont('helvetica', 'normal').setFontSize(8.6);
    const lines = doc.splitTextToSize(s.body, CW - 32) as string[];
    const sh = 30 + lines.length * 11;
    ensure(sh + 6);
    fill(doc, BRAND.zebra);
    stroke(doc, BRAND.line);
    doc.setLineWidth(0.6);
    doc.roundedRect(MX, y, CW, sh, 4, 4, 'FD');
    fill(doc, BRAND.red);
    doc.rect(MX + 0.7, y + 4, 2.6, sh - 8, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(6.8);
    paint(doc, BRAND.muted);
    doc.text(s.title.toUpperCase(), MX + 14, y + 15, { charSpace: 0.5 });
    doc.setFont('helvetica', 'normal').setFontSize(8.6);
    paint(doc, BRAND.body);
    doc.text(lines, MX + 14, y + 27);
    y += sh + blockGap;
  }

  if (m.signatures.length) {
    ensure(76);
    y += 26;
    const gap = 22;
    const sw = (CW - gap * (m.signatures.length - 1)) / m.signatures.length;
    m.signatures.forEach((s, i) => {
      const sx = MX + i * (sw + gap);
      stroke(doc, '#cbd5e1');
      doc.setLineWidth(0.9);
      doc.line(sx, y, sx + sw, y);
      doc.setFont('helvetica', 'bold');
      paint(doc, BRAND.faint);
      doc.text(fitLine(doc, s.role.toUpperCase(), sw, 6.6, 5.2), sx, y + 12, {
        charSpace: 0.3,
      });
      if (s.name) {
        // Vector tick — Helvetica has no '✓' glyph in WinAnsi.
        stroke(doc, BRAND.green);
        doc.setLineWidth(1.3);
        doc.lines(
          [
            [2.4, 2.8],
            [5.6, -6.6],
          ],
          sx + 1,
          y + 19,
          [1, 1],
          'S'
        );
        doc.setFont('helvetica', 'bold');
        paint(doc, BRAND.green);
        doc.text(fitLine(doc, s.name, sw - 14, 8.4, 6.2), sx + 12, y + 23);
      }
    });
    y += 42;
  }

  // ── Per-page chrome ───────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawWatermark(doc, m);
    drawBand(doc, m);
    drawFooter(doc, m, p, total);
  }

  return doc;
}
