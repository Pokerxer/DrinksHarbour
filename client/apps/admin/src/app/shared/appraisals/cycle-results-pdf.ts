import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppraisalCycle } from '@/services/appraisal.service';
import type { PeerProgress } from '@/services/peerAppraisal.service';
import { safeText } from '@/utils/print/pdf-text';
const percent = (n: number) => {
  if (!Number.isFinite(n))
    throw new Error('A saved result contains an invalid score.');
  return n.toFixed(2);
};
function money(minor: number) {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error('A saved result contains an invalid amount.');
  return `NGN ${(minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export const cycleResultsFileName = (name: string) =>
  `${
    name
      .replace(/[^a-z\d_-]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'cycle'
  }-results.pdf`;
export function buildCycleResultsPdf(
  cycle: AppraisalCycle,
  progress: PeerProgress,
  generatedAt = new Date()
) {
  if (cycle.status !== 'closed' || progress.status !== 'closed')
    throw new Error('Only closed cycles have final results to print.');
  if (
    !progress.total ||
    progress.participants.length !== progress.total ||
    progress.participants.some((p) => !p.result)
  )
    throw new Error(
      'Some employee results are missing. Refresh progress before downloading.'
    );
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
    compress: false,
  });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight();
  const people = [...progress.participants].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
  const periods = [
    ...new Set(
      people.flatMap((p) => {
        const c = p.result!.composite;
        return c
          ? [
              c.attendanceFrom && c.attendanceTo
                ? `${c.attendanceFrom} to ${c.attendanceTo}`
                : c.attendanceMonth || 'Saved attendance period',
            ]
          : [];
      })
    ),
  ];
  const weights = [
    ...new Set(
      people.map((p) => {
        const c = p.result!.composite;
        if (!c) return 'Appraisal 100%';
        const hasExam = c.examScore !== undefined && c.examScore !== null;
        const w = c.weights;
        return w
          ? `Appraisal ${w.appraisal}%, exam ${w.exam}%, attendance ${w.attendance}%`
          : hasExam
            ? 'Appraisal, exam and attendance equally weighted (legacy)'
            : 'Appraisal and attendance equally weighted (legacy)';
      })
    ),
  ];
  doc.setProperties({
    title: safeText(`${cycle.name} - Final appraisal results`),
    author: 'DrinksHarbour',
    subject: 'Confidential employee performance results',
  });
  const date = (value: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value);
  const header = () => {
    doc.setFillColor('#b20202').rect(0, 0, width, 7, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor('#111827');
    doc.text(
      safeText(
        doc.splitTextToSize(`${cycle.name} - Final results`, width - 80)[0]
      ),
      40,
      40
    );
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor('#6b7280');
    doc.text(
      safeText(
        `DrinksHarbour | Confidential | ${people.length} employees | Generated ${date(generatedAt)} WAT`
      ),
      40,
      57
    );
  };
  const body = people.map((p) => {
    const r = p.result!,
      c = r.composite;
    return [
      safeText(p.displayName),
      percent(c?.appraisalScore ?? r.averageScore * 20),
      c?.examScore == null ? 'Not assigned' : percent(c.examScore),
      c ? percent(c.attendanceScore) : 'Not applicable',
      percent(c?.combinedScore ?? r.averageScore * 20),
      money(r.allocationMinor),
      money(r.bonusMinor),
    ];
  });
  autoTable(doc, {
    startY: 77,
    margin: { top: 77, bottom: 44, left: 40, right: 40 },
    head: [
      [
        'Employee',
        'Appraisal /100',
        'Exam /100',
        'Attendance /100',
        'Total /100',
        'Allocation',
        'Bonus',
      ],
    ],
    body,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 7,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: { fillColor: [178, 2, 2], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 180 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });
  const notes = [
    `Cycle ID: ${cycle._id}${cycle.closedAt ? ` | Closed ${date(new Date(cycle.closedAt))} WAT` : ''}`,
    ...(periods.length
      ? [`Saved attendance period: ${periods.join('; ')}`]
      : []),
    ...weights,
    'Saved final scores only. Any owner-approved attendance cutoff applied at closure is retained. Later attendance changes are not included.',
    'Not assigned means no examination was required; it is not a zero score. Calculated bonuses do not confirm payment.',
  ];
  const last = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  let y = (last.lastAutoTable?.finalY ?? 77) + 20;
  for (const note of notes) {
    const lines = doc
      .setFontSize(8)
      .splitTextToSize(safeText(note), width - 80) as string[];
    if (y + lines.length * 11 > height - 44) {
      doc.addPage();
      y = 80;
    }
    doc
      .setFont('helvetica', 'normal')
      .setTextColor('#4b5563')
      .text(lines, 40, y, { lineHeightFactor: 1.35 });
    y += lines.length * 11 + 6;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    header();
    doc.setFontSize(8).setTextColor('#6b7280');
    doc.text('Confidential - Employee appraisal results', 40, height - 22);
    doc.text(
      `Page ${page} of ${doc.getNumberOfPages()}`,
      width - 40,
      height - 22,
      { align: 'right' }
    );
  }
  return doc;
}
