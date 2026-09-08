import { CONTINUATION_TOP, drawContinuationHeader } from './templates/pdf-layout';
// Shared financial content; template selection only controls presentation.
import jsPDF from 'jspdf';
import type { DocumentModel } from './doc-model';
import { sanitize } from './pdf-text';
import { templateById } from './templates/registry';
import { drawHeader, drawFooter, color, line, M, W, H, CW, BOTTOM } from './templates/pdf-layout';
import { drawTable } from './templates/pdf-table';
import { drawTotals } from './templates/pdf-totals';
import { drawParties } from './templates/pdf-parties';
export { safeText } from './pdf-text';

export function renderDocument(model: DocumentModel, target?: jsPDF): jsPDF {
  const m = sanitize(model),
    t = templateById(m.templateId);
  const doc = target ?? new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  if (target) doc.addPage();
  const firstPage = doc.getNumberOfPages();
  if (!target)
    doc.setProperties({
      title: `${m.docTitle} ${m.number}`,
      subject: `${m.docTitle} | ${t.name}`,
      author: m.companyName,
      creator: 'DrinksHarbour ERM',
    });
  const top = t.headerHeight + 16;
  let y = top;
  const ensure = (height: number) => {
    if (y + height > BOTTOM) {
      doc.addPage();
      y = CONTINUATION_TOP;
    }
  };
  // Split text into page-sized chunks; never clip a long terms/notes section.
  const paragraph = (title: string, body: string) => {
    doc.setFont(t.font, 'normal').setFontSize(9);
    const lines = doc.splitTextToSize(body, CW - 16) as string[];
    let offset = 0;
    do {
      ensure(50);
      color(doc, t.accent);
      doc.setFont(t.font, 'bold').setFontSize(8);
      doc.text(title.toUpperCase() + (offset ? ' (CONTINUED)' : ''), M, y + 10);
      line(doc, M, y + 16, CW, t.secondary);
      const count = Math.max(1, Math.floor((BOTTOM - y - 30) / 12));
      const chunk = lines.slice(offset, offset + count);
      color(doc, '#374151');
      doc.setFont(t.font, 'normal').setFontSize(9);
      doc.text(chunk, M + 8, y + 30);
      y += 38 + chunk.length * 12;
      offset += count;
    } while (offset < lines.length);
  };
  y = drawParties(doc, m, t, y);
  if (m.meta.length) {
    y =
      drawTable(
        doc,
        t,
        m.meta.map(([label]) => ({ label })),
        [m.meta.map(([, value]) => ({ text: value }))],
        y,
        true
      ) + 14;
  }
  if (m.notice) paragraph(m.notice.title, m.notice.body);
  y = drawTable(doc, t, m.table.columns, m.table.rows, y) + 16;
  if (m.totals.length) {
    // Keep normal totals together when possible; oversized summaries paginate.
    ensure(Math.min(180, m.totals.length * 24 + 16));
    y = drawTotals(doc, m.totals, t, y) + 16;
  }
  if (m.words) paragraph('Amount in words', m.words);
  for (const table of m.miniTables ?? []) {
    ensure(60);
    paragraph(table.title, '');
    y =
      drawTable(
        doc,
        t,
        table.columns.map(([label, align]) => ({ label, align })),
        table.rows,
        y,
        true
      ) + 14;
  }
  for (const group of m.kvGroups ?? [])
    paragraph(group.title, group.items.map(([label, value]) => `${label}: ${value}`).join('\n'));
  for (const section of m.sections) paragraph(section.title, section.body);
  if (m.signatures.length) {
    ensure(90);
    y += 25;
    const width = CW / m.signatures.length;
    for (let i = 0; i < m.signatures.length; i++) {
      const signature = m.signatures[i];
      const x = M + i * width;
      line(doc, x, y, width - 20, t.secondary);
      color(doc, t.accent);
      doc.setFont(t.font, 'bold').setFontSize(8);
      doc.text(doc.splitTextToSize(signature.role, width - 20), x, y + 14);
      if (signature.name) {
        doc.setFont(t.font, 'normal');
        doc.text(doc.splitTextToSize(signature.name, width - 20), x, y + 38);
      }
    }
  }
  const total = doc.getNumberOfPages();
  for (let page = firstPage; page <= total; page++) {
    doc.setPage(page);
    if (m.watermark) {
      const GraphicsState = doc.GState as unknown as new (options: {
        opacity: number;
      }) => ReturnType<typeof doc.GState>;
      doc.saveGraphicsState();
      doc.setGState(new GraphicsState({ opacity: 0.08 }));
      color(doc, t.accent);
      doc.setFont(t.font, 'bold').setFontSize(65);
      doc.text(m.watermark, W / 2, H / 2, { align: 'center', angle: 30 });
      doc.restoreGraphicsState();
    }
    if (page === firstPage) drawHeader(doc, m, t);
    else drawContinuationHeader(doc, m, t);
    drawFooter(doc, m, t, page - firstPage + 1, total - firstPage + 1);
  }
  return doc;
}

export function renderDocuments(models: DocumentModel[]): jsPDF {
  if (!models.length) throw new Error('Select at least one document');
  return models.reduce<jsPDF | undefined>((doc, model) => renderDocument(model, doc), undefined)!;
}
