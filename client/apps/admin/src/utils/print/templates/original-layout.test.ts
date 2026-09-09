import { expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { drawHeader } from './pdf-layout';
import { TEMPLATES } from './registry';
import { templateSample } from '@/app/shared/document-templates/template-sample';

it.each(TEMPLATES)(
  'retains the original slanted band and department badge in $name',
  (template) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
    drawHeader(
      doc,
      { ...templateSample(), department: 'Wholesale Sales', status: 'paid' },
      template
    );
    const output = doc.output();
    expect(output).toContain('(WHOLESALE SALES)');
    expect(output).toContain('(PAID)');
    // The original band covers the full page width, then adds a diagonal panel.
    const widths = Array.from(output.matchAll(/([\d.]+) -104\. re/g)).map((match) =>
      Number(match[1])
    );
    expect(widths.some((width) => Math.abs(width - 595.28) < 0.01)).toBe(true);
  }
);

import { drawTotals } from './pdf-totals';
import { drawMeta } from './pdf-meta';
it('preserves final totals when the original summary panel spans pages', () => {
  const doc = new jsPDF({ unit: 'pt', compress: false });
  drawTotals(
    doc,
    Array.from({ length: 100 }, (_, i) => ({ label: `Charge ${i}`, value: `NGN ${i}.00` })),
    TEMPLATES[0],
    730
  );
  expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  expect(doc.output()).toContain('(Charge 99)');
  expect(doc.output()).toContain('(NGN 99.00)');
});
it('metadata cards wrap onto another page without losing the last reference', () => {
  const doc = new jsPDF({ unit: 'pt', compress: false });
  drawMeta(
    doc,
    Array.from({ length: 12 }, (_, i) => [`Reference ${i}`, `REF-${i}`]),
    TEMPLATES[0],
    780
  );
  expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  expect(doc.output()).toContain('(REF-11)');
});
